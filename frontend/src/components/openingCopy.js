export const OPENING_COPY = {
  fitScore:
    "Fit score combines results, sample size, plan clarity, recent form, opponent strength, risk, and learning cost. Use it to choose what to study first.",
  styleFingerprint:
    "OpeningFit reads recurring patterns from your games: pawn structures, development speed, king safety, tactics, and the positions you keep reaching.",
  weakLine:
    "A weak line is a repeated early move order where your score or stability drops. It is more useful than only knowing the opening name.",
};

export function sampleSizeCopy(games) {
  const count = Number(games) || 0;

  if (count >= 25) {
    return `${count} games. Reliable enough to treat as a pattern.`;
  }

  if (count >= 10) {
    return `${count} games. Useful signal; confirm it with more games before changing everything.`;
  }

  if (count >= 5) {
    return `${count} games. Early signal only. Watch it, but do not make a hard repertoire call yet.`;
  }

  if (count > 0) {
    return `${count} game${count === 1 ? "" : "s"}. Too small for a verdict.`;
  }

  return "No reliable game sample yet.";
}

export function weakLineIssueCopy(issue, games = null) {
  const key = String(issue || "").toLowerCase();

  if (games !== null && Number(games) > 0 && Number(games) < 5) {
    return "Sample size is the main issue. Collect more games before blaming the opening.";
  }

  if (/move.?order|transposition|branch|variation|line/.test(key)) {
    return "The opening may be fine, but this move order is where the position starts to drift.";
  }

  if (/plan|clarity|random|setup|structure/.test(key)) {
    return "You reach the opening, but the follow-up plan changes too much from game to game.";
  }

  if (/loss|mistake|blunder|tactic|short/.test(key)) {
    return "The issue appears early in the game. Review the first repeated mistake before switching openings.";
  }

  if (/black|white|colour|color|side/.test(key)) {
    return "This is colour-specific. Treat it as a White or Black repair, not a general opening verdict.";
  }

  if (/weak_fit|avoid|replace/.test(key)) {
    return "The current fit is weak enough to review the repeated positions before trusting this line.";
  }

  if (/training|improve|review|repair/.test(key)) {
    return "This looks fixable. Train the repeated branch before replacing the opening.";
  }

  return "Use this as a focused review target from your games, not a verdict on the whole opening.";
}
