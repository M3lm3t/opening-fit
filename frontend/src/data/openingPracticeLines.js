export const openingPracticePacks = [
  {
    key: "vienna game",
    aliases: ["Vienna Game", "Vienna"],
    lines: [
      {
        name: "Vienna Main Line",
        moves: ["e4", "e5", "Nc3", "Nf6", "f4"],
        idea: "Develop quickly and use f4 to challenge Black's centre.",
      },
      {
        name: "Vienna Gambit Accepted",
        moves: ["e4", "e5", "Nc3", "Nf6", "f4", "exf4"],
        idea: "Black takes the pawn, so White aims for fast development and pressure.",
      },
      {
        name: "Quiet Vienna",
        moves: ["e4", "e5", "Nc3", "Nf6", "Bc4"],
        idea: "A calmer setup with natural development and pressure on f7.",
      },
    ],
  },
  {
    key: "italian game",
    aliases: ["Italian Game", "Giuoco Piano"],
    lines: [
      {
        name: "Classical Italian",
        moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"],
        idea: "Develop naturally and fight for the centre.",
      },
      {
        name: "Two Knights Defence",
        moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6"],
        idea: "Black attacks e4 quickly and creates sharper play.",
      },
      {
        name: "Quiet Setup",
        moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "d3"],
        idea: "A solid setup that keeps your king safe and develops smoothly.",
      },
    ],
  },
  {
    key: "sicilian defense",
    aliases: ["Sicilian Defense", "Sicilian Defence", "Sicilian"],
    lines: [
      {
        name: "Open Sicilian",
        moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4"],
        idea: "White opens the centre and aims for active piece play.",
      },
      {
        name: "Alapin Sicilian",
        moves: ["e4", "c5", "c3"],
        idea: "White prepares d4 and avoids some heavy Sicilian theory.",
      },
      {
        name: "Closed Sicilian",
        moves: ["e4", "c5", "Nc3", "Nc6", "g3"],
        idea: "White builds slowly and often attacks on the kingside.",
      },
    ],
  },
  {
    key: "french defense",
    aliases: ["French Defense", "French Defence", "French"],
    lines: [
      {
        name: "Advance French",
        moves: ["e4", "e6", "d4", "d5", "e5"],
        idea: "White gains space while Black attacks the pawn chain.",
      },
      {
        name: "Exchange French",
        moves: ["e4", "e6", "d4", "d5", "exd5", "exd5"],
        idea: "A simpler structure with less theory.",
      },
      {
        name: "Classical French",
        moves: ["e4", "e6", "d4", "d5", "Nc3", "Nf6"],
        idea: "White develops naturally and supports the centre.",
      },
    ],
  },
  {
    key: "caro-kann defense",
    aliases: ["Caro-Kann Defense", "Caro-Kann Defence", "Caro-Kann", "Caro Kann"],
    lines: [
      {
        name: "Advance Caro-Kann",
        moves: ["e4", "c6", "d4", "d5", "e5"],
        idea: "White takes space and Black looks for breaks with c5 or Bf5.",
      },
      {
        name: "Exchange Caro-Kann",
        moves: ["e4", "c6", "d4", "d5", "exd5", "cxd5"],
        idea: "A clean structure with easy development.",
      },
      {
        name: "Classical Caro-Kann",
        moves: ["e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4"],
        idea: "White recaptures centrally and develops actively.",
      },
    ],
  },
  {
    key: "scandinavian defense",
    aliases: ["Scandinavian Defense", "Scandinavian Defence", "Scandinavian", "Center Counter"],
    lines: [
      {
        name: "Main Scandinavian",
        moves: ["e4", "d5", "exd5", "Qxd5", "Nc3"],
        idea: "White gains time by attacking the queen.",
      },
      {
        name: "Modern Scandinavian",
        moves: ["e4", "d5", "exd5", "Nf6"],
        idea: "Black delays queen recapture and develops a piece first.",
      },
      {
        name: "Portuguese-style Setup",
        moves: ["e4", "d5", "exd5", "Nf6", "d4", "Bg4"],
        idea: "Black creates active piece pressure instead of simple recapture.",
      },
    ],
  },
  {
    key: "queen's gambit",
    aliases: ["Queen's Gambit", "Queens Gambit", "Queen Gambit"],
    lines: [
      {
        name: "Queen's Gambit Declined",
        moves: ["d4", "d5", "c4", "e6"],
        idea: "White challenges the centre while Black stays solid.",
      },
      {
        name: "Queen's Gambit Accepted",
        moves: ["d4", "d5", "c4", "dxc4"],
        idea: "Black takes the pawn, but White gets central control and development.",
      },
      {
        name: "Exchange Variation",
        moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "cxd5"],
        idea: "White creates a clear pawn structure and plays for long-term pressure.",
      },
    ],
  },
  {
    key: "london system",
    aliases: ["London System", "London"],
    lines: [
      {
        name: "Basic London Setup",
        moves: ["d4", "d5", "Bf4", "Nf6", "e3"],
        idea: "Build a solid setup with Bf4, e3, Nf3 and c3.",
      },
      {
        name: "London vs King's Indian Setup",
        moves: ["d4", "Nf6", "Bf4", "g6", "e3", "Bg7"],
        idea: "Use a stable structure while Black fianchettoes.",
      },
      {
        name: "London with c4",
        moves: ["d4", "d5", "Bf4", "Nf6", "e3", "e6", "c4"],
        idea: "A more ambitious London where White also fights for the centre.",
      },
    ],
  },
  {
    key: "king's indian defense",
    aliases: ["King's Indian Defense", "King's Indian Defence", "Kings Indian", "King's Indian"],
    lines: [
      {
        name: "Classical King's Indian",
        moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6"],
        idea: "White takes the centre while Black prepares kingside counterplay.",
      },
      {
        name: "Fianchetto Variation",
        moves: ["d4", "Nf6", "c4", "g6", "g3"],
        idea: "White uses a solid setup and limits Black's kingside attack.",
      },
      {
        name: "Four Pawns Attack",
        moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "f4"],
        idea: "White grabs space and attacks directly in the centre.",
      },
    ],
  },
  {
    key: "english opening",
    aliases: ["English Opening", "English"],
    lines: [
      {
        name: "Symmetrical English",
        moves: ["c4", "c5", "Nc3", "Nc6", "g3"],
        idea: "Both sides fight for queenside and central control.",
      },
      {
        name: "English vs e5",
        moves: ["c4", "e5", "Nc3", "Nf6", "g3"],
        idea: "White uses a reversed Sicilian-style setup.",
      },
      {
        name: "Botvinnik Setup",
        moves: ["c4", "g6", "Nc3", "Bg7", "g3", "d6", "Bg2"],
        idea: "A flexible system with long-term dark-square control.",
      },
    ],
  },
];

export function findOpeningPracticePack(openingName = "") {
  const normalise = (value) =>
    String(value)
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/defence/g, "defense")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const name = normalise(openingName);

  if (!name) return null;

  return (
    openingPracticePacks.find((pack) => {
      const names = [pack.key, ...(pack.aliases || [])].map(normalise);

      return names.some((alias) => {
        return name.includes(alias) || alias.includes(name);
      });
    }) || null
  );
}
