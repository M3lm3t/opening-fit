import "./NextBestAction.css";

export default function NextBestAction({
  eyebrow = "Next best action",
  title,
  detail,
  primary,
  secondary = [],
}) {
  if (!primary && !title) return null;

  return (
    <section className="nextBestAction" aria-label={eyebrow}>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h3>{title || primary?.label}</h3>
        {detail ? <p>{detail}</p> : null}
      </div>
      <div className="nextBestActionButtons">
        {primary ? (
          <button type="button" className="primaryBtn" onClick={primary.onClick} disabled={primary.disabled}>
            {primary.label}
          </button>
        ) : null}
        {secondary.slice(0, 2).map((action) => (
          <button key={action.label} type="button" className="secondaryBtn" onClick={action.onClick} disabled={action.disabled}>
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}
