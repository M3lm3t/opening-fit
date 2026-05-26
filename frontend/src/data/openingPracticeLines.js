import { OPENINGS, findOpeningLine, normaliseOpeningKey } from "./openings";

const legacyOpeningPracticePacks = [
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
  {
    key: "ruy lopez",
    aliases: ["Ruy Lopez", "Spanish Opening", "Spanish Game"],
    lines: [
      {
        name: "Classical Ruy Lopez",
        moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O"],
        idea: "White develops, pressures the knight on c6, and castles before choosing the central plan.",
      },
      {
        name: "Exchange Ruy Lopez",
        moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Bxc6", "dxc6"],
        idea: "White changes the pawn structure early and plays for a clean long-term plan.",
      },
      {
        name: "Berlin Defence",
        moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6", "O-O", "Nxe4"],
        idea: "Black challenges the centre immediately and asks White to prove compensation.",
      },
    ],
  },
  {
    key: "scotch game",
    aliases: ["Scotch Game", "Scotch"],
    lines: [
      {
        name: "Main Scotch",
        moves: ["e4", "e5", "Nf3", "Nc6", "d4", "exd4", "Nxd4"],
        idea: "White opens the centre early and gets active piece play without slow manoeuvring.",
      },
      {
        name: "Scotch Four Knights",
        moves: ["e4", "e5", "Nf3", "Nc6", "Nc3", "Nf6", "d4"],
        idea: "White develops first, then opens the centre from a stable position.",
      },
      {
        name: "Scotch Gambit",
        moves: ["e4", "e5", "Nf3", "Nc6", "d4", "exd4", "Bc4"],
        idea: "White gives up immediate pawn recovery to develop quickly and attack f7.",
      },
    ],
  },
  {
    key: "pirc defense",
    aliases: ["Pirc Defense", "Pirc Defence", "Pirc"],
    lines: [
      {
        name: "Classical Pirc",
        moves: ["e4", "d6", "d4", "Nf6", "Nc3", "g6", "Nf3"],
        idea: "White builds a broad centre while Black prepares counterplay from a flexible setup.",
      },
      {
        name: "Austrian Attack",
        moves: ["e4", "d6", "d4", "Nf6", "Nc3", "g6", "f4"],
        idea: "White grabs space and prepares direct central or kingside play.",
      },
      {
        name: "Fianchetto Setup",
        moves: ["e4", "d6", "d4", "Nf6", "Nc3", "g6", "g3"],
        idea: "White uses a calmer setup and reduces Black's attacking chances.",
      },
    ],
  },
  {
    key: "dutch defense",
    aliases: ["Dutch Defense", "Dutch Defence", "Dutch"],
    lines: [
      {
        name: "Classical Dutch",
        moves: ["d4", "f5", "g3", "Nf6", "Bg2", "e6"],
        idea: "White develops naturally while Black fights for kingside space.",
      },
      {
        name: "Stonewall Dutch",
        moves: ["d4", "f5", "g3", "Nf6", "Bg2", "e6", "Nf3", "d5"],
        idea: "Black builds a fixed centre; White should understand the dark-square plans.",
      },
      {
        name: "Leningrad Dutch",
        moves: ["d4", "f5", "g3", "Nf6", "Bg2", "g6"],
        idea: "Black combines kingside space with a fianchetto; White keeps central control.",
      },
    ],
  },
  {
    key: "slav defense",
    aliases: ["Slav Defense", "Slav Defence", "Slav"],
    lines: [
      {
        name: "Main Slav",
        moves: ["d4", "d5", "c4", "c6", "Nf3", "Nf6", "Nc3"],
        idea: "Black supports the centre with c6 while keeping the light-squared bishop flexible.",
      },
      {
        name: "Exchange Slav",
        moves: ["d4", "d5", "c4", "c6", "cxd5", "cxd5"],
        idea: "The structure becomes symmetrical, so piece activity and plans matter more than tactics.",
      },
      {
        name: "Slow Slav Setup",
        moves: ["d4", "d5", "c4", "c6", "e3", "Nf6", "Nf3"],
        idea: "White develops calmly and avoids sharp theory while keeping central pressure.",
      },
    ],
  },
  {
    key: "reti opening",
    aliases: ["Reti Opening", "Réti Opening", "Reti"],
    lines: [
      {
        name: "Reti Main Setup",
        moves: ["Nf3", "d5", "c4", "e6", "g3", "Nf6", "Bg2"],
        idea: "White controls the centre with pieces first, then chooses when to challenge it with pawns.",
      },
      {
        name: "Reti vs King's Indian Setup",
        moves: ["Nf3", "Nf6", "g3", "g6", "Bg2", "Bg7", "O-O"],
        idea: "Both sides develop flexibly; White keeps options open before committing the centre.",
      },
      {
        name: "Reti with d4",
        moves: ["Nf3", "d5", "g3", "Nf6", "Bg2", "e6", "d4"],
        idea: "White transposes into a solid queen-pawn structure after developing safely.",
      },
    ],
  },
];

function openingToPracticePack(opening) {
  return {
    key: normaliseOpeningKey(opening.name),
    opening,
    aliases: [
      opening.name,
      opening.id,
      opening.eco,
      ...(opening.commonVariations || []),
    ].filter(Boolean),
    lines: opening.trainingLines.map((line) => ({
      name: line.name,
      moves: line.moves,
      idea: line.explanation,
      moveIdeas: line.moves.map((move, index) => {
        if (index === line.moves.length - 1) {
          return `${move} reaches the target position. ${line.explanation}`;
        }

        const idea = line.keyIdeas[index % line.keyIdeas.length];
        return idea ? `${move}: ${idea}` : `${move}: ${line.explanation}`;
      }),
      finishIdea: line.explanation,
      keyIdeas: line.keyIdeas,
    })),
  };
}

function mergePracticePacks(databasePacks, legacyPacks) {
  const merged = new Map();

  [...databasePacks, ...legacyPacks].forEach((pack) => {
    const key = normaliseOpeningKey(pack.key || pack.aliases?.[0] || "");
    if (!key) return;

    if (!merged.has(key)) {
      merged.set(key, {
        ...pack,
        key,
        aliases: [...new Set([pack.key, ...(pack.aliases || [])].filter(Boolean))],
        lines: [...(pack.lines || [])],
      });
      return;
    }

    const existing = merged.get(key);
    const existingLineKeys = new Set(
      existing.lines.map((line) => normaliseOpeningKey(`${line.name}:${line.moves?.join(" ")}`))
    );

    const nextLines = [...existing.lines];
    (pack.lines || []).forEach((line) => {
      const lineKey = normaliseOpeningKey(`${line.name}:${line.moves?.join(" ")}`);
      if (!existingLineKeys.has(lineKey)) {
        existingLineKeys.add(lineKey);
        nextLines.push(line);
      }
    });

    merged.set(key, {
      ...existing,
      aliases: [...new Set([...(existing.aliases || []), pack.key, ...(pack.aliases || [])].filter(Boolean))],
      lines: nextLines,
      opening: existing.opening || pack.opening,
    });
  });

  return Array.from(merged.values()).sort((a, b) => {
    const aName = a.opening?.name || a.aliases?.[0] || a.key;
    const bName = b.opening?.name || b.aliases?.[0] || b.key;
    return aName.localeCompare(bName);
  });
}

const databasePracticePacks = OPENINGS
  .filter((opening) => opening.appearsInTraining !== false)
  .map(openingToPracticePack);

export const openingPracticePacks = mergePracticePacks(
  databasePracticePacks,
  legacyOpeningPracticePacks
);

export function findOpeningPracticePack(openingName = "") {
  const name = normaliseOpeningKey(openingName);

  if (!name) return null;

  return (
    openingPracticePacks.find((pack) => {
      const names = [pack.key, ...(pack.aliases || [])].map(normaliseOpeningKey);

      return names.some((alias) => {
        return name.includes(alias) || alias.includes(name);
      });
    }) ||
    (() => {
      const opening = findOpeningLine(openingName);
      return opening ? openingToPracticePack(opening) : null;
    })()
  );
}
