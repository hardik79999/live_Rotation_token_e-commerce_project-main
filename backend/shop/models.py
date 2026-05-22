import uuid
import enum
from datetime import datetime, timedelta
from shop.extensions import db

# =================================================================================
# 💎 ENUMS (Strict Data Types)
# =================================================================================

class OrderStatus(enum.Enum):
    pending = 'pending'
    processing = 'processing'
    shipped = 'shipped'
    delivered = 'delivered'
    cancelled = 'cancelled'

class PaymentStatus(enum.Enum):
    pending = 'pending'
    completed = 'completed'
    failed = 'failed'
    refunded = 'refunded'

class PaymentMethod(enum.Enum):
    cod = 'cod'
    card = 'card'
    upi = 'upi'
    netbanking = 'netbanking'

class OTPAction(enum.Enum):
    verification = 'verification'
    password_reset = 'password_reset'

class WalletTransactionType(enum.Enum):
    CREDIT = 'CREDIT'
    DEBIT  = 'DEBIT'

class ReturnStatus(enum.Enum):
    pending  = 'pending'   # customer submitted, awaiting admin/seller action
    approved = 'approved'  # approved, refund processing
    rejected = 'rejected'  # rejected with reason
    refunded = 'refunded'  # money returned to wallet / Razorpay

class ReturnReason(enum.Enum):
    defective        = 'defective'
    wrong_item       = 'wrong_item'
    wrong_size       = 'wrong_size'
    not_as_described = 'not_as_described'
    changed_mind     = 'changed_mind'
    damaged_shipping = 'damaged_shipping'
    other            = 'other'


# =================================================================================
# 🔁 BASE MODEL (Super Trick: Ye 8 fields har table me auto-add ho jayengi)
# =================================================================================
class BaseModel(db.Model):
    __abstract__ = True  # Ye batata hai ki iski khud ki koi table nahi banegi

    id = db.Column(db.Integer, primary_key=True)
    uuid = db.Column(db.String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    
    # 6 MANDATORY FIELDS (Auditing)
    is_active = db.Column(db.Boolean, default=True)
    created_by = db.Column(db.Integer, nullable=True)
    updated_by = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, server_default=db.func.now())
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, server_default=db.func.now())


# =================================================================================
# 🔐 MODULE 1 & 2: AUTH, USERS & ADMIN
# =================================================================================

class Role(BaseModel):
    __tablename__ = 'roles'
    role_name = db.Column(db.String(50), nullable=False, unique=True)
    users = db.relationship('User', back_populates='role', lazy=True)

class User(BaseModel):
    __tablename__ = 'users'
    username       = db.Column(db.String(80), unique=True, nullable=False)
    email          = db.Column(db.String(120), unique=True, nullable=False)
    password       = db.Column(db.String(255), nullable=True)   # nullable for OAuth-only accounts
    phone          = db.Column(db.String(15), unique=True, nullable=True)
    role_id        = db.Column(db.Integer, db.ForeignKey('roles.id'), nullable=False)
    is_verified    = db.Column(db.Boolean, default=False)
    profile_photo  = db.Column(db.String(255), nullable=True)
    google_id      = db.Column(db.String(100), unique=True, nullable=True)  # Google sub claim
    wallet_balance = db.Column(db.Float, default=0.0, nullable=False)       # 💰 Loyalty wallet

    role = db.relationship('Role', back_populates='users')
    addresses = db.relationship('Address', backref='user', lazy=True)
    otps = db.relationship('Otp', backref='user', lazy=True)
    orders = db.relationship('Order', backref='customer', lazy=True)
    products = db.relationship('Product', backref='seller_user', lazy=True)
    wallet_transactions = db.relationship('WalletTransaction', backref='user', lazy=True)

class Otp(BaseModel):
    __tablename__ = 'otps'
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=True)
    otp_code = db.Column(db.String(10), nullable=False)
    action = db.Column(db.Enum(OTPAction), default=OTPAction.verification)
    is_used = db.Column(db.Boolean, default=False)
    expires_at = db.Column(db.DateTime, default=lambda: datetime.utcnow() + timedelta(minutes=10))

class Address(BaseModel):
    __tablename__ = 'addresses'
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    full_name = db.Column(db.String(100), nullable=False)
    phone_number = db.Column(db.String(20), nullable=False)
    street = db.Column(db.String(255), nullable=False)
    city = db.Column(db.String(100), nullable=False)
    state = db.Column(db.String(100), nullable=False)
    pincode = db.Column(db.String(20), nullable=False)
    is_default = db.Column(db.Boolean, default=False)
    
    # NOTE: is_active, created_by, uuid, id sab BaseModel se automatic aayega!
    # NOTE: Relationship User table me already defined hai, isliye yahan zaroorat nahi.


# =================================================================================
# 📦 MODULE 3 & 6: CATALOG, PRODUCTS & SELLER
# =================================================================================

class Category(BaseModel):
    __tablename__ = 'categories'
    name        = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)
    icon        = db.Column(db.String(10),  nullable=True)   # emoji icon e.g. "📱"
    parent_id   = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=True)  # NULL = top-level

    parent   = db.relationship('Category', remote_side='Category.id', backref='subcategories', lazy=True)
    products = db.relationship('Product', backref='category', lazy=True)

class SellerCategory(BaseModel):
    __tablename__ = 'seller_categories'
    seller_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=False)
    is_approved = db.Column(db.Boolean, default=False)

class Product(BaseModel):
    __tablename__ = 'products'
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    price = db.Column(db.Float, nullable=False)
    stock = db.Column(db.Integer, default=0)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=False)
    seller_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    images = db.relationship('ProductImage', backref='product', cascade="all, delete-orphan", lazy=True)
    specifications = db.relationship('Specification', backref='product', cascade="all, delete-orphan", lazy=True)
    reviews = db.relationship('Review', backref='product', lazy=True)
    variants = db.relationship('ProductVariant', backref='product', cascade="all, delete-orphan", lazy=True, order_by='ProductVariant.id')

class ProductImage(BaseModel):
    __tablename__ = 'product_images'
    product_id  = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    variant_id  = db.Column(db.Integer, db.ForeignKey('product_variants.id'), nullable=True)  # NULL = applies to all variants
    image_url   = db.Column(db.String(255), nullable=False)
    is_primary  = db.Column(db.Boolean, default=False)
    sort_order  = db.Column(db.Integer, default=0, nullable=False)

class ProductVariant(BaseModel):
    """
    One row per SKU (colour × size combination).
    variant_name  — human label shown in UI, e.g. "128GB · Space Gray"
    sku_code      — internal inventory code, e.g. "IPH17PM-128-SG"
    stock_quantity overrides Product.stock when variants exist.
    additional_price is added on top of Product.price (can be negative for cheaper variants).
    """
    __tablename__ = 'product_variants'
    product_id       = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    variant_name     = db.Column(db.String(120), nullable=True)   # e.g. "128GB · Space Gray"
    sku_code         = db.Column(db.String(80),  nullable=True, index=True)  # e.g. "IPH17PM-128-SG"
    color_name       = db.Column(db.String(80),  nullable=True)   # e.g. "Pacific Blue"
    color_code       = db.Column(db.String(10),  nullable=True)   # e.g. "#0071C5"
    size             = db.Column(db.String(40),  nullable=True)   # e.g. "XL", "256GB"
    additional_price = db.Column(db.Float, default=0.0, nullable=False)
    stock_quantity   = db.Column(db.Integer, default=0, nullable=False)

    images = db.relationship(
        'ProductImage',
        primaryjoin='ProductVariant.id == foreign(ProductImage.variant_id)',
        lazy=True,
        viewonly=True,
    )

class Specification(BaseModel):
    __tablename__ = 'specifications'
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    spec_key   = db.Column(db.String(100), nullable=False)
    spec_value = db.Column(db.Text, nullable=False)   # Text — supports long values like display specs


# =================================================================================
# 🛒 MODULE 4, 5 & 9: CART, ORDERS, PAYMENT & DISCOUNT
# =================================================================================

class Coupon(BaseModel):
    __tablename__ = 'coupons'
    code                = db.Column(db.String(50), unique=True, nullable=False)
    discount_type       = db.Column(db.String(10), nullable=False)   # 'percentage' | 'flat'
    discount_value      = db.Column(db.Float, nullable=False)
    min_cart_value      = db.Column(db.Float, default=0.0, nullable=False)
    max_discount_amount = db.Column(db.Float, nullable=True)
    expiry_date         = db.Column(db.DateTime, nullable=False)
    max_uses            = db.Column(db.Integer, nullable=True)
    current_uses        = db.Column(db.Integer, default=0, nullable=False)
    # seller_id = None means platform-wide coupon (admin-created)
    seller_id           = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    # Keep legacy columns for backward compat
    discount_percentage = db.Column(db.Float, nullable=True)
    discount_flat       = db.Column(db.Float, nullable=True)

    seller = db.relationship('User', foreign_keys=[seller_id], lazy=True)

class CartItem(BaseModel):
    __tablename__ = 'cart_items'
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    quantity   = db.Column(db.Integer, default=1, nullable=False)
    # Abandoned-cart recovery: set True once the recovery email has been sent
    # so we never spam the same user twice for the same stale cart.
    recovery_email_sent = db.Column(db.Boolean, default=False, nullable=False)
    product    = db.relationship('Product', lazy=True)

class Order(BaseModel):
    __tablename__ = 'orders'
    user_id         = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    address_id      = db.Column(db.Integer, db.ForeignKey('addresses.id'), nullable=False)
    total_amount    = db.Column(db.Float, nullable=False)
    payment_method  = db.Column(db.Enum(PaymentMethod), nullable=True)
    status          = db.Column(db.Enum(OrderStatus), default=OrderStatus.pending)
    coupon_code     = db.Column(db.String(50), nullable=True)
    discount_amount = db.Column(db.Float, default=0.0, nullable=False)
    wallet_used     = db.Column(db.Float, default=0.0, nullable=False)  # 💰 wallet deducted at checkout
    delivered_at    = db.Column(db.DateTime, nullable=True)             # 📦 set when status → delivered

    items    = db.relationship('OrderItem', backref='order', cascade="all, delete-orphan", lazy=True)
    tracking = db.relationship('OrderTracking', backref='order', cascade="all, delete-orphan", lazy=True)
    payment  = db.relationship('Payment', backref='order', uselist=False, lazy=True)
    invoice  = db.relationship('Invoice', backref='order', uselist=False, lazy=True)
    returns  = db.relationship('OrderReturn', backref='order', lazy=True)

class OrderItem(BaseModel):
    __tablename__ = 'order_items'
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    price_at_purchase = db.Column(db.Float, nullable=False) 
    product = db.relationship('Product', lazy=True)

class Payment(BaseModel):
    __tablename__ = 'payments'
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False, unique=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    transaction_id = db.Column(db.String(100), unique=True, nullable=True) 
    payment_method = db.Column(db.Enum(PaymentMethod), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.Enum(PaymentStatus), default=PaymentStatus.pending)

class Invoice(BaseModel):
    __tablename__ = 'invoices'
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False, unique=True)
    invoice_number = db.Column(db.String(50), unique=True, nullable=False)
    pdf_url = db.Column(db.String(255), nullable=True) 

class OrderTracking(BaseModel):
    __tablename__ = 'order_tracking'
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    status = db.Column(db.Enum(OrderStatus), nullable=False)
    message = db.Column(db.String(255), nullable=True) 


# =================================================================================
# ⭐ MODULE 7: WISHLIST & REVIEW
# =================================================================================

class Wishlist(BaseModel):
    __tablename__ = 'wishlists'
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)

class Review(BaseModel):
    __tablename__ = 'reviews'
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    rating     = db.Column(db.Integer, nullable=False)  # 1 to 5
    comment    = db.Column(db.Text, nullable=True)
    image_url  = db.Column(db.String(255), nullable=True)  # legacy single photo (kept for compat)
    reviewer   = db.relationship('User', lazy=True, foreign_keys=[user_id])
    images     = db.relationship('ReviewImage', backref='review', cascade='all, delete-orphan', lazy=True)

class ReviewImage(BaseModel):
    """Up to 6 evidence photos per review."""
    __tablename__ = 'review_images'
    review_id = db.Column(db.Integer, db.ForeignKey('reviews.id'), nullable=False)
    image_url = db.Column(db.String(255), nullable=False)
    sort_order = db.Column(db.Integer, default=0, nullable=False)  # display order


# =================================================================================
# 💬 MODULE 8: LIVE CHAT
# =================================================================================

class ChatMessage(BaseModel):
    """
    Stores every chat message between a customer and a seller,
    optionally scoped to a specific product.

    room_id convention:  "chat_{min(customer_id, seller_id)}_{max(customer_id, seller_id)}_{product_id}"
    This ensures both parties always join the same Socket.IO room.
    """
    __tablename__ = 'chat_messages'

    sender_id   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    product_id  = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True)
    room_id     = db.Column(db.String(100), nullable=False, index=True)
    text        = db.Column(db.Text, nullable=False)
    is_read     = db.Column(db.Boolean, default=False, nullable=False)

    sender   = db.relationship('User', foreign_keys=[sender_id],   lazy=True)
    receiver = db.relationship('User', foreign_keys=[receiver_id], lazy=True)
    product  = db.relationship('Product', foreign_keys=[product_id], lazy=True)


# =================================================================================
# 💰 MODULE 10: WALLET & LOYALTY POINTS
# =================================================================================

class WalletTransaction(BaseModel):
    """
    Immutable audit trail for every wallet credit/debit.
    Never delete rows — this is a financial ledger.
    """
    __tablename__ = 'wallet_transactions'

    user_id          = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    amount           = db.Column(db.Float, nullable=False)
    transaction_type = db.Column(db.Enum(WalletTransactionType), nullable=False)
    description      = db.Column(db.String(255), nullable=False)
    order_id         = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=True)


# =================================================================================
# 🔄 MODULE 11: ORDER RETURNS & REFUNDS
# =================================================================================

class OrderReturn(BaseModel):
    """
    One row per return request. An order can only have one active return.
    Separate table keeps Order clean and gives full return audit trail.
    """
    __tablename__ = 'order_returns'

    order_id          = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    user_id           = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    reason            = db.Column(db.Enum(ReturnReason), nullable=False)
    customer_comments = db.Column(db.Text, nullable=True)
    status            = db.Column(db.Enum(ReturnStatus), default=ReturnStatus.pending, nullable=False)
    # Customer-uploaded evidence images (JSON array of URL strings, max 3)
    image_urls        = db.Column(db.Text, nullable=True)   # stored as JSON string
    # Admin/seller action fields
    admin_notes       = db.Column(db.Text, nullable=True)
    refund_method     = db.Column(db.String(20), nullable=True)   # 'wallet' | 'razorpay'
    refund_amount     = db.Column(db.Float, nullable=True)
    razorpay_refund_id = db.Column(db.String(100), nullable=True)

    customer = db.relationship('User', foreign_keys=[user_id], lazy=True)
