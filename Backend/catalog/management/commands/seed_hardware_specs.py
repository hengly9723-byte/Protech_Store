# -*- coding: utf-8 -*-
from django.core.management.base import BaseCommand
from catalog.models import Category, SpecificationDefinition, SpecificationOption

HARDWARE_SPECS = [
    {
        "name": "OS",
        "slug": "os",
        "sort_order": 1,
        "options": [
            "Windows 11 Home",
            "Windows 11 Pro",
            "Windows 10 Pro",
            "macOS Sequoia",
            "ChromeOS",
        ],
    },
    {
        "name": "Processor",
        "slug": "processor",
        "sort_order": 2,
        "options": [
            "Intel Core i5-14400F",
            "Intel Core Ultra 9 275HX",
            "AMD Ryzen 7 8845HS",
            "AMD Ryzen 9 9955HX",
            "Apple M4 Pro",
        ],
    },
    {
        "name": "Graphics",
        "slug": "graphics",
        "sort_order": 3,
        "options": [
            "RTX 3050",
            "RTX 4070",
            "RTX 5060",
        ],
    },
    {
        "name": "RAM",
        "slug": "ram",
        "sort_order": 4,
        "options": [
            "8 GB DDR4",
            "16 GB DDR5",
            "32 GB DDR5",
            "64 GB DDR5",
        ],
    },
    {
        "name": "Storage",
        "slug": "storage",
        "sort_order": 5,
        "options": [
            "256 GB SSD",
            "512 GB SSD",
            "1 TB NVMe SSD",
            "2 TB NVMe SSD",
        ],
    },
    {
        "name": "Display",
        "slug": "display",
        "sort_order": 6,
        "options": [
            '14" FHD IPS 60 Hz',
            '15.6" FHD IPS 144 Hz',
            '16" QHD+ 240 Hz',
            '18" 4K OLED 120 Hz',
        ],
    },
]


class Command(BaseCommand):
    help = (
        "Seed the 6 core hardware SpecificationDefinition records and their "
        "default preset SpecificationOption values."
    )

    def handle(self, *args, **options):
        hw_cat, cat_created = Category.objects.get_or_create(
            slug="hardware-specs",
            defaults={
                "name": "Hardware Specs",
                "is_active": False,
                "sort_order": 9999,
            },
        )
        if cat_created:
            self.stdout.write(self.style.SUCCESS("Created category: " + hw_cat.name))
        else:
            self.stdout.write("Category already exists: " + hw_cat.name)

        for spec in HARDWARE_SPECS:
            obj, created = SpecificationDefinition.objects.get_or_create(
                slug=spec["slug"],
                category=hw_cat,
                defaults={
                    "name": spec["name"],
                    "data_type": "text",
                    "is_filterable": False,
                    "is_required": False,
                    "sort_order": spec["sort_order"],
                },
            )
            status_str = "Created" if created else "Already exists"
            self.stdout.write("  [" + status_str + "] " + obj.name)

            # Seed default preset options (idempotent)
            existing_labels = set(
                SpecificationOption.objects.filter(definition=obj).values_list(
                    "label", flat=True
                )
            )
            for idx, label in enumerate(spec["options"], start=1):
                if label in existing_labels:
                    continue
                SpecificationOption.objects.create(
                    definition=obj,
                    label=label,
                    sort_order=idx,
                )
                self.stdout.write("      + option: " + label)

        self.stdout.write(self.style.SUCCESS("Done - hardware specs are ready."))
