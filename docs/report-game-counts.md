# Report game-count contract

`gameCounts` contract version 2 is the authority for every report count. Legacy
aliases exist only for stored-report compatibility and must be derived from it.

- `fetchedGames`: public records returned by the platform for the requested period.
- `dateRangeEligibleGames`: fetched records inside that period (the upstream APIs
  are queried with the selected period, so this normally equals `fetchedGames`).
- `timeControlEligibleGames`: period-eligible records matching the selected time control.
- `analysisCandidateGames`: most recent matching, deduplicated records selected
  within the service limit.
- `analysedGames`: candidates with enough valid opening information to contribute.
- `usableOpeningSignals`: technical one-per-analysed-game signal count.
- `excludedGames`: `fetchedGames - analysedGames`.

The exclusion-reason total must equal `excludedGames`. `analysedGames` cannot
exceed `analysisCandidateGames`, and `usableOpeningSignals` cannot exceed
`analysedGames`.

The analysis service limit is 300 games. Matching games are sorted newest first
before this limit is applied. The separate 48-game constant only controls how
many rich PGN evidence records are sent to the browser; lightweight metadata for
the full analysed set is retained for report filters. It is not an analysis cap
and must never be used as a report total.

Legacy stored reports may lack stage counts. The frontend adapter preserves only
totals present in those records and labels the detailed breakdown unavailable.
