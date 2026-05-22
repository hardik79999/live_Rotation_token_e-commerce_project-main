import os
import re

def fix_file(filepath):
    with open(filepath, 'r') as f:
        lines = f.readlines()

    # Check if 'from flask import' exists at top level
    flask_import_line_idx = -1
    has_jsonify_at_top = False
    
    for i, line in enumerate(lines):
        if line.startswith('from flask import'):
            flask_import_line_idx = i
            if 'jsonify' in line:
                has_jsonify_at_top = True
            break
        if line.startswith('import flask'):
            flask_import_line_idx = i # Not quite right but we'll see
            break
            
    new_lines = []
    changed = False
    
    for i, line in enumerate(lines):
        # Match "    from flask import jsonify" or similar with any amount of leading spaces
        if re.match(r'^\s+from flask import jsonify', line):
            changed = True
            continue # Remove this line
        new_lines.append(line)

    if changed:
        # Ensure jsonify is at the top
        if not has_jsonify_at_top:
            if flask_import_line_idx != -1:
                # Add to existing flask import
                old_line = new_lines[flask_import_line_idx]
                if 'import ' in old_line:
                    parts = old_line.split('import ')
                    new_line = f"{parts[0]}import jsonify, {parts[1]}"
                    new_lines[flask_import_line_idx] = new_line
            else:
                # Add a new one at the top (after docstring)
                insert_idx = 0
                if new_lines and new_lines[0].startswith('"""'):
                    # skip docstring
                    for j, l in enumerate(new_lines):
                        if j > 0 and l.strip().endswith('"""'):
                            insert_idx = j + 1
                            break
                new_lines.insert(insert_idx, "from flask import jsonify\n")
        
        with open(filepath, 'w') as f:
            f.writelines(new_lines)
        print(f"Fixed {filepath}")

files = [
    "shop/admin/api/approve_category.py",
    "shop/admin/api/create_category.py",
    "shop/admin/api/list_returns.py",
    "shop/admin/api/manage_category.py",
    "shop/admin/api/manage_seller.py",
    "shop/admin/api/seller_surveillance.py",
    "shop/auth/api/profile_delete.py",
    "shop/auth/api/profile_photo.py",
    "shop/auth/api/profile.py",
    "shop/chat/api.py",
    "shop/seller/api/analytics.py",
    "shop/seller/api/buyer_details.py",
    "shop/seller/api/category_request.py",
    "shop/seller/api/coupons.py",
    "shop/seller/api/create_product.py",
    "shop/seller/api/delete_product.py",
    "shop/seller/api/get_categories.py",
    "shop/seller/api/get_orders.py",
    "shop/seller/api/get_products.py",
    "shop/seller/api/order_status.py",
    "shop/seller/api/return_management.py",
    "shop/seller/api/update_product.py",
    "shop/user/api/address.py",
    "shop/user/api/checkout.py",
    "shop/user/api/invoice_pdf.py",
    "shop/user/api/invoice.py",
    "shop/user/api/orders.py",
    "shop/user/api/promo.py",
    "shop/user/api/return_order.py",
    "shop/user/api/review.py",
    "shop/user/api/verify_payment.py",
    "shop/user/api/wallet.py",
    "shop/user/api/wishlist.py"
]

for f in files:
    if os.path.exists(f):
        fix_file(f)
