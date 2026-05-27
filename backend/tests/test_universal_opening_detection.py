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
    ("Queen's Gambit", ["d4", "d5", "c4", "e6"]),
    ("Slav Defence", ["d4", "d5", "c4", "c6"]),
    ("Nimzo-Indian Defence", ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"]),
    ("English Opening", ["c4", "e5", "Nc3", "Nf6"]),
    ("Catalan Opening", ["d4", "Nf6", "c4", "e6", "g3", "d5", "Bg2"]),
    ("London System", ["d4", "Nf6", "Nf3", "d5", "Bf4", "e6"]),
    ("Benoni Defence", ["d4", "Nf6", "c4", "c5", "d5", "e6"]),
    ("Dutch Defence", ["d4", "f5", "g3", "Nf6"]),
    ("Scandinavian Defence", ["e4", "d5", "exd5", "Qxd5"]),
    ("Alekhine Defence", ["e4", "Nf6", "e5", "Nd5"]),
    ("Vienna Game", ["e4", "e5", "Nc3", "Nf6"]),
    ("King's Gambit", ["e4", "e5", "f4", "exf4"]),
]


def test_detects_mainstream_openings_without_needing_long_exact_lines():
    for expected, moves in OPENING_CASES:
        result = detect_opening(moves)
        assert result["opening"] == expected
        assert result["confidence"] in {"medium", "high"}
        assert result["signals"], expected


def test_eco_url_metadata_can_identify_future_or_deep_variations():
    pgn = """[Event "Example"]
[ECO "B90"]
[ECOUrl "https://www.chess.com/openings/Sicilian-Defense-Najdorf-Variation"]

1. e4 c5 2. Nf3 d6 3. d4 cxd4"""

    result = detect_opening_from_pgn(pgn, ["e4", "c5", "Nf3", "d6", "d4", "cxd4"])

    assert result["opening"] == "Sicilian Defence"
    assert any(signal["type"] == "eco" for signal in result["signals"])


def test_eco_ranges_cover_major_families():
    assert eco_family("B12") == "Caro-Kann Defence"
    assert eco_family("C65") == "Ruy Lopez"
    assert eco_family("D15") == "Slav Defence"
    assert eco_family("E20") == "Nimzo-Indian Defence"
    assert eco_family("E70") == "King's Indian Defence"

