# Conservative training outcomes

OpeningFit measures whether a completed opening focus is applied in later analysed games. It does not attribute rating movement, game results, or general chess improvement to training.

## Eligibility

- A game must have a reliable played-at time strictly after the task completion time. Games at the same timestamp are excluded.
- The game's canonical opening identifier must match the focus. Other openings are excluded even if they contain a similar idea.
- A position is relevant only when the saved normalised FEN (piece placement, side to move, castling rights, and en-passant square) is reconstructed from the PGN, or matching saved move-analysis evidence identifies the same issue.
- Missing or malformed dates, PGNs, positions, and opening identifiers do not count as evidence.

## Thresholds

| Rule | Threshold |
| --- | ---: |
| Later games in the same opening before judging progress | 3 |
| Relevant position occurrences before judging progress | 2 |
| Successful applications required for `improved` | 2 |
| Application rate required for `improved` | at least two-thirds |
| Repeated instances required for `not_improved` | 2 |
| Same-opening games required for an opening-result metric | 5 |

`partially_improved` requires at least one successful application and more successful applications than repeated mistakes, after the minimum game and position samples are met. `not_improved` requires the recorded mistake or matching issue to recur at least twice while fewer than half of relevant occurrences use the supported response. Ambiguous mixed evidence remains `insufficient_data`.

## Wording rules

- `improved`: “You applied this successfully in two later games.” (The count changes only when supported.)
- `partially_improved`: says the idea was applied but more consistency evidence is needed.
- `not_improved`: “The same issue occurred again in three games.” (The count changes only when supported.)
- `not_encountered`: “The position has not appeared again yet.” This is neutral and is never treated as failure.
- `insufficient_data`: “There is not enough evidence to judge this.”

Opening-result percentages are whole-number sample summaries, not causal claims. They remain absent below five same-opening games. Rating deltas are not used, and wording must never say or imply that OpeningFit training caused rating or result improvement.
