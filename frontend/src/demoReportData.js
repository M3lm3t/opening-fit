export const DEMO_REPORT = {
  username: "DemoPlayer1300",
  playerName: "DemoPlayer1300",
  platform: "chesscom",
  source: "demo",
  isDemo: true,

  gamesImported: 186,
  games_imported: 186,
  totalGames: 186,
  monthsChecked: 6,
  months_checked: 6,

  rating: 1324,
  chesscomRating: 1324,
  playerLevel: "Intermediate",

  styleProfile: {
    primary: "Attacking practical player",
    summary:
      "You score best when you reach active piece play early. Your results dip when you choose sharp gambits without a clear follow-up plan.",
    labels: ["Attacking", "Tactical", "Practical"],
  },

  style_profile: {
    primary: "Attacking practical player",
    summary:
      "You score best when you reach active piece play early. Your results dip when you choose sharp gambits without a clear follow-up plan.",
    labels: ["Attacking", "Tactical", "Practical"],
  },

  summary:
    "DemoPlayer1300 performs best with active, development-led openings. The Vienna is worth keeping, the Scandinavian needs a cleaner move-order plan, and risky surprise gambits are currently costing rating points.",

  recommendations: {
    white: [
      {
        name: "Vienna Game",
        reason: "Strong results and suits your attacking style.",
        verdict: "Keep",
      },
      {
        name: "Queen's Gambit",
        reason: "A steadier second option when you want less chaos.",
        verdict: "Improve",
      },
    ],
    black: [
      {
        name: "Caro-Kann Defence",
        reason: "Reliable structure and easier plans than your current risky gambits.",
        verdict: "Recommended",
      },
      {
        name: "Scandinavian Defence",
        reason: "Playable, but your early queen moves need tidying up.",
        verdict: "Improve",
      },
    ],
  },

  opening_recommendations: {
    white_repertoire: [
      {
        name: "Vienna Game",
        games: 31,
        colour: "white",
        color: "white",
        context: "played_as_white",
        contextLabel: "played as White",
        reason: "Strong results and suits your attacking style.",
      },
      {
        name: "Queen's Gambit",
        games: 22,
        colour: "white",
        color: "white",
        context: "played_as_white",
        contextLabel: "played as White",
        reason: "A steadier second option when you want less chaos.",
      },
    ],
    black_vs_e4: [
      {
        name: "Caro-Kann Defence",
        games: 11,
        colour: "black",
        color: "black",
        context: "black_vs_e4",
        contextLabel: "played as Black vs 1.e4",
        reason: "Reliable structure and easier plans than your current risky gambits.",
      },
      {
        name: "Scandinavian Defence",
        games: 28,
        colour: "black",
        color: "black",
        context: "black_vs_e4",
        contextLabel: "played as Black vs 1.e4",
        reason: "Playable, but your early queen moves need tidying up.",
      },
    ],
    black_vs_d4_other: [
      {
        name: "Queen's Gambit Declined",
        games: 6,
        colour: "black",
        color: "black",
        context: "black_vs_d4_other",
        contextLabel: "played as Black vs 1.d4 / 1.c4 / 1.Nf3",
        reason: "Use it as the calmer answer to queen-pawn and flank starts.",
      },
    ],
    experimental_rare: [
      {
        name: "Englund Gambit",
        games: 1,
        colour: "black",
        color: "black",
        context: "black_vs_d4_other",
        contextLabel: "played as Black vs 1.d4 / 1.c4 / 1.Nf3",
        reason: "Treat this as a rare experiment, not a core defence.",
      },
    ],
    too_little_data: [
      {
        name: "Unclear transposition",
        games: 1,
        colour: "mixed",
        color: "mixed",
        context: "unknown_mixed",
        contextLabel: "unknown / mixed",
        recommendationCopy:
          "We found this opening pattern, but not enough colour/context data to recommend it confidently.",
      },
    ],
    white: ["Vienna Game", "Queen's Gambit"],
    black: ["Caro-Kann Defence", "Scandinavian Defence", "Queen's Gambit Declined"],
  },

  opening_stats: [
    {
      name: "Vienna Game",
      color: "White",
      games: 31,
      wins: 16,
      draws: 4,
      losses: 11,
      win_rate: 58,
      winRate: 58,
      verdict: "Keep",
    },
    {
      name: "Queen's Gambit Declined",
      color: "White",
      games: 22,
      wins: 11,
      draws: 2,
      losses: 9,
      win_rate: 55,
      winRate: 55,
      verdict: "Keep",
    },
    {
      name: "Scandinavian Defence",
      color: "Black",
      games: 28,
      wins: 10,
      draws: 4,
      losses: 14,
      win_rate: 43,
      winRate: 43,
      verdict: "Improve",
    },
    {
      name: "Sicilian Defence",
      color: "Black",
      games: 17,
      wins: 6,
      draws: 2,
      losses: 9,
      win_rate: 41,
      winRate: 41,
      verdict: "Improve",
    },
    {
      name: "Englund Gambit",
      color: "Black",
      games: 16,
      wins: 4,
      draws: 2,
      losses: 10,
      win_rate: 31,
      winRate: 31,
      verdict: "Avoid",
    },
    {
      name: "Wayward Queen Attack",
      color: "White",
      games: 9,
      wins: 2,
      draws: 1,
      losses: 6,
      win_rate: 28,
      winRate: 28,
      verdict: "Avoid",
    },
  ],

  top_openings: [
    {
      name: "Vienna Game",
      games: 31,
      wins: 16,
      draws: 4,
      losses: 11,
      win_rate: 58,
      winRate: 58,
      verdict: "Keep",
    },
    {
      name: "Scandinavian Defence",
      games: 28,
      wins: 10,
      draws: 4,
      losses: 14,
      win_rate: 43,
      winRate: 43,
      verdict: "Improve",
    },
    {
      name: "Queen's Gambit Declined",
      games: 22,
      wins: 11,
      draws: 2,
      losses: 9,
      win_rate: 55,
      winRate: 55,
      verdict: "Keep",
    },
    {
      name: "Englund Gambit",
      games: 16,
      wins: 4,
      draws: 2,
      losses: 10,
      win_rate: 31,
      winRate: 31,
      verdict: "Avoid",
    },
  ],

  keep_improve_avoid: {
    keep: [
      {
        name: "Vienna Game",
        games: 31,
        win_rate: 58,
        reason: "Good results and matches your attacking style.",
      },
      {
        name: "Queen's Gambit Declined",
        games: 22,
        win_rate: 55,
        reason: "Stable results and useful as a calmer White option.",
      },
    ],
    improve: [
      {
        name: "Scandinavian Defence",
        games: 28,
        win_rate: 43,
        reason: "Not terrible, but repeated early mistakes are dragging results down.",
      },
      {
        name: "Sicilian Defence",
        games: 17,
        win_rate: 41,
        reason: "Promising, but too many different setups are causing confusion.",
      },
    ],
    avoid: [
      {
        name: "Englund Gambit",
        games: 16,
        win_rate: 31,
        reason: "Fun surprise weapon, but currently costing too many games.",
      },
      {
        name: "Wayward Queen Attack",
        games: 9,
        win_rate: 28,
        reason: "Works occasionally, but stronger opponents punish it quickly.",
      },
    ],
  },

  training_plan: [
    {
      title: "Keep the Vienna as your main White weapon",
      detail: "Spend one session learning what to do when Black plays ...Nf6.",
    },
    {
      title: "Replace the Englund Gambit",
      detail: "Use the Caro-Kann or a cleaner Scandinavian setup instead.",
    },
    {
      title: "Clean up move orders",
      detail: "Review losses between moves 6 and 10 where the opening advantage disappears.",
    },
    {
      title: "Track progress after 20 new games",
      detail: "Re-import games and check whether the Improve openings move above 50%.",
    },
  ],

  preferred_openings: {
    white: ["Vienna Game", "Queen's Gambit", "Italian Game"],
    black: ["Caro-Kann Defence", "Scandinavian Defence", "Queen's Gambit Declined"],
  },

  games: [
    {
      id: "demo-vienna-1",
      white: "DemoPlayer1300",
      black: "Opponent1240",
      whiteUsername: "DemoPlayer1300",
      blackUsername: "Opponent1240",
      opening: "Vienna Game",
      result: "1-0",
      pgn: "1. e4 e5 2. Nc3 Nf6 3. f4 d5 4. fxe5 Nxe4 5. Nf3 Be7 6. d4 O-O 7. Bd3 Nxc3 8. bxc3 c5 9. O-O Nc6 10. Qe1 Be6 11. Qg3 Kh8 12. Ng5 Bxg5 13. Bxg5 Qd7 14. Qh4 g6 15. Bf6+ Kg8 16. Qh6 1-0",
      moves: [
        "e4", "e5", "Nc3", "Nf6", "f4", "d5", "fxe5", "Nxe4", "Nf3", "Be7",
        "d4", "O-O", "Bd3", "Nxc3", "bxc3", "c5", "O-O", "Nc6", "Qe1", "Be6",
        "Qg3", "Kh8", "Ng5", "Bxg5", "Bxg5", "Qd7", "Qh4", "g6", "Bf6+", "Kg8", "Qh6"
      ],
    },
    {
      id: "demo-scandi-1",
      white: "Opponent1295",
      black: "DemoPlayer1300",
      whiteUsername: "Opponent1295",
      blackUsername: "DemoPlayer1300",
      opening: "Scandinavian Defence",
      result: "1-0",
      pgn: "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Nf6 5. Nf3 Bg4 6. h3 Bxf3 7. Qxf3 c6 8. Bc4 e6 9. O-O Nbd7 10. Re1 Be7 11. Bf4 O-O 12. Rad1 Rfe8 13. g4 1-0",
      moves: [
        "e4", "d5", "exd5", "Qxd5", "Nc3", "Qa5", "d4", "Nf6", "Nf3", "Bg4",
        "h3", "Bxf3", "Qxf3", "c6", "Bc4", "e6", "O-O", "Nbd7", "Re1", "Be7",
        "Bf4", "O-O", "Rad1", "Rfe8", "g4"
      ],
    },
  ],
};
