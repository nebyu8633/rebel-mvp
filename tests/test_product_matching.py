from app.guard.matching import get_or_create_product, normalize_unit


def test_exact_normalized_match_reuses_product(db_session, make_restaurant):
    restaurant = make_restaurant()

    p1, created1 = get_or_create_product(db_session, restaurant.id, "אנטריקוט טרי מיוחד")
    p2, created2 = get_or_create_product(db_session, restaurant.id, "אנטריקוט טרי מיוחד")

    assert created1 is True
    assert created2 is False
    assert p1.id == p2.id


def test_different_raw_name_creates_new_product_no_fuzzy_matching(db_session, make_restaurant):
    """MVP is deliberately conservative: word-order/naming differences must
    NOT be treated as the same product without an exact normalized match."""
    restaurant = make_restaurant()

    chicken_a, _ = get_or_create_product(db_session, restaurant.id, "חזה עוף 5 ק\"ג")
    chicken_b, _ = get_or_create_product(db_session, restaurant.id, "עוף חזה 5KG")
    chicken_c, _ = get_or_create_product(db_session, restaurant.id, "חזה עוף טרי")

    assert chicken_a.id != chicken_b.id
    assert chicken_a.id != chicken_c.id
    assert chicken_b.id != chicken_c.id


def test_product_raw_name_is_preserved_alongside_normalized_name(db_session, make_restaurant):
    restaurant = make_restaurant()

    product, _ = get_or_create_product(db_session, restaurant.id, "חזה עוף 5 ק\"ג")

    assert product.canonical_name == "חזה עוף 5 ק\"ג"
    assert product.normalized_name != product.canonical_name


def test_product_is_scoped_per_restaurant(db_session, make_restaurant):
    restaurant_a = make_restaurant(phone="+972500000001", name="A")
    restaurant_b = make_restaurant(phone="+972500000002", name="B")

    p_a, _ = get_or_create_product(db_session, restaurant_a.id, "אנטריקוט")
    p_b, _ = get_or_create_product(db_session, restaurant_b.id, "אנטריקוט")

    assert p_a.id != p_b.id


def test_normalize_unit_hebrew_variations():
    assert normalize_unit('ק"ג') == "kg"
    assert normalize_unit("קג") == "kg"
    assert normalize_unit("גרם") == "g"
    assert normalize_unit("ליטר") == "liter"
    assert normalize_unit('מ"ל') == "ml"
    assert normalize_unit("יח'") == "unit"
    assert normalize_unit("יחידה") == "unit"
    assert normalize_unit("קרטון") == "box"
    assert normalize_unit("מארז") == "pack"


def test_normalize_unit_does_not_guess_unknown_units():
    assert normalize_unit("סלסלה") == "סלסלה"
    assert normalize_unit(None) is None
    assert normalize_unit("") is None
