export const openingSeoPages = [
  {
    slug: "london-system",
    name: "London System",
    seoTitle: "London System Opening Guide | OpeningFit",
    seoDescription:
      "Learn the London System ideas, strengths, common mistakes, and whether this chess opening fits your real games.",
    intro:
      "The London System is a reliable White opening built around d4, Nf3, Bf4, e3, and a compact pawn structure. It is popular because the setup is easy to repeat while still giving White practical attacking chances.",
    mainIdeas: [
      "Develop the dark-squared bishop to f4 before locking it in with e3.",
      "Build a stable setup with Nf3, e3, c3, Bd3, and short castling.",
      "Use Ne5, h4, or kingside pressure only after your pieces are developed.",
      "Stay flexible against ...c5, ...Qb6, and King's Indian-style setups.",
    ],
    whoItSuits: [
      "Players who want a repeatable White opening with low memorisation pressure.",
      "Club players who prefer clear development plans over sharp move-order traps.",
      "Players whose results improve when they reach familiar pawn structures.",
    ],
    strengths: [
      "Consistent setup against many Black responses.",
      "Good for building opening confidence and reducing early blunders.",
      "Can become attacking without requiring huge theory files.",
    ],
    weaknesses: [
      "Can become passive if White repeats the setup without reacting to Black.",
      "Black can challenge the structure early with ...c5 or ...Qb6.",
      "Some positions require patience rather than an automatic kingside attack.",
    ],
    commonMistakes: [
      "Playing Bf4, e3, c3, and Bd3 automatically while ignoring Black's pressure on b2 or d4.",
      "Launching a kingside attack before castling and completing development.",
      "Trading pieces too early and reaching a harmless structure with no pressure.",
    ],
    sampleMoves: ["1. d4", "1...d5", "2. Nf3", "2...Nf6", "3. Bf4", "3...e6", "4. e3", "4...Bd6", "5. Bg3"],
    relatedOpenings: ["queens-gambit", "caro-kann"],
    callToActionText:
      "Analyze your own games to see if this opening actually fits your style. OpeningFit can show whether your London System positions are helping your results or hiding one weak variation.",
  },
  {
    slug: "caro-kann",
    name: "Caro-Kann Defence",
    seoTitle: "Caro-Kann Defence Guide | OpeningFit",
    seoDescription:
      "Learn Caro-Kann Defence plans, sample moves, strengths, mistakes, and whether it fits your opening results.",
    intro:
      "The Caro-Kann Defence is a solid Black response to 1.e4 based on 1...c6 and 2...d5. It often gives Black a sturdy pawn structure, clear development, and practical chances without entering the sharpest Sicilian-style positions.",
    mainIdeas: [
      "Challenge White's centre with ...d5 after preparing it with ...c6.",
      "Develop the light-squared bishop before closing the structure when possible.",
      "Use breaks like ...c5 or ...e5 to avoid becoming cramped.",
      "Choose a clear response to the Advance, Exchange, and Classical variations.",
    ],
    whoItSuits: [
      "Black players who want a dependable answer to 1.e4.",
      "Players who prefer structure, endgame chances, and clear plans over early chaos.",
      "Players who score well when they reach solid middlegames and counterattack later.",
    ],
    strengths: [
      "Solid pawn structure and lower early tactical risk.",
      "Good practical choice against aggressive 1.e4 players.",
      "Clear variation families make it easier to build a focused repertoire.",
    ],
    weaknesses: [
      "Black can become cramped if they never challenge White's space.",
      "The Advance Variation requires accurate plans against White's pawn chain.",
      "Slow development can let White build a comfortable initiative.",
    ],
    commonMistakes: [
      "Playing passively after 1.e4 c6 2.d4 d5 3.e5 without preparing a pawn break.",
      "Trading into structures where White keeps all the space and Black has no counterplay.",
      "Delaying development while chasing small material or queen moves.",
    ],
    sampleMoves: ["1. e4", "1...c6", "2. d4", "2...d5", "3. e5", "3...Bf5", "4. Nf3", "4...e6", "5. Be2"],
    relatedOpenings: ["french-defence", "scandinavian-defence"],
    callToActionText:
      "Analyze your own games to see if this opening actually fits your style. OpeningFit can separate a healthy Caro-Kann habit from one troublesome line that needs repair.",
  },
  {
    slug: "kings-indian-defence",
    name: "King's Indian Defence",
    seoTitle: "King's Indian Defence Guide | OpeningFit",
    seoDescription:
      "Understand King's Indian Defence plans, risks, typical players, and how to check if it suits your own games.",
    intro:
      "The King's Indian Defence is a dynamic Black opening against 1.d4 where Black accepts space for White and aims for active counterplay. It often leads to tense pawn structures, kingside attacks, and sharp decisions about timing.",
    mainIdeas: [
      "Develop with ...Nf6, ...g6, ...Bg7, and ...O-O before choosing the central break.",
      "Use ...e5 or ...c5 to challenge White's centre instead of sitting passively.",
      "Understand when Black's kingside play is faster than White's queenside expansion.",
      "Keep track of piece coordination before committing to pawn storms.",
    ],
    whoItSuits: [
      "Players who enjoy imbalance, counterattacks, and strategic tension.",
      "Black players who are comfortable defending space disadvantages for active chances.",
      "Players who remember plans and structures better than long forcing sequences.",
    ],
    strengths: [
      "Creates winning chances even against solid 1.d4 systems.",
      "Gives Black a clear identity and many active middlegame plans.",
      "Rewards players who understand pawn breaks and attack timing.",
    ],
    weaknesses: [
      "White can build a large centre if Black delays counterplay.",
      "Some lines become cramped or strategically demanding.",
      "Mistimed attacks can leave Black worse on both wings.",
    ],
    commonMistakes: [
      "Playing the setup without deciding between ...e5 and ...c5 plans.",
      "Pushing kingside pawns before the centre is stable enough.",
      "Allowing White to expand while Black's pieces stay undeveloped.",
    ],
    sampleMoves: ["1. d4", "1...Nf6", "2. c4", "2...g6", "3. Nc3", "3...Bg7", "4. e4", "4...d6", "5. Nf3"],
    relatedOpenings: ["grunfeld-defence", "pirc-defence"],
    callToActionText:
      "Analyze your own games to see if this opening actually fits your style. OpeningFit can show whether your King's Indian games reward your attacking instincts or expose timing problems.",
  },
  {
    slug: "queens-gambit",
    name: "Queen's Gambit",
    seoTitle: "Queen's Gambit Opening Guide | OpeningFit",
    seoDescription:
      "Learn Queen's Gambit ideas, player fit, strengths, mistakes, and how to analyse whether it works for you.",
    intro:
      "The Queen's Gambit starts with 1.d4 d5 2.c4 and asks Black how they want to handle central tension. It is a classical White opening that can lead to positional pressure, active piece play, or quiet structure-based middlegames.",
    mainIdeas: [
      "Use c4 to challenge Black's d5 pawn and increase central pressure.",
      "Develop smoothly with Nc3, Nf3, Bg5 or Bf4, and e3.",
      "Recapture on c4 at the right moment if Black accepts the gambit.",
      "Choose between patient pressure and central expansion with e4 when conditions allow.",
    ],
    whoItSuits: [
      "Players who like principled development and central control.",
      "White players who are comfortable playing both quiet and active middlegames.",
      "Players who want a serious 1.d4 repertoire without relying on traps.",
    ],
    strengths: [
      "Strong central claim with many reputable plans.",
      "Works as a foundation for a broad 1.d4 repertoire.",
      "Teaches useful themes around tension, minority attacks, and piece activity.",
    ],
    weaknesses: [
      "Some lines demand patience rather than quick tactical shots.",
      "Black has several solid defensive systems.",
      "White can drift if the central tension is resolved without a plan.",
    ],
    commonMistakes: [
      "Trying to win the c-pawn back immediately when development matters more.",
      "Releasing central tension too soon and giving Black easy equality.",
      "Playing routine moves without checking Black's pressure on c4 or d4.",
    ],
    sampleMoves: ["1. d4", "1...d5", "2. c4", "2...e6", "3. Nc3", "3...Nf6", "4. Nf3", "4...Be7", "5. Bg5"],
    relatedOpenings: ["london-system", "slav-defence"],
    callToActionText:
      "Analyze your own games to see if this opening actually fits your style. OpeningFit can show whether Queen's Gambit structures match how you like to win games.",
  },
  {
    slug: "sicilian-defence",
    name: "Sicilian Defence",
    seoTitle: "Sicilian Defence Guide | OpeningFit",
    seoDescription:
      "Explore Sicilian Defence plans, who should play it, common mistakes, and how to test it against your games.",
    intro:
      "The Sicilian Defence begins with 1.e4 c5 and creates an asymmetrical fight from the first move. Black contests the centre indirectly and often aims for active counterplay rather than early symmetry.",
    mainIdeas: [
      "Use the c-pawn to challenge White's centre and create an unbalanced structure.",
      "Choose a family such as Najdorf, Dragon, Classical, Accelerated Dragon, or Scheveningen.",
      "Develop quickly because many Open Sicilian lines punish slow moves.",
      "Watch the d5 square, king safety, and timing of queenside counterplay.",
    ],
    whoItSuits: [
      "Players who want active Black games against 1.e4.",
      "Players who enjoy calculation, imbalance, and concrete decisions.",
      "Players willing to learn a focused set of lines rather than a casual setup.",
    ],
    strengths: [
      "Creates rich winning chances for Black.",
      "Avoids many symmetrical 1.e4 structures.",
      "Offers many sub-variations for different temperaments.",
    ],
    weaknesses: [
      "Can require more theory than quieter defences.",
      "White's attacks can become dangerous if Black loses time.",
      "Choosing too many Sicilian systems at once can make study scattered.",
    ],
    commonMistakes: [
      "Playing a sharp Sicilian line without knowing the basic defensive resources.",
      "Ignoring White's development lead while grabbing material.",
      "Switching between many Sicilian variations before learning one properly.",
    ],
    sampleMoves: ["1. e4", "1...c5", "2. Nf3", "2...d6", "3. d4", "3...cxd4", "4. Nxd4", "4...Nf6", "5. Nc3"],
    relatedOpenings: ["french-defence", "caro-kann"],
    callToActionText:
      "Analyze your own games to see if this opening actually fits your style. OpeningFit can help you spot whether the Sicilian is giving you useful counterplay or just extra study load.",
  },
  {
    slug: "french-defence",
    name: "French Defence",
    seoTitle: "French Defence Guide | OpeningFit",
    seoDescription:
      "Learn French Defence structures, ideal player types, strengths, weaknesses, and how to analyse your fit.",
    intro:
      "The French Defence starts with 1.e4 e6 and usually challenges White's centre with ...d5. It often leads to locked pawn chains, strategic pressure, and counterplay against White's centre.",
    mainIdeas: [
      "Challenge e4 with ...d5 and accept that some lines create a closed structure.",
      "Attack the base of White's pawn chain with ...c5 and sometimes ...f6.",
      "Solve the light-squared bishop problem with patience and good timing.",
      "Learn the Advance, Exchange, Tarrasch, and Winawer-style plans separately.",
    ],
    whoItSuits: [
      "Players who like structure, counterattacks, and strategic tension.",
      "Black players who are comfortable playing slightly cramped positions.",
      "Players who enjoy undermining the centre rather than meeting it symmetrically.",
    ],
    strengths: [
      "Clear central plan against 1.e4.",
      "Strong counterplay against overextended White centres.",
      "Can frustrate opponents who expect open tactical games.",
    ],
    weaknesses: [
      "Black's light-squared bishop can become passive.",
      "Some lines require accurate timing of pawn breaks.",
      "If Black is too slow, White can gain space and attacking chances.",
    ],
    commonMistakes: [
      "Accepting a bad bishop without seeking counterplay elsewhere.",
      "Playing ...c5 too late and letting White fully stabilise the centre.",
      "Treating the Exchange Variation as harmless and drifting into a passive setup.",
    ],
    sampleMoves: ["1. e4", "1...e6", "2. d4", "2...d5", "3. e5", "3...c5", "4. c3", "4...Nc6", "5. Nf3"],
    relatedOpenings: ["caro-kann", "sicilian-defence"],
    callToActionText:
      "Analyze your own games to see if this opening actually fits your style. OpeningFit can show whether French Defence structures suit your patience and counterplay habits.",
  },
  {
    slug: "vienna-game",
    name: "Vienna Game",
    seoTitle: "Vienna Game Opening Guide | OpeningFit",
    seoDescription:
      "Understand Vienna Game plans, attacking ideas, player fit, common mistakes, and how to check your results.",
    intro:
      "The Vienna Game begins with 1.e4 e5 2.Nc3 and gives White flexible attacking options. It can transpose into calm development or become sharp when White supports f4 ideas.",
    mainIdeas: [
      "Develop Nc3 before committing the kingside knight.",
      "Use f4 ideas when development and king safety support them.",
      "Meet Black's central challenges with clear piece activity, not automatic attacks.",
      "Know when to play Bc4, g3, or Nf3 based on Black's setup.",
    ],
    whoItSuits: [
      "White players who want active 1.e4 games without the most common Ruy Lopez theory.",
      "Players who like attacking chances but still want a sound development base.",
      "Players who enjoy flexible move orders and practical surprise value.",
    ],
    strengths: [
      "Can create quick attacking chances against unprepared opponents.",
      "Less familiar to many club players than the main Italian or Ruy Lopez lines.",
      "Offers both gambit-style and calmer positional paths.",
    ],
    weaknesses: [
      "Premature f4 play can backfire if White is undeveloped.",
      "Some lines transpose into standard 1.e4 e5 positions anyway.",
      "White needs a plan against simple central counterplay.",
    ],
    commonMistakes: [
      "Pushing f4 because it is thematic rather than because the position supports it.",
      "Leaving the king exposed while chasing an attack.",
      "Forgetting development after Black declines sharp play.",
    ],
    sampleMoves: ["1. e4", "1...e5", "2. Nc3", "2...Nf6", "3. f4", "3...d5", "4. fxe5", "4...Nxe4", "5. Nf3"],
    relatedOpenings: ["italian-game", "scotch-game"],
    callToActionText:
      "Analyze your own games to see if this opening actually fits your style. OpeningFit can show whether your Vienna games are sharp in a good way or simply becoming loose.",
  },
  {
    slug: "scotch-game",
    name: "Scotch Game",
    seoTitle: "Scotch Game Opening Guide | OpeningFit",
    seoDescription:
      "Learn Scotch Game ideas, who it suits, strengths, common mistakes, and how to analyse your opening fit.",
    intro:
      "The Scotch Game starts with 1.e4 e5 2.Nf3 Nc6 3.d4, opening the centre early. It gives White direct development and active piece play without the slower manoeuvring of some Ruy Lopez lines.",
    mainIdeas: [
      "Open the centre with d4 and develop pieces to active squares.",
      "Use central space and piece activity before Black fully equalises.",
      "Understand when queen moves are useful and when they lose time.",
      "Be ready for both quiet recaptures and sharper gambit-style branches.",
    ],
    whoItSuits: [
      "Players who like open positions and early central clarity.",
      "White players who want a principled 1.e4 e5 option without deep Ruy Lopez theory.",
      "Players who prefer active development over slow positional pressure.",
    ],
    strengths: [
      "Clear central plan and fast piece activity.",
      "Often reaches open positions where development matters.",
      "Can punish opponents who respond passively to the early d4 break.",
    ],
    weaknesses: [
      "Some lines release central tension early and become equal if White drifts.",
      "Queen excursions can become targets.",
      "Black has straightforward development choices if White lacks a follow-up.",
    ],
    commonMistakes: [
      "Opening the centre before being ready to develop actively.",
      "Making early queen moves without a concrete reason.",
      "Trading into a position where White has no remaining pressure.",
    ],
    sampleMoves: ["1. e4", "1...e5", "2. Nf3", "2...Nc6", "3. d4", "3...exd4", "4. Nxd4", "4...Nf6", "5. Nc3"],
    relatedOpenings: ["vienna-game", "italian-game"],
    callToActionText:
      "Analyze your own games to see if this opening actually fits your style. OpeningFit can reveal whether the Scotch gives you useful activity or leaves you without a middlegame plan.",
  },
  {
    slug: "english-opening",
    name: "English Opening",
    seoTitle: "English Opening Guide | OpeningFit",
    seoDescription:
      "Explore English Opening plans, player fit, strengths, weaknesses, and how to analyse it with your own games.",
    intro:
      "The English Opening begins with 1.c4 and often fights for the centre from the flank. It is flexible, transpositional, and especially useful for players who like choosing the shape of the middlegame.",
    mainIdeas: [
      "Use c4 to pressure d5 and delay committing the central pawns.",
      "Develop with Nf3, g3, Bg2, and flexible central breaks.",
      "Watch for transpositions into Queen's Gambit, King's Indian, or reversed Sicilian structures.",
      "Choose between quiet pressure and sharper central expansion based on Black's setup.",
    ],
    whoItSuits: [
      "Players who like flexible openings and strategic choice.",
      "White players who are comfortable with transpositions.",
      "Players who prefer gradual pressure to immediate forcing lines.",
    ],
    strengths: [
      "Highly flexible and hard to reduce to one simple response.",
      "Can steer games into structures the player already understands.",
      "Offers good practical variety without abandoning sound development.",
    ],
    weaknesses: [
      "Transpositions can become confusing without a repertoire map.",
      "Slow play can let Black occupy the centre comfortably.",
      "Some positions require patience and long-term planning.",
    ],
    commonMistakes: [
      "Playing flexible moves without deciding what centre you want.",
      "Allowing Black free central space while developing too quietly.",
      "Treating every English position the same despite major structural differences.",
    ],
    sampleMoves: ["1. c4", "1...e5", "2. Nc3", "2...Nf6", "3. g3", "3...d5", "4. cxd5", "4...Nxd5", "5. Bg2"],
    relatedOpenings: ["queens-gambit", "nimzo-indian-defence"],
    callToActionText:
      "Analyze your own games to see if this opening actually fits your style. OpeningFit can help you see which English structures you handle well and which ones need clearer plans.",
  },
  {
    slug: "ruy-lopez",
    name: "Ruy Lopez",
    seoTitle: "Ruy Lopez Opening Guide | OpeningFit",
    seoDescription:
      "Learn Ruy Lopez plans, suited player types, strengths, mistakes, and how to test it against your real games.",
    intro:
      "The Ruy Lopez starts with 1.e4 e5 2.Nf3 Nc6 3.Bb5 and builds long-term pressure against Black's centre. It is a classical opening that can become strategic, tactical, or deeply manoeuvring depending on the variation.",
    mainIdeas: [
      "Pressure the knight on c6 to increase pressure on Black's e5 pawn.",
      "Develop calmly with O-O, Re1, and central support before expanding.",
      "Understand the difference between open, closed, and anti-Marshall structures.",
      "Keep the bishop pair and central tension in mind when choosing trades.",
    ],
    whoItSuits: [
      "Players who enjoy rich 1.e4 e5 positions and long-term pressure.",
      "White players willing to learn plans rather than just a quick setup.",
      "Players who like improving piece placement before launching tactics.",
    ],
    strengths: [
      "Deep strategic foundation with many practical plans.",
      "Teaches useful central tension and manoeuvring concepts.",
      "Can suit both attacking and positional players depending on the line.",
    ],
    weaknesses: [
      "Theory can become heavy if you try to learn every branch.",
      "Some lines develop slowly and require patience.",
      "Black has many reputable systems and anti-Ruy setups.",
    ],
    commonMistakes: [
      "Playing memorised moves without understanding the central tension.",
      "Trading the bishop casually and losing the point of Bb5.",
      "Pushing pawns before finishing development and king safety.",
    ],
    sampleMoves: ["1. e4", "1...e5", "2. Nf3", "2...Nc6", "3. Bb5", "3...a6", "4. Ba4", "4...Nf6", "5. O-O"],
    relatedOpenings: ["italian-game", "scotch-game"],
    callToActionText:
      "Analyze your own games to see if this opening actually fits your style. OpeningFit can show whether your Ruy Lopez games reward patient pressure or become too theory-heavy for your habits.",
  },
  {
    slug: "italian-game",
    name: "Italian Game",
    seoTitle: "Italian Game Opening Guide | OpeningFit",
    seoDescription:
      "Understand Italian Game ideas, common plans, player fit, mistakes, and how to analyse your results.",
    intro:
      "The Italian Game begins with 1.e4 e5 2.Nf3 Nc6 3.Bc4 and develops naturally while aiming at Black's kingside and centre. It can be quiet and instructional or sharp when White chooses early d4 ideas.",
    mainIdeas: [
      "Develop quickly with Bc4, Nf3, and short castling.",
      "Choose between quiet d3 systems and more direct central play with d4.",
      "Use piece activity around f7 without neglecting the centre.",
      "Learn common plans in Giuoco Piano and Two Knights structures.",
    ],
    whoItSuits: [
      "Players who want a natural first 1.e4 e5 repertoire.",
      "White players who like clear development with optional attacking chances.",
      "Players who want to improve basic opening principles through real games.",
    ],
    strengths: [
      "Easy to understand at a practical level.",
      "Flexible between quiet development and sharper play.",
      "Useful for learning development, king safety, and central breaks.",
    ],
    weaknesses: [
      "Quiet lines can become symmetrical if White has no plan.",
      "Premature attacks on f7 can waste time.",
      "Black has many familiar defensive setups.",
    ],
    commonMistakes: [
      "Attacking f7 before development supports it.",
      "Playing d3 quietly and then failing to improve piece placement.",
      "Ignoring Black's central counterplay with ...d5.",
    ],
    sampleMoves: ["1. e4", "1...e5", "2. Nf3", "2...Nc6", "3. Bc4", "3...Bc5", "4. c3", "4...Nf6", "5. d3"],
    relatedOpenings: ["ruy-lopez", "vienna-game"],
    callToActionText:
      "Analyze your own games to see if this opening actually fits your style. OpeningFit can show whether the Italian Game gives you comfortable development or repeated middlegame drift.",
  },
  {
    slug: "queens-indian-defence",
    name: "Queen's Indian Defence",
    seoTitle: "Queen's Indian Defence Guide | OpeningFit",
    seoDescription:
      "Learn Queen's Indian Defence plans, ideal player fit, strengths, weaknesses, and how to analyse your games.",
    intro:
      "The Queen's Indian Defence is a flexible Black system against 1.d4 setups, usually involving ...Nf6, ...e6, and ...b6. Black develops harmoniously and fights for central control with pieces before choosing pawn breaks.",
    mainIdeas: [
      "Develop the bishop to b7 to pressure the centre from a distance.",
      "Keep the structure flexible with ...Nf6, ...e6, and sensible piece placement.",
      "Use ...c5 or ...d5 breaks when development supports them.",
      "Avoid drifting into passivity while waiting for White to commit.",
    ],
    whoItSuits: [
      "Black players who like solid, flexible positions against 1.d4.",
      "Players who prefer strategic piece play over immediate confrontation.",
      "Players who are comfortable with quiet pressure and later counterplay.",
    ],
    strengths: [
      "Harmonious development and adaptable structures.",
      "Good fit for players who dislike early theoretical chaos.",
      "Can pair well with Nimzo-Indian repertoire choices.",
    ],
    weaknesses: [
      "Black can become too passive if breaks are delayed.",
      "White may gain space if Black only develops without challenging the centre.",
      "Some positions require accurate piece coordination rather than simple setup play.",
    ],
    commonMistakes: [
      "Fianchettoing the bishop and then forgetting to challenge White's centre.",
      "Playing symmetrical moves without a plan for activity.",
      "Trading pieces in a way that leaves White with easy space and no pressure.",
    ],
    sampleMoves: ["1. d4", "1...Nf6", "2. c4", "2...e6", "3. Nf3", "3...b6", "4. g3", "4...Bb7", "5. Bg2"],
    relatedOpenings: ["nimzo-indian-defence", "english-opening"],
    callToActionText:
      "Analyze your own games to see if this opening actually fits your style. OpeningFit can show whether Queen's Indian positions suit your strategic patience or need more active breaks.",
  },
  {
    slug: "nimzo-indian-defence",
    name: "Nimzo-Indian Defence",
    seoTitle: "Nimzo-Indian Defence Guide | OpeningFit",
    seoDescription:
      "Understand Nimzo-Indian Defence ideas, player fit, strengths, mistakes, and how to check your own results.",
    intro:
      "The Nimzo-Indian Defence starts with 1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 and fights for the centre through piece pressure. Black often trades structural concessions for activity, flexibility, and control of key squares.",
    mainIdeas: [
      "Pin the knight on c3 to increase pressure on White's centre.",
      "Choose when to trade on c3 and when to keep the bishop.",
      "Use ...c5, ...d5, or ...b6 plans based on White's setup.",
      "Understand structural themes around doubled pawns and dark-square control.",
    ],
    whoItSuits: [
      "Black players who enjoy flexible, strategic openings.",
      "Players who like making opponents solve positional problems early.",
      "Players who can handle different pawn structures without needing one fixed setup.",
    ],
    strengths: [
      "Active and reputable answer to 1.d4 systems with Nc3.",
      "Creates clear structural targets in many lines.",
      "Pairs naturally with Queen's Indian or Bogo-Indian style choices.",
    ],
    weaknesses: [
      "White can choose many different setups and move orders.",
      "Trading the bishop too casually can give White useful advantages.",
      "Black still needs a plan against 3.Nf3 systems where the Nimzo is avoided.",
    ],
    commonMistakes: [
      "Capturing on c3 without a follow-up against the doubled pawns.",
      "Ignoring White's bishop pair and central expansion.",
      "Playing a Nimzo setup against the wrong move order without adaptation.",
    ],
    sampleMoves: ["1. d4", "1...Nf6", "2. c4", "2...e6", "3. Nc3", "3...Bb4", "4. e3", "4...O-O", "5. Bd3"],
    relatedOpenings: ["queens-indian-defence", "grunfeld-defence"],
    callToActionText:
      "Analyze your own games to see if this opening actually fits your style. OpeningFit can show whether your Nimzo-Indian games reward your structural judgement or expose unclear follow-ups.",
  },
  {
    slug: "grunfeld-defence",
    name: "Grunfeld Defence",
    seoTitle: "Grunfeld Defence Guide | OpeningFit",
    seoDescription:
      "Explore Grunfeld Defence plans, suited player types, practical risks, and how to analyse your own fit.",
    intro:
      "The Grunfeld Defence is a dynamic 1.d4 opening where Black lets White build a centre and then attacks it with pieces and pawn breaks. It is principled, active, and often concrete.",
    mainIdeas: [
      "Develop with ...Nf6, ...g6, ...Bg7, and strike the centre with ...d5.",
      "Use piece pressure against White's central pawns rather than occupying the centre immediately.",
      "Time ...c5 and piece activity carefully.",
      "Be ready for forcing lines where details matter.",
    ],
    whoItSuits: [
      "Black players who like active counterplay against big centres.",
      "Players comfortable with calculation and dynamic imbalance.",
      "Players willing to learn sharper lines rather than rely on one quiet setup.",
    ],
    strengths: [
      "Directly challenges White's centre with active piece play.",
      "Can create rich counterplay against ambitious 1.d4 players.",
      "Often avoids slow, symmetrical structures.",
    ],
    weaknesses: [
      "Some lines are theory-heavy and tactically sharp.",
      "If Black mistimes counterplay, White's centre can become powerful.",
      "Not ideal for players who dislike concrete calculation early.",
    ],
    commonMistakes: [
      "Allowing White's centre to advance without enough pressure on it.",
      "Playing thematic breaks before the pieces are ready.",
      "Choosing the Grunfeld for activity but then defending passively.",
    ],
    sampleMoves: ["1. d4", "1...Nf6", "2. c4", "2...g6", "3. Nc3", "3...d5", "4. cxd5", "4...Nxd5", "5. e4"],
    relatedOpenings: ["kings-indian-defence", "nimzo-indian-defence"],
    callToActionText:
      "Analyze your own games to see if this opening actually fits your style. OpeningFit can reveal whether the Grunfeld's active counterplay matches your calculation habits.",
  },
  {
    slug: "slav-defence",
    name: "Slav Defence",
    seoTitle: "Slav Defence Guide | OpeningFit",
    seoDescription:
      "Learn Slav Defence structures, who it suits, strengths, common mistakes, and how to analyse your games.",
    intro:
      "The Slav Defence meets the Queen's Gambit with 1.d4 d5 2.c4 c6. Black supports the centre while often keeping the light-squared bishop free, leading to solid but active Queen's Gambit structures.",
    mainIdeas: [
      "Support d5 with ...c6 and keep central tension under control.",
      "Develop the light-squared bishop actively when the position allows.",
      "Use ...c5 or ...e5 breaks to avoid a purely defensive setup.",
      "Understand when Black can hold or give back the c4 pawn.",
    ],
    whoItSuits: [
      "Black players who want a solid answer to Queen's Gambit systems.",
      "Players who prefer structure and development over early gambles.",
      "Players who like dependable openings with room for active counterplay.",
    ],
    strengths: [
      "Solid central structure and clear development schemes.",
      "Often solves the light-squared bishop issue better than some Queen's Gambit Declined lines.",
      "Can be played in both quiet and sharper styles.",
    ],
    weaknesses: [
      "Black can become passive if pawn breaks are delayed.",
      "Some accepted-pawn lines require accurate follow-up.",
      "White can build pressure if Black only defends d5.",
    ],
    commonMistakes: [
      "Holding the c4 pawn at the cost of development.",
      "Leaving the bishop passive despite choosing the Slav for bishop activity.",
      "Failing to challenge White's centre after completing the setup.",
    ],
    sampleMoves: ["1. d4", "1...d5", "2. c4", "2...c6", "3. Nf3", "3...Nf6", "4. e3", "4...Bf5", "5. Nc3"],
    relatedOpenings: ["queens-gambit", "caro-kann"],
    callToActionText:
      "Analyze your own games to see if this opening actually fits your style. OpeningFit can show whether your Slav Defence games are solid by design or passive by habit.",
  },
  {
    slug: "scandinavian-defence",
    name: "Scandinavian Defence",
    seoTitle: "Scandinavian Defence Guide | OpeningFit",
    seoDescription:
      "Understand Scandinavian Defence plans, practical player fit, strengths, mistakes, and how to check results.",
    intro:
      "The Scandinavian Defence starts with 1.e4 d5 and challenges the centre immediately. It gives Black a direct, compact repertoire, often with early queen activity and straightforward development plans.",
    mainIdeas: [
      "Challenge e4 at once and accept that Black's queen may move early.",
      "Develop quickly after recapturing on d5.",
      "Use solid structures with ...c6, ...Nf6, ...Bf5 or ...Bg4, and ...e6.",
      "Avoid unnecessary queen moves after the opening job is done.",
    ],
    whoItSuits: [
      "Black players who want a clear, low-branching answer to 1.e4.",
      "Players who value practical simplicity over fashionable theory.",
      "Players who can stay disciplined after early queen development.",
    ],
    strengths: [
      "Simple central idea from move one.",
      "Can surprise opponents who expect Sicilian, French, or Caro-Kann structures.",
      "Repertoire choices are often easier to organise.",
    ],
    weaknesses: [
      "The queen can lose time if Black keeps moving it.",
      "White may gain development if Black is careless.",
      "Some structures are solid but not especially ambitious.",
    ],
    commonMistakes: [
      "Moving the queen repeatedly without improving the rest of the position.",
      "Treating simplicity as a reason to ignore development.",
      "Allowing White to build a large lead in activity.",
    ],
    sampleMoves: ["1. e4", "1...d5", "2. exd5", "2...Qxd5", "3. Nc3", "3...Qa5", "4. d4", "4...Nf6", "5. Nf3"],
    relatedOpenings: ["caro-kann", "french-defence"],
    callToActionText:
      "Analyze your own games to see if this opening actually fits your style. OpeningFit can show whether the Scandinavian's simplicity is helping you or costing tempi.",
  },
  {
    slug: "pirc-defence",
    name: "Pirc Defence",
    seoTitle: "Pirc Defence Guide | OpeningFit",
    seoDescription:
      "Learn Pirc Defence ideas, player fit, strengths, risks, and how to analyse whether it suits your games.",
    intro:
      "The Pirc Defence lets White build a centre while Black develops with ...Nf6, ...g6, and ...Bg7. Black aims to undermine that centre later, which can create rich counterattacking games.",
    mainIdeas: [
      "Develop the kingside quickly and castle before the centre opens.",
      "Pressure White's centre with ...c5, ...e5, or piece activity.",
      "Choose the right moment to challenge White's space.",
      "Respect aggressive Austrian Attack and kingside expansion plans.",
    ],
    whoItSuits: [
      "Black players who enjoy counterpunching from flexible structures.",
      "Players comfortable giving White space in exchange for later targets.",
      "Players who like King's Indian-style ideas against 1.e4.",
    ],
    strengths: [
      "Flexible and less forcing than many mainline 1.e4 defences.",
      "Can lure overambitious opponents into overextension.",
      "Creates familiar fianchetto structures for counterattacking players.",
    ],
    weaknesses: [
      "White can launch direct attacks if Black is too slow.",
      "Black needs good timing to avoid cramped positions.",
      "Not ideal for players who dislike defending early space disadvantages.",
    ],
    commonMistakes: [
      "Letting White build a centre and then failing to attack it.",
      "Castling into a prepared attack without counterplay.",
      "Playing King's Indian ideas automatically when the 1.e4 structure is different.",
    ],
    sampleMoves: ["1. e4", "1...d6", "2. d4", "2...Nf6", "3. Nc3", "3...g6", "4. Nf3", "4...Bg7", "5. Be2"],
    relatedOpenings: ["modern-defence", "kings-indian-defence"],
    callToActionText:
      "Analyze your own games to see if this opening actually fits your style. OpeningFit can show whether the Pirc gives you useful counterplay or leaves you cramped too often.",
  },
  {
    slug: "modern-defence",
    name: "Modern Defence",
    seoTitle: "Modern Defence Guide | OpeningFit",
    seoDescription:
      "Explore Modern Defence plans, practical player fit, strengths, common mistakes, and how to analyse your fit.",
    intro:
      "The Modern Defence usually begins with ...g6 and ...Bg7, delaying an immediate central commitment. Black invites White to occupy the centre, then looks for ways to challenge it with flexible pawn breaks.",
    mainIdeas: [
      "Fianchetto the bishop and pressure the centre from g7.",
      "Delay ...Nf6 or central pawn choices until White's setup is clearer.",
      "Use ...c5, ...d6, ...e5, or ...a6-based plans with a purpose.",
      "Stay alert to direct attacks against Black's king.",
    ],
    whoItSuits: [
      "Players who like flexible move orders and counterattacking structures.",
      "Black players comfortable playing without an immediate central mirror.",
      "Players who understand plans better than fixed opening scripts.",
    ],
    strengths: [
      "Very flexible against several White first moves.",
      "Can steer opponents away from their prepared main lines.",
      "Rewards players who read the centre well.",
    ],
    weaknesses: [
      "White can gain too much space if Black delays counterplay.",
      "Loose move orders can become dangerous quickly.",
      "Requires judgement about when to transpose into Pirc or King's Indian structures.",
    ],
    commonMistakes: [
      "Playing flexible moves without ever challenging White's centre.",
      "Assuming the fianchetto alone makes the position safe.",
      "Choosing pawn breaks reactively rather than from a clear plan.",
    ],
    sampleMoves: ["1. e4", "1...g6", "2. d4", "2...Bg7", "3. Nc3", "3...d6", "4. Nf3", "4...a6", "5. Be2"],
    relatedOpenings: ["pirc-defence", "kings-indian-defence"],
    callToActionText:
      "Analyze your own games to see if this opening actually fits your style. OpeningFit can show whether the Modern Defence's flexibility fits your decision-making or creates unclear positions.",
  },
  {
    slug: "dutch-defence",
    name: "Dutch Defence",
    seoTitle: "Dutch Defence Guide | OpeningFit",
    seoDescription:
      "Learn Dutch Defence plans, who it suits, strengths, risks, common mistakes, and how to check your results.",
    intro:
      "The Dutch Defence starts with 1.d4 f5 and gives Black an assertive kingside structure from move one. It often leads to attacking plans, imbalance, and strategic decisions around e6, g6, or Stonewall setups.",
    mainIdeas: [
      "Use ...f5 to claim kingside space and challenge White's usual 1.d4 comfort.",
      "Choose a setup such as Stonewall, Classical, or Leningrad.",
      "Watch the e6 and e5 squares because central control decides many Dutch games.",
      "Develop safely before pushing for a kingside attack.",
    ],
    whoItSuits: [
      "Black players who want active, distinctive games against 1.d4.",
      "Players who enjoy kingside attacking chances and imbalance.",
      "Players comfortable accepting some structural risk for practical initiative.",
    ],
    strengths: [
      "Creates an immediate identity and avoids many standard Queen's Gambit structures.",
      "Can generate strong kingside plans when coordinated well.",
      "Useful for players who dislike passive 1.d4 defences.",
    ],
    weaknesses: [
      "The early f-pawn move can weaken Black's king.",
      "White can target dark squares or the e-file if Black is careless.",
      "Some setups become rigid if Black cannot find a break.",
    ],
    commonMistakes: [
      "Pushing for attack before completing development.",
      "Ignoring central weaknesses created by ...f5.",
      "Mixing Stonewall, Classical, and Leningrad ideas without a coherent setup.",
    ],
    sampleMoves: ["1. d4", "1...f5", "2. g3", "2...Nf6", "3. Bg2", "3...e6", "4. Nf3", "4...Be7", "5. O-O"],
    relatedOpenings: ["kings-indian-defence", "modern-defence"],
    callToActionText:
      "Analyze your own games to see if this opening actually fits your style. OpeningFit can show whether the Dutch Defence's ambition matches your attacking play or weakens your position too early.",
  },
  {
    slug: "benko-gambit",
    name: "Benko Gambit",
    seoTitle: "Benko Gambit Guide | OpeningFit",
    seoDescription:
      "Understand Benko Gambit plans, suited player types, strengths, risks, and how to analyse your own games.",
    intro:
      "The Benko Gambit is a Black gambit against 1.d4 where Black gives a queenside pawn for long-term pressure. It often leads to active rooks, fianchetto pressure, and clear plans against White's queenside.",
    mainIdeas: [
      "Offer the b-pawn to open queenside lines after White advances with d5.",
      "Fianchetto the dark-squared bishop and pressure the long diagonal.",
      "Use rooks on the a- and b-files to create lasting pressure.",
      "Know when the compensation is positional rather than immediate tactical material.",
    ],
    whoItSuits: [
      "Black players who like active piece play and long-term pressure.",
      "Players comfortable being a pawn down for clear compensation.",
      "Players who prefer recurring plans over memorising many unrelated structures.",
    ],
    strengths: [
      "Gives Black active queenside play and clear targets.",
      "Can be uncomfortable for White players who dislike long-term pressure.",
      "Plans are often thematic and repeatable across games.",
    ],
    weaknesses: [
      "Black is giving material, so passive play is costly.",
      "White can decline or return the pawn to change the character of the game.",
      "Endgames may favour White if Black's pressure disappears.",
    ],
    commonMistakes: [
      "Playing the gambit and then failing to occupy open queenside files.",
      "Trading too many active pieces and losing compensation.",
      "Expecting immediate tactics when the real idea is lasting pressure.",
    ],
    sampleMoves: ["1. d4", "1...Nf6", "2. c4", "2...c5", "3. d5", "3...b5", "4. cxb5", "4...a6", "5. bxa6"],
    relatedOpenings: ["grunfeld-defence", "kings-indian-defence"],
    callToActionText:
      "Analyze your own games to see if this opening actually fits your style. OpeningFit can show whether the Benko Gambit gives you lasting pressure or leaves you simply down a pawn.",
  },
];

export const openingSeoPagesBySlug = Object.fromEntries(
  openingSeoPages.map((opening) => [opening.slug, opening])
);

export function getOpeningSeoPage(slug) {
  return openingSeoPagesBySlug[String(slug || "").toLowerCase()] || null;
}

export function getOpeningSeoSlugFromPath(path) {
  const match = String(path || "").match(/^\/openings\/([^/]+)$/);
  return match ? match[1] : "";
}
