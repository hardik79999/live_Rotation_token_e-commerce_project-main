from __future__ import annotations
"""
shop/utils/scheduler.py — APScheduler background jobs.

Registered once in create_app() so jobs run inside the Flask app context.
"""
from shop.models import CartItem, Order, User

import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

# Module-level singleton — only one scheduler per process.
_scheduler: BackgroundScheduler | None = None


def init_scheduler(app) -> None:
    """
    Create and start the APScheduler BackgroundScheduler.
    Call this once from create_app() after all extensions are initialised.
    """
    global _scheduler

    if _scheduler is not None and _scheduler.running:
        return  # Already started (e.g. Flask reloader spawns a second process)

    _scheduler = BackgroundScheduler(daemon=True)

    # ── Job: Abandoned Cart Recovery ─────────────────────────────────────
    # Runs every hour.  Finds carts idle for > 24 h and sends one recovery
    # email per user (recovery_email_sent flag prevents repeat sends).
    _scheduler.add_job(
        func=lambda: _run_abandoned_cart_job(app),
        trigger=IntervalTrigger(hours=1),
        id='abandoned_cart_recovery',
        name='Abandoned Cart Recovery',
        replace_existing=True,
        misfire_grace_time=300,   # allow up to 5 min late start
    )

    _scheduler.start()
    logger.info('APScheduler started — abandoned cart job registered (every 1 h).')


def _run_abandoned_cart_job(app) -> None:
    """Execute the abandoned-cart scan inside a proper Flask app context."""
    with app.app_context():
        _abandoned_cart_recovery()


# ─────────────────────────────────────────────────────────────────────────────
# Core job logic
# ─────────────────────────────────────────────────────────────────────────────

def _abandoned_cart_recovery() -> None:
    """
    Find users whose cart has been idle for > 24 hours and who have NOT
    placed an order in the last 24 hours, then send them a single recovery
    email with a 10 % discount code.

    Safety guarantees:
    - recovery_email_sent = True prevents duplicate emails for the same cart.
    - The flag is reset to False whenever the user adds/updates a cart item
      (handled in cart API — see shop/user/api/cart.py).
    - We never email users whose cart was already cleared (is_active = False).
    """
    from shop.extensions import db
    from shop.utils.email_service import send_abandoned_cart_email
    from sqlalchemy import func

    cutoff = datetime.utcnow() - timedelta(hours=24)

    try:
        # ── Step 1: find user IDs with stale active carts ─────────────────
        # Group by user_id; take the MAX updated_at across all their items.
        # If the newest item is still older than the cutoff, the whole cart
        # is considered abandoned.
        stale_user_ids = (
            db.session.query(CartItem.user_id)
            .filter(
                CartItem.is_active           == True,
                CartItem.recovery_email_sent == False,
            )
            .group_by(CartItem.user_id)
            .having(func.max(CartItem.updated_at) < cutoff)
            .all()
        )

        if not stale_user_ids:
            logger.info('Abandoned cart job: no stale carts found.')
            return

        stale_ids = [row[0] for row in stale_user_ids]
        logger.info(f'Abandoned cart job: {len(stale_ids)} candidate user(s).')

        # ── Step 2: exclude users who placed an order in the last 24 h ────
        recent_buyers = (
            db.session.query(Order.user_id)
            .filter(Order.created_at >= cutoff)
            .distinct()
            .all()
        )
        recent_buyer_ids = {row[0] for row in recent_buyers}

        target_ids = [uid for uid in stale_ids if uid not in recent_buyer_ids]
        logger.info(f'Abandoned cart job: {len(target_ids)} user(s) to email after excluding recent buyers.')

        # ── Step 3: send email + mark flag ────────────────────────────────
        for user_id in target_ids:
            user = User.query.get(user_id)
            if not user or not user.is_active:
                continue

            cart_items = CartItem.query.filter_by(
                user_id=user_id, is_active=True
            ).all()
            if not cart_items:
                continue

            # Build a lightweight item list for the template
            items_data = []
            for ci in cart_items:
                p = ci.product
                if p and p.is_active:
                    # Primary image URL
                    primary_img = next(
                        (img.image_url for img in p.images if img.is_primary),
                        (p.images[0].image_url if p.images else None),
                    )
                    items_data.append({
                        'name':     p.name,
                        'price':    float(p.price),
                        'quantity': ci.quantity,
                        'subtotal': float(p.price) * ci.quantity,
                        'image':    primary_img,
                    })

            if not items_data:
                continue

            total = sum(i['subtotal'] for i in items_data)

            try:
                send_abandoned_cart_email(
                    user=user,
                    items=items_data,
                    total=total,
                    discount_code='COMEBACK10',
                )
                # Mark ALL active items for this user so we don't re-send
                CartItem.query.filter_by(
                    user_id=user_id, is_active=True
                ).update({'recovery_email_sent': True})
                db.session.commit()
                logger.info(f'Abandoned cart email sent to user {user.email}.')
            except Exception as mail_err:
                db.session.rollback()
                logger.error(f'Failed to send abandoned cart email to {user.email}: {mail_err}')

    except Exception as e:
        logger.error(f'Abandoned cart job error: {e}')
