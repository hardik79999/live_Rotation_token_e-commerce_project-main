from shop.user import user_bp
from flask import request as _req   # used in cache key_prefix lambdas

# Import APIs
from shop.user.api.browse import get_categories_action, get_products_action, get_single_product_action
from shop.extensions import cache
from shop.user.api.address import add_address_action, get_addresses_action, set_default_address_action, delete_address_action
from shop.user.api.cart import add_to_cart_action, get_cart_action, update_cart_item_action
from shop.user.api.wishlist import toggle_wishlist_action, get_wishlist_action
from shop.user.api.checkout import checkout_action
from shop.user.api.verify_payment import verify_payment_action
from shop.user.api.orders import get_orders_action, get_order_status_action
from shop.user.api.webhook import razorpay_webhook_action   
from shop.user.api.review import add_product_review_action, get_product_reviews_action
from shop.user.api.recommendations import get_recommendations_action
from shop.user.api.invoice import generate_invoice_action
from shop.user.api.invoice_pdf import download_invoice_action
from shop.user.api.promo import validate_promo_action, available_promos_action
from shop.user.api.wallet import get_wallet_action, get_wallet_transactions_action
from shop.user.api.return_order import request_return_action, get_return_status_action

# ==========================================
# 🌐 PUBLIC BROWSING ROUTES (No Login Required)
# ==========================================
@user_bp.route('/categories', methods=['GET'])
@cache.cached(timeout=600, key_prefix='catalog:categories')
def get_categories_route():
    """
    Get All Active Categories
    ---
    tags:
      - 🌐 User Browsing
    responses:
      200:
        description: List of categories fetched successfully
    """
    return get_categories_action()

@user_bp.route('/products', methods=['GET'])
@cache.cached(timeout=300, query_string=True, key_prefix='catalog:products')
def get_products_route():
    """
    Get All Products (with Filters)
    ---
    tags:
      - 🌐 User Browsing
    parameters:
      - name: page
        in: query
        type: integer
      - name: limit
        in: query
        type: integer
      - name: search
        in: query
        type: string
      - name: category
        in: query
        type: string
      - name: sort_by
        in: query
        type: string
        enum: ['newest', 'price_low_to_high', 'price_high_to_low']
    responses:
      200:
        description: Products list
    """
    return get_products_action()

@user_bp.route('/product/<product_uuid>', methods=['GET'])
@cache.cached(timeout=300, key_prefix=lambda: f'catalog:product:{_req.view_args["product_uuid"]}')
def get_single_product_route(product_uuid):
    """
    Get Product Details
    ---
    tags:
      - 🌐 User Browsing
    parameters:
      - name: product_uuid
        in: path
        type: string
        required: true
    responses:
      200:
        description: Product details
    """
    return get_single_product_action(product_uuid)

# ==========================================
# 📍 ADDRESS ROUTES (Requires Login)
# ==========================================
@user_bp.route('/address', methods=['POST'])
def add_address_route():
    """
    Add New Delivery Address
    ---
    tags:
      - 📍 User Address
    security:
      - CSRF-Token: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          properties:
            full_name: {type: string}
            phone_number: {type: string}
            street: {type: string}
            city: {type: string}
            state: {type: string}
            pincode: {type: string}
    responses:
      201:
        description: Address saved
    """
    return add_address_action()

@user_bp.route('/addresses', methods=['GET'])
def get_addresses_route():
    """
    Get All Saved Addresses
    ---
    tags:
      - 📍 User Address
    security:
      - CSRF-Token: []
    responses:
      200:
        description: List of addresses
    """
    return get_addresses_action()

@user_bp.route('/address/<address_uuid>/set-default', methods=['PUT'])
def set_default_address_route(address_uuid):
    """
    Set Default Address
    ---
    tags:
      - 📍 User Address
    security:
      - CSRF-Token: []
    parameters:
      - name: address_uuid
        in: path
        type: string
        required: true
    responses:
      200:
        description: Default address updated
    """
    return set_default_address_action(address_uuid)

@user_bp.route('/address/<address_uuid>', methods=['DELETE'])
def delete_address_route(address_uuid):
    """
    Delete Address
    ---
    tags:
      - 📍 User Address
    security:
      - CSRF-Token: []
    parameters:
      - name: address_uuid
        in: path
        type: string
        required: true
    responses:
      200:
        description: Address deleted
    """
    return delete_address_action(address_uuid)

# ==========================================
# 🛒 CART ROUTES (Requires Login)
# ==========================================
@user_bp.route('/cart', methods=['POST'])
def add_to_cart_route():
    """
    Add Product to Cart
    ---
    tags:
      - 🛒 User Cart
    security:
      - CSRF-Token: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          properties:
            product_uuid: {type: string}
            quantity: {type: integer, default: 1}
    responses:
      200:
        description: Item added
    """
    return add_to_cart_action()

@user_bp.route('/cart', methods=['GET'])
def get_cart_route():
    """
    View My Cart
    ---
    tags:
      - 🛒 User Cart
    security:
      - CSRF-Token: []
    responses:
      200:
        description: Cart items and total bill
    """
    return get_cart_action()

@user_bp.route('/cart', methods=['PUT'])
def update_cart_route():
    """
    Update Cart Quantity (0 to remove)
    ---
    tags:
      - 🛒 User Cart
    security:
      - CSRF-Token: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          properties:
            product_uuid: {type: string}
            quantity: {type: integer}
    responses:
      200:
        description: Cart updated
    """
    return update_cart_item_action()

# ==========================================
# ❤️ WISHLIST & ⭐ REVIEW
# ==========================================
@user_bp.route('/wishlist', methods=['POST'])
def toggle_wishlist_route(): 
    """
    Toggle Wishlist (Add/Remove)
    ---
    tags:
      - ❤️ Wishlist & Reviews
    security:
      - CSRF-Token: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          properties:
            product_uuid: {type: string}
    responses:
      200:
        description: Wishlist toggled
    """
    return toggle_wishlist_action()

@user_bp.route('/wishlist', methods=['GET'])
def get_wishlist_route(): 
    """
    View My Wishlist
    ---
    tags:
      - ❤️ Wishlist & Reviews
    security:
      - CSRF-Token: []
    responses:
      200:
        description: Wishlisted products
    """
    return get_wishlist_action()

@user_bp.route('/product/<product_uuid>/review', methods=['POST'])
def submit_review_route(product_uuid):
    """
    Submit Product Review (multipart/form-data)
    ---
    tags:
      - ❤️ Wishlist & Reviews
    security:
      - CSRF-Token: []
    consumes:
      - multipart/form-data
    parameters:
      - name: product_uuid
        in: path
        type: string
        required: true
      - name: rating
        in: formData
        type: integer
        required: true
      - name: comment
        in: formData
        type: string
      - name: image
        in: formData
        type: file
    responses:
      201:
        description: Review added
    """
    return add_product_review_action(product_uuid)

@user_bp.route('/product/<product_uuid>/reviews', methods=['GET'])
def get_reviews_route(product_uuid):
    """
    Get Product Reviews (public)
    ---
    tags:
      - ❤️ Wishlist & Reviews
    parameters:
      - name: product_uuid
        in: path
        type: string
        required: true
    responses:
      200:
        description: List of reviews with avg rating
    """
    return get_product_reviews_action(product_uuid)

@user_bp.route('/product/<product_uuid>/recommendations', methods=['GET'])
def get_recommendations_route(product_uuid):
    """
    Get Product Recommendations (public)
    ---
    tags:
      - 🌐 User Browsing
    parameters:
      - name: product_uuid
        in: path
        type: string
        required: true
    responses:
      200:
        description: Up to 4 recommended products (co-purchase or category fallback)
    """
    return get_recommendations_action(product_uuid)

@user_bp.route('/promo/validate', methods=['POST'])
def validate_promo_route():
    """
    Validate a Promo Code
    ---
    tags:
      - 🛒 User Cart
    security:
      - CSRF-Token: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          properties:
            code: {type: string}
    responses:
      200:
        description: Discount calculated
      400:
        description: Invalid, expired, or minimum not met
    """
    return validate_promo_action()

@user_bp.route('/promo/available', methods=['GET'])
def available_promos_route():
    """
    List Available Promo Codes
    ---
    tags:
      - 🛒 User Cart
    security:
      - CSRF-Token: []
    responses:
      200:
        description: List of active, non-expired coupons
    """
    return available_promos_action()

# ==========================================
# 💸 CHECKOUT & ORDERS (PAYMENT FLOW)
# ==========================================
@user_bp.route('/checkout', methods=['POST'])
def checkout_route():
    """
    Place Order (COD or Online)
    ---
    tags:
      - 💸 Checkout & Payments
    security:
      - CSRF-Token: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          properties:
            payment_method: {type: string, enum: ['cod', 'card', 'upi']}
            address_uuid: {type: string}
    responses:
      201:
        description: Order initiated
    """
    return checkout_action()

@user_bp.route('/verify-payment', methods=['POST'])
def verify_payment_route():
    """
    Verify Razorpay Payment
    ---
    tags:
      - 💸 Checkout & Payments
    security:
      - CSRF-Token: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          properties:
            razorpay_order_id: {type: string}
            razorpay_payment_id: {type: string}
            razorpay_signature: {type: string}
    responses:
      200:
        description: Payment verified
    """
    return verify_payment_action()

@user_bp.route('/orders', methods=['GET'])
def get_orders_route():
    """
    View Order History
    ---
    tags:
      - 💸 Checkout & Payments
    security:
      - CSRF-Token: []
    responses:
      200:
        description: List of all orders
    """
    return get_orders_action()

@user_bp.route('/order/status/<order_uuid>', methods=['GET'])
def get_order_status_route(order_uuid):
    """
    Track Order Status
    ---
    tags:
      - 💸 Checkout & Payments
    security:
      - CSRF-Token: []
    parameters:
      - name: order_uuid
        in: path
        type: string
        required: true
    responses:
      200:
        description: Order status details
    """
    return get_order_status_action(order_uuid)

@user_bp.route('/order/<order_uuid>/invoice', methods=['GET'])
def get_invoice_route(order_uuid):
    """
    Generate & View Invoice
    ---
    tags:
      - 💸 Checkout & Payments
    security:
      - CSRF-Token: []
    parameters:
      - name: order_uuid
        in: path
        type: string
        required: true
    responses:
      200:
        description: Full Invoice JSON
    """
    return generate_invoice_action(order_uuid)

@user_bp.route('/order/<order_uuid>/invoice/download', methods=['GET'])
def download_invoice_route(order_uuid):
    """
    Download Invoice as PDF
    ---
    tags:
      - 💸 Checkout & Payments
    security:
      - CSRF-Token: []
    parameters:
      - name: order_uuid
        in: path
        type: string
        required: true
    responses:
      200:
        description: PDF file download
        content:
          application/pdf: {}
    """
    return download_invoice_action(order_uuid)

# 🔥 WEBHOOK ROUTE (No JWT Required)
@user_bp.route('/webhook/razorpay', methods=['POST'])
def razorpay_webhook_route():
    """
    Razorpay Payment Webhook
    (Ye API hum manually call nahi karte, Razorpay khud isko hit karta hai background me)
    ---
    tags:
      - ⚓ Webhooks
    parameters:
      - name: X-Razorpay-Signature
        in: header
        type: string
        required: true
        description: Secret signature sent by Razorpay for security
      - name: body
        in: body
        required: true
        description: Webhook event payload sent by Razorpay
        schema:
          properties:
            event: {type: string, example: "payment.captured"}
            payload: {type: object}
    responses:
      200:
        description: Webhook received and processed successfully
    """
    return razorpay_webhook_action()

# ==========================================
# 💰 WALLET ROUTES (Customer only)
# ==========================================
@user_bp.route('/wallet', methods=['GET'])
def get_wallet_route():
    """
    Get Wallet Balance & Recent Transactions
    ---
    tags:
      - 💰 Wallet
    security:
      - CSRF-Token: []
    responses:
      200:
        description: Wallet balance and last 20 transactions
    """
    return get_wallet_action()

@user_bp.route('/wallet/transactions', methods=['GET'])
def get_wallet_transactions_route():
    """
    Get Full Wallet Transaction History (paginated)
    ---
    tags:
      - 💰 Wallet
    security:
      - CSRF-Token: []
    parameters:
      - name: page
        in: query
        type: integer
      - name: per_page
        in: query
        type: integer
    responses:
      200:
        description: Paginated wallet transactions
    """
    return get_wallet_transactions_action()

# ==========================================
# 🔄 RETURN & REFUND ROUTES (Customer only)
# ==========================================
@user_bp.route('/order/<order_uuid>/return', methods=['POST'])
def request_return_route(order_uuid):
    """
    Initiate Order Return
    ---
    tags:
      - 🔄 Returns & Refunds
    security:
      - CSRF-Token: []
    parameters:
      - name: order_uuid
        in: path
        type: string
        required: true
      - name: body
        in: body
        required: true
        schema:
          properties:
            reason: {type: string, enum: ['defective','wrong_item','wrong_size','not_as_described','changed_mind','damaged_shipping','other']}
            comments: {type: string}
    responses:
      201:
        description: Return request submitted
      403:
        description: Return window expired
      409:
        description: Return already exists
      422:
        description: Order not delivered
    """
    return request_return_action(order_uuid)

@user_bp.route('/order/<order_uuid>/return', methods=['GET'])
def get_return_status_route(order_uuid):
    """
    Get Return Status for an Order
    ---
    tags:
      - 🔄 Returns & Refunds
    security:
      - CSRF-Token: []
    parameters:
      - name: order_uuid
        in: path
        type: string
        required: true
    responses:
      200:
        description: Return status and window info
    """
    return get_return_status_action(order_uuid)