import "./SessionSummary.css";

export default function SessionSummary({ summary, onDismiss, onToday }) {
  if (!summary) return null;

  return (
    <aside className="sessionSummary" aria-live="polite" aria-label="Session summary">
      <div>
        <p className="eyebrow">{summary.title || "Today's progress"}</p>
        <ul>
          {(summary.lines || []).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <div className="sessionSummaryActions">
        {onToday ? <button type="button" className="secondaryBtn" onClick={onToday}>Today</button> : null}
        <button type="button" className="ghostBtn" onClick={onDismiss}>Dismiss</button>
      </div>
    </aside>
  );
}
