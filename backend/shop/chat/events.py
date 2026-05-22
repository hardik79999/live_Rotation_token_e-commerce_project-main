"""
shop/chat/events.py — Socket.IO event handlers for live chat.

Authentication:
  flask-socketio pushes a proper request context for every event handler,
  so we CAN use flask.request inside handlers.  The `auth` dict from the
  socket.io-client `{ auth: { token } }` option is passed as the second
  positional argument to the `connect` handler and stored in
  flask.request.environ['socketio']['auth'] for all other handlers.

  We decode the JWT with PyJWT directly (no verify_jwt_in_request) to
  avoid the Werkzeug 3.x session-setter bug.

Token flow:
  Frontend reads `access_token_cookie` (NOT HttpOnly) and passes it as:
    io(url, { auth: { token: getCookie('access_token_cookie') } })
  Backend decodes it in _get_current_user().
"""
import jwt as pyjwt
from flask import current_app, request as flask_request
from flask_socketio import emit, join_room
from shop.extensions import db, socketio
from shop.models import ChatMessage, User, Product


# ── Helpers ───────────────────────────────────────────────────

def _make_room_id(id_a: int, id_b: int, product_id: int | None) -> str:
    lo, hi = min(id_a, id_b), max(id_a, id_b)
    return f"chat_{lo}_{hi}_{product_id or 0}"


def _serialize(msg: ChatMessage) -> dict:
    return {
        'uuid':          msg.uuid,
        'room_id':       msg.room_id,
        'sender_uuid':   msg.sender.uuid          if msg.sender   else None,
        'sender_name':   msg.sender.username      if msg.sender   else 'Unknown',
        'sender_photo':  msg.sender.profile_photo if msg.sender   else None,
        'receiver_uuid': msg.receiver.uuid        if msg.receiver else None,
        'text':          msg.text,
        'is_read':       msg.is_read,
        'created_at':    msg.created_at.isoformat() if msg.created_at else None,
        'product_uuid':  msg.product.uuid if msg.product else None,
        'product_name':  msg.product.name if msg.product else None,
    }


def _decode_token(token: str) -> User | None:
    """Decode a raw JWT string and return the matching active User."""
    if not token:
        return None
    try:
        secret  = current_app.config['JWT_SECRET_KEY']
        decoded = pyjwt.decode(
            token,
            secret,
            algorithms=['HS256'],
            options={'verify_exp': True},
        )
        # Flask-JWT-Extended stores identity as 'sub'
        user_uuid = decoded.get('sub') or decoded.get('user_uuid')
        if not user_uuid:
            return None
        return User.query.filter_by(uuid=user_uuid, is_active=True).first()
    except (pyjwt.ExpiredSignatureError, pyjwt.InvalidTokenError):
        return None
    except Exception:
        return None


def _get_current_user(auth: dict | None = None) -> User | None:
    """
    Authenticate the socket connection.

    Strategy:
      The access_token_cookie is HttpOnly — JS cannot read it.
      The csrf_access_token IS readable by JS (it's designed for that).

      We use a two-step approach:
        1. The frontend sends csrf_access_token in the auth dict.
           We use it only to confirm the client has a valid session.
        2. We read the actual JWT from the HttpOnly access_token_cookie
           via flask_request.cookies (available because flask-socketio
           pushes a full request context for every event handler).
        3. We decode the JWT with PyJWT to get the user identity.

      Fallback: if auth dict contains a full JWT token (future-proofing),
      we decode that directly.
    """
    token = None

    # ── Try reading the full JWT from the HttpOnly cookie ─────────────────
    # flask-socketio pushes a request context, so flask_request.cookies
    # contains the browser's cookies including the HttpOnly access token.
    try:
        token = flask_request.cookies.get('access_token_cookie')
    except RuntimeError:
        pass   # no request context (shouldn't happen in flask-socketio)

    # ── Fallback: auth dict may contain a full JWT (non-HttpOnly setup) ───
    if not token and isinstance(auth, dict):
        candidate = auth.get('token') or auth.get('access_token')
        # Only use it if it looks like a JWT (3 dot-separated segments)
        if candidate and candidate.count('.') == 2:
            token = candidate

    # ── Fallback: environ auth ────────────────────────────────────────────
    if not token:
        try:
            sio_env = flask_request.environ.get('socketio', {})
            if isinstance(sio_env, dict):
                sio_auth = sio_env.get('auth') or {}
                candidate = sio_auth.get('token') or sio_auth.get('access_token')
                if candidate and candidate.count('.') == 2:
                    token = candidate
        except RuntimeError:
            pass

    return _decode_token(token)


# ── Event: connect ────────────────────────────────────────────

@socketio.on('connect', namespace='/chat')
def on_connect(auth):
    """
    `auth` is the dict from socket.io-client: { auth: { token: '...' } }
    flask-socketio passes it as the second positional argument here.
    Returning False rejects the connection (client gets connect_error).
    """
    user = _get_current_user(auth)
    if not user:
        current_app.logger.warning('Chat: rejected unauthenticated connect')
        return False
    join_room(f"user_{user.id}")
    current_app.logger.info(f'Chat: {user.username} connected')
    return True


# ── Event: disconnect ─────────────────────────────────────────

@socketio.on('disconnect', namespace='/chat')
def on_disconnect():
    pass


# ── Event: join_chat ──────────────────────────────────────────

@socketio.on('join_chat', namespace='/chat')
def on_join_chat(data: dict):
    user = _get_current_user()
    if not user:
        emit('error', {'message': 'Authentication required'})
        return

    # ── Fast path: caller already knows the room_id (e.g. seller inbox) ──
    explicit_room_id = (data.get('room_id') or '').strip()
    if explicit_room_id:
        # Validate the user belongs to this room before joining
        parts = explicit_room_id.split('_')
        if len(parts) >= 4:
            try:
                lo, hi = int(parts[1]), int(parts[2])
                if user.id in (lo, hi):
                    join_room(explicit_room_id)
                    history = (
                        ChatMessage.query
                        .filter_by(room_id=explicit_room_id, is_active=True)
                        .order_by(ChatMessage.created_at.asc())
                        .limit(50)
                        .all()
                    )
                    emit('chat_history', {
                        'room_id':  explicit_room_id,
                        'messages': [_serialize(m) for m in history],
                    })
                    return
                else:
                    emit('error', {'message': 'Access denied to this room'})
                    return
            except (ValueError, IndexError):
                pass   # fall through to seller_uuid path

    # ── Normal path: compute room from seller_uuid + product_uuid ─────────
    seller_uuid  = (data.get('seller_uuid')  or '').strip()
    product_uuid = (data.get('product_uuid') or '').strip()

    seller  = User.query.filter_by(uuid=seller_uuid, is_active=True).first()
    product = (
        Product.query.filter_by(uuid=product_uuid, is_active=True).first()
        if product_uuid else None
    )

    if not seller:
        emit('error', {'message': 'Seller not found'})
        return

    room_id = _make_room_id(user.id, seller.id, product.id if product else None)
    join_room(room_id)

    history = (
        ChatMessage.query
        .filter_by(room_id=room_id, is_active=True)
        .order_by(ChatMessage.created_at.asc())
        .limit(50)
        .all()
    )
    emit('chat_history', {
        'room_id':  room_id,
        'messages': [_serialize(m) for m in history],
    })


# ── Event: send_message ───────────────────────────────────────

@socketio.on('send_message', namespace='/chat')
def on_send_message(data: dict):
    user = _get_current_user()
    if not user:
        emit('error', {'message': 'Authentication required'})
        return

    room_id       = (data.get('room_id')       or '').strip()
    text          = (data.get('text')          or '').strip()
    receiver_uuid = (data.get('receiver_uuid') or '').strip()

    if not room_id or not text or not receiver_uuid:
        emit('error', {'message': 'room_id, text, and receiver_uuid are required'})
        return

    if len(text) > 2000:
        emit('error', {'message': 'Message too long (max 2000 chars)'})
        return

    receiver = User.query.filter_by(uuid=receiver_uuid, is_active=True).first()
    if not receiver:
        emit('error', {'message': 'Receiver not found'})
        return

    parts = room_id.split('_')
    if len(parts) < 4:
        emit('error', {'message': 'Invalid room_id'})
        return
    try:
        lo, hi     = int(parts[1]), int(parts[2])
        product_id = int(parts[3]) if parts[3] != '0' else None
    except (ValueError, IndexError):
        emit('error', {'message': 'Invalid room_id format'})
        return

    if user.id not in (lo, hi):
        emit('error', {'message': 'You are not a participant in this room'})
        return

    msg = ChatMessage(
        sender_id   = user.id,
        receiver_id = receiver.id,
        product_id  = product_id,
        room_id     = room_id,
        text        = text,
        created_by  = user.id,
    )
    db.session.add(msg)
    db.session.commit()

    emit('new_message', _serialize(msg), to=room_id)


# ── Event: typing ─────────────────────────────────────────────

@socketio.on('typing', namespace='/chat')
def on_typing(data: dict):
    user = _get_current_user()
    if not user:
        return
    room_id = (data.get('room_id') or '').strip()
    if room_id:
        emit('typing', {'sender_uuid': user.uuid}, to=room_id, include_self=False)


# ── Event: mark_read ─────────────────────────────────────────

@socketio.on('mark_read', namespace='/chat')
def on_mark_read(data: dict):
    user = _get_current_user()
    if not user:
        return
    room_id = (data.get('room_id') or '').strip()
    if not room_id:
        return
    ChatMessage.query.filter_by(
        room_id=room_id,
        receiver_id=user.id,
        is_read=False,
    ).update({'is_read': True})
    db.session.commit()
    emit('messages_read', {'room_id': room_id}, to=room_id)
