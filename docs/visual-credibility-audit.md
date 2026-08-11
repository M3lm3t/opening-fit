# OpeningFit visual credibility audit

Date: 11 August 2026  
Scope: active frontend only; audit only; no production code changed

## Executive assessment

**Overall visual credibility: 5.5/10**

OpeningFit already has the content needed to feel like a credible specialist chess product: named openings, W/D/L evidence, confidence, repertoire roles, position boards, move sequences, import reconciliation, and concrete actions such as Keep, Repair, and Train next. The report is substantially more trustworthy than a generic “AI insight” product at the information-architecture level.

The visual layer does not yet express that distinction consistently. The landing page and several product screens use the familiar grammar of a generated SaaS template: large gradient-backed shells, floating decorative cards, many rounded panels, pill labels, icon tiles, repeated “eyebrow + heading + paragraph + button” compositions, and generous but weakly structured spacing. Within the application, later design-system styles sit on top of a very large accumulated stylesheet and many component-specific styles. As a result, otherwise good chess evidence is often presented as one more decorated card rather than as the product’s visual backbone.

This is not primarily a brand-colour problem. The highest-value work is reducing competing containers and visual treatments, establishing a small typographic and spacing hierarchy, and letting chess evidence carry more of the identity.

### Audit method and confidence

This audit traced the currently rendered route owners and active components from `frontend/src/App.jsx`, `appNavigation`, the report views, the current landing flow, import overlay, repertoire, training, history, profile/account, premium/pricing, and `MobileBottomNav`. It inspected their JSX and the CSS loaded by the current application. Unreachable legacy components were not evaluated merely because they exist.

This was a source-level visual audit, not a screenshot-based usability study. Findings about layering, tokens, responsive rules, copy, and component repetition are high confidence. Judgements about exact perceived density in a running browser are medium confidence and should be confirmed with a small set of representative screenshots before implementation.

## 1. What already looks professional

- The report’s conceptual hierarchy is strong: Health, Repair, Train next, Keep, Coverage, and Evidence are meaningful user questions rather than generic dashboard categories.
- Canonical W/D/L counts, chess score, qualifying-game totals, confidence, and exclusion reconciliation create real product credibility.
- Opening names and repertoire roles such as White, Black vs 1.e4, and Black vs 1.d4 make the analysis specific and legible.
- The loading experience uses real import milestones and counts. Its small board and move line are appropriately chess-specific.
- The current report separates summary decisions from detailed evidence instead of forcing every metric onto Overview.
- Position boards, recorded moves, source-game review, and opening-specific training are the product’s strongest visual assets.
- The compact mobile Overview priority is appropriate: Health, Repair, Train next, then Keep.
- Semantic colours already have a useful foundation: success/Keep, warning/Repair, danger, confidence/neutral, and White/Black role tokens exist.
- Controls generally respect a 44px touch-target foundation, and the shell includes explicit overflow protection.
- Copy is often admirably honest: low evidence is labelled, exclusions are not treated as errors, and training causality is not overstated.

These elements should be treated as the core identity, not restyled into a generic “premium dashboard.”

## 2. What creates the “vibe-coded” impression

### Layered visual systems

The active app loads `index.css`, `uiFoundation.css`, component styles, `App.css`, `ThemePolish.css`, `appShellExperience.css`, `reportExperience.css`, `productScreensExperience.css`, and `ProductAppShell.css`. `App.css` alone is more than 42,000 physical lines and contains multiple late-stage restylings of the same surfaces.

The accumulated CSS contains approximately:

- 1,746 `border-radius` declarations
- 1,031 explicit one-pixel borders
- 635 `box-shadow` declarations
- 535 linear gradients
- 271 radial gradients
- 353 uses of a `999px` pill radius

These totals include inactive selectors, so they are not a count of visible elements. They are nevertheless strong evidence that several visual languages coexist and override one another. The active `.mobileBottomNav`, for example, is redefined in numerous later sections and breakpoints. That makes consistency dependent on cascade order rather than on one authoritative component contract.

### Generic SaaS composition

The landing page combines floating repertoire cards, a fake browser screenshot frame, benefit cards with icon tiles, annotated demo cards, step cards, before/after cards, output cards, credibility-stat cards, use-case cards, pricing cards, badges, and sticky CTAs. Each section is individually understandable, but the cumulative effect resembles a component showcase rather than a tightly edited chess product.

The common pattern is repeated across active screens:

1. uppercase eyebrow;
2. icon in a rounded coloured tile;
3. heading;
4. explanatory paragraph;
5. bordered or gradient panel;
6. pill metadata;
7. rounded button.

Because almost every item receives a container and a visual accent, important evidence and secondary guidance compete at similar visual weight.

### Decorative polish competing with evidence

Radial page glows, card gradients, premium gradients, grid textures, large shadows, inset highlights, and coloured icon surfaces are used broadly. These effects are familiar signals of AI SaaS landing pages. They do not consistently encode chess meaning, evidence strength, or action priority.

### Product naming and visual voice

The interface alternates between “OpeningFit” and “Opening Fit.” That small inconsistency reinforces an assembled feel. The knight mark is useful, but it is surrounded by generic analytics iconography—sparkles, charts, targets, shields, arrows, check circles—more often than by moves, positions, role markers, or game records.

## 3. Highest-impact fixes

| Proposed change | Impact | Effort | Risk |
| --- | --- | --- | --- |
| Establish one authoritative active-app surface system: page, section, evidence row, decision panel, and interactive control. Remove visual overrides from the active cascade only after mapping them. | HIGH | LARGE | MEDIUM |
| Flatten report nesting so a section is not automatically a bordered card containing bordered cards and pill metadata. Use rules, spacing, and table/list structure for evidence. | HIGH | MEDIUM | LOW |
| Edit the landing page down to hero/import, real report preview, concise method/trust proof, pricing, and FAQ. Remove repeated benefit/output/use-case card grids that restate the same promise. | HIGH | MEDIUM | MEDIUM |
| Make W/D/L, opening roles, move notation, confidence, and position evidence the primary visual motifs; reserve abstract icons for navigation and true actions. | HIGH | MEDIUM | LOW |
| Define and enforce a small token set for radius, padding, type, icon size, button height, section gap, borders, and elevation. | HIGH | MEDIUM | LOW |
| Reserve gradients and glow for at most one brand/hero moment and one selected-action state; use flat semantic surfaces elsewhere. | HIGH | SMALL | LOW |
| Replace most metadata pills with inline text, compact definition rows, or table columns. Keep pills only for statuses and filters. | HIGH | SMALL | LOW |
| Give mobile screens a purpose-built reading rhythm—summary, action, evidence disclosure—rather than merely stacking desktop cards. | HIGH | MEDIUM | MEDIUM |

## 4. Elements to KEEP

### Keep unchanged in concept

- Health score with its deterministic explanation.
- Keep, Repair, Train next, and low-evidence verdict semantics.
- W/D/L and draw-inclusive score evidence.
- Repertoire coverage organised by White, Black vs 1.e4, Black vs 1.d4, and only other roles the backend can support.
- Compact evidence disclosure and import reconciliation.
- Real loading milestones and counts.
- Chess boards, recorded move sequences, game sources, and training positions.
- Opening names as strong headings rather than decorative labels.
- Honest empty states and confidence language.
- Current mobile priority order and entitlement-aware navigation logic.
- The restrained `reportExperience.css` direction where nested report cards already use flat surfaces and no shadows.

### Proposed preservation rule

Preserve any visual element that answers one of these questions: “What opening?”, “What role?”, “What happened in my games?”, “How reliable is this?”, or “What do I do next?” Decorative elements should have to justify themselves against that standard.

**IMPACT: HIGH · EFFORT: SMALL · RISK: LOW**

## 5. Elements to simplify

### Landing page section count

The landing journey currently repeats the product promise across Problem, Why different, Demo, workflow walkthrough, How it works, before/after, output examples, generated output, empty states, proof, credibility, use cases, opening choice, pricing, and FAQ. This makes the page long without proportionally increasing trust.

Simplify to one argument:

- enter a public username;
- see a real, clearly fictional report preview;
- understand Keep/Repair/Train next and evidence confidence;
- understand data handling and limits;
- choose free or Plus.

**IMPACT: HIGH · EFFORT: MEDIUM · RISK: MEDIUM**

### Report containers

Use one section boundary per major report question. Inside it, prefer aligned evidence rows and disclosure rather than another fully styled article. Health may remain a strong summary panel; the individual Repair/Train/Keep decisions should read more like an editorial report than three mini landing cards.

**IMPACT: HIGH · EFFORT: MEDIUM · RISK: LOW**

### Pills

Keep pills for finite states—Established, Needs repair, Coverage gap, Low confidence—and active filters. Convert ordinary metadata such as username, platform, date range, game count, section eyebrows, and explanatory qualifiers to inline text or labelled rows when no selection/status meaning exists.

**IMPACT: HIGH · EFFORT: SMALL · RISK: LOW**

### Loading screen

The chessboard/move-line loader is distinctive and should stay. The surrounding nested header, progress wrapper, workspace, narrative card, active-message card, steps, milestones, reassurance, and footer can feel over-articulated. One progress narrative, confirmed milestones, and cancellation affordance are enough.

**IMPACT: MEDIUM · EFFORT: SMALL · RISK: LOW**

### Profile, account, history, and pricing

These surfaces should use a quieter settings/list vocabulary. Avoid giving each statistic, preference, subscription fact, saved report, and upgrade prompt the same elevated card treatment. Profile especially benefits from rows and grouped sections; history benefits from a chronological list; pricing can retain two clear plan panels.

**IMPACT: MEDIUM · EFFORT: MEDIUM · RISK: LOW**

## 6. Elements to remove

These are design recommendations only; nothing was removed in this audit.

- Decorative floating repertoire cards around the landing hero once the real report preview is visible. They duplicate the product example and read as template decoration.  
  **IMPACT: MEDIUM · EFFORT: SMALL · RISK: LOW**
- Fake browser chrome around every preview. One authentic product crop is more credible than a generic three-dot frame.  
  **IMPACT: MEDIUM · EFFORT: SMALL · RISK: LOW**
- Most sparkle icons. “Sparkles” is a strong AI-template fingerprint and appears in loading/analysis contexts where a chess or data-processing symbol would be more accurate.  
  **IMPACT: MEDIUM · EFFORT: SMALL · RISK: LOW**
- Decorative radial glows behind routine application pages and cards.  
  **IMPACT: HIGH · EFFORT: SMALL · RISK: LOW**
- Hover lift/shadow effects from non-interactive informational cards. They imply clickability and add visual noise.  
  **IMPACT: MEDIUM · EFFORT: SMALL · RISK: LOW**
- Repeated marketing sections that restate “turn games into decisions” without adding evidence or answering an objection.  
  **IMPACT: HIGH · EFFORT: MEDIUM · RISK: MEDIUM**
- Status-like styling from ordinary nouns such as “Personalised,” platform names, and report metadata.  
  **IMPACT: MEDIUM · EFFORT: SMALL · RISK: LOW**

## 7. Typography inconsistencies

The newer foundations define reasonable page and section heading scales, but active component CSS still uses many local values and very heavy weights. Labels frequently use 800–950 weight, uppercase, and letter spacing at 0.70–0.82rem. When headings, labels, badges, and buttons are all bold, little feels truly important.

Observed issues:

- Several heading scales coexist: landing hero, application hero, report hero, product-screen hero, public trust hero, and component-local headings.
- Small uppercase labels are used so often that they become texture rather than hierarchy.
- Numeric evidence is sometimes large, but nearby card titles, status chips, and CTAs are also heavy, reducing contrast.
- Long explanatory paragraphs frequently sit inside cards at the same width and weight as short action copy.
- Font weights such as 850 and 950 appear alongside 800 and 900, creating fine distinctions that are unlikely to be perceptible or reliably supported by every font.

Recommended type hierarchy:

1. one display size for the landing proposition only;
2. one page-title size;
3. one section-title size;
4. one card/row title size;
5. body and compact evidence text;
6. one small-label style used sparingly.

**IMPACT: HIGH · EFFORT: MEDIUM · RISK: LOW**

## 8. Card, pill, and border inconsistencies

The codebase contains a broad radius vocabulary: 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 30, and 32px, plus rem-based values, token values, and `999px`. Common active values include 12, 14, 16, 18, 20, 22, and 24px. This is too many near-equivalent corner treatments to communicate meaningful hierarchy.

Border overload is visible in the report structure: a bordered view panel can contain a bordered summary card, bordered stat cards, bordered chips, and bordered buttons. Even without shadows, this creates “card inside card inside card.”

Recommended contract:

- 0 radius for tables, dividers, and evidence rows;
- one control radius;
- one standard panel radius;
- optional larger hero radius;
- pill radius only for genuine statuses/filters;
- no border on a child when the parent boundary and spacing already establish grouping;
- one subtle elevation level for overlays or genuinely floating content, not every card.

**IMPACT: HIGH · EFFORT: MEDIUM · RISK: LOW**

## 9. Colour and gradient problems

Colour tokens are semantically promising, but usage is diluted by decorative cyan/blue/gold/green gradients and accent mixes across many unrelated surfaces.

Specific problems:

- The page background itself uses multiple radial glows plus a linear gradient in both themes.
- Primary buttons, premium panels, active navigation, benefit cards, score panels, loading states, and selected states all compete with gradient treatments.
- Accent colour sometimes means primary action, sometimes brand decoration, sometimes information, sometimes a score, and sometimes selection.
- Gold can mean premium, warning, or decorative warmth.
- Green/teal can mean Keep, success, brand, selected navigation, or a CTA.
- Repair and low-confidence semantics risk being visually weakened because many neutral cards are already colourful.

Recommended semantic rule:

- green: established/Keep/success;
- amber: Repair/caution;
- red: destructive/error only;
- blue or teal: navigation/interactive focus;
- neutral: confidence and evidence scaffolding unless a confidence warning is required;
- gold: premium only, if retained;
- gradients: brand hero or premium emphasis, never routine evidence cards.

**IMPACT: HIGH · EFFORT: MEDIUM · RISK: MEDIUM**

## 10. Copy that sounds AI-generated or marketing-heavy

The current product copy is generally more grounded than the visuals, but several active phrases weaken credibility:

- “Discover the openings you already win with.” It is catchy but overstates the product before evidence and frames draws awkwardly.
- “Find openings that match your style.” “Style” is broad and can sound like a personality quiz unless immediately grounded in games and roles.
- “Opening advice that feels personal, practical, and finishable.” The three-adjective construction is polished marketing language rather than specialist authority.
- “turns messy games into opening decisions” / “turn opening confusion into one clear next action.” These ideas are repeated across multiple landing sections.
- Repeated “unlock” language makes normal data thresholds and paid features sound gamified: “unlock a clearer recommendation,” “unlock stronger opening trends,” “unlock comparison.”
- “Personalised intelligence,” “IntelligentCoachInsights,” and sparkle-led presentation are AI-coded even when the underlying logic is deterministic. Internal component names are not a user issue, but visible “Personalized study roadmap” and similar language contribute to the impression.
- “Stop guessing which chess openings you should play.” It is direct, but generic conversion copy when paired with a decorated hero.
- “powerful” is not prominent on the traced core journey, which is positive.

Preferred voice: state the input, finding, evidence limit, and next action. For example: “See which openings are established in your games, which positions need repair, and where the sample is still too small.”

**IMPACT: MEDIUM · EFFORT: SMALL · RISK: LOW**

## 11. Chess-specific identity opportunities

The product should not add ornamental chessboards everywhere. It should use chess data formats where they make information easier to recognise.

### High-value opportunities

- Make opening names the most visually prominent labels on decision rows.
- Present W/D/L as a consistent compact triplet, not three unrelated badges.
- Pair score with sample size and confidence in one evidence line.
- Use White/Black piece or side markers only for repertoire role—not as generic decoration.
- Use short move fragments such as `1.e4 c6 2.d4 d5` when a diagnosis genuinely identifies a branch.
- Let a real position diagram anchor Repair or training detail where canonical FEN/PGN exists.
- Use a repertoire matrix/list as a signature visual: White, Black vs 1.e4, Black vs 1.d4, status, evidence.
- Use game-result strips or restrained mini timelines in History rather than generic stat tiles.
- In Evidence, favour compact chess tables and source-game rows over dashboard cards.

### Avoid

- Decorative chess pieces unrelated to role or position.
- Huge opening trees the backend cannot support reliably.
- Fabricated board positions or move sequences.
- Turning every metric into a score gauge.

**IMPACT: HIGH · EFFORT: MEDIUM · RISK: LOW**

## 12. Mobile-specific issues

The code includes many sensible mobile safeguards, but the mobile experience still risks feeling like desktop cards stacked vertically.

- Large rounded shells remain rounded cards on small screens rather than becoming simpler full-width sections.
- Nested cards compound vertical scrolling and repeat padding at each level.
- Many small uppercase labels and pill rows wrap unpredictably and add height without adding priority.
- Full-width buttons recur after individual cards, making secondary actions feel as prominent as the main task.
- The fixed bottom navigation has been restyled repeatedly in `App.css`, including multiple definitions around different breakpoint blocks. Its final appearance is difficult to reason about and fragile to future edits.
- Five navigation items at narrow widths leave little room for labels. The implementation adapts below 380px, but the density still resembles a generic mobile dashboard bar.
- Sticky landing CTAs plus long stacked marketing sections can make the mobile page feel persistently promotional.
- Desktop comparison grids generally collapse to one column rather than changing into concise ranked lists or disclosures.

Recommended mobile principle: remove outer card chrome, keep one primary decision visible per viewport, make evidence a compact line or disclosure, and reserve full-width CTAs for the next action.

**IMPACT: HIGH · EFFORT: MEDIUM · RISK: MEDIUM**

## 13. Design-system inconsistencies

### Tokens exist, but do not govern the product

`uiFoundation.css` defines a coherent spacing, radius, control-height, surface, and colour vocabulary. Active styles frequently bypass it with literal values or redefine the same component later with `!important`. The result is token presence without token authority.

### Inconsistent dimensions

- Radius: many values from 8px to 32px plus pills.
- Buttons: a 44px foundation exists, but local components use their own padding, height, and radius.
- Padding: panels use numerous local `clamp()` expressions and fixed values.
- Section gaps: global tokens coexist with local 10, 12, 14, 18, 20, 22, 24, and 28px gaps.
- Icons: 14, 15, 16, 18, 19, 20, and 21px sizes appear in closely related contexts.
- Headings: several component-local clamp scales compete with the foundation.
- Containers: 980, 1180, and 1280px tokens are useful, but component shells and landing sections introduce additional width behavior.

### Cascade risk

Repeated `!important` overrides and multiple definitions of active selectors mean a small visual edit can produce unrelated regressions. This is a design credibility problem as well as a maintenance problem: local fixes accumulate instead of converging on a system.

Recommended first technical design task: create an active-selector inventory and assign every currently rendered surface to a single tokenised primitive before deleting or consolidating any CSS.

**IMPACT: HIGH · EFFORT: LARGE · RISK: MEDIUM**

## 14. Surface-by-surface findings

| Surface | Assessment | Main issue | Recommendation | Impact | Effort | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| Landing | Visually polished but strongly template-like | Too many card-grid sections, glows, icon tiles, repeated claims | Edit the narrative and foreground one authentic report preview | HIGH | MEDIUM | MEDIUM |
| Username entry | Clear and usable | Sits inside a decorated hero with competing preview/login/labels | Make the input and supported platforms the visual centre | HIGH | SMALL | LOW |
| Loading | Credible data behavior and good chess cue | Too many nested narrative/progress containers; sparkle iconography | Retain board, moves, real milestones; flatten the shell | MEDIUM | SMALL | LOW |
| Report Overview | Strong product logic | Summary card, score card, stat cards, decision cards, chips, and tabs create nested chrome | Use an editorial summary plus evidence rows | HIGH | MEDIUM | LOW |
| Health | Clear and trustworthy when explanation is present | Large score treatment can resemble a generic dashboard KPI | Pair score, status, and limiting reason in one restrained block | HIGH | SMALL | LOW |
| Repair | Specialist content | Competes visually with Keep and secondary metadata | Give diagnosis and position evidence priority; amber only for action state | HIGH | SMALL | LOW |
| Train next | Actionable and distinctive | Generic CTA/card treatment can hide the chess task | Show concrete target, move/position, duration, then one CTA | HIGH | SMALL | LOW |
| Keep | Trust-building | Can receive too much card prominence relative to action items | Render as compact confirmation with evidence | MEDIUM | SMALL | LOW |
| Repertoire | Natural chess-specific structure | Risks becoming a grid of status cards and pills | Use a role-based matrix/list with expandable evidence | HIGH | MEDIUM | LOW |
| Coverage | Excellent specialist concept | Status pills and nested cards can make it dashboard-like | Treat roles as rows; reserve colour for status | HIGH | SMALL | LOW |
| Evidence | Strongest credibility surface | Generic cards dilute table/source-game clarity | Prefer tables, result triplets, game links, and disclosures | HIGH | MEDIUM | LOW |
| Today | Useful return loop | Mission/progress/continue cards may repeat the same action | One current task, one progress line, secondary history link | MEDIUM | MEDIUM | LOW |
| Training | Chess boards and recorded moves feel authentic | Surrounding step cards and gamification can overpower the position | Make the board/moves primary and reduce chrome | HIGH | MEDIUM | LOW |
| History/progress | Valuable longitudinal proof | Metric cards and unlock language feel like a retention template | Use dated report rows, restrained deltas, and honest sample labels | MEDIUM | MEDIUM | LOW |
| Profile/account | Functional | Card-per-setting and mixed optional insight panels | Use conventional grouped settings rows | MEDIUM | MEDIUM | LOW |
| Pricing | Understandable | Premium gradients/badges repeat generic SaaS conventions | Keep two simple plans and evidence-backed feature distinctions | MEDIUM | SMALL | LOW |
| Mobile navigation | Functionally considered | Visually defined by multiple competing CSS blocks; crowded at narrow widths | Establish one authoritative fixed-nav rule set | HIGH | MEDIUM | MEDIUM |

## 15. Recommended implementation order

This order is deliberately conservative and does not require changing brand colours or product logic.

1. **Capture a visual baseline and map active selectors.** Take representative desktop and 320/375/393px screenshots for landing, loading, Overview, Repertoire, Evidence, Today/training, History, Profile, and pricing. Map each visible element to its winning CSS rule.  
   **IMPACT: HIGH · EFFORT: MEDIUM · RISK: LOW**

2. **Define the authoritative visual contract.** Limit radii, type sizes, weights, button heights, icon sizes, section gaps, border use, and elevation. Decide which existing foundation file owns each token.  
   **IMPACT: HIGH · EFFORT: MEDIUM · RISK: LOW**

3. **Fix the report first.** Flatten Overview, then Repertoire/Coverage and Evidence. These are the moments where credibility converts; preserve all canonical data and CTA IDs.  
   **IMPACT: HIGH · EFFORT: MEDIUM · RISK: LOW**

4. **Make training visibly chess-first.** Promote board, moves, opening, and source game; demote generic cards, icon tiles, and gamification decoration.  
   **IMPACT: HIGH · EFFORT: MEDIUM · RISK: LOW**

5. **Consolidate mobile shell and navigation styles.** Establish a single mobile nav implementation and simplify full-width section treatment. Test 320, 375, and 393px.  
   **IMPACT: HIGH · EFFORT: MEDIUM · RISK: MEDIUM**

6. **Edit the landing page.** Remove repeated sections and template decoration, then use real product evidence as the visual proof.  
   **IMPACT: HIGH · EFFORT: MEDIUM · RISK: MEDIUM**

7. **Quiet utility surfaces.** Convert Profile/account/history to conventional grouped rows and chronology; simplify pricing without changing entitlements.  
   **IMPACT: MEDIUM · EFFORT: MEDIUM · RISK: LOW**

8. **Consolidate active CSS only.** Once screenshots and regression tests prove parity, remove superseded active overrides incrementally. Do not combine this with feature or logic work.  
   **IMPACT: HIGH · EFFORT: LARGE · RISK: MEDIUM**

## Final verdict

OpeningFit currently sits between categories A and B. Its product logic and evidence model belong to **A: credible specialist chess analytics**. Its surface language too often belongs to **B: generic AI/vibe-coded SaaS**.

The path forward is subtraction and hierarchy, not a wholesale redesign. Keep the chess evidence, honest confidence model, action semantics, boards, moves, and repertoire roles. Reduce decorative gradients, glows, pills, nested cards, repeated landing sections, and competing CSS overrides. If the interface begins to look more like a concise chess report and training workspace—and less like a gallery of rounded feature cards—the specialist credibility already present in the product will become visible.
