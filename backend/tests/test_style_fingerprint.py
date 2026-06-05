from backend.analysis.style_fingerprint import build_style_fingerprint


def game(moves, result="win", colour="white", opening="Open Game"):
    return {
        "moves": moves,
        "result": result,
        "colour": colour,
        "opening": opening,
    }


def test_tactical_open_position_fingerprint_from_short_wins():
    games = [
        game(
            "e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O dxc3 Qb3 Qe7 Ba3 d6 Nxc3".split(),
            "win",
            "white",
            "Evans Gambit",
        ),
        game(
            "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5 e6 f4 Be7 Qf3 Qc7 O-O-O".split(),
            "win",
            "white",
            "Sicilian Defence",
        ),
        game(
            "e4 e5 f4 exf4 Nf3 g5 Bc4 g4 O-O gxf3 Qxf3 Qf6 d4 Qxd4+ Kh1".split(),
            "win",
            "white",
            "King's Gambit",
        ),
        game(
            "d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bxf6 Bxf6 Rc1".split(),
            "loss",
            "white",
            "Queen's Gambit",
        ),
    ]

    fingerprint = build_style_fingerprint(games)

    assert fingerprint["primary_style"] == "Tactical Attacker"
    assert fingerprint["confidence"] == "medium"
    assert fingerprint["traits"]["tactical_tendency"] >= 60
    assert fingerprint["traits"]["open_position_preference"] >= 60
    assert any("centre opens early" in item for item in fingerprint["evidence"])


def test_delayed_castling_losses_raise_king_safety_risk():
    games = [
        game("e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Bc5 c3 d6 h3 h6 Nbd2 O-O Nf1 Re8".split(), "loss", "white"),
        game("d4 Nf6 c4 e6 Nc3 Bb4 f3 d5 a3 Bxc3+ bxc3 c5 e3 Nc6".split(), "loss", "white"),
        game("e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3".split(), "loss", "white"),
        game("e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6".split(), "win", "white"),
    ]

    fingerprint = build_style_fingerprint(games)

    assert fingerprint["traits"]["king_safety_risk"] >= 60
    assert fingerprint["traits"]["castling_consistency"] <= 40
    assert any("delayed castling" in item for item in fingerprint["evidence"])


def test_low_sample_returns_neutral_defensive_fallback():
    fingerprint = build_style_fingerprint([
        game("e4 e5 Nf3 Nc6 Bc4 Bc5 O-O Nf6".split(), "win", "white"),
    ])

    assert fingerprint["confidence"] == "low"
    assert fingerprint["primary_style"] == "Developing Player"
    assert fingerprint["traits"]["tactical_tendency"] == 50
    assert fingerprint["sample_size"] == 1
