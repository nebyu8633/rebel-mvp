from app.guard.matching import get_or_create_supplier, normalize_name


def test_same_normalized_name_reuses_supplier(db_session, make_restaurant):
    restaurant = make_restaurant()

    s1 = get_or_create_supplier(db_session, restaurant.id, "בשר הצפון")
    s2 = get_or_create_supplier(db_session, restaurant.id, "בשר הצפון")

    assert s1.id == s2.id


def test_whitespace_variation_still_matches(db_session, make_restaurant):
    restaurant = make_restaurant()

    s1 = get_or_create_supplier(db_session, restaurant.id, "בשר הצפון")
    s2 = get_or_create_supplier(db_session, restaurant.id, "  בשר   הצפון  ")

    assert s1.id == s2.id


def test_different_name_creates_new_supplier(db_session, make_restaurant):
    restaurant = make_restaurant()

    s1 = get_or_create_supplier(db_session, restaurant.id, "בשר הצפון")
    s2 = get_or_create_supplier(db_session, restaurant.id, "ירקות השוק")

    assert s1.id != s2.id


def test_supplier_is_scoped_per_restaurant(db_session, make_restaurant):
    restaurant_a = make_restaurant(phone="+972500000001", name="A")
    restaurant_b = make_restaurant(phone="+972500000002", name="B")

    s_a = get_or_create_supplier(db_session, restaurant_a.id, "בשר הצפון")
    s_b = get_or_create_supplier(db_session, restaurant_b.id, "בשר הצפון")

    assert s_a.id != s_b.id
    assert s_a.restaurant_id == restaurant_a.id
    assert s_b.restaurant_id == restaurant_b.id


def test_normalize_name_lowercases_and_strips_punctuation():
    assert normalize_name("Meat Co.") == "meat co"
    assert normalize_name("  בשר   הצפון  ") == normalize_name("בשר הצפון")
