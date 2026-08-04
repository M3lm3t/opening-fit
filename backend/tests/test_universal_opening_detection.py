from backend.opening_detection import detect_opening, detect_opening_from_pgn, eco_family


OPENING_CASES = [
    ("Sicilian Defence", ["e4", "c5", "Nf3", "d6"]),
    ("French Defence", ["e4", "e6", "d4", "d5"]),
    ("Caro-Kann Defence", ["e4", "c6", "d4", "d5"]),
    ("Ruy Lopez", ["e4", "e5", "Nf3", "Nc6", "Bb5"]),
    ("Italian Game", ["e4", "e5", "Nf3", "Nc6", "Bc4"]),
    ("Scotch Game", ["e4", "e5", "Nf3", "Nc6", "d4"]),
    ("Pirc Defence", ["e4", "d6", "d4", "Nf6", "Nc3", "g6"]),
    ("Modern Defence", ["e4", "g6", "d4", "Bg7", "Nc3", "d6"]),
    ("King's Indian Defence", ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6"]),
    ("Grünfeld Defence", ["d4", "Nf6", "c4", "g6", "Nc3", "d5"]),
    ("Queen's Gambit", ["d4", "d5", "c4", "dxc4"]),
    ("Queen's Gambit Declined", ["d4", "d5", "c4", "e6", "Nc3", "Nf6"]),
    ("Slav Defence", ["d4", "d5", "c4", "c6"]),
    ("Nimzo-Indian Defence", ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"]),
    ("English Opening", ["c4", "e5", "Nc3", "Nf6"]),
    ("Catalan Opening", ["d4", "Nf6", "c4", "e6", "g3", "d5", "Bg2"]),
    ("London System", ["d4", "Nf6", "Nf3", "d5", "Bf4", "e6"]),
    ("Jobava London System", ["d4", "Nf6", "Nc3", "d5", "Bf4", "e6"]),
    ("Benoni Defence", ["d4", "Nf6", "c4", "c5", "d5", "e6"]),
    ("Dutch Defence", ["d4", "f5", "g3", "Nf6"]),
    ("Scandinavian Defence", ["e4", "d5", "exd5", "Qxd5"]),
    ("Alekhine Defence", ["e4", "Nf6", "e5", "Nd5"]),
    ("Vienna Game", ["e4", "e5", "Nc3", "Nf6"]),
    ("Four Knights Game", ["e4", "e5", "Nc3", "Nf6", "Nf3", "Nc6"]),
    ("King's Gambit", ["e4", "e5", "f4", "exf4"]),
]


def test_detects_mainstream_openings_without_needing_long_exact_lines():
    for expected, moves in OPENING_CASES:
        result = detect_opening(moves)
        assert result["opening"] == expected
        assert result["confidence"] in {"medium", "high"}
        assert result["signals"], expected


def test_eco_url_metadata_is_diagnostic_while_moves_authoritatively_identify_family():
    pgn = """[Event "Example"]
[ECO "B90"]
[ECOUrl "https://www.chess.com/openings/Sicilian-Defense-Najdorf-Variation"]

1. e4 c5 2. Nf3 d6 3. d4 cxd4"""

    result = detect_opening_from_pgn(pgn, ["e4", "c5", "Nf3", "d6", "d4", "cxd4"])

    assert result["opening"] == "Sicilian Defence"
    assert any(signal["type"] == "eco" for signal in result["metadataSignals"])
    assert result["classificationSource"].startswith("move_sequence:")
    assert result["matchedOpeningRuleId"]
    assert result["matchedPlyDepth"] > 0


def test_incompatible_external_nimzo_tag_cannot_classify_e4_games():
    result = detect_opening(
        ["e4", "e5", "d4", "Nc6", "d5", "Nd4", "c3", "Bc5"],
        eco="B00",
        tagged_opening="Nimzo-Indian Defence",
    )

    assert result["opening"] != "Nimzo-Indian Defence"
    assert result["metadataConflictReason"] in {"metadata_without_move_rule", "metadata_conflicts_with_move_rule"}
    assert result["classificationSource"] == "unclassified" or result["matchedOpeningRuleId"]


def test_eco_ranges_cover_major_families():
    assert eco_family("B12") == "Caro-Kann Defence"
    assert eco_family("C65") == "Ruy Lopez"
    assert eco_family("D15") == "Slav Defence"
    assert eco_family("D35") == "Queen's Gambit Declined"
    assert eco_family("E20") == "Nimzo-Indian Defence"
    assert eco_family("E70") == "King's Indian Defence"


def test_transpositions_override_first_move_labels():
    english_to_qgd = detect_opening(["c4", "e6", "d4", "d5", "Nc3", "Nf6", "Nf3", "Be7"])
    reti_to_slav = detect_opening(["Nf3", "d5", "c4", "c6", "d4", "Nf6", "Nc3"])
    reti_to_sicilian = detect_opening(["Nf3", "c5", "e4", "d6", "d4", "cxd4"])

    assert english_to_qgd["opening"] == "Queen's Gambit Declined"
    assert reti_to_slav["opening"] == "Slav Defence"
    assert reti_to_sicilian["opening"] == "Sicilian Defence"


def test_uncertain_systems_prefer_broad_family_over_wrong_precision():
    queen_pawn = detect_opening(["d4", "Nf6", "Nc3", "e6", "Bg5", "Be7"])

    assert queen_pawn["opening"] == "Queen's Pawn Opening"
    assert queen_pawn["confidence"] in {"medium", "high"}
