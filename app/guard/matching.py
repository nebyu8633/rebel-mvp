"""Name/unit normalization and conservative supplier/product matching.

Matching is intentionally conservative for the MVP: only an EXACT match on
the normalized name is considered the same supplier/product. No fuzzy
matching. The system must never claim a price changed unless it is sure it
is comparing the same product from the same supplier for the same
restaurant.
"""
import re
import unicodedata

from sqlalchemy.orm import Session

from app.db.models import Product, Supplier

# Hebrew diacritics (niqqud) + cantillation marks range.
_NIQQUD_RE = re.compile(r"[֑-ׇ]")
# Punctuation commonly used inside Hebrew abbreviations (גרש/גרשיים) and
# generic separators we want to drop when normalizing a name.
_PUNCT_RE = re.compile(r"[\"'׳״‘’“”.,()\-_/\\]")
_WHITESPACE_RE = re.compile(r"\s+")

# unit variation -> canonical unit code
_UNIT_MAP: dict[str, str] = {
    # kg
    "kg": "kg", "kgs": "kg", "ק\"ג": "kg", "קג": "kg", "ק''ג": "kg", "ק.ג": "kg",
    # g
    "g": "g", "gr": "g", "gram": "g", "grams": "g", "גרם": "g", "ג'": "g", "גר": "g",
    # liter
    "l": "liter", "liter": "liter", "litre": "liter", "liters": "liter", "litres": "liter",
    "ליטר": "liter",
    # ml
    "ml": "ml", "מ\"ל": "ml", "מל": "ml", "מ''ל": "ml",
    # unit (single item)
    "unit": "unit", "units": "unit", "pc": "unit", "pcs": "unit", "piece": "unit",
    "pieces": "unit", "יח": "unit", "יח'": "unit", "יחידה": "unit", "יחידות": "unit",
    # box
    "box": "box", "boxes": "box", "קרטון": "box", "קרטונים": "box",
    # pack
    "pack": "pack", "packs": "pack", "מארז": "pack", "מארזים": "pack",
    # case
    "case": "case", "cases": "case", "ארגז": "case", "ארגזים": "case",
}


def normalize_name(raw_name: str) -> str:
    """Normalize a supplier/product name for exact matching.

    Applies unicode normalization, strips Hebrew niqqud and punctuation,
    lowercases (no-op for Hebrew), and collapses whitespace. Deliberately
    does NOT reorder words or attempt fuzzy/phonetic matching.
    """
    text = unicodedata.normalize("NFKC", raw_name)
    text = _NIQQUD_RE.sub("", text)
    text = _PUNCT_RE.sub(" ", text)
    text = text.strip().lower()
    text = _WHITESPACE_RE.sub(" ", text)
    return text


def normalize_unit(raw_unit: str | None) -> str | None:
    """Map a unit string to a canonical unit code when confidently known.

    If the unit is missing or not recognized, the original (trimmed) value
    is returned unchanged rather than guessing a conversion.
    """
    if raw_unit is None:
        return None
    cleaned = raw_unit.strip()
    if not cleaned:
        return None
    key = _PUNCT_RE.sub("", cleaned).strip().lower()
    return _UNIT_MAP.get(key, cleaned)


def get_or_create_supplier(db: Session, restaurant_id: int, raw_name: str) -> Supplier:
    """Find an existing supplier for this restaurant by normalized name, or create one.

    Always scoped by restaurant_id so suppliers never leak across restaurants.
    """
    normalized = normalize_name(raw_name)
    existing = (
        db.query(Supplier)
        .filter(Supplier.restaurant_id == restaurant_id, Supplier.normalized_name == normalized)
        .first()
    )
    if existing:
        return existing

    supplier = Supplier(restaurant_id=restaurant_id, name=raw_name, normalized_name=normalized)
    db.add(supplier)
    db.flush()
    return supplier


def get_or_create_product(db: Session, restaurant_id: int, raw_name: str, default_unit: str | None = None) -> tuple[Product, bool]:
    """Find an existing product for this restaurant by exact normalized-name match.

    Returns (product, created) where created is True if a new Product row
    was inserted because no exact match existed.
    """
    normalized = normalize_name(raw_name)
    existing = (
        db.query(Product)
        .filter(Product.restaurant_id == restaurant_id, Product.normalized_name == normalized)
        .first()
    )
    if existing:
        return existing, False

    product = Product(
        restaurant_id=restaurant_id,
        canonical_name=raw_name,
        normalized_name=normalized,
        default_unit=default_unit,
    )
    db.add(product)
    db.flush()
    return product, True
