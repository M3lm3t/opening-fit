import { useEffect, useMemo, useState } from "react";
import { importGames } from "../lib/importClient";

function normaliseName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function displayPlatform(platform) {
  if (platform === "lichess") return "Lichess";
  return "Chess.com";
}

function getCompareParams() {
  if (typeof window === "undefined") {
    return { compareUser: "", comparePlatform: "chesscom" };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    compareUser: params.get("compareUser") || "",
    comparePlatform: params.get("comparePlatform") || "chesscom",
  };
}

function buildCompareLink(username, platform) {
  if (typeof window === "undefined" || !username) return "";

  const url = new URL(window.location.origin);
  url.searchParams.set("comparePlatform", platform || "chesscom");
  url.searchParams.set("compareUser", username);

  return url.toString();
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
    if (Number.isFinite(value)) return value <= 1 ? Math.round(value * 100) : Math.round(value);
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

function getTopOpenings(report) {
  const payload = report?.data || report?.analysis || report?.report || report || {};
  const rows = collectOpeningRows(payload);

  const merged = new Map();

  rows.forEach((row) => {
    if (!row.key) return;

    const existing = merged.get(row.key);

    if (!existing) {
      merged.set(row.key, row);
      return;
    }

    const totalGames = existing.games + row.games;
    const weightedWinRate =
      totalGames > 0
        ? Math.round(
            ((existing.winRate * existing.games) + (row.winRate * row.games)) /
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
    })
    .slice(0, 8);
}

function getBestOpenings(report) {
  return getTopOpenings(report)
    .filter((row) => row.games >= 2)
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 5);
}

function compareReports(baseReport, currentReport) {
  const baseTop = getTopOpenings(baseReport);
  const currentTop = getTopOpenings(currentReport);

  const baseBest = getBestOpenings(baseReport);
  const currentBest = getBestOpenings(currentReport);

  const baseKeys = new Set(baseTop.map((row) => row.key));
  const currentKeys = new Set(currentTop.map((row) => row.key));

  const shared = currentTop
    .filter((row) => baseKeys.has(row.key))
    .slice(0, 5);

  const baseOnly = baseTop
    .filter((row) => !currentKeys.has(row.key))
    .slice(0, 4);

  const currentOnly = currentTop
    .filter((row) => !baseKeys.has(row.key))
    .slice(0, 4);

  const overlap = shared.length;
  const possible = Math.max(1, Math.min(baseTop.length, currentTop.length));
  const styleMatch = Math.min(99, Math.round((overlap / possible) * 100));

  return {
    baseTop,
    currentTop,
    baseBest,
    currentBest,
    shared,
    baseOnly,
    currentOnly,
    styleMatch,
  };
}

function OpeningList({ title, items, emptyText }) {
  return (
    <div className="compareMiniPanel">
      <h4>{title}</h4>

      {items.length ? (
        <div className="compareOpeningList">
          {items.map((item) => (
            <div className="compareOpeningRow" key={`${title}-${item.key}`}>
              <span>{item.name}</span>
              <strong>{item.winRate}%</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="compareEmpty">{emptyText}</p>
      )}
    </div>
  );
}

export default function OpeningComparison({ data, username, platform }) {
  const [copyStatus, setCopyStatus] = useState("");
  const [targetData, setTargetData] = useState(null);
  const [targetLoading, setTargetLoading] = useState(false);
  const [targetError, setTargetError] = useState("");

  const compareParams = useMemo(() => getCompareParams(), []);
  const compareUser = compareParams.compareUser;
  const comparePlatform = compareParams.comparePlatform;

  const shareLink = useMemo(
    () => buildCompareLink(username, platform),
    [username, platform]
  );

  const isComparing =
    compareUser &&
    username &&
    normaliseName(compareUser) !== normaliseName(username);

  useEffect(() => {
    if (!isComparing) return;

    let cancelled = false;

    async function loadComparisonTarget() {
      setTargetLoading(true);
      setTargetError("");

      try {
        const { data: payload } = await importGames({
          platform: comparePlatform,
          username: compareUser,
          months: 3,
        });

        if (!cancelled) {
          setTargetData(payload);
        }
      } catch (error) {
        if (!cancelled) {
          setTargetError(error.message || "Could not load comparison.");
        }
      } finally {
        if (!cancelled) {
          setTargetLoading(false);
        }
      }
    }

    loadComparisonTarget();

    return () => {
      cancelled = true;
    };
  }, [isComparing, comparePlatform, compareUser]);

  const comparison = useMemo(() => {
    if (!targetData || !data) return null;
    return compareReports(targetData, data);
  }, [targetData, data]);

  async function copyCompareLink() {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      setCopyStatus("Copied comparison link");
      setTimeout(() => setCopyStatus(""), 2200);
    } catch {
      setCopyStatus("Copy failed — copy the page URL instead");
      setTimeout(() => setCopyStatus(""), 2600);
    }
  }

  if (!data) return null;

  return (
    <section className="card openingCompareCard">
      <div className="compareHeader">
        <div>
          <p className="eyebrow">New sharing feature</p>
          <h2>Compare with a friend</h2>
          <p>
            Share your Opening Fit report and let another player compare their
            opening profile against yours.
          </p>
        </div>

        {shareLink ? (
          <button
            className="secondaryButton compareShareButton"
            type="button"
            onClick={copyCompareLink}
          >
            Copy comparison link
          </button>
        ) : null}
      </div>

      {copyStatus ? <p className="compareStatus">{copyStatus}</p> : null}

      {isComparing ? (
        <div className="compareActiveBox">
          <h3>
            {displayPlatform(comparePlatform)} comparison: {compareUser} vs{" "}
            {username}
          </h3>

          {targetLoading ? (
            <p>Loading {compareUser}'s report...</p>
          ) : targetError ? (
            <p className="compareError">{targetError}</p>
          ) : comparison ? (
            <>
              <div className="styleMatchBox">
                <span>Opening style match</span>
                <strong>{comparison.styleMatch}%</strong>
              </div>

              <div className="compareGrid">
                <OpeningList
                  title={`${compareUser}'s best openings`}
                  items={comparison.baseBest}
                  emptyText="Not enough opening data yet."
                />

                <OpeningList
                  title={`${username}'s best openings`}
                  items={comparison.currentBest}
                  emptyText="Not enough opening data yet."
                />

                <OpeningList
                  title="Shared openings"
                  items={comparison.shared}
                  emptyText="No clear shared openings found yet."
                />

                <OpeningList
                  title="Biggest differences"
                  items={[...comparison.baseOnly, ...comparison.currentOnly].slice(0, 5)}
                  emptyText="No major differences found yet."
                />
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <div className="comparePreviewBox">
          <strong>Your comparison link is ready.</strong>
          <span>
            Anyone who opens it can import their own account and compare their
            openings against yours.
          </span>
        </div>
      )}
    </section>
  );
}
