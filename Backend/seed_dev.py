import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from accounts.models import User, Role
from catalog.models import Brand, Category, Product, ProductType, ProductVariant, ProductImage
from stock.models import Stock

# --- Users ---
admin, created = User.objects.get_or_create(
    email="admin@protech.com",
    defaults={"full_name": "Protech Admin", "is_staff": True, "is_superuser": True, "is_email_verified": True, "role": "admin"},
)
if created:
    admin.set_password("Admin@12345")
    admin.save()
    print("Created admin")

customer, created = User.objects.get_or_create(
    email="customer@protech.com",
    defaults={"full_name": "Test Customer", "is_email_verified": True, "role": "customer"},
)
if created:
    customer.set_password("Customer@12345")
    customer.save()
    role, _ = Role.objects.get_or_create(name="customer", defaults={"description": "Standard customer role"})
    customer.roles.add(role)
    print("Created customer")

# --- Brand ---
brand, _ = Brand.objects.get_or_create(
    slug="protech", defaults={"name": "Protech", "description": "Premium tech gear"}
)
brand2, _ = Brand.objects.get_or_create(
    slug="audiosphere", defaults={"name": "AudioSphere", "description": "Immersive audio"}
)

# --- Categories ---
computing, _ = Category.objects.get_or_create(
    slug="computing", defaults={"name": "Computing", "description": "Computing hardware"}
)
laptops, _ = Category.objects.get_or_create(
    slug="laptops", defaults={"name": "Laptops", "description": "Portable computers", "parent": computing}
)
accessories, _ = Category.objects.get_or_create(
    slug="accessories", defaults={"name": "Accessories", "description": "Peripherals", "parent": computing}
)
audio, _ = Category.objects.get_or_create(
    slug="audio", defaults={"name": "Audio", "description": "Audio equipment"}
)
headphones, _ = Category.objects.get_or_create(
    slug="headphones", defaults={"name": "Headphones", "description": "Headphones", "parent": audio}
)

ptype_physical = ProductType.objects.filter(name="Physical").first()

def make_product(slug, name, category, brand, price, compare_at, desc, images):
    product, created = Product.objects.get_or_create(
        slug=slug,
        defaults={
            "name": name,
            "category": category,
            "brand": brand,
            "type": ptype_physical,
            "base_price": price,
            "compare_at_price": compare_at,
            "description": desc,
            "short_description": desc[:120],
            "status": "active",
            "is_active": True,
            "is_featured": True,
        },
    )
    return product

def make_variant(product, sku, name, price, available, image=None, specifications=None):
    specs = specifications or {}
    variant, created = ProductVariant.objects.get_or_create(
        sku=sku,
        defaults={"product": product, "name": name, "price": price, "status": "active", "specifications": specs},
    )
    if not created:
        variant.name = name
        variant.price = price
        variant.specifications = specs
        variant.save()

    Stock.objects.get_or_create(variant=variant, defaults={"quantity_available": available, "reorder_level": 2})
    if image:
        ProductImage.objects.get_or_create(
            product=product,
            image_url=image,
            defaults={"is_primary": True},
        )
    return variant

IMG_LAPTOP = "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80"
IMG_KEYBOARD = "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80"
IMG_HEADPHONES = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80"
IMG_MOUSE = "https://images.unsplash.com/photo-1527814050087-3793815479db?w=800&q=80"

p1 = make_product(
    "probook-pro-15",
    "ProBook Pro 15",
    laptops,
    brand,
    1299.99,
    1499.99,
    "A powerful 15-inch ultrabook with the latest processor, high-speed RAM, and fast NVMe SSD storage.",
    IMG_LAPTOP,
)
make_variant(
    p1,
    "PB-PRO15-BASE",
    "16GB RAM / 512GB SSD",
    1299.99,
    25,
    IMG_LAPTOP,
    specifications={
        "os": "Windows 11 Home",
        "processor": "Intel Core Ultra 7 155H",
        "graphics": "Intel Arc Graphics",
        "ram": "16 GB LPDDR5X",
        "storage": "512 GB NVMe SSD",
        "display": "15.6\" 2.8K OLED 120Hz",
    },
)
make_variant(
    p1,
    "PB-PRO15-HIGH",
    "32GB RAM / 1TB SSD / RTX 4060",
    1599.99,
    2,
    IMG_LAPTOP,
    specifications={
        "os": "Windows 11 Pro",
        "processor": "Intel Core Ultra 9 185H",
        "graphics": "NVIDIA GeForce RTX 4060 8GB",
        "ram": "32 GB LPDDR5X",
        "storage": "1 TB NVMe Gen4 SSD",
        "display": "15.6\" 2.8K OLED 120Hz Touch",
    },
)

p2 = make_product(
    "nova-mechanical-keyboard",
    "Nova Mechanical Keyboard",
    accessories,
    brand2,
    89.99,
    119.99,
    "Hot-swappable mechanical keyboard with RGB backlighting and aluminum frame.",
    IMG_KEYBOARD,
)
make_variant(
    p2,
    "NOVA-KB-BLUE",
    "Clicky Blue Switch",
    89.99,
    3,
    IMG_KEYBOARD,
    specifications={
        "processor": "32-bit ARM Cortex-M4",
        "connectivity": "USB-C & 2.4GHz Wireless",
        "key_switches": "Tactile Clicky Blue (50g)",
        "backlight": "Per-Key RGB 16.8M colors",
        "battery": "4000 mAh Rechargeable",
    },
)
make_variant(
    p2,
    "NOVA-KB-RED",
    "Linear Red Switch",
    89.99,
    40,
    IMG_KEYBOARD,
    specifications={
        "processor": "32-bit ARM Cortex-M4",
        "connectivity": "USB-C & 2.4GHz Wireless",
        "key_switches": "Smooth Linear Red (45g)",
        "backlight": "Per-Key RGB 16.8M colors",
        "battery": "4000 mAh Rechargeable",
    },
)

p3 = make_product(
    "audiosphere-wireless-headphones",
    "AudioSphere Wireless Headphones",
    headphones,
    brand2,
    199.99,
    249.99,
    "Active noise cancelling over-ear headphones with 40h battery life.",
    IMG_HEADPHONES,
)
make_variant(
    p3,
    "AS-WH-BLACK",
    "Matte Black Edition",
    199.99,
    5,
    IMG_HEADPHONES,
    specifications={
        "driver": "40mm Custom Dynamic Drivers",
        "anc": "Hybrid Active Noise Cancellation",
        "battery": "40 Hours Playback",
        "bluetooth": "Bluetooth 5.3 Multipoint",
        "codecs": "LDAC, AAC, SBC",
    },
)
make_variant(
    p3,
    "AS-WH-WHITE",
    "Pearl White Edition",
    199.99,
    0,
    IMG_HEADPHONES,
    specifications={
        "driver": "40mm Custom Dynamic Drivers",
        "anc": "Hybrid Active Noise Cancellation",
        "battery": "40 Hours Playback",
        "bluetooth": "Bluetooth 5.3 Multipoint",
        "codecs": "LDAC, AAC, SBC",
    },
)

p4 = make_product(
    "protech-wireless-mouse",
    "Protech Wireless Mouse",
    accessories,
    brand,
    29.99,
    None,
    "Silent click ergonomic wireless mouse with 2.4GHz and Bluetooth.",
    IMG_MOUSE,
)
make_variant(
    p4,
    "PT-MOUSE-BLK",
    "Ergonomic Black",
    29.99,
    100,
    IMG_MOUSE,
    specifications={
        "sensor": "Optical 4000 DPI Sensor",
        "connectivity": "Dual Mode (Bluetooth 5.0 + 2.4G)",
        "battery": "Up to 18 Months (1x AA)",
        "buttons": "6 Programmable Silent Buttons",
    },
)

print("Seeding complete. Admin: admin@protech.com / Admin@12345 | Customer: customer@protech.com / Customer@12345")