"""
REST endpoints for chat — used to load data on page mount.

GET  /api/chat/conversations          — seller: list all unique conversations
GET  /api/chat/history/<room_id>      — both roles: paginated message history
POST /api/chat/room                   — customer: get/create room_id for a seller+product
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import verify_jwt_in_request, get_jwt

from shop.extensions import db
from shop.models import ChatMessage, User, Product
from shop.utils.api_response import error_response
from sqlalchemy import func, or_, and_

chat_bp = Blueprint('chat', __name__)


def _require_user():
    verify_jwt_in_request()
    claims = get_jwt()
    return User.query.filter_by(uuid=claims.get('user_uuid'), is_active=True).first()


def _make_room_id(id_a: int, id_b: int, product_id: int | None) -> str:
    lo, hi = min(id_a, id_b), max(id_a, id_b)
    return f"chat_{lo}_{hi}_{product_id or 0}"


def _serialize(msg: ChatMessage) -> dict:
    return {
        'uuid':          msg.uuid,
        'room_id':       msg.room_id,
        'sender_uuid':   msg.sender.uuid      if msg.sender   else None,
        'sender_name':   msg.sender.username  if msg.sender   else 'Unknown',
        'sender_photo':  msg.sender.profile_photo if msg.sender else None,
        'receiver_uuid': msg.receiver.uuid    if msg.receiver else None,
        'text':          msg.text,
        'is_read':       msg.is_read,
        'created_at':    msg.created_at.isoformat() if msg.created_at else None,
        'product_uuid':  msg.product.uuid if msg.product else None,
        'product_name':  msg.product.name if msg.product else None,
    }


# ── POST /api/chat/room ───────────────────────────────────────

@chat_bp.route('/room', methods=['POST'])
def get_or_create_room():
    """
    Customer calls this to get the room_id before opening the chat modal.
    Body: { seller_uuid, product_uuid? }
    """
    try:
        user = _require_user()
        if not user:
            return error_response('Authentication required', 401)

        data         = request.get_json(silent=True) or {}
        seller_uuid  = (data.get('seller_uuid')  or '').strip()
        product_uuid = (data.get('product_uuid') or '').strip()

        seller  = User.query.filter_by(uuid=seller_uuid, is_active=True).first()
        if not seller:
            return error_response('Seller not found', 404)

        product = (
            Product.query.filter_by(uuid=product_uuid, is_active=True).first()
            if product_uuid else None
        )

        room_id = _make_room_id(user.id, seller.id, product.id if product else None)

        return jsonify({
            'success': True,
            'room_id': room_id,
            'seller': {
                'uuid':          seller.uuid,
                'username':      seller.username,
                'profile_photo': seller.profile_photo,
            },
            'product': {
                'uuid': product.uuid,
                'name': product.name,
            } if product else None,
        }), 200

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        return error_response("An error occurred. Please try again.", 500)


# ── GET /api/chat/history/<room_id> ──────────────────────────

@chat_bp.route('/history/<room_id>', methods=['GET'])
def get_history(room_id: str):
    """Return last 50 messages for a room (both participants can call this)."""
    try:
        user = _require_user()
        if not user:
            return error_response('Authentication required', 401)

        # Verify user belongs to this room
        parts = room_id.split('_')
        if len(parts) < 4:
            return error_response('Invalid room_id', 400)
        try:
            lo, hi = int(parts[1]), int(parts[2])
        except ValueError:
            return error_response('Invalid room_id', 400)

        if user.id not in (lo, hi):
            return error_response('Access denied', 403)

        messages = (
            ChatMessage.query
            .filter_by(room_id=room_id, is_active=True)
            .order_by(ChatMessage.created_at.asc())
            .limit(50)
            .all()
        )

        return jsonify({
            'success':  True,
            'room_id':  room_id,
            'messages': [_serialize(m) for m in messages],
        }), 200

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        return error_response("An error occurred. Please try again.", 500)


# ── GET /api/chat/conversations ───────────────────────────────

@chat_bp.route('/conversations', methods=['GET'])
def get_conversations():
    """
    Seller: returns one entry per unique room_id, with the latest message
    and unread count.  Customers can also call this to see their own chats.
    """
    try:
        user = _require_user()
        if not user:
            return error_response('Authentication required', 401)

        # Find all room_ids where this user is a participant
        room_ids_q = (
            db.session.query(ChatMessage.room_id)
            .filter(
                or_(
                    ChatMessage.sender_id   == user.id,
                    ChatMessage.receiver_id == user.id,
                ),
                ChatMessage.is_active == True,
            )
            .distinct()
            .all()
        )
        room_ids = [r[0] for r in room_ids_q]

        conversations = []
        for room_id in room_ids:
            # Latest message
            latest = (
                ChatMessage.query
                .filter_by(room_id=room_id, is_active=True)
                .order_by(ChatMessage.created_at.desc())
                .first()
            )
            if not latest:
                continue

            # Unread count (messages sent TO this user)
            unread = ChatMessage.query.filter_by(
                room_id=room_id,
                receiver_id=user.id,
                is_read=False,
                is_active=True,
            ).count()

            # The other participant
            other_id = (
                latest.receiver_id
                if latest.sender_id == user.id
                else latest.sender_id
            )
            other = User.query.get(other_id)

            conversations.append({
                'room_id':      room_id,
                'other_user': {
                    'uuid':          other.uuid          if other else None,
                    'username':      other.username      if other else 'Unknown',
                    'profile_photo': other.profile_photo if other else None,
                    'role':          other.role.role_name if other and other.role else None,
                },
                'product': {
                    'uuid': latest.product.uuid if latest.product else None,
                    'name': latest.product.name if latest.product else None,
                } if latest.product else None,
                'last_message':      latest.text,
                'last_message_time': latest.created_at.isoformat() if latest.created_at else None,
                'unread_count':      unread,
            })

        # Sort by most recent message first
        conversations.sort(
            key=lambda c: c['last_message_time'] or '',
            reverse=True,
        )

        return jsonify({
            'success': True,
            'data':    conversations,
            'total':   len(conversations),
        }), 200

    except Exception as e:
        e_name = e.__class__.__name__
        e_str = str(e).lower()
        if 'jwt' in e_name.lower() or 'token' in e_name.lower() or 'auth' in e_name.lower() or 'signature' in e_name.lower() or 'cookie' in e_str or 'token' in e_str:
            return jsonify({'error': str(e)}), 401
        return error_response("An error occurred. Please try again.", 500)
