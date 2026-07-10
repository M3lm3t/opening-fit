import { useMemo } from "react";
import {
  buildRepertoireMap,
  getRepertoireGames,
  getRepertoireOpeningName,
  getRepertoireScore,
  getRepertoireStatus,
} from "../services/repertoireStatus";
import MistakeBasedPractice from "./MistakeBasedPractice";
import "./MyRepertoire.css";

function RepertoireEmptyState({ hasData, onAnalyse, onReport }) {
  return (
    <section className="myRepertoireEmpty" id="my-repertoire">
      <span>My Repertoire</span>
      <h1>{hasData ? "Your repertoire map is still building." : "Map your repertoire from one analysis."}</h1>
      <p>
        {hasData
          ? "We need more classified games before we can map your repertoire with confidence. Detected openings will stay low-confidence until they repeat."
          : "Import recent games and OpeningFit will show what you currently play as White and Black."}
      </p>
      <div>
        <button className="primaryBtn" type="button" onClick={onAnalyse}>
          Analyse games
        </button>
        {hasData ? (
          <button className="secondaryBtn" type="button" onClick={onReport}>
            Open report
          </button>
        ) : null}
      </div>
    </section>
  );
}

function statusMeta(status) {
  const copy = {
    Strong: "Good opening",
    Stable: "Reliable enough",
    Developing: "Underdeveloped",
    Weak: "Needs repair",
    "Too little data": "Insufficient evidence",
    Missing: "Coverage gap",
    Overloaded: "Repertoire overload",
  };
  return copy[status] || "Opening signal";
}

function RepertoireOpeningRow({ opening, data, sectionCount, onPractice, onReport }) {
  const status = getRepertoireStatus(opening, { sectionCount });
  const name = getRepertoireOpeningName(opening);
  const games = getRepertoireGames(opening);
  const score = getRepertoireScore(opening);
  const canPractice = ["Strong", "Stable", "Developing", "Weak"].includes(status.status);
  const action = () => {
    if (canPractice && onPractice) {
      onPractice(opening);
      return;
    }
    onReport?.();
  };

  return (
    <article className={`myRepertoireRow myRepertoireRow--${status.tone}`}>
      <div className="myRepertoireRowMain">
        <div>
          <h3>{name}</h3>
          <p>{status.explanation}</p>
        </div>
        <span className={`myRepertoireStatus myRepertoireStatus--${status.tone}`}>
          {status.status}
        </span>
      </div>
      <div className="myRepertoireRowMeta">
        <span>{games ? `${games} game${games === 1 ? "" : "s"}` : "Games unavailable"}</span>
        <span>{score !== null ? `${score}/100` : statusMeta(status.status)}</span>
      </div>
      <button type="button" onClick={action}>
        {status.actionLabel}
      </button>
      <MistakeBasedPractice
        data={data}
        opening={opening}
        compact
        showEmpty={false}
        onStart={onPractice}
      />
    </article>
  );
}

function RepertoireSection({ title, subtitle, openings, emptyText, data, onPractice, onReport }) {
  return (
    <section className="myRepertoireSection">
      <div className="myRepertoireSectionHeader">
        <div>
          <span>{subtitle}</span>
          <h2>{title}</h2>
        </div>
        <strong>{openings.length || "No clear plan"}</strong>
      </div>
      {openings.length ? (
        <div className="myRepertoireRows">
          {openings.map((opening, index) => (
            <RepertoireOpeningRow
              key={`${title}-${getRepertoireOpeningName(opening)}-${index}`}
              opening={opening}
              data={data}
              sectionCount={openings.length}
              onPractice={onPractice}
              onReport={onReport}
            />
          ))}
        </div>
      ) : (
        <div className="myRepertoireMissing">
          <strong>Missing</strong>
          <p>{emptyText}</p>
          <button type="button" onClick={onReport}>Explore alternatives</button>
        </div>
      )}
    </section>
  );
}

export default function MyRepertoire({ data, onAnalyse, onPractice, onReport }) {
  const model = useMemo(() => buildRepertoireMap(data || {}), [data]);
  const hasReport = Boolean(data);

  if (!hasReport || !model.totalOpenings) {
    return (
      <RepertoireEmptyState
        hasData={hasReport}
        onAnalyse={onAnalyse}
        onReport={onReport}
      />
    );
  }

  return (
    <section className="myRepertoire" id="my-repertoire" aria-labelledby="my-repertoire-title">
      <header className="myRepertoireHero">
        <div>
          <span>What am I building?</span>
          <h1 id="my-repertoire-title">{model.focusLabel}</h1>
          <p>{model.overview}</p>
        </div>
        <div className="myRepertoireActionCard">
          <span>Your next repertoire decision</span>
          <strong>{model.action}</strong>
          <button type="button" onClick={onReport}>Review the evidence</button>
        </div>
      </header>

      <div className="myRepertoireGrid">
        <RepertoireSection
          title="White"
          subtitle="What you play with White"
          openings={model.sections.white}
          data={data}
          emptyText="No clear White repertoire has been detected. This may simply mean the current report does not classify the side confidently."
          onPractice={onPractice}
          onReport={onReport}
        />
        <RepertoireSection
          title="Black vs 1.e4"
          subtitle="Main defences"
          openings={model.sections.blackE4}
          data={data}
          emptyText="No clear defence against 1.e4 has been detected yet."
          onPractice={onPractice}
          onReport={onReport}
        />
        <RepertoireSection
          title="Black vs 1.d4 / other"
          subtitle="Queen-pawn and flank coverage"
          openings={model.sections.blackD4}
          data={data}
          emptyText="No clear plan against 1.d4 or other main first moves has been detected yet."
          onPractice={onPractice}
          onReport={onReport}
        />
      </div>

      <section className="myRepertoireGaps" aria-labelledby="coverage-gaps-title">
        <div>
          <span>Coverage gaps</span>
          <h2 id="coverage-gaps-title">What needs clarity next</h2>
        </div>
        <ul>
          {model.gaps.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      </section>
    </section>
  );
}
