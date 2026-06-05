from backend.analysis.opening_recommendation_catalog import (
    OPENING_RECOMMENDATION_CATALOG,
    all_opening_recommendations,
    opening_catalog_by_name,
    openings_for_slot,
)


REQUIRED_KEYS = {
    "name",
    "colour",
    "against",
    "eco_family",
    "style_tags",
    "difficulty",
    "theory_load",
    "tactical_risk",
    "strategic_risk",
    "typical_position_type",
    "good_for",
    "bad_for",
    "recommended_rating_band",
    "fit_weights",
}


def test_catalog_contains_requested_seed_openings():
    names = {item["name"] for item in OPENING_RECOMMENDATION_CATALOG}

    for expected in [
        "Vienna Game",
        "Vienna Gambit",
        "Italian Game",
        "Evans Gambit",
        "Scotch Game",
        "Queen's Gambit",
        "London System",
        "Jobava London",
        "English Opening",
        "Ruy Lopez",
        "King's Indian Attack",
        "Smith-Morra Gambit",
        "Caro-Kann Defence",
        "French Defence",
        "Sicilian Defence",
        "Scandinavian Defence",
        "Scandinavian Portuguese/Icelandic Gambit Ideas",
        "1...e5 Classical",
        "Pirc Defence",
        "Modern Defence",
        "Queen's Gambit Declined",
        "Slav Defence",
        "King's Indian Defence",
        "Nimzo-Indian Defence",
        "Dutch Defence",
        "Benoni/Benko-style Options",
        "Grünfeld Defence",
    ]:
        assert expected in names


def test_catalog_items_have_required_shape():
    assert len(OPENING_RECOMMENDATION_CATALOG) >= 27

    for item in OPENING_RECOMMENDATION_CATALOG:
        assert REQUIRED_KEYS.issubset(item.keys()), item["name"]
        assert item["colour"] in {"white", "black"}
        assert isinstance(item["style_tags"], list) and item["style_tags"]
        assert isinstance(item["good_for"], list) and item["good_for"]
        assert isinstance(item["bad_for"], list) and item["bad_for"]
        assert len(item["recommended_rating_band"]) == 2
        assert item["recommended_rating_band"][0] < item["recommended_rating_band"][1]
        assert isinstance(item["fit_weights"], dict) and item["fit_weights"]


def test_catalog_helpers_return_copies_and_filter_slots():
    scotch = opening_catalog_by_name("Scotch Game")
    assert scotch["colour"] == "white"
    assert scotch["fit_weights"]["open_position_preference"] > 0

    black_e4 = openings_for_slot("black", "1.e4")
    assert any(item["name"] == "Caro-Kann Defence" for item in black_e4)
    assert all(item["colour"] == "black" and item["against"] == "1.e4" for item in black_e4)

    copied = all_opening_recommendations()
    copied[0]["name"] = "Changed"
    assert OPENING_RECOMMENDATION_CATALOG[0]["name"] != "Changed"
