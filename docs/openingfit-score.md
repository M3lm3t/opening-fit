# OpeningFit Score calculation

The post-analysis report uses `build_opening_fit_profile` in `backend/main.py`. The formula was not changed during the transparency work.

The score is the rounded weighted sum of:

| Saved component | Weight | Current input |
| --- | ---: | --- |
| `stability` | 22% | Share of recognised opening games in the three most-played openings, plus repeated-opening coverage |
| `whitePerformance` | 20% | Game-weighted result score in recognised White openings |
| `blackPerformance` | 20% | Game-weighted result score in recognised Black openings |
| `confidence` | 18% | Total analysed games and number of openings with at least five games |
| `weaknessControl` | 12% | Deductions for lower-scoring, rare, and unclear opening samples |
| `recentConsistency` | 8% | A coarse sample proxy: 58 below 20 games and 72 at 20 or more games |

The rounded result is clamped to 20–95 when recognised opening data exists. No-opening reports return 0 with an insufficient-data explanation.

The 8% `recentConsistency` input is not a move-by-move consistency measurement. It is labelled “Sample consistency proxy” in the interface to avoid overstating what the calculation knows.

Older reports remain compatible: if a saved report contains only the final score, OpeningFit shows that score, confidence label, and game count without inventing component values.

The separately stored retention score (`analysis/retention_metrics.py`) is a 0–1000 progress metric and is not the score presented as the main 0–100 post-analysis OpeningFit Score.
