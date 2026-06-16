export const chessOpeningSeoPages = [
  {
    slug: "vienna-game",
    name: "Vienna Game",
    shortDescription:
      "An active 1.e4 opening for players who want quick development and attacking chances.",
    description:
      "The Vienna Game is a 1.e4 opening for players who want active pieces, quick kingside chances, and clear attacking plans without memorising a huge Sicilian-sized tree.",
    whoItSuits: [
      "White players who like early initiative and direct development.",
      "Improving players who want attacking chances from familiar 1.e4 positions.",
      "Players whose results improve when the middlegame has obvious targets.",
    ],
    commonPlans: [
      "Develop with Nc3, Bc4 or g3, and castle before forcing the attack.",
      "Use f4 ideas when the centre is ready for it.",
      "Aim pressure at f7 while keeping your own king safe.",
    ],
    commonMistake: "Pushing f4 or launching a kingside attack before development supports it.",
    callToAction: "Analyse your games to see if this opening fits you",
  },
  {
    slug: "scandinavian-defense",
    name: "Scandinavian Defense",
    shortDescription:
      "A practical Black response to 1.e4 with an early central challenge and simple plans.",
    description:
      "The Scandinavian Defense gives Black a practical answer to 1.e4 with an early central challenge and straightforward development plans.",
    whoItSuits: [
      "Black players who want a simple, repeatable response to 1.e4.",
      "Players who prefer structure and piece activity over deep forcing theory.",
      "Players who are comfortable accepting a small space disadvantage for clarity.",
    ],
    commonPlans: [
      "Challenge the centre with 1...d5 and recover the queen safely.",
      "Develop quickly with ...Nf6, ...c6 or ...e6, and castle.",
      "Trade into solid structures when White overextends.",
    ],
    commonMistake: "Moving the queen too many times and falling behind in development.",
    callToAction: "Analyse your games to see if this opening fits you",
  },
  {
    slug: "caro-kann-defense",
    name: "Caro-Kann Defense",
    shortDescription:
      "A solid 1.e4 defense for players who value structure, reliability, and clean development.",
    description:
      "The Caro-Kann Defense is a solid answer to 1.e4 for players who value structure, clean development, and reliable middlegames.",
    whoItSuits: [
      "Black players who want fewer early collapses against 1.e4.",
      "Players who like solid pawn structures and endgame chances.",
      "Players who prefer improving a position gradually over gambling in sharp theory.",
    ],
    commonPlans: [
      "Build with ...c6 and ...d5, then develop the light-squared bishop actively.",
      "Use ...c5 or ...e5 breaks when White gives you time.",
      "Trade into healthy structures when White overpresses.",
    ],
    commonMistake: "Playing too passively and letting White gain space without a counterbreak.",
    callToAction: "Analyse your games to see if this opening fits you",
  },
  {
    slug: "london-system",
    name: "London System",
    shortDescription:
      "A repeatable White setup for players who want clear development and low early risk.",
    description:
      "The London System is a White opening built around stable piece placement, low early risk, and repeatable plans against many Black setups.",
    whoItSuits: [
      "White players who want a dependable opening with clear development.",
      "Players who prefer plans and structures over memorising forcing lines.",
      "Players whose results are better when the first ten moves feel familiar.",
    ],
    commonPlans: [
      "Set up d4, Bf4, Nf3, e3, c3, Bd3, and castle.",
      "React to Black's setup instead of playing the same moves automatically.",
      "Use Ne5 or kingside pressure only when the centre is stable.",
    ],
    commonMistake: "Playing the setup on autopilot while ignoring Black's central counterplay.",
    callToAction: "Analyse your games to see if this opening fits you",
  },
  {
    slug: "sicilian-defense",
    name: "Sicilian Defense",
    shortDescription:
      "An ambitious Black defense for players who enjoy imbalance, counterplay, and tactics.",
    description:
      "The Sicilian Defense is an ambitious answer to 1.e4 for Black players who want imbalanced positions, counterplay, and tactical chances.",
    whoItSuits: [
      "Black players who enjoy sharp positions and are willing to study.",
      "Players whose strengths show up in tactical, unbalanced middlegames.",
      "Players who do not mind facing several White systems.",
    ],
    commonPlans: [
      "Challenge the centre with ...c5 and develop with purpose.",
      "Choose one Sicilian family first, such as Najdorf, Dragon, Classical, or Accelerated Dragon.",
      "Look for queenside counterplay and central breaks before attacking.",
    ],
    commonMistake: "Trying to learn too many Sicilian variations at once and missing basic development.",
    callToAction: "Analyse your games to see if this opening fits you",
  },
];

export const chessOpeningSeoPagesBySlug = Object.fromEntries(
  chessOpeningSeoPages.map((opening) => [opening.slug, opening])
);

export function getChessOpeningSeoPage(slug) {
  return chessOpeningSeoPagesBySlug[String(slug || "").toLowerCase()] || null;
}

export function getChessOpeningSeoSlugFromPath(path) {
  const match = String(path || "").match(/^\/chess-openings\/([^/]+)$/);
  return match ? match[1] : "";
}
