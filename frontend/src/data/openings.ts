export type OpeningLine = {
  id: string;
  name: string;
  eco?: string;
  color: "white" | "black" | "both";
  moves: string[];
  pgn: string;
  tags: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  ideas: string[];
  trainingLines: {
    name: string;
    moves: string[];
    explanation: string;
    keyIdeas: string[];
  }[];
  traps?: {
    name: string;
    moves: string[];
    warning: string;
  }[];
  commonVariations?: string[];
  appearsInTraining: boolean;
};

export const OPENINGS: OpeningLine[] = [
  {
    id: "london-system",
    name: "London System",
    eco: "D02",
    color: "white",
    moves: ["d4", "d5", "Nf3", "Nf6", "Bf4"],
    pgn: "1. d4 d5 2. Nf3 Nf6 3. Bf4",
    tags: ["solid", "beginner", "system", "white", "d4"],
    difficulty: "beginner",
    ideas: [
      "Develop the bishop to f4 before playing e3.",
      "Build a solid setup with Nf3, e3, c3 and Bd3.",
      "Often attack with Ne5 and pressure h7.",
    ],
    commonVariations: ["Jobava London", "Classical London", "London vs King's Indian setup"],
    trainingLines: [
      {
        name: "Main London Setup",
        moves: ["d4", "d5", "Nf3", "Nf6", "Bf4", "e6", "e3", "Bd6", "Bg3", "O-O", "Bd3"],
        explanation: "A standard London setup focused on safe development and kingside attacking chances.",
        keyIdeas: ["Keep the structure solid", "Trade dark-square bishops if useful", "Look for Ne5"],
      },
      {
        name: "London vs King's Indian Setup",
        moves: ["d4", "Nf6", "Nf3", "g6", "Bf4", "Bg7", "e3", "O-O", "Be2", "d6", "O-O"],
        explanation: "White keeps the London shape while Black fianchettoes, then chooses c4 or h3 later.",
        keyIdeas: ["Do not rush", "Keep e5 under control", "Castle before attacking"],
      },
    ],
    traps: [
      {
        name: "Greek Gift Pattern",
        moves: ["d4", "d5", "Nf3", "Nf6", "Bf4", "e6", "e3", "Bd6", "Bg3", "O-O", "Bd3"],
        warning: "Watch for Bxh7+ sacrifices when Black weakens their king and the knight can reach g5.",
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "queens-gambit",
    name: "Queen's Gambit",
    eco: "D06",
    color: "white",
    moves: ["d4", "d5", "c4"],
    pgn: "1. d4 d5 2. c4",
    tags: ["classical", "white", "positional", "center", "d4"],
    difficulty: "intermediate",
    ideas: [
      "Challenge Black's center immediately.",
      "Gain space and create pressure on d5.",
      "Develop naturally with Nc3, Nf3, e3 and Bd3.",
    ],
    commonVariations: ["Queen's Gambit Declined", "Queen's Gambit Accepted", "Exchange Variation"],
    trainingLines: [
      {
        name: "Queen's Gambit Declined",
        moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7", "e3", "O-O", "Nf3"],
        explanation: "A classical structure where White pressures the center and develops actively.",
        keyIdeas: ["Pressure d5", "Develop bishop before e3 when possible", "Prepare a central break"],
      },
      {
        name: "Queen's Gambit Accepted",
        moves: ["d4", "d5", "c4", "dxc4", "e3", "Nf6", "Bxc4", "e6", "Nf3"],
        explanation: "White quickly recaptures the gambit pawn and develops with central control.",
        keyIdeas: ["Recover the pawn", "Control the center", "Avoid rushing attacks"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "kings-indian-attack",
    name: "King's Indian Attack",
    eco: "A07",
    color: "white",
    moves: ["Nf3", "d5", "g3", "Nf6", "Bg2"],
    pgn: "1. Nf3 d5 2. g3 Nf6 3. Bg2",
    tags: ["system", "white", "kingside", "flexible", "beginner"],
    difficulty: "beginner",
    ideas: [
      "Fianchetto the bishop and castle quickly.",
      "Build slowly with d3, Nbd2, e4.",
      "Attack on the kingside later with h4 or e5 ideas.",
    ],
    commonVariations: ["KIA vs French setup", "KIA vs Sicilian setup", "Reti transposition"],
    trainingLines: [
      {
        name: "Standard KIA Setup",
        moves: ["Nf3", "d5", "g3", "Nf6", "Bg2", "e6", "O-O", "Be7", "d3", "O-O", "Nbd2", "c5", "e4"],
        explanation: "White plays a flexible setup and later challenges the center.",
        keyIdeas: ["Castle early", "Prepare e4", "Attack after development"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "vienna-game",
    name: "Vienna Game",
    eco: "C25",
    color: "white",
    moves: ["e4", "e5", "Nc3"],
    pgn: "1. e4 e5 2. Nc3",
    tags: ["white", "attacking", "e4", "beginner-friendly"],
    difficulty: "beginner",
    ideas: [
      "Develop naturally while keeping attacking options.",
      "Often play f4 to attack the center.",
      "Can transpose into aggressive kingside attacks.",
    ],
    commonVariations: ["Vienna Gambit", "Quiet Vienna", "Max Lange Defense"],
    trainingLines: [
      {
        name: "Vienna Gambit",
        moves: ["e4", "e5", "Nc3", "Nf6", "f4"],
        explanation: "White immediately attacks the center and creates sharp attacking chances.",
        keyIdeas: ["Use f4 to challenge e5", "Develop quickly", "Avoid falling behind in development"],
      },
      {
        name: "Quiet Vienna",
        moves: ["e4", "e5", "Nc3", "Nf6", "Bc4", "Bc5", "d3", "d6", "Nf3"],
        explanation: "A calmer Vienna where White develops naturally and keeps f4 available later.",
        keyIdeas: ["Develop before attacking", "Castle quickly", "Pressure f7 carefully"],
      },
    ],
    traps: [
      {
        name: "Vienna Gambit trap",
        moves: ["e4", "e5", "Nc3", "Nf6", "f4", "d5", "fxe5", "Nxe4", "Qf3"],
        warning: "If Black grabs material carelessly, Qf3 can create pressure on f7 and e4.",
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "italian-game",
    name: "Italian Game",
    eco: "C50",
    color: "white",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bc4"],
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4",
    tags: ["white", "classical", "beginner", "development", "e4"],
    difficulty: "beginner",
    ideas: [
      "Develop pieces quickly and fight for the center.",
      "Pressure f7 with the bishop.",
      "Castle early and prepare d3 or c3.",
    ],
    commonVariations: ["Giuoco Piano", "Two Knights Defense", "Evans Gambit"],
    trainingLines: [
      {
        name: "Giuoco Piano",
        moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d3", "O-O", "O-O"],
        explanation: "A calm Italian setup focused on development and central control.",
        keyIdeas: ["Prepare d4", "Castle early", "Avoid early queen attacks"],
      },
      {
        name: "Two Knights Defense",
        moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "d3", "Bc5", "O-O", "d6"],
        explanation: "A practical way to meet the Two Knights without memorising sharp theory.",
        keyIdeas: ["Defend e4", "Castle early", "Keep the center stable"],
      },
    ],
    traps: [
      {
        name: "Fried Liver warning",
        moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "Ng5", "d5", "exd5"],
        warning: "If you allow Ng5 tactics, know the defensive line before grabbing pawns.",
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "ruy-lopez",
    name: "Ruy Lopez",
    eco: "C60",
    color: "white",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"],
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5",
    tags: ["white", "classical", "positional", "advanced", "e4"],
    difficulty: "advanced",
    ideas: [
      "Pressure the knight defending e5.",
      "Build long-term central pressure.",
      "Use c3 and d4 to claim space.",
    ],
    commonVariations: ["Closed Ruy Lopez", "Exchange Variation", "Berlin Defense"],
    trainingLines: [
      {
        name: "Ruy Lopez Main Setup",
        moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5", "Bb3", "d6", "c3"],
        explanation: "White builds long-term pressure and prepares d4.",
        keyIdeas: ["Preserve the bishop", "Prepare d4", "Use Re1 to support e4"],
      },
      {
        name: "Exchange Ruy Lopez",
        moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Bxc6", "dxc6", "O-O"],
        explanation: "White changes the pawn structure and plays for a clean long-term plan.",
        keyIdeas: ["Understand the pawn structure", "Castle before expanding", "Use the endgame majority"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "scotch-game",
    name: "Scotch Game",
    eco: "C45",
    color: "white",
    moves: ["e4", "e5", "Nf3", "Nc6", "d4"],
    pgn: "1. e4 e5 2. Nf3 Nc6 3. d4",
    tags: ["white", "open", "attacking", "e4", "center"],
    difficulty: "intermediate",
    ideas: [
      "Open the center early before Black fully settles.",
      "Use active piece play instead of slow maneuvering.",
      "Watch queen tempi after early captures.",
    ],
    commonVariations: ["Main Scotch", "Scotch Four Knights", "Scotch Gambit"],
    trainingLines: [
      {
        name: "Main Scotch",
        moves: ["e4", "e5", "Nf3", "Nc6", "d4", "exd4", "Nxd4", "Nf6", "Nc3"],
        explanation: "White opens the center and develops active pieces quickly.",
        keyIdeas: ["Open the center", "Develop before queen moves", "Keep e4 protected"],
      },
      {
        name: "Scotch Gambit",
        moves: ["e4", "e5", "Nf3", "Nc6", "d4", "exd4", "Bc4", "Bc5", "c3"],
        explanation: "White delays recapturing to develop quickly and attack f7.",
        keyIdeas: ["Lead in development", "Pressure f7", "Do not drift into pawn grabbing"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "english-opening",
    name: "English Opening",
    eco: "A10",
    color: "white",
    moves: ["c4"],
    pgn: "1. c4",
    tags: ["white", "positional", "flank", "flexible", "system"],
    difficulty: "intermediate",
    ideas: [
      "Control d5 from the side before occupying the center.",
      "Often fianchetto the bishop with g3 and Bg2.",
      "Can transpose into Queen's Gambit or reversed Sicilian structures.",
    ],
    commonVariations: ["Symmetrical English", "Reversed Sicilian", "Botvinnik setup"],
    trainingLines: [
      {
        name: "English vs e5",
        moves: ["c4", "e5", "Nc3", "Nf6", "g3", "d5", "cxd5", "Nxd5", "Bg2"],
        explanation: "White uses a reversed Sicilian structure with an extra tempo.",
        keyIdeas: ["Fianchetto safely", "Pressure d5", "Keep central breaks flexible"],
      },
      {
        name: "Botvinnik Setup",
        moves: ["c4", "g6", "Nc3", "Bg7", "g3", "d6", "Bg2", "e5", "e4"],
        explanation: "White builds a clamp and plays around dark-square control.",
        keyIdeas: ["Control d5", "Use the fianchetto bishop", "Expand only after development"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "reti-opening",
    name: "Reti Opening",
    eco: "A04",
    color: "white",
    moves: ["Nf3", "d5", "c4"],
    pgn: "1. Nf3 d5 2. c4",
    tags: ["white", "flank", "system", "positional", "flexible"],
    difficulty: "intermediate",
    ideas: [
      "Control the center with pieces before committing pawns.",
      "Fianchetto the bishop and pressure d5.",
      "Transpose only when it suits your repertoire.",
    ],
    commonVariations: ["Reti main line", "Reti with d4", "King's Indian Attack transposition"],
    trainingLines: [
      {
        name: "Reti Main Setup",
        moves: ["Nf3", "d5", "c4", "e6", "g3", "Nf6", "Bg2", "Be7", "O-O"],
        explanation: "White develops flexibly and waits to choose the central structure.",
        keyIdeas: ["Pressure d5", "Castle early", "Keep transpositions under control"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "catalan-opening",
    name: "Catalan Opening",
    eco: "E01",
    color: "white",
    moves: ["d4", "Nf6", "c4", "e6", "g3"],
    pgn: "1. d4 Nf6 2. c4 e6 3. g3",
    tags: ["white", "positional", "fianchetto", "advanced", "d4"],
    difficulty: "advanced",
    ideas: [
      "Combine Queen's Gambit space with a powerful g2 bishop.",
      "Apply long-term pressure on the queenside and center.",
      "Be ready to recover or sacrifice the c4 pawn.",
    ],
    commonVariations: ["Open Catalan", "Closed Catalan", "Catalan Accepted"],
    trainingLines: [
      {
        name: "Closed Catalan Setup",
        moves: ["d4", "Nf6", "c4", "e6", "g3", "d5", "Bg2", "Be7", "Nf3", "O-O", "O-O"],
        explanation: "White builds long-term pressure with the g2 bishop and safe development.",
        keyIdeas: ["Keep the bishop active", "Pressure c6 and d5", "Do not rush tactics"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "colle-system",
    name: "Colle System",
    eco: "D05",
    color: "white",
    moves: ["d4", "d5", "Nf3", "Nf6", "e3"],
    pgn: "1. d4 d5 2. Nf3 Nf6 3. e3",
    tags: ["white", "solid", "system", "beginner", "d4"],
    difficulty: "beginner",
    ideas: [
      "Build a simple setup with e3, Bd3, c3, and Nbd2.",
      "Prepare e4 as the central break.",
      "Attack the kingside only after the structure is ready.",
    ],
    commonVariations: ["Colle-Koltanowski", "Zukertort setup", "Stonewall transposition"],
    trainingLines: [
      {
        name: "Colle Main Setup",
        moves: ["d4", "d5", "Nf3", "Nf6", "e3", "e6", "Bd3", "c5", "c3", "Nc6", "Nbd2"],
        explanation: "White builds a repeatable setup and prepares e4.",
        keyIdeas: ["Keep the setup compact", "Prepare e4", "Avoid blocking every piece"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "trompowsky-attack",
    name: "Trompowsky Attack",
    eco: "A45",
    color: "white",
    moves: ["d4", "Nf6", "Bg5"],
    pgn: "1. d4 Nf6 2. Bg5",
    tags: ["white", "attacking", "anti-theory", "d4"],
    difficulty: "intermediate",
    ideas: [
      "Challenge the knight early and avoid heavy d4 theory.",
      "Be ready for doubled-pawn structures after Bxf6.",
      "Develop quickly if Black attacks the bishop.",
    ],
    commonVariations: ["Trompowsky with Bxf6", "Trompowsky with e3", "Trompowsky vs Ne4"],
    trainingLines: [
      {
        name: "Trompowsky Main Setup",
        moves: ["d4", "Nf6", "Bg5", "e6", "e4", "Be7", "Nc3", "d5", "e5"],
        explanation: "White uses the bishop pin to build central space.",
        keyIdeas: ["Use the pin", "Support the center", "Do not let the bishop get trapped"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "kings-gambit",
    name: "King's Gambit",
    eco: "C30",
    color: "white",
    moves: ["e4", "e5", "f4"],
    pgn: "1. e4 e5 2. f4",
    tags: ["white", "attacking", "gambit", "sharp", "e4"],
    difficulty: "advanced",
    ideas: [
      "Sacrifice a flank pawn to attack the center and f-file.",
      "Develop quickly; slow play is punished.",
      "King safety is fragile, so every tempo matters.",
    ],
    commonVariations: ["Accepted", "Declined", "Falkbeer Countergambit"],
    trainingLines: [
      {
        name: "King's Gambit Accepted",
        moves: ["e4", "e5", "f4", "exf4", "Nf3", "g5", "Bc4", "Bg7", "O-O"],
        explanation: "White accepts risk for rapid development and attacking chances.",
        keyIdeas: ["Develop fast", "Attack f7", "Do not waste tempi"],
      },
    ],
    traps: [
      {
        name: "Falkbeer danger",
        moves: ["e4", "e5", "f4", "d5", "exd5", "e4"],
        warning: "Black can counter in the center immediately; know how to meet ...d5.",
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "sicilian-defense",
    name: "Sicilian Defense",
    eco: "B20",
    color: "black",
    moves: ["e4", "c5"],
    pgn: "1. e4 c5",
    tags: ["black", "sharp", "counterattack", "e4-response", "attacking"],
    difficulty: "intermediate",
    ideas: [
      "Fight for the center asymmetrically.",
      "Create queenside counterplay.",
      "Avoid passive development.",
    ],
    commonVariations: ["Open Sicilian", "Alapin", "Closed Sicilian"],
    trainingLines: [
      {
        name: "Open Sicilian Setup",
        moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3"],
        explanation: "Black accepts a sharp open position with dynamic counterplay.",
        keyIdeas: ["Pressure the center", "Develop quickly", "Look for queenside play"],
      },
      {
        name: "Alapin Sicilian",
        moves: ["e4", "c5", "c3", "Nf6", "e5", "Nd5", "d4", "cxd4", "Nf3"],
        explanation: "Black meets c3 by pressuring e5 and avoiding a passive setup.",
        keyIdeas: ["Challenge e5", "Do not allow easy d4", "Develop actively"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "sicilian-najdorf",
    name: "Sicilian Najdorf",
    eco: "B90",
    color: "black",
    moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"],
    pgn: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6",
    tags: ["black", "sharp", "advanced", "e4-response", "attacking"],
    difficulty: "advanced",
    ideas: [
      "Use ...a6 to control b5 and prepare queenside expansion.",
      "Choose ...e5 or ...e6 structures deliberately.",
      "Counterattack before White's kingside attack lands.",
    ],
    commonVariations: ["English Attack", "Classical", "Poisoned Pawn"],
    trainingLines: [
      {
        name: "Najdorf Main Setup",
        moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6", "Be3", "e5"],
        explanation: "Black gains queenside control and challenges the knight with ...e5.",
        keyIdeas: ["Control b5", "Know your central structure", "Prepare counterplay"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "sicilian-dragon",
    name: "Sicilian Dragon",
    eco: "B70",
    color: "black",
    moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "g6"],
    pgn: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6",
    tags: ["black", "sharp", "fianchetto", "e4-response", "attacking"],
    difficulty: "advanced",
    ideas: [
      "Fianchetto the bishop to create pressure on the long diagonal.",
      "Use queenside counterplay against castled-long positions.",
      "Calculate tactics around c3, h-file attacks, and exchange sacrifices.",
    ],
    commonVariations: ["Yugoslav Attack", "Classical Dragon", "Accelerated Dragon"],
    trainingLines: [
      {
        name: "Dragon Main Setup",
        moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "g6", "Be3", "Bg7"],
        explanation: "Black develops the dragon bishop and prepares dynamic counterplay.",
        keyIdeas: ["Use the g7 bishop", "Counter on the queenside", "Watch h-file attacks"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "caro-kann-defense",
    name: "Caro-Kann Defense",
    eco: "B10",
    color: "black",
    moves: ["e4", "c6"],
    pgn: "1. e4 c6",
    tags: ["black", "solid", "beginner", "e4-response"],
    difficulty: "beginner",
    ideas: [
      "Support d5 with c6.",
      "Build a solid pawn structure.",
      "Develop the light-square bishop before e6 when possible.",
    ],
    commonVariations: ["Classical", "Advance", "Exchange"],
    trainingLines: [
      {
        name: "Caro-Kann Classical",
        moves: ["e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Bf5"],
        explanation: "Black develops solidly and avoids early weaknesses.",
        keyIdeas: ["Play d5", "Develop Bf5", "Stay solid"],
      },
      {
        name: "Caro-Kann Advance",
        moves: ["e4", "c6", "d4", "d5", "e5", "Bf5", "Nf3", "e6"],
        explanation: "Black attacks White's advanced center from a solid base.",
        keyIdeas: ["Pressure d4", "Develop bishop early", "Use c5 break later"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "french-defense",
    name: "French Defense",
    eco: "C00",
    color: "black",
    moves: ["e4", "e6"],
    pgn: "1. e4 e6",
    tags: ["black", "solid", "counterattack", "e4-response"],
    difficulty: "intermediate",
    ideas: [
      "Challenge the center with d5.",
      "Accept a solid but slightly cramped position.",
      "Attack White's pawn chain with c5 and f6.",
    ],
    commonVariations: ["Advance", "Classical", "Exchange", "Winawer"],
    trainingLines: [
      {
        name: "French Advance",
        moves: ["e4", "e6", "d4", "d5", "e5", "c5", "c3", "Nc6", "Nf3"],
        explanation: "Black attacks White's center immediately with c5.",
        keyIdeas: ["Break with c5", "Pressure d4", "Watch the bad bishop"],
      },
      {
        name: "French Classical",
        moves: ["e4", "e6", "d4", "d5", "Nc3", "Nf6", "Bg5", "Be7", "e5", "Nfd7"],
        explanation: "Black challenges the center while keeping a solid structure.",
        keyIdeas: ["Pressure d4", "Prepare c5", "Free the light-square bishop"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "scandinavian-defense",
    name: "Scandinavian Defense",
    eco: "B01",
    color: "black",
    moves: ["e4", "d5"],
    pgn: "1. e4 d5",
    tags: ["black", "direct", "beginner", "e4-response", "solid"],
    difficulty: "beginner",
    ideas: [
      "Challenge e4 immediately.",
      "Accept queen-tempo risk only when the queen has a safe square.",
      "Develop quickly after the early queen move.",
    ],
    commonVariations: ["Main line Qxd5", "Modern Scandinavian", "Portuguese setup"],
    trainingLines: [
      {
        name: "Main Scandinavian",
        moves: ["e4", "d5", "exd5", "Qxd5", "Nc3", "Qa5", "d4", "Nf6", "Nf3"],
        explanation: "Black accepts an early queen move but aims for simple development.",
        keyIdeas: ["Do not overuse the queen", "Develop quickly", "Target central stability"],
      },
      {
        name: "Modern Scandinavian",
        moves: ["e4", "d5", "exd5", "Nf6", "d4", "Nxd5", "Nf3", "g6"],
        explanation: "Black delays queen recapture and develops a piece first.",
        keyIdeas: ["Develop before recapturing", "Challenge d5", "Keep pieces active"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "pirc-defense",
    name: "Pirc Defense",
    eco: "B07",
    color: "black",
    moves: ["e4", "d6", "d4", "Nf6"],
    pgn: "1. e4 d6 2. d4 Nf6",
    tags: ["black", "hypermodern", "e4-response", "flexible"],
    difficulty: "intermediate",
    ideas: [
      "Let White build a center, then attack it with pieces and pawn breaks.",
      "Develop with ...g6, ...Bg7, and ...O-O.",
      "Watch for fast Austrian Attack setups.",
    ],
    commonVariations: ["Classical", "Austrian Attack", "Fianchetto"],
    trainingLines: [
      {
        name: "Classical Pirc",
        moves: ["e4", "d6", "d4", "Nf6", "Nc3", "g6", "Nf3", "Bg7", "Be2", "O-O"],
        explanation: "Black develops flexibly and prepares central counterplay.",
        keyIdeas: ["Castle quickly", "Challenge the center", "Do not drift passively"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "modern-defense",
    name: "Modern Defense",
    eco: "B06",
    color: "black",
    moves: ["e4", "g6"],
    pgn: "1. e4 g6",
    tags: ["black", "hypermodern", "flexible", "e4-response"],
    difficulty: "intermediate",
    ideas: [
      "Fianchetto first, then decide how to challenge the center.",
      "Use ...d6, ...Bg7, and ...c5 or ...e5 breaks.",
      "Do not let White attack before you complete development.",
    ],
    commonVariations: ["Modern with d6", "Tiger Modern", "Pirc transposition"],
    trainingLines: [
      {
        name: "Modern Main Setup",
        moves: ["e4", "g6", "d4", "Bg7", "Nc3", "d6", "Nf3", "Nf6", "Be2", "O-O"],
        explanation: "Black develops the fianchetto and keeps central breaks flexible.",
        keyIdeas: ["Fianchetto safely", "Choose the right break", "Watch the kingside"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "alekhine-defense",
    name: "Alekhine Defense",
    eco: "B02",
    color: "black",
    moves: ["e4", "Nf6"],
    pgn: "1. e4 Nf6",
    tags: ["black", "counterattack", "hypermodern", "e4-response"],
    difficulty: "advanced",
    ideas: [
      "Invite White to overextend pawns, then attack the center.",
      "Move the knight only with a clear purpose.",
      "Use ...d6 and ...g6 or ...Bg4 setups to pressure the center.",
    ],
    commonVariations: ["Four Pawns Attack", "Modern Variation", "Exchange Variation"],
    trainingLines: [
      {
        name: "Alekhine Main Setup",
        moves: ["e4", "Nf6", "e5", "Nd5", "d4", "d6", "Nf3", "Bg4", "Be2", "e6"],
        explanation: "Black provokes central pawns and then starts undermining them.",
        keyIdeas: ["Attack overextension", "Develop after provoking", "Do not lose tempi aimlessly"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "queens-gambit-declined",
    name: "Queen's Gambit Declined",
    eco: "D30",
    color: "black",
    moves: ["d4", "d5", "c4", "e6"],
    pgn: "1. d4 d5 2. c4 e6",
    tags: ["black", "solid", "classical", "d4-response"],
    difficulty: "intermediate",
    ideas: [
      "Defend d5 solidly with e6.",
      "Develop pieces naturally.",
      "Look for c5 or e5 breaks.",
    ],
    commonVariations: ["Orthodox", "Tarrasch", "Exchange Variation"],
    trainingLines: [
      {
        name: "QGD Orthodox Setup",
        moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7", "e3", "O-O", "Nf3"],
        explanation: "Black plays solidly and prepares to challenge White's center later.",
        keyIdeas: ["Stay solid", "Develop naturally", "Break with c5"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "slav-defense",
    name: "Slav Defense",
    eco: "D10",
    color: "black",
    moves: ["d4", "d5", "c4", "c6"],
    pgn: "1. d4 d5 2. c4 c6",
    tags: ["black", "solid", "d4-response", "classical"],
    difficulty: "intermediate",
    ideas: [
      "Support d5 without blocking the light-square bishop.",
      "Develop Bf5 or Bg4 before e6.",
      "Create a solid but active structure.",
    ],
    commonVariations: ["Main Slav", "Exchange Slav", "Semi-Slav"],
    trainingLines: [
      {
        name: "Main Slav Setup",
        moves: ["d4", "d5", "c4", "c6", "Nf3", "Nf6", "Nc3", "dxc4", "a4", "Bf5"],
        explanation: "Black holds a solid structure and develops actively.",
        keyIdeas: ["Develop bishop before e6", "Hold d5", "Use queenside counterplay"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "kings-indian-defense",
    name: "King's Indian Defense",
    eco: "E60",
    color: "black",
    moves: ["d4", "Nf6", "c4", "g6"],
    pgn: "1. d4 Nf6 2. c4 g6",
    tags: ["black", "dynamic", "kingside", "d4-response", "attacking"],
    difficulty: "advanced",
    ideas: [
      "Allow White to build the center, then attack it.",
      "Use Bg7, d6, O-O and e5 or c5 breaks.",
      "Often attack on the kingside.",
    ],
    commonVariations: ["Classical", "Fianchetto", "Four Pawns Attack"],
    trainingLines: [
      {
        name: "King's Indian Main Setup",
        moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "Nf3", "O-O"],
        explanation: "Black develops flexibly and prepares central counterplay.",
        keyIdeas: ["Castle quickly", "Prepare e5", "Attack the center"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "nimzo-indian-defense",
    name: "Nimzo-Indian Defense",
    eco: "E20",
    color: "black",
    moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"],
    pgn: "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4",
    tags: ["black", "positional", "d4-response", "advanced"],
    difficulty: "advanced",
    ideas: [
      "Pin the knight and fight for control of e4.",
      "Use flexible pawn structures based on White's setup.",
      "Trade structural damage for bishop-pair concessions only when useful.",
    ],
    commonVariations: ["Classical", "Rubinstein", "Sämisch"],
    trainingLines: [
      {
        name: "Nimzo Main Setup",
        moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4", "e3", "O-O", "Bd3", "d5"],
        explanation: "Black pins the knight, castles, and challenges the center.",
        keyIdeas: ["Control e4", "Castle early", "Choose your pawn break"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "queens-indian-defense",
    name: "Queen's Indian Defense",
    eco: "E12",
    color: "black",
    moves: ["d4", "Nf6", "c4", "e6", "Nf3", "b6"],
    pgn: "1. d4 Nf6 2. c4 e6 3. Nf3 b6",
    tags: ["black", "solid", "d4-response", "positional"],
    difficulty: "intermediate",
    ideas: [
      "Fianchetto the queen bishop to contest central dark squares.",
      "Avoid overextending before development is complete.",
      "Challenge the center with ...Bb7, ...Be7, and ...d5 or ...c5.",
    ],
    commonVariations: ["Classical", "Fianchetto", "Petrosian"],
    trainingLines: [
      {
        name: "Queen's Indian Main Setup",
        moves: ["d4", "Nf6", "c4", "e6", "Nf3", "b6", "g3", "Ba6", "b3", "Bb4+"],
        explanation: "Black develops actively and contests White's fianchetto setup.",
        keyIdeas: ["Use the b7/a6 bishop actively", "Challenge c4", "Stay flexible"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "benoni-defense",
    name: "Benoni Defense",
    eco: "A56",
    color: "black",
    moves: ["d4", "Nf6", "c4", "c5", "d5", "e6"],
    pgn: "1. d4 Nf6 2. c4 c5 3. d5 e6",
    tags: ["black", "dynamic", "d4-response", "attacking"],
    difficulty: "advanced",
    ideas: [
      "Accept space disadvantage for dynamic piece play.",
      "Use ...exd5, ...d6, ...g6, and pressure on e4.",
      "Counterattack on the queenside and dark squares.",
    ],
    commonVariations: ["Modern Benoni", "Benko-style structures", "Czech Benoni"],
    trainingLines: [
      {
        name: "Modern Benoni Setup",
        moves: ["d4", "Nf6", "c4", "c5", "d5", "e6", "Nc3", "exd5", "cxd5", "d6", "Nf3", "g6"],
        explanation: "Black creates an imbalanced structure with dark-square counterplay.",
        keyIdeas: ["Pressure e4", "Use queenside play", "Do not become passive"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "dutch-defense",
    name: "Dutch Defense",
    eco: "A80",
    color: "black",
    moves: ["d4", "f5"],
    pgn: "1. d4 f5",
    tags: ["black", "attacking", "d4-response", "kingside"],
    difficulty: "intermediate",
    ideas: [
      "Fight for e4 and gain kingside space.",
      "Choose between Stonewall, Classical, or Leningrad structures.",
      "Watch dark-square weaknesses around the king.",
    ],
    commonVariations: ["Classical Dutch", "Stonewall Dutch", "Leningrad Dutch"],
    trainingLines: [
      {
        name: "Classical Dutch",
        moves: ["d4", "f5", "g3", "Nf6", "Bg2", "e6", "Nf3", "Be7", "O-O", "O-O"],
        explanation: "Black develops normally and keeps kingside attacking potential.",
        keyIdeas: ["Control e4", "Castle safely", "Avoid weakening dark squares too much"],
      },
      {
        name: "Stonewall Dutch",
        moves: ["d4", "f5", "g3", "Nf6", "Bg2", "e6", "Nf3", "d5", "O-O", "Bd6"],
        explanation: "Black builds a fixed center and aims for kingside pressure.",
        keyIdeas: ["Know the light-square bishop problem", "Attack on e4", "Use Ne4 when safe"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "benko-gambit",
    name: "Benko Gambit",
    eco: "A57",
    color: "black",
    moves: ["d4", "Nf6", "c4", "c5", "d5", "b5"],
    pgn: "1. d4 Nf6 2. c4 c5 3. d5 b5",
    tags: ["black", "gambit", "queenside", "d4-response", "advanced"],
    difficulty: "advanced",
    ideas: [
      "Sacrifice a queenside pawn for long-term file pressure.",
      "Use rooks on a- and b-files after recapture.",
      "Play actively; slow piece placement wastes the compensation.",
    ],
    commonVariations: ["Accepted", "Declined", "Fianchetto systems"],
    trainingLines: [
      {
        name: "Benko Accepted Setup",
        moves: ["d4", "Nf6", "c4", "c5", "d5", "b5", "cxb5", "a6", "bxa6", "Bxa6"],
        explanation: "Black gives a pawn for open queenside files and active bishops.",
        keyIdeas: ["Open the a- and b-files", "Keep pieces active", "Pressure queenside pawns"],
      },
    ],
    appearsInTraining: true,
  },
  {
    id: "englund-gambit",
    name: "Englund Gambit",
    eco: "A40",
    color: "black",
    moves: ["d4", "e5"],
    pgn: "1. d4 e5",
    tags: ["black", "gambit", "trap", "d4-response", "attacking"],
    difficulty: "advanced",
    ideas: [
      "Use as a surprise weapon, not a full-time repertoire anchor.",
      "Create early tactical problems for unprepared opponents.",
      "If the trap fails, development and king safety become urgent.",
    ],
    commonVariations: ["Englund Gambit Complex", "Hartlaub-Charlick", "Declined"],
    trainingLines: [
      {
        name: "Englund Trap Line",
        moves: ["d4", "e5", "dxe5", "Nc6", "Nf3", "Qe7", "Bf4", "Qb4+"],
        explanation: "Black tries to create tactical pressure quickly, but the line is risky.",
        keyIdeas: ["Know the tactic", "Do not rely on one trap", "Develop after the queen sortie"],
      },
    ],
    traps: [
      {
        name: "Queen fork trap",
        moves: ["d4", "e5", "dxe5", "Nc6", "Nf3", "Qe7", "Bf4", "Qb4+"],
        warning: "This can win material against careless play, but prepared opponents can neutralize it.",
      },
    ],
    appearsInTraining: true,
  },
];

const normalise = (value: string) =>
  String(value || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/defence/g, "defense")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function normaliseOpeningKey(value: string) {
  return normalise(value);
}

export function findOpeningLine(openingName = "") {
  const name = normalise(openingName);
  if (!name) return null;

  return (
    OPENINGS.find((opening) => {
      const names = [
        opening.name,
        opening.id,
        opening.eco || "",
        ...(opening.commonVariations || []),
      ].map(normalise);

      return names.some((alias) => name.includes(alias) || alias.includes(name));
    }) || null
  );
}

export function searchOpenings(query = "", openings = OPENINGS) {
  const value = normalise(query);
  if (!value) return openings;

  return openings.filter((opening) => {
    const searchable = [
      opening.name,
      opening.eco || "",
      opening.id,
      opening.pgn,
      opening.moves.join(" "),
      ...opening.tags,
      ...(opening.commonVariations || []),
    ]
      .map(normalise)
      .join(" ");

    return searchable.includes(value);
  });
}
