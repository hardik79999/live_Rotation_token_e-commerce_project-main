"""
email_service.py
────────────────
Universal HTML email system for ShopHub.

Architecture
────────────
• send_templated_email()  — core utility: renders a Jinja2 template from
  shop/templates/email/ and sends it via Flask-Mail.  All other functions
  are thin wrappers that build the context dict and call this utility.

• Every email is sent with BOTH an HTML part and a plain-text fallback.
  If the HTML doesn't render, the user still sees the text + link.

• frontend_url is always an absolute URL read from FRONTEND_BASE_URL in
  config (set in .env).  Templates must never use relative paths.

• Every send_* function returns bool (True = sent, False = failed).
  Failures are logged but NEVER raise — they must not crash the API.

Template directory
──────────────────
  shop/templates/email/
    base.html                  ← master layout (header, footer, brand)
    welcome.html               ← new user registration
    password_reset_otp.html    ← forgot-password OTP
    order_confirmation.html    ← customer: order placed
    order_status_update.html   ← customer: status changed
    new_order_seller_alert.html← seller: new order received
    category_approved.html     ← seller: category approved/rejected/revoked
    seller_status_changed.html ← seller: account activated/blocked
"""

import textwrap
from datetime import datetime
from flask import current_app, render_template
from flask_mail import Message
from shop.extensions import mail
from shop.utils.url_builder import build_absolute_url, build_api_url


# ─────────────────────────────────────────────────────────────────────────────
# CORE UTILITY
# ─────────────────────────────────────────────────────────────────────────────

def send_templated_email(
    to: str | list[str],
    subject: str,
    template_name: str,
    plain_text: str = "",
    **context,
) -> bool:
    """
    Render a Jinja2 email template and send it as a multipart email
    (HTML + plain-text fallback) via Flask-Mail.

    Parameters
    ──────────
    to            : recipient email address or list of addresses
    subject       : email subject line
    template_name : filename inside shop/templates/email/
    plain_text    : plain-text fallback (shown when HTML can't render).
                    If omitted, a minimal fallback is auto-generated.
    **context     : variables passed to the Jinja2 template

    Returns True on success, False on any failure (never raises).
    """
    try:
        # ── Inject globals available in every template ────────────────────
        frontend_url  = current_app.config.get('FRONTEND_BASE_URL', 'http://127.0.0.1:5173')
        support_email = current_app.config.get('SUPPORT_EMAIL', 'support@shophub.in')

        context.setdefault('current_year',  datetime.utcnow().year)
        context.setdefault('support_email', support_email)
        context.setdefault('frontend_url',  frontend_url)
        # Expose build_absolute_url as a callable inside every template so
        # template authors can write {{ url('/user/orders') }} instead of
        # concatenating strings.
        context.setdefault('url', build_absolute_url)

        # ── Render HTML ───────────────────────────────────────────────────
        html_body = render_template(f"email/{template_name}", **context)

        # ── Build plain-text fallback ─────────────────────────────────────
        if not plain_text:
            plain_text = _auto_plain_text(subject, frontend_url, support_email)

        # ── Compose and send ──────────────────────────────────────────────
        recipients = [to] if isinstance(to, str) else to
        msg = Message(
            subject    = subject,
            sender     = current_app.config.get('MAIL_DEFAULT_SENDER', current_app.config['MAIL_USERNAME']),
            recipients = recipients,
        )
        msg.html = html_body
        msg.body = plain_text          # plain-text part — always set
        mail.send(msg)

        current_app.logger.info(
            f"Email sent | template={template_name} | to={recipients} | subject={subject!r}"
        )
        return True

    except Exception as e:
        current_app.logger.error(
            f"Email FAILED | template={template_name} | to={to} | error={e}"
        )
        return False


def _auto_plain_text(subject: str, frontend_url: str, support_email: str) -> str:
    """Minimal plain-text fallback used when the caller doesn't supply one."""
    return textwrap.dedent(f"""\
        {subject}
        ─────────────────────────────────────────
        ShopHub — India's Fastest Growing Marketplace

        This email was sent as HTML. If you're seeing this, your email
        client could not display the formatted version.

        Visit your account: {frontend_url}
        Need help? Email us: {support_email}

        © {datetime.utcnow().year} ShopHub · All rights reserved
    """)


# ─────────────────────────────────────────────────────────────────────────────
# 1. WELCOME / EMAIL VERIFICATION
#    Triggered by: shop/auth/api/signup.py
# ─────────────────────────────────────────────────────────────────────────────

def send_verification_email(user_email: str, token: str) -> bool:
    verification_link = build_api_url(f"/api/auth/verify/{token}")

    return send_templated_email(
        to            = user_email,
        subject       = "ShopHub: Verify your email address",
        template_name = "welcome.html",
        email_title   = "Email Verification",
        username      = user_email.split('@')[0],
        role          = "customer",
        verification_link = verification_link,
        plain_text    = textwrap.dedent(f"""\
            Welcome to ShopHub!
            ───────────────────
            Please verify your email address by visiting the link below.
            This link expires in 10 minutes.

            {verification_link}

            If you didn't create a ShopHub account, ignore this email.
        """),
    )


def send_welcome_email(user_email: str, username: str, role: str, token: str) -> bool:
    """
    Richer version — call this when you have the username and role available.
    """
    verification_link = build_api_url(f"/api/auth/verify/{token}")

    return send_templated_email(
        to            = user_email,
        subject       = f"ShopHub: Welcome, {username}! Verify your email",
        template_name = "welcome.html",
        email_title   = "Welcome to ShopHub",
        username      = username,
        role          = role,
        verification_link = verification_link,
        plain_text    = textwrap.dedent(f"""\
            Welcome to ShopHub, {username}!
            ────────────────────────────────
            Verify your email address to activate your account:

            {verification_link}

            This link expires in 10 minutes.
            If you didn't sign up, ignore this email.
        """),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 2. PASSWORD RESET OTP
#    Triggered by: shop/auth/api/forgot_password.py
# ─────────────────────────────────────────────────────────────────────────────

def send_otp_email(user_email: str, otp_code: str) -> bool:
    return send_templated_email(
        to            = user_email,
        subject       = "ShopHub: Your Password Reset OTP",
        template_name = "password_reset_otp.html",
        email_title   = "Password Reset",
        otp_code      = otp_code,
        plain_text    = textwrap.dedent(f"""\
            ShopHub Password Reset
            ──────────────────────
            Your one-time password (OTP) is:

                {otp_code}

            This OTP is valid for 10 minutes.
            Never share it with anyone — ShopHub will never ask for it.

            If you didn't request a reset, ignore this email.
        """),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 3. ORDER STATUS UPDATE  (sent to customer)
#    Triggered by: shop/seller/api/order_status.py
# ─────────────────────────────────────────────────────────────────────────────

_STATUS_META: dict[str, tuple[str, str, str]] = {
    # status: (headline, description, icon)
    "pending":    ("Order Received",           "We've received your order and it's being reviewed.",                              "🕐"),
    "processing": ("Order is Being Processed", "Your order has been confirmed and is being prepared for shipment.",               "📦"),
    "shipped":    ("Your Order is On the Way!", "Great news! Your package has been handed over to the courier.",                  "🚚"),
    "delivered":  ("Order Delivered!",          "Your order has been delivered. We hope you love it!",                           "🎉"),
    "cancelled":  ("Order Cancelled",           "Your order has been cancelled. If this was unexpected, please contact support.", "❌"),
}

_TIMELINE_STEPS = ["pending", "processing", "shipped", "delivered"]


def send_order_status_email(
    user_email: str,
    order_uuid: str,
    new_status: str,
    customer_name: str = "Valued Customer",
) -> bool:
    status_lower = new_status.lower()
    headline, description, icon = _STATUS_META.get(
        status_lower,
        (f"Order Update: {new_status.capitalize()}", "Your order status has been updated.", "📋"),
    )

    current_idx = _TIMELINE_STEPS.index(status_lower) if status_lower in _TIMELINE_STEPS else -1
    timeline_steps = [
        {
            "label":      step,
            "is_done":    i <= current_idx,
            "is_current": i == current_idx,
        }
        for i, step in enumerate(_TIMELINE_STEPS)
    ]

    short_id     = order_uuid[:8].upper()
    orders_url   = build_absolute_url("/user/orders")

    return send_templated_email(
        to            = user_email,
        subject       = f"ShopHub Order #{short_id}: {icon} {headline}",
        template_name = "order_status_update.html",
        email_title   = f"Order #{short_id} Update",
        customer_name = customer_name,
        order_uuid    = order_uuid,
        new_status    = status_lower,
        headline      = f"{icon} {headline}",
        description   = description,
        icon          = icon,
        show_timeline = (status_lower != "cancelled"),
        timeline_steps = timeline_steps,
        plain_text    = textwrap.dedent(f"""\
            ShopHub Order Update
            ────────────────────
            Hi {customer_name},

            {icon} {headline}
            {description}

            Order ID: #{short_id}
            Status:   {status_lower.capitalize()}

            View your order details:
            {orders_url}

            Questions? Contact us: {{support_email}}
        """),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 4. ORDER CONFIRMATION  (sent to customer at checkout)
#    Triggered by: shop/user/api/checkout.py
# ─────────────────────────────────────────────────────────────────────────────

def send_order_confirmation_email(
    user_email: str,
    customer_name: str,
    order_uuid: str,
    order_date: str,
    payment_method: str,
    items: list[dict],
    subtotal: float,
    tax: float,
    shipping_fee: float,
    grand_total: float,
    shipping_address: str,
) -> bool:
    short_id     = order_uuid[:8].upper()
    orders_url   = build_absolute_url("/user/orders")

    # Build plain-text items list
    items_text = "\n".join(
        f"  • {item['name']} × {item['qty']}  —  ₹{item['subtotal']:.2f}"
        for item in items
    )

    return send_templated_email(
        to              = user_email,
        subject         = f"ShopHub Order #{short_id} Confirmed 🎉",
        template_name   = "order_confirmation.html",
        email_title     = f"Order #{short_id} Confirmed",
        customer_name   = customer_name,
        order_uuid      = order_uuid,
        order_date      = order_date,
        payment_method  = payment_method,
        items           = items,
        subtotal        = subtotal,
        tax             = tax,
        shipping_fee    = shipping_fee,
        grand_total     = grand_total,
        shipping_address = shipping_address,
        plain_text      = textwrap.dedent(f"""\
            ShopHub Order Confirmed!
            ────────────────────────
            Hi {customer_name}, thank you for your order.

            Order ID:  #{short_id}
            Date:      {order_date}
            Payment:   {payment_method.upper()}

            Items:
{items_text}

            Subtotal:  ₹{subtotal:.2f}
            GST:       ₹{tax:.2f}
            Shipping:  {'FREE' if shipping_fee == 0 else f'₹{shipping_fee:.2f}'}
            ─────────────────────
            Total:     ₹{grand_total:.2f}

            Ship to: {shipping_address}

            Track your order:
            {orders_url}
        """),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 5. NEW ORDER SELLER ALERT  (sent to seller when a customer orders)
#    Triggered by: shop/user/api/checkout.py
# ─────────────────────────────────────────────────────────────────────────────

def send_new_order_seller_alert(
    seller_email: str,
    seller_name: str,
    order_uuid: str,
    order_date: str,
    customer_name: str,
    items: list[dict],
    seller_total: float,
    shipping_address: str,
) -> bool:
    short_id      = order_uuid[:8].upper()
    dashboard_url = build_absolute_url("/seller/orders")

    items_text = "\n".join(
        f"  • {item['name']} × {item['qty']}  —  ₹{item['subtotal']:.2f}"
        for item in items
    )

    return send_templated_email(
        to               = seller_email,
        subject          = f"ShopHub: 🔔 New Order #{short_id} — Action Required",
        template_name    = "new_order_seller_alert.html",
        email_title      = "New Order Received",
        seller_name      = seller_name,
        order_uuid       = order_uuid,
        order_date       = order_date,
        customer_name    = customer_name,
        items            = items,
        seller_total     = seller_total,
        shipping_address = shipping_address,
        plain_text       = textwrap.dedent(f"""\
            ShopHub: New Order Received
            ───────────────────────────
            Hi {seller_name},

            {customer_name} has placed an order containing your products.

            Order ID: #{short_id}
            Date:     {order_date}

            Items:
{items_text}

            Your Revenue: ₹{seller_total:.2f}

            Ship to: {shipping_address}

            View and fulfill this order:
            {dashboard_url}
        """),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 6. CATEGORY REQUEST  (sent to admin)
#    Triggered by: shop/seller/api/category_request.py
# ─────────────────────────────────────────────────────────────────────────────

def send_category_request_email_to_admin(
    admin_emails: list[str],
    seller_name: str,
    category_name: str,
) -> bool:
    """
    Notify admin(s) that a seller has requested a new category.
    Uses send_templated_email with a dedicated template for consistency.
    """
    frontend_url  = current_app.config.get('FRONTEND_BASE_URL', 'http://127.0.0.1:5173')
    dashboard_url = build_absolute_url("/admin/category-requests")

    return send_templated_email(
        to            = admin_emails,
        subject       = f"[ShopHub Admin] Category Request: '{category_name}' by {seller_name}",
        template_name = "category_request_admin.html",
        email_title   = "New Category Request",
        seller_name   = seller_name,
        category_name = category_name,
        plain_text    = textwrap.dedent(f"""\
            ShopHub Admin: New Category Request
            ────────────────────────────────────
            Seller:   {seller_name}
            Category: {category_name}

            Review and approve or reject this request:
            {dashboard_url}
        """),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 7. CATEGORY APPROVED / REJECTED / REVOKED  (sent to seller)
#    Triggered by: shop/admin/api/approve_category.py
# ─────────────────────────────────────────────────────────────────────────────

def send_category_decision_email(
    seller_email: str,
    seller_name: str,
    category_name: str,
    action: str,
) -> bool:
    subjects = {
        "approved": f"ShopHub: ✅ Category '{category_name}' Approved — Start Selling!",
        "rejected": f"ShopHub: ❌ Category Request for '{category_name}' Not Approved",
        "revoked":  f"ShopHub: ⚠️ Category Access for '{category_name}' Revoked",
    }
    action_text = {
        "approved": f"Your request to sell in '{category_name}' has been approved.",
        "rejected": f"Your request to sell in '{category_name}' was not approved.",
        "revoked":  f"Your access to sell in '{category_name}' has been revoked.",
    }
    categories_url = build_absolute_url("/seller/categories")

    return send_templated_email(
        to            = seller_email,
        subject       = subjects.get(action, f"ShopHub: Category Update — {category_name}"),
        template_name = "category_approved.html",
        email_title   = "Category Decision",
        seller_name   = seller_name,
        category_name = category_name,
        action        = action,
        plain_text    = textwrap.dedent(f"""\
            ShopHub: Category Update
            ────────────────────────
            Hi {seller_name},

            {action_text.get(action, '')}
            Category: {category_name}

            Visit your dashboard:
            {categories_url}
        """),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 8. SELLER ACCOUNT ACTIVATED / BLOCKED
#    Triggered by: shop/admin/api/manage_seller.py
# ─────────────────────────────────────────────────────────────────────────────

def send_seller_status_email(
    seller_email: str,
    seller_name: str,
    is_active: bool,
) -> bool:
    subject = (
        "ShopHub: 🎉 Your Seller Account is Now Active!"
        if is_active else
        "ShopHub: ⛔ Your Seller Account Has Been Suspended"
    )
    status_text   = "activated" if is_active else "suspended"
    dashboard_url = build_absolute_url("/seller/dashboard")

    return send_templated_email(
        to            = seller_email,
        subject       = subject,
        template_name = "seller_status_changed.html",
        email_title   = "Account Status Update",
        seller_name   = seller_name,
        is_active     = is_active,
        plain_text    = textwrap.dedent(f"""\
            ShopHub: Account Status Update
            ──────────────────────────────
            Hi {seller_name},

            Your ShopHub seller account has been {status_text}.

            {'Visit your dashboard: ' + dashboard_url if is_active else ''}
            {'Contact support if you believe this is an error.' if not is_active else ''}
        """),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 9. ABANDONED CART RECOVERY  (sent by background scheduler)
#    Triggered by: shop/utils/scheduler.py
# ─────────────────────────────────────────────────────────────────────────────

def send_abandoned_cart_email(
    user,
    items: list[dict],
    total: float,
    discount_code: str = 'COMEBACK10',
) -> bool:
    cart_url = build_absolute_url('/cart')

    items_text = "\n".join(
        f"  • {item['name']} × {item['quantity']}  —  ₹{item['subtotal']:.2f}"
        for item in items
    )

    return send_templated_email(
        to            = user.email,
        subject       = f"ShopHub: 🛒 {user.username}, you left something behind!",
        template_name = "abandoned_cart.html",
        email_title   = "Complete Your Purchase",
        user          = user,
        items         = items,
        total         = total,
        discount_code = discount_code,
        cart_url      = cart_url,
        plain_text    = textwrap.dedent(f"""\
            ShopHub: You left items in your cart!
            ──────────────────────────────────────
            Hi {user.username},

            You left the following items in your cart:

{items_text}

            Cart Total: ₹{total:.2f}

            Use code {discount_code} for 10% off your order!

            Complete your purchase:
            {cart_url}

            This offer is valid for 48 hours.
        """),
    )
