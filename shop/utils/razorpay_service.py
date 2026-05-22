import razorpay
from flask import current_app

def get_razorpay_client():
    """Razorpay client ko initialize karta hai keys ke sath"""
    # .get() use kiya hai taaki agar config me key na bhi ho toh server start hone me crash na ho
    key_id = current_app.config.get('RAZORPAY_KEY_ID', 'dummy_key')
    key_secret = current_app.config.get('RAZORPAY_KEY_SECRET', 'dummy_secret')
    
    return razorpay.Client(auth=(key_id, key_secret))