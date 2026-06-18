import { useMemo, useState } from "react";

const FAVOURITES_KEY = "openingFit:favouriteOpenings";
const IGNORED_KEY = "openingFit:ignoredOpenings";
const REPERTOIRE_KEY = "openingFit:repertoire";
const CHECKLIST_KEY = "openingFit:trainingChecklist";
const WIZARD_KEY = "openingFit:openingWizard";

function loadJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage may be unavailable in private mode.
  }
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function openingName(opening) {
  if (typeof opening === "string") return opening;
  return (
    opening?.name ||
    opening?.opening ||
    opening?.openingName ||
    opening?.ecoName ||
    opening?.family ||
    "Unknown Opening"
  );
}

function openingGames(opening) {
  if (typeof opening === "string") return 0;
  return safeNumber(opening?.games ?? opening?.count ?? opening?.total, 0);
}

function openingWinRate(opening) {
  if (!opening || typeof opening === "string") return 0;

  if (opening.win_rate !== undefined) return safeNumber(opening.win_rate, 0);
  if (opening.winRate !== undefined) return safeNumber(opening.winRate, 0);

  const games = safeNumber(opening.games, 0);
  const wins = safeNumber(opening.wins ?? opening.w, 0);
  const draws = safeNumber(opening.draws ?? opening.d, 0);

  if (!games) return 0;
  return Math.round(((wins + draws * 0.5) / games) * 100);
}

function isUnknownOpening(name) {
  const lower = String(name || "").toLowerCase().trim();
  return !lower || lower.includes("unknown") || lower.includes("uncommon");
}

function normaliseOpening(opening) {
  const name = openingName(opening);

  return {
    name,
    games: openingGames(opening),
    winRate: openingWinRate(opening),
    wins: safeNumber(opening?.wins ?? opening?.w, 0),
    draws: safeNumber(opening?.draws ?? opening?.d, 0),
    losses: safeNumber(opening?.losses ?? opening?.l, 0),
    fitScore: safeNumber(opening?.fitScore ?? opening?.score, 0),
    verdict: opening?.fitVerdict || opening?.verdict || opening?.status || "Track",
    reason: opening?.fitExplanation || opening?.reason || "",
  };
}

function getOpenings(data) {
  const sources = [
    data?.top_openings,
    data?.best_openings,
    data?.preferred_white,
    data?.preferred_black,
    data?.opening_recommendations?.white,
    data?.opening_recommendations?.black,
  ];

  const merged = new Map();

  sources.forEach((source) => {
    if (!Array.isArray(source)) return;

    source.forEach((item) => {
      const opening =
        typeof item === "string" ? normaliseOpening({ name: item }) : normaliseOpening(item);

      if (isUnknownOpening(opening.name)) return;

      const key = opening.name.toLowerCase();
      const existing = merged.get(key);

      if (!existing) {
        merged.set(key, opening);
        return;
      }

      merged.set(key, {
        ...existing,
        games: Math.max(existing.games, opening.games),
        winRate: Math.max(existing.winRate, opening.winRate),
        fitScore: Math.max(existing.fitScore, opening.fitScore),
        verdict: existing.verdict !== "Track" ? existing.verdict : opening.verdict,
        reason: existing.reason || opening.reason,
      });
    });
  });

  return Array.from(merged.values()).sort((a, b) => {
    if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore;
    if (b.games !== a.games) return b.games - a.games;
    return b.winRate - a.winRate;
  });
}

function defaultRepertoire() {
  return {
    white: [],
    blackVsE4: [],
    blackVsD4: [],
  };
}

function makeChecklist(openings) {
  const best = openings[0];
  const weak = [...openings].filter((item) => item.games > 0).sort((a, b) => a.winRate - b.winRate)[0];

  return [
    {
      id: "practice-best",
      text: best ? `Practise ${best.name} for 10 minutes` : "Practise your best opening",
      done: false,
    },
    {
      id: "review-weak",
      text: weak ? `Review one loss in ${weak.name}` : "Review one recent opening loss",
      done: false,
    },
    {
      id: "play-repertoire",
      text: "Play 5 games using your chosen repertoire",
      done: false,
    },
    {
      id: "reimport",
      text: "Re-import after your next 10 games",
      done: false,
    },
  ];
}

function getStyleSuggestion(wizard) {
  if (!wizard?.style) return "Complete the wizard to get a preference-based suggestion.";

  if (wizard.style === "attacking") {
    return "You may enjoy Vienna Game, Italian Game, Scotch Game, Sicilian Defence, or King's Indian setups.";
  }

  if (wizard.style === "solid") {
    return "You may enjoy London System, Queen's Gambit, Caro-Kann Defence, French Defence, or Slav setups.";
  }

  if (wizard.style === "simple") {
    return "You may enjoy London System, Italian Game, Scandinavian Defence, and simple development-based openings.";
  }

  if (wizard.style === "tricky") {
    return "You may enjoy Vienna Game, Danish Gambit, Smith-Morra Gambit, Scandinavian Defence, or offbeat practical lines.";
  }

  return "Your best route is a small, balanced repertoire with one White opening and two Black responses.";
}

function TileButton({ children, onClick, active = false, danger = false }) {
  return (
    <button
      className={`interactiveTileBtn ${active ? "interactiveTileBtnActive" : ""} ${
        danger ? "interactiveTileBtnDanger" : ""
      }`}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function InteractiveRepertoire({ data, onPractice }) {
  const openings = useMemo(() => getOpenings(data), [data]);

  const [selectedOpening, setSelectedOpening] = useState(null);
  const [favourites, setFavourites] = useState(() => loadJson(FAVOURITES_KEY, []));
  const [ignored, setIgnored] = useState(() => loadJson(IGNORED_KEY, []));
  const [repertoire, setRepertoire] = useState(() => loadJson(REPERTOIRE_KEY, defaultRepertoire()));
  const [checklist, setChecklist] = useState(() => {
    const saved = loadJson(CHECKLIST_KEY, null);
    return saved || makeChecklist(openings);
  });
  const [wizard, setWizard] = useState(() =>
    loadJson(WIZARD_KEY, {
      style: "",
      theory: "",
      positions: "",
    })
  );
  const [copyStatus, setCopyStatus] = useState("");

  const visibleOpenings = openings.filter(
    (opening) => !ignored.includes(opening.name)
  );

  const bestOpening = visibleOpenings[0];
  const weakOpening = [...visibleOpenings]
    .filter((opening) => opening.games > 0)
    .sort((a, b) => a.winRate - b.winRate)[0];

  const favouriteOpenings = visibleOpenings.filter((opening) =>
    favourites.includes(opening.name)
  );

  const repertoireNames = [
    ...repertoire.white,
    ...repertoire.blackVsE4,
    ...repertoire.blackVsD4,
  ];

  const repertoireMatches = visibleOpenings.filter((opening) =>
    repertoireNames.includes(opening.name)
  );

  const totalGames = safeNumber(
    data?.total_games ?? data?.totalGames ?? data?.gamesImported,
    visibleOpenings.reduce((total, opening) => total + opening.games, 0)
  );

  const repertoireGames = repertoireMatches.reduce(
    (total, opening) => total + opening.games,
    0
  );

  const shareText = [
    "My Opening Fit report:",
    bestOpening ? `Best opening: ${bestOpening.name} (${bestOpening.winRate}%)` : null,
    weakOpening ? `Needs work: ${weakOpening.name} (${weakOpening.winRate}%)` : null,
    favouriteOpenings.length ? `Favourites: ${favouriteOpenings.map((item) => item.name).join(", ")}` : null,
    totalGames ? `Games analysed: ${totalGames}` : null,
    "Try yours at Opening Fit",
  ]
    .filter(Boolean)
    .join("\n");

  function updateFavourites(name) {
    const next = favourites.includes(name)
      ? favourites.filter((item) => item !== name)
      : [...favourites, name];

    setFavourites(next);
    saveJson(FAVOURITES_KEY, next);
  }

  function updateIgnored(name) {
    const next = ignored.includes(name)
      ? ignored.filter((item) => item !== name)
      : [...ignored, name];

    setIgnored(next);
    saveJson(IGNORED_KEY, next);
  }

  function addToRepertoire(section, name) {
    const current = repertoire[section] || [];
    if (current.includes(name)) return;

    const next = {
      ...repertoire,
      [section]: [...current, name],
    };

    setRepertoire(next);
    saveJson(REPERTOIRE_KEY, next);
  }

  function removeFromRepertoire(section, name) {
    const next = {
      ...repertoire,
      [section]: repertoire[section].filter((item) => item !== name),
    };

    setRepertoire(next);
    saveJson(REPERTOIRE_KEY, next);
  }

  function toggleChecklist(id) {
    const next = checklist.map((item) =>
      item.id === id ? { ...item, done: !item.done } : item
    );

    setChecklist(next);
    saveJson(CHECKLIST_KEY, next);
  }

  function resetChecklist() {
    const next = makeChecklist(openings);
    setChecklist(next);
    saveJson(CHECKLIST_KEY, next);
  }

  function updateWizard(key, value) {
    const next = {
      ...wizard,
      [key]: value,
    };

    setWizard(next);
    saveJson(WIZARD_KEY, next);
  }

  async function copyShareText() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopyStatus("Copied.");
    } catch {
      setCopyStatus("Could not copy automatically.");
    }

    setTimeout(() => setCopyStatus(""), 1800);
  }

  if (!data) return null;

  return (
    <section className="interactivePage">
      <div className="interactiveHeroTile">
        <div>
          <p className="eyebrow">Interactive tools</p>
          <h2>Build, track, and train your repertoire</h2>
          <p>
            Favourite openings, ignore noisy results, build a personal repertoire,
            complete training tasks, and share your progress.
          </p>
        </div>

        <div className="interactiveHeroStats">
          <div>
            <strong>{visibleOpenings.length}</strong>
            <span>openings</span>
          </div>
          <div>
            <strong>{favourites.length}</strong>
            <span>favourites</span>
          </div>
          <div>
            <strong>{repertoireGames}</strong>
            <span>repertoire games</span>
          </div>
        </div>
      </div>

      <div className="interactiveTileGrid">
        <article className="modernTile modernTileLarge">
          <div className="modernTileTop">
            <div>
              <p className="tileLabel">Opening details</p>
              <h3>Click any opening</h3>
            </div>
            <span className="tileBadge">Interactive</span>
          </div>

          <div className="openingTileList">
            {visibleOpenings.slice(0, 10).map((opening, index) => (
              <button
                className="openingTile"
                key={`${opening.name}-${opening.context || opening.side || index}`}
                type="button"
                onClick={() => setSelectedOpening(opening)}
              >
                <div>
                  <strong>{opening.name}</strong>
                  <span>
                    {opening.games} games · {opening.winRate}% ·{" "}
                    {opening.fitScore ? `Fit ${opening.fitScore}/100` : opening.verdict}
                  </span>
                </div>

                <span className="openingTileArrow">→</span>
              </button>
            ))}
          </div>
        </article>

        <article className="modernTile">
          <div className="modernTileTop">
            <div>
              <p className="tileLabel">Best fit</p>
              <h3>{bestOpening?.name || "Not enough data"}</h3>
            </div>
            <span className="tileBadge tileBadgeGreen">Keep</span>
          </div>

          <p>
            {bestOpening
              ? `${bestOpening.winRate}% score from ${bestOpening.games} games.`
              : "Import more games to find your strongest opening."}
          </p>

          {bestOpening ? (
            <div className="tileActions">
              <TileButton onClick={() => setSelectedOpening(bestOpening)}>Details</TileButton>
              <TileButton onClick={() => onPractice(bestOpening.name)}>Practise</TileButton>
            </div>
          ) : null}
        </article>

        <article className="modernTile">
          <div className="modernTileTop">
            <div>
              <p className="tileLabel">Needs work</p>
              <h3>{weakOpening?.name || "Not enough data"}</h3>
            </div>
            <span className="tileBadge tileBadgeAmber">Improve</span>
          </div>

          <p>
            {weakOpening
              ? `This is currently scoring ${weakOpening.winRate}%. Review one loss here next.`
              : "Your weakest opening will appear after more games."}
          </p>

          {weakOpening ? (
            <div className="tileActions">
              <TileButton onClick={() => setSelectedOpening(weakOpening)}>Review</TileButton>
              <TileButton onClick={() => onPractice(weakOpening.name)}>Practise</TileButton>
            </div>
          ) : null}
        </article>

        <article className="modernTile">
          <div className="modernTileTop">
            <div>
              <p className="tileLabel">Share card</p>
              <h3>Progress snapshot</h3>
            </div>
            <span className="tileBadge">Social</span>
          </div>

          <pre className="interactiveShareCard">{shareText}</pre>

          <div className="tileActions">
            <TileButton onClick={copyShareText}>Copy text</TileButton>
          </div>

          {copyStatus ? <p className="smallText">{copyStatus}</p> : null}
        </article>
      </div>

      <div className="interactiveTileGrid twoColumnTiles">
        <article className="modernTile">
          <div className="modernTileTop">
            <div>
              <p className="tileLabel">Training checklist</p>
              <h3>This week’s tasks</h3>
            </div>
            <button className="miniTextButton" type="button" onClick={resetChecklist}>
              Reset
            </button>
          </div>

          <div className="checklistTiles">
            {checklist.map((item) => (
              <button
                className={`checklistTile ${item.done ? "checklistTileDone" : ""}`}
                key={item.id}
                type="button"
                onClick={() => toggleChecklist(item.id)}
              >
                <span>{item.done ? "✓" : ""}</span>
                <strong>{item.text}</strong>
              </button>
            ))}
          </div>
        </article>

        <article className="modernTile">
          <div className="modernTileTop">
            <div>
              <p className="tileLabel">Opening wizard</p>
              <h3>Your preference profile</h3>
            </div>
            <span className="tileBadge">New</span>
          </div>

          <div className="wizardGroup">
            <label>What style do you enjoy?</label>
            <div className="wizardOptions">
              {[
                ["attacking", "Attacking"],
                ["solid", "Solid"],
                ["simple", "Simple plans"],
                ["tricky", "Tricky"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={wizard.style === value ? "wizardActive" : ""}
                  type="button"
                  onClick={() => updateWizard("style", value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="wizardGroup">
            <label>How much theory do you want?</label>
            <div className="wizardOptions">
              {["Low", "Medium", "High"].map((value) => (
                <button
                  key={value}
                  className={wizard.theory === value ? "wizardActive" : ""}
                  type="button"
                  onClick={() => updateWizard("theory", value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="wizardResult">
            <strong>Suggestion</strong>
            <p>{getStyleSuggestion(wizard)}</p>
          </div>
        </article>
      </div>

      <article className="modernTile">
        <div className="modernTileTop">
          <div>
            <p className="tileLabel">My repertoire</p>
            <h3>Your chosen openings</h3>
          </div>
          <span className="tileBadge">{repertoireNames.length} saved</span>
        </div>

        <div className="repertoireBoard">
          <RepertoireColumn
            title="White"
            items={repertoire.white}
            onRemove={(name) => removeFromRepertoire("white", name)}
            onPractice={onPractice}
          />
          <RepertoireColumn
            title="Black vs e4"
            items={repertoire.blackVsE4}
            onRemove={(name) => removeFromRepertoire("blackVsE4", name)}
            onPractice={onPractice}
          />
          <RepertoireColumn
            title="Black vs d4"
            items={repertoire.blackVsD4}
            onRemove={(name) => removeFromRepertoire("blackVsD4", name)}
            onPractice={onPractice}
          />
        </div>
      </article>

      {selectedOpening ? (
        <div className="openingDetailsOverlay" onClick={() => setSelectedOpening(null)}>
          <div className="openingDetailsModal" onClick={(event) => event.stopPropagation()}>
            <button
              className="openingDetailsClose"
              type="button"
              onClick={() => setSelectedOpening(null)}
              aria-label="Close opening details"
            >
              ×
            </button>

            <p className="eyebrow">Opening details</p>
            <h2>{selectedOpening.name}</h2>

            <div className="detailsStatsGrid">
              <div>
                <strong>{selectedOpening.games}</strong>
                <span>games</span>
              </div>
              <div>
                <strong>{selectedOpening.winRate}%</strong>
                <span>score</span>
              </div>
              <div>
                <strong>{selectedOpening.fitScore || "—"}</strong>
                <span>fit score</span>
              </div>
              <div>
                <strong>{selectedOpening.verdict}</strong>
                <span>verdict</span>
              </div>
            </div>

            <div className="openingDetailsText">
              <h3>Why it matters</h3>
              <p>
                {selectedOpening.reason ||
                  `This opening appears in your report. Use the actions below to practise it, add it to your repertoire, favourite it, or hide it from your interactive tools.`}
              </p>
            </div>

            <div className="detailsActionGrid">
              <TileButton onClick={() => onPractice(selectedOpening)}>
                Train This Line
              </TileButton>

              <TileButton
                active={favourites.includes(selectedOpening.name)}
                onClick={() => updateFavourites(selectedOpening.name)}
              >
                {favourites.includes(selectedOpening.name) ? "Unfavourite" : "Favourite"}
              </TileButton>

              <TileButton onClick={() => addToRepertoire("white", selectedOpening.name)}>
                Add as White
              </TileButton>

              <TileButton onClick={() => addToRepertoire("blackVsE4", selectedOpening.name)}>
                Add vs e4
              </TileButton>

              <TileButton onClick={() => addToRepertoire("blackVsD4", selectedOpening.name)}>
                Add vs d4
              </TileButton>

              <TileButton
                danger
                active={ignored.includes(selectedOpening.name)}
                onClick={() => {
                  updateIgnored(selectedOpening.name);
                  setSelectedOpening(null);
                }}
              >
                Ignore opening
              </TileButton>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RepertoireColumn({ title, items, onRemove, onPractice }) {
  return (
    <div className="repertoireBoardColumn">
      <h4>{title}</h4>

      {items.length ? (
        items.map((item) => (
          <div className="repertoireSavedTile" key={item}>
            <strong>{item}</strong>
            <div>
              <button type="button" onClick={() => onPractice(item)}>
                Practise
              </button>
              <button type="button" onClick={() => onRemove(item)}>
                Remove
              </button>
            </div>
          </div>
        ))
      ) : (
        <p>No openings saved yet. Open an opening detail tile to add one.</p>
      )}
    </div>
  );
}
