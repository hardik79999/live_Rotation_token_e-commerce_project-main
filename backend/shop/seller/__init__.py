from flask import Blueprint

seller_bp = Blueprint('seller', __name__)

from shop.seller import routes