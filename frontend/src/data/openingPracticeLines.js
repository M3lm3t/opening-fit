import { OPENINGS, normaliseOpeningKey } from "./openings.ts";
import { Chess } from "chess.js";

const canonicalPack = (packId, displayName, repertoireRole, moves, purpose, aliases = []) => ({
  key: packId,
  packId,
  canonicalOpeningId: packId,
  aliases: [displayName, packId, ...aliases],
  compatibleRoles: [repertoireRole],
  playerColour: repertoireRole === "white" ? "white" : "black",
  practiceSide: repertoireRole === "white" ? "white" : "black",
  initialMoveFamily: moves[0],
  purpose,
  deviations: [],
  source: "openingfit_club_pack_registry",
  version: 1,
  lines: [{ name: `${displayName} practical line`, moves, idea: purpose, source: "openingfit_club_pack_registry" }],
});

const supplementalCanonicalPacks = [
  canonicalPack("evans-gambit", "Evans Gambit", "white", ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "b4"], "Gain time for rapid development by deflecting Black's bishop."),
  canonicalPack("two-knights-white", "Two Knights Defence", "white", ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "Ng5", "d5", "exd5"], "Meet the Two Knights actively while keeping the tactical centre under control."),
  canonicalPack("four-knights-game", "Four Knights Game", "white", ["e4", "e5", "Nf3", "Nc6", "Nc3", "Nf6"], "Reach a sound developed position before choosing the central break."),
  canonicalPack("danish-gambit", "Danish Gambit", "white", ["e4", "e5", "d4", "exd4", "c3", "dxc3", "Bc4"], "Trade pawns for open lines and fast development."),
  canonicalPack("ponziani-opening", "Ponziani Opening", "white", ["e4", "e5", "Nf3", "Nc6", "c3"], "Prepare d4 while keeping a clear central plan."),
  canonicalPack("bishops-opening", "Bishop's Opening", "white", ["e4", "e5", "Bc4", "Nf6", "d3"], "Develop the bishop first and retain flexible knight placement."),
  canonicalPack("smith-morra-gambit", "Smith-Morra Gambit", "white", ["e4", "c5", "d4", "cxd4", "c3", "dxc3", "Nxc3"], "Use rapid development and open files against the Sicilian."),
  canonicalPack("alapin-sicilian-white", "Alapin Sicilian", "white", ["e4", "c5", "c3", "d5", "exd5", "Qxd5", "d4"], "Build a broad centre while avoiding the heaviest Open Sicilian theory."),
  canonicalPack("open-sicilian-white", "Open Sicilian", "white", ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4"], "Open the centre and develop actively against the Sicilian."),
  canonicalPack("advance-french-white", "Advance French", "white", ["e4", "e6", "d4", "d5", "e5"], "Use the space advantage and prepare to support the pawn chain."),
  canonicalPack("exchange-french-white", "Exchange French", "white", ["e4", "e6", "d4", "d5", "exd5", "exd5"], "Reach a symmetrical centre and compete through active development."),
  canonicalPack("tarrasch-french-white", "Tarrasch French", "white", ["e4", "e6", "d4", "d5", "Nd2"], "Support e4 while reducing early pressure on the c3 knight."),
  canonicalPack("advance-caro-kann-white", "Advance Caro-Kann", "white", ["e4", "c6", "d4", "d5", "e5"], "Take space and prepare to meet Black's bishop development."),
  canonicalPack("fantasy-caro-kann-white", "Fantasy Caro-Kann", "white", ["e4", "c6", "d4", "d5", "f3"], "Build an ambitious centre and support e4."),
  canonicalPack("queens-gambit-accepted-white", "Queen's Gambit Accepted", "white", ["d4", "d5", "c4", "dxc4", "e4"], "Recover central control through development rather than chasing the pawn immediately."),
  canonicalPack("queens-gambit-declined-white", "Queen's Gambit Declined as White", "white", ["d4", "d5", "c4", "e6", "Nc3", "Nf6"], "Develop behind the Queen's Gambit tension and prepare the central break."),
  canonicalPack("jobava-london", "Jobava London", "white", ["d4", "d5", "Nc3", "Nf6", "Bf4"], "Combine London development with early queenside knight pressure."),
  canonicalPack("stonewall-attack", "Stonewall Attack", "white", ["d4", "d5", "e3", "Nf6", "Bd3", "e6", "f4"], "Build a stable kingside attacking structure."),
  canonicalPack("blackmar-diemer-gambit", "Blackmar-Diemer Gambit", "white", ["d4", "d5", "e4", "dxe4", "Nc3", "Nf6", "f3"], "Use a pawn investment for development and open attacking lines."),
  canonicalPack("queens-pawn-opening", "Queen's Pawn Opening", "white", ["d4", "d5", "Nf3", "Nf6", "e3"], "Build a sound Queen's Pawn centre with flexible development.", ["Queen Pawn Game", "Queen's Pawn Game"]),
  canonicalPack("petroff-defense", "Petroff Defence", "black_vs_e4", ["e4", "e5", "Nf3", "Nf6"], "Challenge White's e4 pawn symmetrically and develop safely."),
  canonicalPack("philidor-defense", "Philidor Defence", "black_vs_e4", ["e4", "e5", "Nf3", "d6"], "Support e5 and build a compact classical position."),
  canonicalPack("e5-classical-black", "1...e5 classical repertoire", "black_vs_e4", ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"], "Meet 1.e4 directly with classical development."),
  canonicalPack("accelerated-dragon", "Accelerated Dragon", "black_vs_e4", ["e4", "c5", "Nf3", "Nc6", "d4", "cxd4", "Nxd4", "g6"], "Fianchetto quickly while retaining the option of an early d5 break."),
  canonicalPack("classical-sicilian", "Classical Sicilian", "black_vs_e4", ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "Nc6"], "Develop both knights and contest the centre before choosing a flank plan."),
  canonicalPack("kan-sicilian", "Kan Sicilian", "black_vs_e4", ["e4", "c5", "Nf3", "e6", "d4", "cxd4", "Nxd4", "a6"], "Use a flexible Sicilian structure and control b5."),
  canonicalPack("semi-slav-defense", "Semi-Slav Defence", "black_vs_d4", ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Nf3", "c6"], "Build a resilient triangle while retaining central counterplay."),
  canonicalPack("grunfeld-defense", "Grünfeld Defence", "black_vs_d4", ["d4", "Nf6", "c4", "g6", "Nc3", "d5"], "Allow White a centre, then attack it with pieces and pawn breaks."),
  canonicalPack("modern-benoni", "Modern Benoni", "black_vs_d4", ["d4", "Nf6", "c4", "c5", "d5", "e6"], "Create queenside counterplay against White's central space."),
  canonicalPack("budapest-gambit", "Budapest Gambit", "black_vs_d4", ["d4", "Nf6", "c4", "e5"], "Challenge White's centre immediately with active piece play."),
  canonicalPack("d5-classical-black", "1...d5 classical repertoire", "black_vs_d4", ["d4", "d5", "c4", "e6", "Nc3", "Nf6"], "Meet 1.d4 with a direct classical centre."),
  canonicalPack("classical-dutch", "Classical Dutch", "black_vs_d4", ["d4", "f5", "c4", "Nf6", "Nc3", "e6"], "Control e4 and build kingside space with disciplined development."),
  canonicalPack("stonewall-dutch", "Stonewall Dutch", "black_vs_d4", ["d4", "f5", "c4", "Nf6", "Nc3", "e6", "Nf3", "d5"], "Build the Stonewall chain and prepare kingside activity."),
];

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
  const firstMove = opening.trainingLines?.[0]?.moves?.[0] || "";
  const repertoireRole = opening.color === "black"
    ? (firstMove === "d4" ? "black_vs_d4" : "black_vs_e4")
    : "white";
  return {
    key: normaliseOpeningKey(opening.name),
    packId: opening.id,
    canonicalOpeningId: opening.id,
    opening,
    practiceSide: opening.color === "black" ? "black" : "white",
    playerColour: opening.color === "black" ? "black" : "white",
    compatibleRoles: [repertoireRole],
    initialMoveFamily: firstMove,
    purpose: opening.ideas?.[0] || `Practise the canonical ${opening.name} move order.`,
    deviations: opening.commonVariations || [],
    source: "opening_database",
    version: 1,
    aliases: [
      opening.name,
      opening.id,
      opening.eco,
    ].filter(Boolean),
    lines: opening.trainingLines.map((line) => ({
      name: line.name,
      moves: line.moves,
      practiceSide: opening.color === "black" ? "black" : "white",
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
  [...databasePracticePacks, ...supplementalCanonicalPacks],
  legacyOpeningPracticePacks
);

function roleForSubject(subject = {}) {
  return subject.repertoireRole || subject.repertoire_role || subject.role || "";
}

function colourForSubject(subject = {}) {
  const value = subject.playerColour || subject.player_colour || subject.practiceSide || subject.side || subject.colour || subject.color || "";
  return String(value).toLowerCase();
}

function familyForSubject(subject = {}) {
  const explicit = subject.initialMoveFamily || subject.initial_move_family || "";
  if (explicit) return String(explicit).replace(/^1\.{1,3}/, "").trim().split(/\s+/)[0];
  const moves = subject.targetLine || subject.target_line || subject.moveLine || subject.move_line || "";
  if (Array.isArray(moves)) return moves[0] || "";
  return String(moves).replace(/^1\.{1,3}/, "").trim().split(/\s+/)[0];
}

function packMatchesSubject(pack, subject = {}) {
  const role = roleForSubject(subject);
  const colour = colourForSubject(subject);
  const family = familyForSubject(subject);
  if (role && !pack.compatibleRoles?.includes(role)) return false;
  if (colour && pack.playerColour !== colour) return false;
  if (family && pack.initialMoveFamily !== family) return false;
  return true;
}

const aliasIndex = openingPracticePacks.reduce((index, pack) => {
  [pack.packId, pack.canonicalOpeningId, pack.key, ...(pack.aliases || [])].forEach((alias) => {
    const key = normaliseOpeningKey(alias || "");
    if (!key) return;
    const matches = index.get(key) || [];
    if (!matches.includes(pack)) matches.push(pack);
    index.set(key, matches);
  });
  return index;
}, new Map());

export function resolveOpeningPracticePack(subject = "") {
  const details = typeof subject === "string" ? { openingName: subject } : (subject || {});
  const requested = details.openingId || details.opening_id || details.canonicalOpeningId || details.canonical_opening_id || details.openingName || details.opening || details.name || "";
  const key = normaliseOpeningKey(requested);
  if (!key) return { status: "missing", reason: "missing_opening_identity", pack: null, compatibleAlternatives: [] };
  const candidates = (aliasIndex.get(key) || []).filter((pack) => packMatchesSubject(pack, details));
  if (candidates.length === 1) return { status: "ready", reason: "exact_canonical_match", pack: candidates[0], compatibleAlternatives: [] };
  const hasCompatibilityContext = Boolean(roleForSubject(details) && colourForSubject(details) && familyForSubject(details));
  const compatibleAlternatives = hasCompatibilityContext
    ? openingPracticePacks.filter((pack) => packMatchesSubject(pack, details)).slice(0, 8)
    : [];
  return {
    status: candidates.length > 1 ? "invalid" : "missing",
    reason: candidates.length > 1 ? "ambiguous_opening_identity" : "no_compatible_pack",
    pack: null,
    compatibleAlternatives,
  };
}

export function findOpeningPracticePack(subject = "") {
  return resolveOpeningPracticePack(subject).pack;
}

export function validateOpeningPracticeRegistry(packs = openingPracticePacks) {
  const errors = [];
  const ids = new Set();
  const aliases = new Map();
  packs.forEach((pack) => {
    if (!pack.packId || ids.has(pack.packId)) errors.push(`duplicate_or_missing_pack_id:${pack.packId || "unknown"}`);
    ids.add(pack.packId);
    [pack.packId, pack.canonicalOpeningId, pack.key, ...(pack.aliases || [])].forEach((alias) => {
      const key = normaliseOpeningKey(alias || "");
      if (!key) return;
      const owner = aliases.get(key);
      if (owner && owner !== pack.packId) errors.push(`ambiguous_alias:${key}:${owner}:${pack.packId}`);
      else aliases.set(key, pack.packId);
    });
    if (!pack.canonicalOpeningId || !pack.playerColour || !pack.initialMoveFamily || !pack.compatibleRoles?.length || !pack.purpose || !pack.source || !pack.version) {
      errors.push(`incomplete_metadata:${pack.packId}`);
    }
    if (pack.compatibleRoles?.includes("white") && pack.playerColour !== "white") errors.push(`role_colour_mismatch:${pack.packId}`);
    if (pack.compatibleRoles?.some((role) => role.startsWith("black_")) && pack.playerColour !== "black") errors.push(`role_colour_mismatch:${pack.packId}`);
    if (pack.compatibleRoles?.includes("black_vs_e4") && pack.initialMoveFamily !== "e4") errors.push(`role_family_mismatch:${pack.packId}`);
    if (pack.compatibleRoles?.includes("black_vs_d4") && pack.initialMoveFamily !== "d4") errors.push(`role_family_mismatch:${pack.packId}`);
    (pack.lines || []).forEach((line, lineIndex) => {
      const game = new Chess();
      if (line.moves?.[0] !== pack.initialMoveFamily) errors.push(`line_family_mismatch:${pack.packId}:${lineIndex}`);
      for (const move of line.moves || []) {
        try {
          if (!game.move(move)) throw new Error("illegal");
        } catch {
          errors.push(`illegal_line:${pack.packId}:${lineIndex}:${move}`);
          break;
        }
      }
    });
  });
  return { valid: errors.length === 0, packCount: packs.length, lineCount: packs.reduce((sum, pack) => sum + (pack.lines?.length || 0), 0), errors };
}
