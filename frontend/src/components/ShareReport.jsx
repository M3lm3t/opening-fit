import { useMemo, useState } from "react";
import { buildReportGameCounts } from "../lib/reportGameCounts.js";
import { normaliseReportDecision } from "../lib/recommendationEvidence.js";
import { formatChessScore, formatRecommendationConfidence, recommendationCopy, trainingActionCopy } from "../lib/reportCoachCopy.js";

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
  return Number(item?.sample?.games ?? item?.games ?? item?.count ?? item?.total ?? 0);
}

function getWinRate(item) {
  const direct = item?.sample?.scoreRate ?? item?.scoreRate ?? item?.score_rate ?? item?.winRate ?? item?.win_rate ?? item?.score;

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

function getUsername(data) {
  return (
    data?.username ||
    data?.playerName ||
    data?.player ||
    data?.profile?.username ||
    "my account"
  );
}

function getGamesImported(data) {
  return buildReportGameCounts(data).analysedGames;
}

function inferStyle(openings) {
  const names = openings.map((item) => item.name.toLowerCase()).join(" ");

  if (
    names.includes("vienna") ||
    names.includes("scotch") ||
    names.includes("king's gambit") ||
    names.includes("sicilian")
  ) {
    return "Direct tactical player";
  }

  if (
    names.includes("london") ||
    names.includes("caro") ||
    names.includes("queen's gambit") ||
    names.includes("slav")
  ) {
    return "Solid structure-based player";
  }

  if (
    names.includes("english") ||
    names.includes("reti") ||
    names.includes("réti") ||
    names.includes("indian")
  ) {
    return "Flexible positional player";
  }

  return "Practical club player";
}

export default function ShareReport({ data }) {
  const [copied, setCopied] = useState(false);

  const report = useMemo(() => {
    if (!data) return null;

    const openings = collectOpenings(data)
      .map((item) => ({
        name: getOpeningName(item),
        games: getGames(item),
        winRate: getWinRate(item),
      }))
      .filter((item) => !isUnknownOpening(item.name))
      .filter((item) => item.games > 0)
      .sort((a, b) => {
        if (b.games !== a.games) return b.games - a.games;
        return b.winRate - a.winRate;
      });

    const decision = normaliseReportDecision(data.reportDecision || data.report_decision);
    const card = (entry) => entry ? { name: entry.opening, games: entry.sample?.games ?? entry.games, winRate: entry.sample?.scoreRate ?? entry.scoreRate ?? entry.score } : null;
    const best = card(decision?.establishedStrength);
    const weakest = card(decision?.primaryProblem);
    const nextAction = decision?.nextTrainingAction || { label: "Collect more games before changing your repertoire", reason: "No reliable opening weakness was found yet." };
    const training = trainingActionCopy(nextAction, decision?.primaryProblem || decision?.establishedStrength);

    const username = getUsername(data);
    const gamesImported = getGamesImported(data);
    const style = inferStyle(openings);

    const text = `My OpeningFit report

Player: ${username}
Games analysed: ${gamesImported || "Imported games"}
Style: ${style}

Established strength: ${decision?.establishedStrength ? recommendationCopy(decision.establishedStrength, "keep") : "We do not have enough consistent results to name one yet."}
${decision?.establishedStrength ? `${formatChessScore(decision.establishedStrength)} ${formatRecommendationConfidence(decision.establishedStrength)}` : ""}

Primary problem: ${recommendationCopy(decision?.primaryProblem, "repair")}
${decision?.primaryProblem ? `${formatChessScore(decision.primaryProblem)} ${formatRecommendationConfidence(decision.primaryProblem)}` : ""}

Next training action:
${training.title}. ${training.explanation}

Try it: https://www.openingfit.com`;

    return {
      username,
      gamesImported,
      style,
      best,
      weakest,
      nextAction,
      training,
      text,
    };
  }, [data]);

  if (!data || !report) return null;

  const encodedText = encodeURIComponent(report.text);
  const encodedUrl = encodeURIComponent("https://www.openingfit.com");

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      alert("Could not copy automatically. You can manually copy the report text.");
    }
  };

  const shareOnTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodedText}`, "_blank", "noopener,noreferrer");
  };

  const shareOnReddit = () => {
    window.open(
      `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodeURIComponent("My OpeningFit chess opening report")}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <section className="shareReportShell" id="share-report">
      <div className="shareReportHeader">
        <div>
          <div className="shareReportEyebrow">Share your result</div>
          <h2>Turn your analysis into something worth sharing.</h2>
          <p>
            A shareable report helps users remember their result, ask for feedback, and spread
            OpeningFit without sounding like an advert.
          </p>
        </div>

        <div className="shareReportActions">
          <button type="button" onClick={copyReport}>
            {copied ? "Copied!" : "Copy report"}
          </button>

          <button type="button" className="ghost" onClick={shareOnTwitter}>
            Share on X
          </button>

          <button type="button" className="ghost" onClick={shareOnReddit}>
            Share on Reddit
          </button>
        </div>
      </div>

      <div className="shareReportCard">
        <div className="shareReportTop">
          <span>OpeningFit report</span>
          <strong>{report.username}</strong>
        </div>

        <div className="shareReportMain">
          <div>
            <span>Style</span>
            <h3>{report.style}</h3>
          </div>

          <div>
            <span>Games analysed</span>
            <h3>{report.gamesImported || "Imported"}</h3>
          </div>
        </div>

        <div className="shareReportResultGrid">
          <div className="shareReportResult best">
            <span>Established strength</span>
            <h3>{report.best?.name || "Not enough evidence yet"}</h3>
            <p>
              {report.best?.winRate ? `${report.best.winRate}% score` : "Best current result"}
              {report.best?.games ? ` · ${report.best.games} games` : ""}
            </p>
          </div>

          <div className="shareReportResult fix">
            <span>Primary problem</span>
            <h3>{report.weakest?.name || "No reliable opening weakness found yet"}</h3>
            <p>
              {report.weakest?.winRate ? `${report.weakest.winRate}% score` : "Needs review"}
              {report.weakest?.games ? ` · ${report.weakest.games} games` : ""}
            </p>
          </div>
        </div>

        <div className="shareReportText">
          <pre>{report.text}</pre>
        </div>
      </div>
    </section>
  );
}
