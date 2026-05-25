import csv
import io
import re
import os
import uuid
import logging
import zipfile
from datetime import datetime
from urllib.parse import urlparse

from flask import request, jsonify, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt

from shop.extensions import db
from shop.models import (
    Category, Product, ProductImage,
    ProductVariant, Specification, User, BulkImportLog
)
from shop.utils.api_response import error_response

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────

REQUIRED_COLUMNS = {'product_name', 'description', 'price', 'stock', 'category_name', 'sku_code'}

MAX_CSV_ROWS       = 1000        # hard cap to prevent abuse
MAX_CSV_SIZE_MB    = 5
MAX_CSV_BYTES      = MAX_CSV_SIZE_MB * 1024 * 1024
MAX_ZIP_SIZE_MB    = 15
MAX_ZIP_BYTES      = MAX_ZIP_SIZE_MB * 1024 * 1024

_URL_RE = re.compile(
    r'^https?://'                            # http:// or https://
    r'(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,}'  # domain
    r'(?::\d+)?'                             # optional port
    r'(?:[/?#]\S*)?$',                       # optional path/query
    re.IGNORECASE,
)

# ── Helpers ────────────────────────────────────────────────────────────────────

def _s(val) -> str:
    """Strip whitespace from CSV cell; return empty string for None."""
    return (val or '').strip()


def _float_or_none(val) -> float | None:
    try:
        return float(_s(val))
    except (ValueError, TypeError):
        return None


def _int_or_none(val) -> int | None:
    try:
        return int(float(_s(val)))
    except (ValueError, TypeError):
        return None


def _is_valid_url(url: str) -> bool:
    """Return True for http/https URLs only."""
    return bool(url and _URL_RE.match(url))


def _decode_csv_bytes(data: bytes) -> tuple[str, str]:
    """Decode CSV bytes and return the text plus the detected encoding."""
    for encoding in ('utf-8-sig', 'utf-16'):
        try:
            return data.decode(encoding), encoding
        except UnicodeDecodeError:
            continue

    try:
        return data.decode('cp1252'), 'cp1252'
    except UnicodeDecodeError as exc:
        raise exc


def _validate_row(row: dict, row_num: int, existing_skus: set[str]) -> list[str]:
    """Return a list of validation error strings (empty list = row is valid)."""
    errors: list[str] = []

    # required fields
    for col in REQUIRED_COLUMNS:
        if not _s(row.get(col)):
            errors.append(f"Missing required field: '{col}'")

    # price
    price = _float_or_none(row.get('price'))
    if price is None or price <= 0:
        errors.append("'price' must be a positive number")

    # stock
    stock = _int_or_none(row.get('stock'))
    if stock is None or stock < 0:
        errors.append("'stock' must be a non-negative integer")

    # sku uniqueness (within the batch + DB)
    sku = _s(row.get('sku_code'))
    if sku and sku in existing_skus:
        errors.append(f"Duplicate SKU: '{sku}'")

    # image url (only if supplied)
    image_url = _s(row.get('image_url'))
    if image_url and not _is_valid_url(image_url):
        errors.append(f"Invalid image URL: '{image_url}'")

    # additional_price (if supplied must be a number)
    add_price_raw = _s(row.get('additional_price'))
    if add_price_raw:
        if _float_or_none(add_price_raw) is None:
            errors.append("'additional_price' must be a number")

    # stock_quantity (if supplied must be non-negative integer)
    sq_raw = _s(row.get('stock_quantity'))
    if sq_raw:
        sq = _int_or_none(sq_raw)
        if sq is None or sq < 0:
            errors.append("'stock_quantity' must be a non-negative integer")

    return errors


def _get_or_create_category(name: str, seller_id: int) -> Category:
    """Find category by name (case-insensitive) or create one."""
    cat = Category.query.filter(
        db.func.lower(Category.name) == name.lower(),
        Category.is_active == True,
    ).first()

    if not cat:
        cat = Category(
            name       = name,
            created_by = seller_id,
        )
        db.session.add(cat)
        db.session.flush()   # get cat.id immediately

    return cat


def _build_specs(row: dict) -> list[tuple[str, str]]:
    """Extract up to 5 spec key/value pairs from the row."""
    specs = []
    for i in range(1, 6):
        k = _s(row.get(f'spec_key_{i}'))
        v = _s(row.get(f'spec_value_{i}'))
        if k and v:
            specs.append((k[:100], v))
    return specs


# ── Main action ────────────────────────────────────────────────────────────────

def bulk_import_products_action():
    """
    POST /api/seller/products/bulk-import
    Accepts: multipart/form-data  { file: <CSV or ZIP file> }
    """
    # ── Auth ──────────────────────────────────────────────────────────────────
    try:
        verify_jwt_in_request()
        claims = get_jwt()
    except Exception as e:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401

    if claims.get('role') != 'seller':
        return error_response('Seller access required', 403)

    seller = User.query.filter_by(uuid=claims.get('user_uuid'), is_active=True).first()
    if not seller:
        return error_response('Seller account not found', 404)

    # ── File retrieval and validation ─────────────────────────────────────────
    # Support:
    # 1. Single CSV file under 'file'
    # 2. Single ZIP file under 'file' (contains CSV + images)
    # 3. CSV file under 'file' AND ZIP file under 'file' (both under 'file')
    # 4. CSV file under 'file' AND ZIP file under 'images' (separate fields)
    all_uploaded_files = request.files.getlist('file') + request.files.getlist('images')
    if not all_uploaded_files:
        return error_response("No file uploaded. Send a CSV or ZIP file via field name 'file'.", 400)

    csv_file = None
    zip_file = None

    for f in all_uploaded_files:
        if not f.filename:
            continue
        fname_lower = f.filename.lower()
        if fname_lower.endswith('.csv'):
            csv_file = f
        elif fname_lower.endswith('.zip'):
            zip_file = f

    # Fallback if extensions didn't match: use the first file
    if not csv_file and not zip_file:
        first_file = all_uploaded_files[0]
        fname_lower = first_file.filename.lower()
        if fname_lower.endswith('.csv'):
            csv_file = first_file
        elif fname_lower.endswith('.zip'):
            zip_file = first_file
        else:
            return error_response('Only CSV (.csv) or ZIP (.zip) files are accepted.', 400)

    # Size validations
    if csv_file:
        csv_file.seek(0, 2)
        csv_size = csv_file.tell()
        csv_file.seek(0)
        if csv_size > MAX_CSV_BYTES:
            return error_response(f'CSV file is too large ({csv_size // 1024} KB). Maximum allowed is {MAX_CSV_SIZE_MB} MB.', 413)

    if zip_file:
        zip_file.seek(0, 2)
        zip_size = zip_file.tell()
        zip_file.seek(0)
        if zip_size > MAX_ZIP_BYTES:
            return error_response(f'ZIP file is too large ({zip_size // 1024} KB). Maximum allowed is {MAX_ZIP_SIZE_MB} MB.', 413)

    # Log file details for debugging
    if csv_file:
        logger.info(f"Uploaded CSV name: {csv_file.filename}")
    if zip_file:
        logger.info(f"Uploaded ZIP name: {zip_file.filename}")

    csv_text = None
    zip_archive = None
    zip_files_list = []

    # Handle ZIP file if present (extract CSV if direct CSV upload was not provided)
    if zip_file:
        try:
            zip_bytes = zip_file.read()
            logger.info("Reading ZIP file...")
            zip_archive = zipfile.ZipFile(io.BytesIO(zip_bytes))
            zip_files_list = zip_archive.namelist()
            logger.info(f"Files in ZIP: {zip_files_list}")

            if not csv_file:
                # Find the CSV file inside the ZIP
                csv_filenames = [f for f in zip_files_list if f.lower().endswith('.csv') and not f.startswith('__MACOSX')]
                if not csv_filenames:
                    logger.error("No CSV file found in ZIP.")
                    return error_response('ZIP file does not contain a CSV configuration file.', 400)

                csv_content = zip_archive.read(csv_filenames[0])
                logger.info(f"Reading CSV file from ZIP: {csv_filenames[0]}")
                csv_text, detected_encoding = _decode_csv_bytes(csv_content)
                if detected_encoding != 'utf-8-sig':
                    logger.warning("CSV inside ZIP decoded using %s encoding", detected_encoding)
        except zipfile.BadZipFile:
            logger.error("Invalid or corrupted ZIP file.")
            return error_response('Invalid or corrupted ZIP file.', 400)
        except UnicodeDecodeError:
            logger.error("CSV inside ZIP could not be decoded.")
            return error_response('CSV inside ZIP could not be decoded. Please upload UTF-8 or Windows-1252 encoded CSV.', 400)

    # Handle CSV file if direct CSV upload was provided
    if csv_file:
        try:
            raw_bytes = csv_file.read()
            logger.info("Reading plain CSV file...")
            csv_text, detected_encoding = _decode_csv_bytes(raw_bytes)
            if detected_encoding != 'utf-8-sig':
                logger.warning("Uploaded CSV decoded using %s encoding", detected_encoding)
        except UnicodeDecodeError:
            logger.error("Uploaded CSV could not be decoded.")
            return error_response('CSV could not be decoded. Please upload UTF-8 or Windows-1252 encoded CSV.', 400)

    if not csv_text:
        return error_response('No product CSV file provided.', 400)

    # ── Parse CSV rows ────────────────────────────────────────────────────────
    try:
        reader = csv.DictReader(io.StringIO(csv_text))
        rows = list(reader)
    except csv.Error as ce:
        return error_response(f'Malformed CSV: {ce}', 400)

    if not rows:
        return error_response('CSV file is empty.', 400)

    if len(rows) > MAX_CSV_ROWS:
        return error_response(
            f'CSV contains {len(rows)} rows. Maximum allowed per import: {MAX_CSV_ROWS}.',
            400,
        )

    # Validate headers
    if not reader.fieldnames:
        return error_response('CSV has no header row.', 400)

    actual_cols = {c.strip().lower() for c in reader.fieldnames}
    missing_required = REQUIRED_COLUMNS - actual_cols
    if missing_required:
        return error_response(
            f"CSV is missing required columns: {', '.join(sorted(missing_required))}",
            400,
        )

    # Normalise row keys
    rows = [{k.strip(): v for k, v in row.items()} for row in rows]

    # Pre-load existing SKUs
    existing_sku_set: set[str] = {
        r[0]
        for r in db.session.query(ProductVariant.sku_code)
            .filter(ProductVariant.sku_code.isnot(None))
            .all()
    }

    # ── Process rows ──────────────────────────────────────────────────────────
    total_rows    = len(rows)
    imported      = 0
    failed        = 0
    errors_list   = []

    batch_skus: set[str] = set()
    cat_cache: dict[str, Category] = {}

    for row_idx, row in enumerate(rows, start=2):   # row 1 is headers

        if all(not v or not v.strip() for v in row.values()):
            continue

        sku = _s(row.get('sku_code'))
        check_skus = existing_sku_set | batch_skus

        # Validate basic row constraints
        row_errors = _validate_row(row, row_idx, check_skus)
        if row_errors:
            failed += 1
            err_msg = '; '.join(row_errors)
            errors_list.append({'row': row_idx, 'message': err_msg})
            # Log validation failure to database
            db.session.add(BulkImportLog(
                sku        = sku or None,
                status     = 'failed',
                message    = f"Validation Error (Row {row_idx}): {err_msg}",
                created_by = seller.id
            ))
            continue

        # ── Atomically process database insertion ─────────────────────────────
        try:
            with db.session.begin_nested():   # SAVEPOINT

                # 1. Category Lookup/Creation
                cat_name = _s(row.get('category_name'))
                cat_key = cat_name.lower()
                if cat_key not in cat_cache:
                    cat_cache[cat_key] = _get_or_create_category(cat_name, seller.id)
                category = cat_cache[cat_key]

                # 2. Product Insertion
                price = float(_float_or_none(row.get('price')))
                stock = int(_int_or_none(row.get('stock')))

                product = Product(
                    name        = _s(row.get('product_name'))[:200],
                    description = _s(row.get('description')),
                    price       = price,
                    stock       = stock,
                    category_id = category.id,
                    seller_id   = seller.id,
                    created_by  = seller.id,
                )
                db.session.add(product)
                db.session.flush()   # generates product.id

                # 3. ProductVariant Insertion
                add_price_raw = _s(row.get('additional_price'))
                additional_price = float(_float_or_none(add_price_raw) or 0.0)

                sq_raw = _s(row.get('stock_quantity'))
                stock_quantity = _int_or_none(sq_raw)
                if stock_quantity is None or stock_quantity < 0:
                    stock_quantity = stock

                variant_name = _s(row.get('variant_name')) or None
                color_name   = _s(row.get('color_name'))   or None
                color_code   = _s(row.get('color_code'))   or None
                size         = _s(row.get('size'))          or None

                variant = ProductVariant(
                    product_id       = product.id,
                    variant_name     = variant_name[:120] if variant_name else None,
                    sku_code         = sku,
                    color_name       = color_name[:80] if color_name else None,
                    color_code       = color_code[:10] if color_code else None,
                    size             = size[:40]        if size        else None,
                    additional_price = additional_price,
                    stock_quantity   = stock_quantity,
                    created_by       = seller.id,
                )
                db.session.add(variant)
                db.session.flush()   # generates variant.id

                # 4. Image mapping (ZIP matches or CSV URL)
                images_added_count = 0
                
                # Check for images inside ZIP matching: <SKU>-<index>.<ext>
                if zip_archive and sku:
                    sku_lower = sku.lower()
                    # Find all files in the zip that match the sku pattern
                    matching_zip_paths = []
                    for path in zip_files_list:
                        basename = os.path.basename(path)
                        # Pattern matches: <sku>-<digits>.<allowed_ext>
                        match = re.match(
                            rf"^{re.escape(sku_lower)}-(\d+)\.(jpg|jpeg|png|webp|gif|bmp|tiff|tif|avif|heic|heif|svg)$",
                            basename,
                            re.IGNORECASE
                        )
                        if match:
                            index = int(match.group(1))
                            matching_zip_paths.append((index, path))

                    # Sort matching paths numerically by their index
                    matching_zip_paths.sort(key=lambda x: x[0])

                    for index, (regex_index, path_in_zip) in enumerate(matching_zip_paths):
                        try:
                            # Read bytes of file inside zip
                            img_bytes = zip_archive.read(path_in_zip)
                            ext = path_in_zip.rsplit('.', 1)[1].lower()
                            
                            # Save to disk using a unique UUID filename
                            unique_filename = f"{uuid.uuid4().hex}.{ext}"
                            upload_dir = os.path.join(current_app.root_path, 'static', 'uploads', 'products')
                            os.makedirs(upload_dir, exist_ok=True)
                            
                            with open(os.path.join(upload_dir, unique_filename), 'wb') as f:
                                f.write(img_bytes)

                            # Save product image entry
                            db.session.add(ProductImage(
                                product_id = product.id,
                                variant_id = variant.id,
                                image_url  = f"/static/uploads/products/{unique_filename}",
                                is_primary = (index == 0),   # first image is primary
                                sort_order = index,
                                created_by = seller.id
                            ))
                            images_added_count += 1
                        except Exception as img_err:
                            logger.error(f"Failed to process ZIP image '{path_in_zip}': {img_err}")

                # Fallback to CSV image_url column if no ZIP images were found
                if images_added_count == 0:
                    image_url = _s(row.get('image_url'))
                    if image_url and _is_valid_url(image_url):
                        is_primary_raw = _s(row.get('is_primary', 'true')).lower()
                        is_primary = is_primary_raw not in ('false', '0', 'no')

                        db.session.add(ProductImage(
                            product_id = product.id,
                            variant_id = variant.id,
                            image_url  = image_url[:255],
                            is_primary = is_primary,
                            sort_order = 0,
                            created_by = seller.id,
                        ))
                        images_added_count = 1

                # 5. Specifications
                for spec_key, spec_val in _build_specs(row):
                    db.session.add(Specification(
                        product_id = product.id,
                        spec_key   = spec_key,
                        spec_value = spec_val,
                        created_by = seller.id,
                    ))

            # Commit the row savepoint
            batch_skus.add(sku)
            imported += 1

            # Log success to database
            msg = f"Successfully imported product with {images_added_count} image(s)"
            db.session.add(BulkImportLog(
                sku        = sku,
                status     = 'success',
                message    = msg,
                created_by = seller.id
            ))

        except Exception as row_exc:
            failed += 1
            err_msg = f"Database error: {row_exc}"
            errors_list.append({'row': row_idx, 'message': err_msg})
            logger.warning(f'Bulk import row {row_idx} failed: {row_exc}')
            
            # Log failure to database
            db.session.add(BulkImportLog(
                sku        = sku or None,
                status     = 'failed',
                message    = err_msg,
                created_by = seller.id
            ))

    # ── Final Commit ──────────────────────────────────────────────────────────
    try:
        db.session.commit()
    except Exception as commit_exc:
        db.session.rollback()
        logger.error(f'Bulk import final commit failed: {commit_exc}')
        return error_response(f'Commit failed: {commit_exc}', 500)

    # Invalidate catalog cache
    if imported > 0:
        try:
            from shop.utils.cache_utils import invalidate_product_catalog
            invalidate_product_catalog()
        except Exception:
            pass

    # Close zip if open
    if zip_archive:
        try:
            zip_archive.close()
        except Exception:
            pass

    # ── Response ──────────────────────────────────────────────────────────────
    return jsonify({
        'success':    imported > 0 or total_rows == 0,
        'total_rows': total_rows,
        'imported':   imported,
        'failed':     failed,
        'errors':     errors_list,
    }), (200 if imported > 0 else 400)


def list_bulk_import_logs_action():
    """
    GET /api/seller/products/bulk-import/logs
    Returns: JSON list of bulk import audit logs for this seller.
    """
    try:
        verify_jwt_in_request()
        claims = get_jwt()
    except Exception:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401

    if claims.get('role') != 'seller':
        return error_response('Seller access required', 403)

    seller = User.query.filter_by(uuid=claims.get('user_uuid'), is_active=True).first()
    if not seller:
        return error_response('Seller account not found', 404)

    logs = BulkImportLog.query.filter_by(created_by=seller.id, is_active=True)\
        .order_by(BulkImportLog.created_at.desc()).all()

    return jsonify({
        'success': True,
        'logs': [{
            'uuid': log.uuid,
            'sku': log.sku,
            'status': log.status,
            'message': log.message,
            'created_at': log.created_at.isoformat()
        } for log in logs]
    }), 200

