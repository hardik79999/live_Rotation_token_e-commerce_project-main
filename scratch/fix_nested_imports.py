import os
import re

def fix_nested_imports(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    lines = content.splitlines()
    
    # 1. Find all nested 'from shop.models import ...'
    nested_imports = []
    new_lines = []
    
    for line in lines:
        match = re.match(r'^(\s+)from shop\.models import (.+)$', line)
        if match and match.group(1): # Indented
            models = [m.strip() for m in match.group(2).replace('(', '').replace(')', '').split(',')]
            nested_imports.extend(models)
            continue # Remove this line
        new_lines.append(line)

    if not nested_imports:
        return # No changes

    # 2. Add these models to the top-level import
    top_level_import_idx = -1
    for i, line in enumerate(new_lines):
        if line.startswith('from shop.models import'):
            top_level_import_idx = i
            break
    
    if top_level_import_idx != -1:
        # Check if it's a multi-line import
        if '(' in new_lines[top_level_import_idx]:
            # Find the closing parenthesis
            end_idx = top_level_import_idx
            for j in range(top_level_import_idx, len(new_lines)):
                if ')' in new_lines[j]:
                    end_idx = j
                    break
            
            # Extract existing models
            existing_models_str = "".join(new_lines[top_level_import_idx:end_idx+1])
            existing_models = re.findall(r'(\w+)', existing_models_str[existing_models_str.find('import'):])
            if 'import' in existing_models: existing_models.remove('import')
            
            to_add = [m for m in nested_imports if m and m not in existing_models]
            if to_add:
                # Add before the closing parenthesis
                last_line = new_lines[end_idx]
                if last_line.strip() == ')':
                    # Insert before this line
                    for m in to_add:
                        new_lines.insert(end_idx, f"    {m},")
                        end_idx += 1
                else:
                    # Replace last line
                    new_lines[end_idx] = last_line.replace(')', f", {', '.join(to_add)})")
        else:
            # Single line import
            line = new_lines[top_level_import_idx]
            existing_models = [m.strip() for m in line.split('import ')[1].split(',')]
            to_add = [m for m in nested_imports if m and m not in existing_models]
            if to_add:
                new_lines[top_level_import_idx] = line + ", " + ", ".join(to_add)
    else:
        # No top-level import, add one
        new_lines.insert(0, f"from shop.models import {', '.join(set(nested_imports))}")

    with open(filepath, 'w') as f:
        f.write("\n".join(new_lines) + "\n")
    print(f"Fixed nested imports in {filepath}")

files = [
    "shop/admin/api/approve_category.py",
    "shop/search/routes.py",
    "shop/seller/api/order_status.py",
    "shop/user/api/checkout.py",
    "shop/user/api/invoice_pdf.py",
    "shop/user/api/return_order.py",
    "shop/utils/scheduler.py"
]

for f in files:
    if os.path.exists(f):
        fix_nested_imports(f)
