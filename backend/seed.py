#!/usr/bin/env python3
"""
seed.py — ShopHub data seeder.

Creates:
  • 3 Users  (1 admin, 1 seller, 1 customer)
  • 105 Categories with emoji icons  (no products, no approvals)

Usage:
    python seed.py              # seed roles + users + categories
    python seed.py --wipe       # wipe everything first, then seed
    python seed.py --categories # only update/add categories
"""
import argparse
from datetime import datetime, timezone

from app import app
from shop.extensions import db, bcrypt
from shop.models import Role, User, Category

# ── Helpers ───────────────────────────────────────────────────
def _pw(plain: str) -> str:
    return bcrypt.generate_password_hash(plain).decode('utf-8')

# ── 105 Categories ────────────────────────────────────────────
CATEGORIES = [
    # Technology & Electronics
    ("Electronics",            "📱", "Phones, laptops, gadgets and accessories"),
    ("Mobile Phones",          "📲", "Smartphones, feature phones and accessories"),
    ("Laptops & Computers",    "💻", "Laptops, desktops, monitors and peripherals"),
    ("Tablets",                "📟", "iPads, Android tablets and e-readers"),
    ("Cameras & Photography",  "📷", "DSLRs, mirrorless cameras, lenses and tripods"),
    ("Gaming",                 "🎮", "Consoles, controllers, games and accessories"),
    ("Smart Home",             "🏡", "Smart speakers, bulbs, cameras and doorbells"),
    ("Drones & RC",            "🚁", "Drones, remote control cars and accessories"),
    ("Wearables",              "⌚", "Smartwatches, fitness bands and AR glasses"),
    ("Audio & Headphones",     "🎧", "Headphones, earbuds, speakers and amplifiers"),
    ("TV & Home Theatre",      "📺", "Televisions, projectors and home theatre systems"),
    ("Networking",             "📡", "Routers, switches, modems and network cables"),
    ("Storage & Drives",       "💾", "SSDs, HDDs, USB drives and memory cards"),
    ("Printers & Scanners",    "🖨️", "Inkjet, laser printers and document scanners"),
    ("Computer Accessories",   "🖱️", "Keyboards, mice, webcams and USB hubs"),

    # Fashion & Apparel
    ("Fashion",                "👗", "Clothing, footwear and accessories for all"),
    ("Men's Clothing",         "👔", "Shirts, trousers, suits and casual wear for men"),
    ("Women's Clothing",       "👘", "Dresses, tops, sarees and ethnic wear for women"),
    ("Kids' Clothing",         "🧒", "T-shirts, frocks, school uniforms and more"),
    ("Footwear",               "👟", "Sneakers, formal shoes, sandals and boots"),
    ("Bags & Wallets",         "👜", "Handbags, backpacks, clutches and wallets"),
    ("Sunglasses & Eyewear",   "🕶️", "Sunglasses, frames and contact lenses"),
    ("Watches",                "⌚", "Luxury, smart and casual watches for all"),
    ("Jewellery",              "💍", "Rings, necklaces, earrings and bracelets"),
    ("Caps & Hats",            "🧢", "Baseball caps, beanies, sun hats and more"),
    ("Scarves & Stoles",       "🧣", "Silk, wool and cotton scarves and stoles"),
    ("Belts",                  "👔", "Leather, fabric and designer belts"),
    ("Socks & Innerwear",      "🧦", "Socks, briefs, bras and thermal innerwear"),
    ("Ethnic Wear",            "🥻", "Sarees, kurtas, sherwanis and lehengas"),
    ("Activewear",             "🩱", "Gym wear, yoga pants, sports bras and shorts"),

    # Home & Living
    ("Home & Kitchen",         "🏠", "Appliances, cookware and home décor"),
    ("Kitchen Appliances",     "🍳", "Mixers, microwaves, toasters and ovens"),
    ("Furniture",              "🛋️", "Sofas, beds, tables and storage solutions"),
    ("Bedding & Bath",         "🛁", "Bedsheets, pillows, towels and bath accessories"),
    ("Lighting",               "💡", "LED bulbs, lamps, chandeliers and smart lights"),
    ("Home Décor",             "🖼️", "Wall art, vases, candles and decorative items"),
    ("Garden & Outdoors",      "🌿", "Plants, tools, furniture and outdoor décor"),
    ("Cleaning Supplies",      "🧹", "Mops, brooms, detergents and cleaning tools"),
    ("Storage & Organisation", "📦", "Boxes, shelves, hangers and organisers"),
    ("Cookware & Bakeware",    "🍲", "Pans, pots, baking trays and utensils"),
    ("Dining & Tableware",     "🍽️", "Plates, glasses, cutlery and serving bowls"),
    ("Tools & Hardware",       "🔧", "Power tools, hand tools and safety equipment"),
    ("Flooring & Carpets",     "🏠", "Rugs, carpets, mats and floor tiles"),
    ("Curtains & Blinds",      "🪟", "Curtains, blinds, rods and accessories"),
    ("Wall Paints & Finishes", "🎨", "Interior paints, primers and wall textures"),

    # Health & Beauty
    ("Health & Wellness",      "💊", "Vitamins, supplements and medical devices"),
    ("Beauty & Personal",      "💄", "Skincare, haircare and grooming essentials"),
    ("Skincare",               "🧴", "Moisturisers, serums, sunscreens and masks"),
    ("Haircare",               "💇", "Shampoos, conditioners, oils and styling tools"),
    ("Makeup & Cosmetics",     "💋", "Lipsticks, foundations, mascaras and palettes"),
    ("Fragrances",             "🌸", "Perfumes, deodorants and body mists"),
    ("Men's Grooming",         "🪒", "Razors, shaving creams, beard oils and trimmers"),
    ("Oral Care",              "🦷", "Toothbrushes, toothpaste, mouthwash and floss"),
    ("Feminine Care",          "🌺", "Sanitary products, intimate wash and care"),
    ("Medical Devices",        "🩺", "BP monitors, glucometers, thermometers"),
    ("Nutrition & Protein",    "🥤", "Protein powders, energy bars and supplements"),
    ("Ayurveda & Herbal",      "🌿", "Herbal supplements, oils and Ayurvedic products"),

    # Sports & Fitness
    ("Sports & Fitness",       "🏋️", "Gym equipment, sportswear and outdoor gear"),
    ("Yoga & Meditation",      "🧘", "Yoga mats, blocks, straps and meditation aids"),
    ("Cycling",                "🚴", "Bicycles, helmets, locks and cycling gear"),
    ("Swimming & Water",       "🏊", "Swimwear, goggles, floats and pool accessories"),
    ("Cricket",                "🏏", "Bats, balls, pads, gloves and cricket kits"),
    ("Football",               "⚽", "Footballs, boots, shin guards and jerseys"),
    ("Badminton",              "🏸", "Rackets, shuttlecocks, nets and shoes"),
    ("Tennis",                 "🎾", "Rackets, balls, strings and tennis shoes"),
    ("Basketball",             "🏀", "Basketballs, hoops, jerseys and shoes"),
    ("Gym Equipment",          "🏋️", "Dumbbells, barbells, benches and machines"),
    ("Outdoor Adventure",      "🏕️", "Tents, sleeping bags, trekking poles and gear"),
    ("Martial Arts",           "🥋", "Gloves, uniforms, pads and training equipment"),

    # Books & Education
    ("Books",                  "📚", "Fiction, non-fiction, textbooks and more"),
    ("Academic Books",         "🎓", "School, college and competitive exam books"),
    ("Children's Books",       "📖", "Picture books, story books and activity books"),
    ("Comics & Manga",         "🦸", "Marvel, DC, manga and graphic novels"),
    ("Stationery & Art",       "🎨", "Sketchbooks, paints, pens and craft supplies"),
    ("Musical Instruments",    "🎸", "Guitars, keyboards, drums and accessories"),
    ("E-Learning",             "🖥️", "Online courses, software and learning tools"),

    # Food & Grocery
    ("Grocery & Food",         "🛒", "Packaged foods, snacks and beverages"),
    ("Snacks & Namkeen",       "🍿", "Chips, biscuits, namkeen and dry fruits"),
    ("Beverages",              "☕", "Tea, coffee, juices, energy drinks and water"),
    ("Dairy & Eggs",           "🥛", "Milk, butter, cheese, curd and eggs"),
    ("Organic & Natural",      "🌾", "Organic grains, oils, honey and superfoods"),
    ("Spices & Condiments",    "🌶️", "Masalas, sauces, pickles and vinegars"),
    ("Frozen & Ready-to-Eat",  "🧊", "Frozen meals, instant noodles and ready foods"),
    ("Bakery & Sweets",        "🍰", "Cakes, cookies, mithai and chocolates"),

    # Baby & Kids
    ("Baby & Maternity",       "👶", "Diapers, strollers, feeding and baby care"),
    ("Baby Clothing",          "🍼", "Onesies, rompers, bibs and baby accessories"),
    ("Baby Gear",              "🛒", "Strollers, car seats, carriers and bouncers"),
    ("Toys & Games",           "🧸", "Toys, board games and educational kits"),
    ("Educational Toys",       "🔬", "STEM kits, puzzles, building blocks and more"),
    ("School Supplies",        "✏️", "Bags, stationery, lunch boxes and water bottles"),

    # Automotive
    ("Automotive",             "🚗", "Car accessories, tools and maintenance"),
    ("Car Accessories",        "🚘", "Seat covers, mats, chargers and organisers"),
    ("Bike Accessories",       "🏍️", "Helmets, gloves, covers and bike care"),
    ("Car Care",               "🧽", "Wax, polish, cleaners and detailing kits"),
    ("Tyres & Wheels",         "🛞", "Tyres, alloy wheels, rims and tyre care"),
    ("GPS & Navigation",       "🗺️", "GPS devices, dash cams and parking sensors"),

    # Travel & Lifestyle
    ("Travel & Luggage",       "🧳", "Suitcases, backpacks and travel accessories"),
    ("Travel Accessories",     "✈️", "Neck pillows, adapters, locks and pouches"),
    ("Camping & Hiking",       "⛺", "Tents, sleeping bags, torches and survival gear"),

    # Office & Professional
    ("Office Supplies",        "🖊️", "Stationery, printers and desk accessories"),
    ("Office Furniture",       "🪑", "Chairs, desks, cabinets and shelving"),
    ("Packaging Materials",    "📦", "Boxes, tapes, bubble wrap and labels"),

    # Pets
    ("Pet Supplies",           "🐾", "Food, toys and accessories for your pets"),
    ("Dog Supplies",           "🐶", "Dog food, leashes, beds and grooming"),
    ("Cat Supplies",           "🐱", "Cat food, litter, toys and scratching posts"),
    ("Aquarium & Fish",        "🐠", "Fish food, tanks, filters and decorations"),
    ("Bird Supplies",          "🐦", "Bird food, cages, perches and accessories"),
]


def wipe_data():
    print("Wiping all data...")
    meta = db.metadata
    for table in reversed(meta.sorted_tables):
        if table.name not in ('roles',):
            db.session.execute(table.delete())
    db.session.commit()
    print("Wiped.")


def seed_roles():
    for name in ('admin', 'seller', 'customer'):
        if not Role.query.filter_by(role_name=name).first():
            db.session.add(Role(role_name=name))
    db.session.commit()


def seed_categories():
    added = 0
    updated = 0
    for name, icon, desc in CATEGORIES:
        cat = Category.query.filter(db.func.lower(Category.name) == name.lower()).first()
        if cat:
            cat.icon = icon
            cat.description = desc
            cat.is_active = True
            updated += 1
        else:
            db.session.add(Category(name=name, icon=icon, description=desc))
            added += 1
    db.session.commit()
    print(f"  Categories: {added} added, {updated} updated. Total = {len(CATEGORIES)}.")


def seed_users():
    admin_role    = Role.query.filter_by(role_name='admin').first()
    seller_role   = Role.query.filter_by(role_name='seller').first()
    customer_role = Role.query.filter_by(role_name='customer').first()

    def upsert_user(username, email, password, role_id, is_verified=True, wallet_balance=0.0):
        user = User.query.filter_by(email=email).first()
        if user:
            user.username = username
            user.password = _pw(password)
            user.role_id = role_id
            user.is_verified = is_verified
            if wallet_balance:
                user.wallet_balance = wallet_balance
        else:
            db.session.add(User(
                username=username, email=email,
                password=_pw(password), role_id=role_id,
                is_verified=is_verified,
                wallet_balance=wallet_balance
            ))

    upsert_user('admin', 'admin@ecommerece.com', 'Admin@123', admin_role.id)
    upsert_user('hardik', 'hardikbandhiya2004@gmail.com', '78997899', seller_role.id)
    upsert_user('ravi', 'ravibandhiya7899@gmail.com', '78997899', customer_role.id, wallet_balance=500.0)

    db.session.commit()
    print("  Users: 1 admin, 1 seller, 1 customer (upserted).")


def main():
    parser = argparse.ArgumentParser(description='Seed ShopHub')
    parser.add_argument('--wipe',       action='store_true', help='Wipe all data before seeding')
    parser.add_argument('--categories', action='store_true', help='Only seed/update categories')
    args = parser.parse_args()

    with app.app_context():
        if args.wipe:
            wipe_data()

        print('\nSeeding ShopHub...\n')
        seed_roles()

        if args.categories:
            seed_categories()
            print('\nDone.\n')
            return

        seed_categories()
        seed_users()

        print('\nDone! Login credentials:')
        print('  Admin    -> admin@ecommerece.com                     / Admin@123')
        print('  Seller   -> hardikbandhiya2004@gmail.com             / 78997899')
        print('  Customer -> ravibandhiya7899@gmail.com               / 78997899\n')


if __name__ == '__main__':
    main()
