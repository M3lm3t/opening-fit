import { useEffect, useMemo, useState } from "react";

const PLAN_KEY = "openingFit:repertoirePlan:v1";

function normaliseName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getOpeningName(row) {
  return (
    row?.opening ||
    row?.name ||
    row?.ecoName ||
    row?.openingName ||
    row?.family ||
    row?.label ||
    ""
  );
}

function getGames(row) {
  return Number(row?.games ?? row?.count ?? row?.total ?? row?.played ?? 0) || 0;
}

function getWinRate(row) {
  const direct = row?.winRate ?? row?.win_rate ?? row?.scoreRate ?? row?.score_rate;

  if (direct !== undefined && direct !== null && direct !== "") {
    const value = Number(direct);
    if (Number.isFinite(value)) {
      return value <= 1 ? Math.round(value * 100) : Math.round(value);
    }
  }

  const wins = Number(row?.wins ?? row?.win ?? 0) || 0;
  const draws = Number(row?.draws ?? row?.draw ?? 0) || 0;
  const losses = Number(row?.losses ?? row?.loss ?? 0) || 0;
  const games = getGames(row) || wins + draws + losses;

  if (!games) return 0;

  return Math.round(((wins + draws * 0.5) / games) * 100);
}

function collectOpeningRows(value, rows = []) {
  if (!value) return rows;

  if (Array.isArray(value)) {
    value.forEach((item) => collectOpeningRows(item, rows));
    return rows;
  }

  if (typeof value === "object") {
    const name = getOpeningName(value);
    const games = getGames(value);
    const winRate = getWinRate(value);

    if (name && (games || winRate)) {
      rows.push({
        name,
        key: normaliseName(name),
        games,
        winRate,
      });
    }

    Object.values(value).forEach((item) => collectOpeningRows(item, rows));
  }

  return rows;
}

function getOpeningRows(data) {
  const payload = data?.data || data?.analysis || data?.report || data || {};
  const rows = collectOpeningRows(payload);
  const merged = new Map();

  rows.forEach((row) => {
    if (!row.key || row.name.toLowerCase().includes("unknown")) return;

    const existing = merged.get(row.key);

    if (!existing) {
      merged.set(row.key, row);
      return;
    }

    const totalGames = existing.games + row.games;
    const weightedWinRate =
      totalGames > 0
        ? Math.round(
            (existing.winRate * existing.games + row.winRate * row.games) /
              totalGames
          )
        : Math.max(existing.winRate, row.winRate);

    merged.set(row.key, {
      ...existing,
      games: totalGames,
      winRate: weightedWinRate,
    });
  });

  return Array.from(merged.values())
    .filter((row) => row.name && row.games >= 1)
    .sort((a, b) => {
      if (b.games !== a.games) return b.games - a.games;
      return b.winRate - a.winRate;
    });
}

function guessColour(index) {
  if (index === 0 || index === 1) return "White";
  if (index === 2 || index === 3) return "Black vs 1.e4";
  return "Black vs 1.d4";
}

function defaultRole(index, winRate) {
  if (index === 0) return "Main weapon";
  if (index === 1) return "Backup";
  if (winRate >= 55) return "Reliable choice";
  if (winRate >= 45) return "Learning";
  return "Needs review";
}

function defaultStatus(winRate) {
  if (winRate >= 58) return "Reliable choice";
  if (winRate >= 45) return "Learn";
  return "Needs review";
}

function buildSuggestedPlan(data) {
  const rows = getOpeningRows(data)
    .filter((row) => row.games >= 2)
    .slice(0, 6);

  return rows.map((row, index) => ({
    id: `${row.key}-${index}`,
    name: row.name,
    colour: guessColour(index),
    role: defaultRole(index, row.winRate),
    status: defaultStatus(row.winRate),
    games: row.games,
    winRate: row.winRate,
    source: "suggested",
  }));
}

function loadSavedPlan() {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePlan(plan) {
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  } catch {
    // Ignore localStorage failure.
  }
}

export default function RepertoirePlan({ data }) {
  const suggestedPlan = useMemo(() => buildSuggestedPlan(data), [data]);
  const [plan, setPlan] = useState([]);
  const [newOpening, setNewOpening] = useState("");
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    const saved = loadSavedPlan();
    if (saved.length) {
      setPlan(saved);
    } else {
      setPlan(suggestedPlan);
    }
  }, [suggestedPlan]);

  useEffect(() => {
    if (!plan.length) return;
    savePlan(plan);
  }, [plan]);

  function updateItem(id, field, value) {
    setPlan((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }

  function removeItem(id) {
    setPlan((current) => current.filter((item) => item.id !== id));
  }

  function addOpening() {
    const name = newOpening.trim();
    if (!name) return;

    const item = {
      id: `${normaliseName(name)}-${Date.now()}`,
      name,
      colour: "White",
      role: "Learning",
      status: "Learn",
      games: 0,
      winRate: 0,
      source: "manual",
    };

    setPlan((current) => [...current, item]);
    setNewOpening("");
  }

  function resetToSuggested() {
    setPlan(suggestedPlan);
    savePlan(suggestedPlan);
    setSaveStatus("Plan reset to latest suggestions");
    setTimeout(() => setSaveStatus(""), 2200);
  }

  function clearPlan() {
    setPlan([]);
    savePlan([]);
    setSaveStatus("Plan cleared");
    setTimeout(() => setSaveStatus(""), 2200);
  }

  function manuallySave() {
    savePlan(plan);
    setSaveStatus("Plan saved");
    setTimeout(() => setSaveStatus(""), 2200);
  }

  if (!data) return null;

  return (
    <section className="card repertoirePlanCard" id="repertoire-plan">
      <div className="repertoirePlanHeader">
        <div>
          <p className="eyebrow">Functional study tool</p>
          <h2>My Repertoire Plan</h2>
          <p>
            Turn your Opening Fit results into a simple opening plan you can
            actually follow.
          </p>
        </div>

        <div className="repertoirePlanActions">
          <button className="secondaryButton" type="button" onClick={manuallySave}>
            Save plan
          </button>
          <button className="secondaryButton" type="button" onClick={resetToSuggested}>
            Reset suggestions
          </button>
          <button className="ghostButton" type="button" onClick={clearPlan}>
            Clear
          </button>
        </div>
      </div>

      {saveStatus ? <p className="repertoireSaveStatus">{saveStatus}</p> : null}

      <div className="repertoireAddRow">
        <input
          value={newOpening}
          onChange={(event) => setNewOpening(event.target.value)}
          placeholder="Add an opening manually, e.g. Vienna Game"
        />
        <button className="secondaryButton" type="button" onClick={addOpening}>
          Add opening
        </button>
      </div>

      {plan.length ? (
        <div className="repertoirePlanTableWrap">
          <table className="repertoirePlanTable">
            <thead>
              <tr>
                <th>Opening</th>
                <th>Colour</th>
                <th>Role</th>
                <th>Status</th>
                <th>Data</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {plan.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                  </td>

                  <td>
                    <select
                      value={item.colour}
                      onChange={(event) =>
                        updateItem(item.id, "colour", event.target.value)
                      }
                    >
                      <option>White</option>
                      <option>Black vs 1.e4</option>
                      <option>Black vs 1.d4</option>
                      <option>General</option>
                    </select>
                  </td>

                  <td>
                    <select
                      value={item.role}
                      onChange={(event) =>
                        updateItem(item.id, "role", event.target.value)
                      }
                    >
                      <option>Main weapon</option>
                      <option>Backup</option>
                      <option>Reliable choice</option>
                      <option>Learning</option>
                      <option>Promising but unstable</option>
                      <option>Needs review</option>
                    </select>
                  </td>

                  <td>
                    <select
                      value={item.status}
                      onChange={(event) =>
                        updateItem(item.id, "status", event.target.value)
                      }
                    >
                      <option>Reliable choice</option>
                      <option>Learn</option>
                      <option>Promising but unstable</option>
                      <option>Needs review</option>
                    </select>
                  </td>

                  <td>
                    {item.games ? (
                      <span className="repertoireDataPill">
                        {item.games} games · {item.winRate}%
                      </span>
                    ) : (
                      <span className="repertoireDataPill muted">Manual</span>
                    )}
                  </td>

                  <td>
                    <button
                      className="smallDangerButton"
                      type="button"
                      onClick={() => removeItem(item.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="repertoireEmpty">
          <strong>No openings in your plan yet.</strong>
          <p>Add one manually or reset to the latest Opening Fit suggestions.</p>
        </div>
      )}

      <div className="repertoireTip">
        <strong>Suggested use:</strong> keep one main White opening, one answer
        to 1.e4, and one answer to 1.d4. Mark everything else as backup or
        learning.
      </div>
    </section>
  );
}
