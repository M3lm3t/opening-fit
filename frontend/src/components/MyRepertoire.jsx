import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "openingFit:myRepertoire";

function getOpeningName(item) {
  return (
    item?.opening ||
    item?.name ||
    item?.ecoName ||
    item?.opening_name ||
    item?.label ||
    "Unknown opening"
  );
}

function getGames(item) {
  return Number(item?.games ?? item?.count ?? item?.total ?? 0);
}

function getWinRate(item) {
  const direct = item?.winRate ?? item?.win_rate ?? item?.score;

  if (typeof direct === "number") {
    return direct > 1 ? Math.round(direct) : Math.round(direct * 100);
  }

  const games = getGames(item);
  const wins = Number(item?.wins ?? item?.w ?? 0);
  const draws = Number(item?.draws ?? item?.d ?? 0);

  if (!games) return 0;

  return Math.round(((wins + draws * 0.5) / games) * 100);
}

function collectOpenings(data) {
  const possible =
    data?.openingStats ||
    data?.openings ||
    data?.topOpenings ||
    data?.verdicts ||
    data?.opening_win_rates ||
    data?.openingWinRates ||
    [];

  if (Array.isArray(possible)) return possible;

  if (possible && typeof possible === "object") {
    return Object.entries(possible).map(([name, value]) => ({
      name,
      ...(typeof value === "object" ? value : { games: value }),
    }));
  }

  return [];
}

function isUnknownOpening(name) {
  const normalised = String(name || "").trim().toLowerCase();

  return (
    !normalised ||
    normalised === "unknown" ||
    normalised === "unknown opening" ||
    normalised.includes("uncommon opening")
  );
}

function guessSide(openingName) {
  const name = String(openingName || "").toLowerCase();

  if (
    name.includes("sicilian") ||
    name.includes("caro") ||
    name.includes("scandinavian") ||
    name.includes("french") ||
    name.includes("pirc") ||
    name.includes("modern") ||
    name.includes("slav") ||
    name.includes("king's indian") ||
    name.includes("nimzo")
  ) {
    return "black";
  }

  return "white";
}

function emptyRepertoire() {
  return {
    white: [],
    black: [],
    notes: "",
    updatedAt: null,
  };
}

export default function MyRepertoire({ data, isPremium, onUnlockDemo }) {
  const [repertoire, setRepertoire] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : emptyRepertoire();
    } catch {
      return emptyRepertoire();
    }
  });

  const [saved, setSaved] = useState(false);

  const suggestions = useMemo(() => {
    const openings = collectOpenings(data)
      .map((item) => ({
        name: getOpeningName(item),
        games: getGames(item),
        winRate: getWinRate(item),
      }))
      .filter((item) => !isUnknownOpening(item.name))
      .sort((a, b) => {
        if (b.games !== a.games) return b.games - a.games;
        return b.winRate - a.winRate;
      });

    const white = openings.filter((item) => guessSide(item.name) === "white").slice(0, 4);
    const black = openings.filter((item) => guessSide(item.name) === "black").slice(0, 4);

    return {
      white: white.length ? white : openings.slice(0, 4),
      black: black.length ? black : openings.slice(1, 5),
    };
  }, [data]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(repertoire));
  }, [repertoire]);

  if (!data) return null;

  const addOpening = (side, opening) => {
    setRepertoire((current) => {
      const existing = current[side].some((item) => item.name === opening.name);
      if (existing) return current;

      return {
        ...current,
        [side]: [...current[side], opening].slice(0, 8),
        updatedAt: new Date().toISOString(),
      };
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const removeOpening = (side, openingName) => {
    setRepertoire((current) => ({
      ...current,
      [side]: current[side].filter((item) => item.name !== openingName),
      updatedAt: new Date().toISOString(),
    }));
  };

  const addBestSuggestions = () => {
    setRepertoire((current) => ({
      ...current,
      white: [...current.white, ...suggestions.white]
        .filter((item, index, arr) => arr.findIndex((other) => other.name === item.name) === index)
        .slice(0, 8),
      black: [...current.black, ...suggestions.black]
        .filter((item, index, arr) => arr.findIndex((other) => other.name === item.name) === index)
        .slice(0, 8),
      updatedAt: new Date().toISOString(),
    }));

    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const resetRepertoire = () => {
    setRepertoire(emptyRepertoire());
    localStorage.removeItem(STORAGE_KEY);
  };

  const updateNotes = (event) => {
    setRepertoire((current) => ({
      ...current,
      notes: event.target.value,
      updatedAt: new Date().toISOString(),
    }));
  };

  const renderSuggestion = (side, opening) => (
    <div className="repertoireSuggestion" key={`${side}-${opening.name}`}>
      <div>
        <strong>{opening.name}</strong>
        <span>
          {opening.winRate ? `${opening.winRate}%` : "Review"} ·{" "}
          {opening.games ? `${opening.games} games` : "suggested"}
        </span>
      </div>

      <button type="button" onClick={() => addOpening(side, opening)}>
        Add
      </button>
    </div>
  );

  const renderSavedOpening = (side, opening) => (
    <div className="repertoireSavedOpening" key={`${side}-saved-${opening.name}`}>
      <div>
        <strong>{opening.name}</strong>
        <span>
          {opening.winRate ? `${opening.winRate}% score` : "Saved opening"}
          {opening.games ? ` · ${opening.games} games` : ""}
        </span>
      </div>

      <button type="button" onClick={() => removeOpening(side, opening.name)}>
        Remove
      </button>
    </div>
  );

  return (
    <section className="myRepertoireShell" id="my-repertoire">
      <div className="myRepertoireHeader">
        <div>
          <div className="myRepertoireEyebrow">My Repertoire</div>
          <h2>Save the openings you plan to play.</h2>
          <p>Keep your White and Black choices in one place, then repair the lines that keep costing points.</p>
        </div>

        <div className="myRepertoireActions">
          <span>{saved ? "Saved" : isPremium ? "Premium ready" : "Free preview"}</span>

          <button type="button" onClick={addBestSuggestions}>
            Add best suggestions
          </button>

          {!isPremium ? (
            <button type="button" className="ghost" onClick={onUnlockDemo}>
              Unlock demo
            </button>
          ) : null}

          <button type="button" className="danger" onClick={resetRepertoire}>
            Reset
          </button>
        </div>
      </div>

      <div className="myRepertoireGrid">
        <div className="repertoireColumn">
          <div className="repertoireColumnHeader">
            <span>Recommended White options</span>
            <strong>{suggestions.white.length}</strong>
          </div>

          <div className="repertoireSuggestionList">
            {suggestions.white.map((opening) => renderSuggestion("white", opening))}
          </div>
        </div>

        <div className="repertoireColumn">
          <div className="repertoireColumnHeader">
            <span>Recommended Black options</span>
            <strong>{suggestions.black.length}</strong>
          </div>

          <div className="repertoireSuggestionList">
            {suggestions.black.map((opening) => renderSuggestion("black", opening))}
          </div>
        </div>
      </div>

      <div className="savedRepertoireGrid">
        <div className="savedRepertoireCard">
          <h3>Your White repertoire</h3>

          {repertoire.white.length ? (
            <div className="savedOpeningsList">
              {repertoire.white.map((opening) => renderSavedOpening("white", opening))}
            </div>
          ) : (
            <p>No White openings saved yet. Save a White line when you want it in your repertoire.</p>
          )}
        </div>

        <div className="savedRepertoireCard">
          <h3>Your Black repertoire</h3>

          {repertoire.black.length ? (
            <div className="savedOpeningsList">
              {repertoire.black.map((opening) => renderSavedOpening("black", opening))}
            </div>
          ) : (
            <p>No Black openings saved yet. Save one response to 1.e4 or 1.d4 when the report gives a clear fit.</p>
          )}
        </div>
      </div>

      <div className="repertoireNotesCard">
        <div>
          <h3>Personal repertoire notes</h3>
          <p>Track move-order problems, sidelines to avoid, and the next branch to study.</p>
        </div>

        <textarea
          value={repertoire.notes}
          onChange={updateNotes}
          placeholder="Example: As White, build around the Vienna. As Black, prepare one clear answer to 1.d4..."
        />
      </div>
    </section>
  );
}
