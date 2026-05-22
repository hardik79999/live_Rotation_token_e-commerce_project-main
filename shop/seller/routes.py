from shop.seller import seller_bp

from shop.seller.api.create_product import create_product_action
from shop.seller.api.get_products import get_products_action
from shop.seller.api.update_product import update_product_action
from shop.seller.api.delete_product import delete_product_action
from shop.seller.api.category_request import category_request_action
from shop.seller.api.get_categories import get_categories_action
from shop.seller.api.order_status import update_order_status_action
from shop.seller.api.get_orders import get_seller_orders_action
from shop.seller.api.analytics import seller_analytics_action
from shop.seller.api.buyer_details import get_buyer_details_action
from shop.seller.api.coupons import (
    list_seller_coupons_action,
    create_seller_coupon_action,
    update_seller_coupon_action,
    delete_seller_coupon_action,
)

@seller_bp.route('/product', methods=['POST'])
def create_product_route():
    """
    Create a New Product (With Multiple Images)
    ---
    tags:
      - 🏪 Seller Dashboard
    security:
      - CSRF-Token: []
    consumes:
      - multipart/form-data
    parameters:
      - name: name
        in: formData
        type: string
        required: true
      - name: description
        in: formData
        type: string
        required: true
      - name: price
        in: formData
        type: number
        required: true
      - name: stock
        in: formData
        type: integer
      - name: category_uuid
        in: formData
        type: string
        required: true
      - name: specifications
        in: formData
        type: string
      - name: images        # 🔥 YAHAN MULTIPLE ENABLE KIYA HAI
        in: formData
        type: array
        items:
          type: file
        collectionFormat: multi
        required: false
    responses:
      201:
        description: Product created successfully
    """
    return create_product_action()

@seller_bp.route('/products', methods=['GET'])
def get_products_route():
    """
    Get My Products (Seller)
    ---
    tags:
      - 🏪 Seller Dashboard
    security:
      - CSRF-Token: []
    responses:
      200:
        description: List of seller's products
    """
    return get_products_action()

@seller_bp.route('/product/<product_uuid>', methods=['PUT'])
def update_product_route(product_uuid):
    """
    Update Product (With Images)
    ---
    tags:
      - 🏪 Seller Dashboard
    security:
      - CSRF-Token: []
    consumes:
      - multipart/form-data
    parameters:
      - name: product_uuid
        in: path
        type: string
        required: true
      - name: name
        in: formData
        type: string
        required: false
      - name: description
        in: formData
        type: string
        required: false
      - name: price
        in: formData
        type: number
        required: false
      - name: stock
        in: formData
        type: integer
        required: false
      - name: category_uuid
        in: formData
        type: string
        required: false
      - name: specifications
        in: formData
        type: string
        required: false
      - name: images
        in: formData
        type: file
        required: false
    responses:
      200:
        description: Product updated
    """
    return update_product_action(product_uuid)

@seller_bp.route('/product/<product_uuid>', methods=['DELETE'])
def delete_product_route(product_uuid):
    """
    Delete Product (Soft Delete)
    ---
    tags:
      - 🏪 Seller Dashboard
    security:
      - CSRF-Token: []
    parameters:
      - name: product_uuid
        in: path
        type: string
        required: true
    responses:
      200:
        description: Product deleted
    """
    return delete_product_action(product_uuid)

@seller_bp.route('/category-request', methods=['POST'])
def category_request_route():
    """
    Request Category Approval
    ---
    tags:
      - 🏪 Seller Dashboard
    security:
      - CSRF-Token: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          properties:
            category_uuid: {type: string}
    responses:
      201:
        description: Request sent to admin
    """
    return category_request_action()

@seller_bp.route('/my-categories', methods=['GET'])
def get_categories_route():
    """
    View Approved Categories
    ---
    tags:
      - 🏪 Seller Dashboard
    security:
      - CSRF-Token: []
    responses:
      200:
        description: List of approved categories
    """
    return get_categories_action()  

@seller_bp.route('/orders', methods=['GET'])
def get_seller_orders_route():
    """
    Get Orders Containing My Products
    ---
    tags:
      - 🏪 Seller Dashboard
    security:
      - CSRF-Token: []
    responses:
      200:
        description: List of orders with only this seller's items
    """
    return get_seller_orders_action()


@seller_bp.route('/order/<order_uuid>/status', methods=['PUT'])
def update_order_status_route(order_uuid):
    """
    Update Order Status
    ---
    tags:
      - 🏪 Seller Dashboard
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
            status: {type: string, enum: ['processing', 'shipped', 'delivered', 'cancelled']}
    responses:
      200:
        description: Status updated and email sent
    """
    return update_order_status_action(order_uuid)


@seller_bp.route('/analytics', methods=['GET'])
def seller_analytics_route():
    """
    Seller Revenue Analytics (time-range)
    ---
    tags:
      - 🏪 Seller Dashboard
    security:
      - CSRF-Token: []
    parameters:
      - name: range
        in: query
        type: string
        enum: [7d, 30d, 6m]
        default: 6m
        description: >
          7d  → daily data for the last 7 days  (7 points, zero-filled)
          30d → daily data for the last 30 days (30 points, zero-filled)
          6m  → monthly data for the last 6 months (6 points, zero-filled)
    responses:
      200:
        description: >
          Array of { label, full_label, revenue, orders, date_key }
          sorted oldest → newest, ready for Recharts AreaChart.
    """
    return seller_analytics_action()


@seller_bp.route('/order/<order_uuid>/buyer-details', methods=['GET'])
def get_buyer_details_route(order_uuid):
    """
    Get Buyer Details for a Specific Order
    ---
    tags:
      - 🏪 Seller Dashboard
    security:
      - CSRF-Token: []
    parameters:
      - name: order_uuid
        in: path
        type: string
        required: true
        description: UUID of the order (must belong to this seller)
    responses:
      200:
        description: >
          Buyer contact info, shipping address, and order history
          with this seller only. 403 if the order is not yours.
      403:
        description: Order does not contain your products
      404:
        description: Order or customer not found
    """
    return get_buyer_details_action(order_uuid)


from shop.seller.api.return_management import seller_approve_return_action, seller_reject_return_action
from shop.user.api.invoice_pdf import seller_download_invoice_action

@seller_bp.route('/order/<order_uuid>/invoice/download', methods=['GET'])
def seller_download_invoice_route(order_uuid):
    """
    Download Order Invoice as PDF (Seller)
    ---
    tags:
      - 🏪 Seller Dashboard
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
    return seller_download_invoice_action(order_uuid)


@seller_bp.route('/order/<order_uuid>/return/approve', methods=['PUT'])
def seller_approve_return_route(order_uuid):
    """
    Approve a Return Request (Seller)
    ---
    tags:
      - 🏪 Seller Dashboard
    security:
      - CSRF-Token: []
    parameters:
      - name: order_uuid
        in: path
        type: string
        required: true
      - name: body
        in: body
        schema:
          properties:
            seller_note: {type: string}
    responses:
      200:
        description: Return approved, refund issued, stock restored
    """
    return seller_approve_return_action(order_uuid)


@seller_bp.route('/order/<order_uuid>/return/reject', methods=['PUT'])
def seller_reject_return_route(order_uuid):
    """
    Reject a Return Request (Seller)
    ---
    tags:
      - 🏪 Seller Dashboard
    security:
      - CSRF-Token: []
    parameters:
      - name: order_uuid
        in: path
        type: string
        required: true
      - name: body
        in: body
        schema:
          properties:
            seller_note: {type: string}
    responses:
      200:
        description: Return rejected
    """
    return seller_reject_return_action(order_uuid)


# ── Coupon Management ─────────────────────────────────────────

@seller_bp.route('/coupons', methods=['GET'])
def list_coupons_route():
    """List My Coupons --- tags: [🏪 Seller Dashboard]"""
    return list_seller_coupons_action()

@seller_bp.route('/coupons', methods=['POST'])
def create_coupon_route():
    """Create a Coupon --- tags: [🏪 Seller Dashboard]"""
    return create_seller_coupon_action()

@seller_bp.route('/coupon/<coupon_uuid>', methods=['PUT'])
def update_coupon_route(coupon_uuid):
    """Update a Coupon --- tags: [🏪 Seller Dashboard]"""
    return update_seller_coupon_action(coupon_uuid)

@seller_bp.route('/coupon/<coupon_uuid>', methods=['DELETE'])
def delete_coupon_route(coupon_uuid):
    """Deactivate a Coupon --- tags: [🏪 Seller Dashboard]"""
    return delete_seller_coupon_action(coupon_uuid)
