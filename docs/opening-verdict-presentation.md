# Opening verdict presentation

OpeningFit presents four separate values for an opening:

- **Fit**: how well the opening and resulting positions appear to match demonstrated preferences, strengths and recurring successful patterns. Visible bands are Strong (65+), Mixed (45–64.9), Weak (below 45), or Unknown when no explicit fit signal exists.
- **Current performance**: what the available game results show. Chess score counts a win as one point and a draw as half a point. Visible bands are Strong (55%+), Inconsistent (45–54.9%), Struggling (below 45%), or Unknown.
- **Evidence confidence**: the amount and quality of opening-specific evidence. Fewer than five games or invalid evidence is Insufficient data; 5–9 reliable games is Low; 10–14 reconciled games is Moderate; High requires at least 15 reconciled games with traceable supporting game IDs.
- **Verdict**: the existing recommendation engine's overall action, shown after the three independent signals.

Raw numerical values remain available in secondary detail. A performance value is never reused as fit, and `fitScore` is never used as a result score. When a recurring branch is supported, the verdict keeps the opening and targets that branch rather than rejecting the whole opening.
