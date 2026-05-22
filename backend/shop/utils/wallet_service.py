"""
Shared ACID wallet helpers.
All functions must be called INSIDE an active db.session transaction.
The caller is responsible for commit/rollback.
"""
from shop.extensions import db
from shop.models import User, WalletTransaction, WalletTransactionType, Order


def credit_wallet(user: User, amount: float, description: str, order: Order | None = None) -> WalletTransaction:
    """
    Add `amount` to user.wallet_balance and write a CREDIT ledger entry.
    Raises ValueError if amount <= 0.
    """
    if amount <= 0:
        raise ValueError(f'Credit amount must be positive, got {amount}')

    user.wallet_balance = round(user.wallet_balance + amount, 2)

    txn = WalletTransaction(
        user_id          = user.id,
        amount           = round(amount, 2),
        transaction_type = WalletTransactionType.CREDIT,
        description      = description,
        order_id         = order.id if order else None,
        created_by       = user.id,
    )
    db.session.add(txn)
    return txn


def debit_wallet(user: User, amount: float, description: str, order: Order | None = None) -> WalletTransaction:
    """
    Deduct `amount` from user.wallet_balance and write a DEBIT ledger entry.
    Raises ValueError if amount <= 0 or balance insufficient.

    SECURITY: Re-reads the user row with SELECT ... FOR UPDATE inside the
    caller's transaction to prevent concurrent debits from racing past the
    balance check and driving the balance below zero.
    """
    if amount <= 0:
        raise ValueError(f'Debit amount must be positive, got {amount}')

    # Re-fetch with a row-level lock so concurrent transactions queue here
    # instead of both reading the same stale balance.
    locked_user = (
        db.session.query(User)
        .with_for_update()
        .filter(User.id == user.id)
        .first()
    )
    if locked_user is None:
        raise ValueError('User not found during wallet debit')

    if locked_user.wallet_balance < amount:
        raise ValueError(
            f'Insufficient wallet balance. Available: ₹{locked_user.wallet_balance:.2f}, '
            f'Requested: ₹{amount:.2f}'
        )

    locked_user.wallet_balance = round(locked_user.wallet_balance - amount, 2)
    # Keep the in-memory object in sync so callers see the updated value
    user.wallet_balance = locked_user.wallet_balance

    txn = WalletTransaction(
        user_id          = locked_user.id,
        amount           = round(amount, 2),
        transaction_type = WalletTransactionType.DEBIT,
        description      = description,
        order_id         = order.id if order else None,
        created_by       = locked_user.id,
    )
    db.session.add(txn)
    return txn


# ── Points rate: customer earns 5% of order total as wallet credit ────────────
LOYALTY_RATE = 0.05


def compute_loyalty_credit(order_total: float) -> float:
    """Return the wallet credit amount earned for a given order total."""
    return round(order_total * LOYALTY_RATE, 2)
