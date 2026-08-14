import { useEffect, useState } from "react";
import { CHANGELOG } from "../content/changelog";
import { supportPath } from "../lib/trustExperience";
import { SUPPORT_EMAIL } from "../lib/supportConfig.js";
import { DEFAULT_PUBLIC_ANALYSIS_CONTRACT, loadPublicAnalysisContract } from "../lib/productTransparency.js";

export default function PublicTrustPage({ page, appTopNav }) {
  const [analysisContract, setAnalysisContract] = useState(DEFAULT_PUBLIC_ANALYSIS_CONTRACT);

  useEffect(() => {
    if (page !== "how") return undefined;
    let active = true;
    loadPublicAnalysisContract().then((value) => { if (active) setAnalysisContract(value); }).catch(() => {});
    return () => { active = false; };
  }, [page]);

  const sections = {
    about: <>
      <h1>Opening guidance built for real club-player games.</h1>
      <p>OpeningFit exists because opening advice often starts with theory lists rather than the positions a player actually reaches. It is an independently built product by Daniel, designed to turn public online games into manageable repertoire and training decisions.</p>
      <p>OpeningFit is an independent product and is not affiliated with Chess.com or Lichess.</p>
      <h2>What it does</h2>
      <p>OpeningFit identifies openings and recurring positions, compares results and available behavioural signals, and creates practical repertoire and training guidance. It is not a chess engine, a coaching qualification, or a universal judgement of an opening.</p>
      <p><a href={supportPath("general")}>Contact the builder</a></p>
    </>,
    how: <>
      <h1>How OpeningFit analysis works</h1>
      <p>This page describes the current report method and enforced public limits. OpeningFit uses imported public games and deterministic analysis; it is not a claim that every public game can be analysed.</p>
      <ol>
        <li><strong>Fetch.</strong> OpeningFit requests public Chess.com or Lichess profile and game records for the username submitted. It never asks for the platform password.</li>
        <li><strong>Filter.</strong> The selected date window and supported time-control setting determine which games continue. Missing PGN or moves, unsupported game types, duplicates and games without enough legal opening plies are excluded for reasons shown in the report.</li>
        <li><strong>Limit.</strong> At most <strong>{analysisContract.analysisGameLimit} structurally usable games</strong> enter one import analysis, selected newest first. Games beyond that cap are valid public games, but are not classified in that report. Free accounts can request up to {analysisContract.freeHistoryMonths} months of history; Plus can request up to {analysisContract.plusHistoryMonths} months. A shorter public history can produce fewer games.</li>
        <li><strong>Classify.</strong> Move sequences and opening metadata identify an opening and the player colour. The report separates openings played by the user from openings faced as White or Black. Unusual move orders and transpositions can remain ambiguous.</li>
        <li><strong>Decide.</strong> Repeated, sufficiently supported samples can become an established strength or primary problem. Small samples receive cautious conclusions. Zero-game suggestions are labelled as experiments, not observed results. The report selects at most one established strength, one primary problem and exactly one next training action.</li>
      </ol>
      <details open>
        <summary>Scores, results and confidence</summary>
        <p>Repertoire Health describes the condition and completeness of the three repertoire roles; it is not a measure of general chess ability. Observed Performance is the actual win/draw/loss evidence. Win Rate counts wins only, while Opening Score Rate is wins plus half of draws divided by games in the opening sample. Opening Suitability is a separate deterministic fit estimate, not predicted results. Evidence Confidence describes certainty and sample scope, not performance. The current contract is <code>repertoire_health_v2</code>; the report shows its versioned components and effective weights and marks unavailable evidence rather than treating it as zero.</p>
        <p>Historical reports retain their stored formula version and are not silently recalculated or compared with incompatible versions. Where supporting PGNs are retained, the report and training surfaces let the player inspect the games and position behind the decision.</p>
      </details>
      <details>
        <summary>What OpeningFit does not do</summary>
        <p>OpeningFit does not provide full-game engine analysis, claim objective engine move quality when engine analysis is unavailable, verify a player&apos;s identity, inspect private games, guarantee improvement, or judge an opening&apos;s universal theoretical soundness. Results can change when the date window, time controls, available public games, classification, formula version or comparison baseline changes.</p>
      </details>
      <p>OpeningFit is an independent product and is not affiliated with Chess.com or Lichess. <a href="/report/sample">Inspect the labelled example report</a> or <a href={supportPath("general")}>ask a methodology question</a>.</p>
    </>,
    privacy: <>
      <h1>OpeningFit Privacy Policy</h1>
      <p><strong>Effective date: 14 August 2026.</strong></p>
      <p>OpeningFit is an independent chess-training product. Questions about this policy or personal data can be sent to <a href={`mailto:${SUPPORT_EMAIL}?subject=OpeningFit%20data%20question`}>{SUPPORT_EMAIL}</a>.</p>

      <h2>Information OpeningFit collects</h2>
      <p>When you create an account, OpeningFit may process your email address, account identifier, display name, linked authentication provider information, chess usernames, preferences and session information. Supabase provides authentication, account and session storage. Google OAuth may be used to sign in; OpeningFit does not receive or store your Google password.</p>
      <p>When you submit a Chess.com or Lichess username, OpeningFit requests publicly available profile and game information from that platform. This can include usernames, ratings, game records, moves or PGNs, results, dates, opponents, colours, openings and time controls. No Chess.com or Lichess password is required.</p>
      <p>OpeningFit creates information derived from those games, including analysis results, recommendations and reports. Signed-in users may save reports, analysed-game records, repertoire choices, training state, activity, settings, recommendation history and progress information to their account. Signed-out use may store reports, preferences and progress locally in the browser or app. The service may also keep limited username-based import/profile caches needed to provide and restore results.</p>

      <h2>How information is used</h2>
      <p>OpeningFit uses this information to authenticate users, import and analyse public games, generate and save reports, restore account data across devices, provide repertoire and training features, manage subscriptions, prevent abuse, diagnose failures, respond to support requests and improve product reliability.</p>

      <h2>Technical, analytics and referral data</h2>
      <p>OpeningFit records limited operational and product events such as the route, device category, feature stage and broad success or error category. Its analytics safeguards reject fields such as passwords, tokens, email addresses, usernames, PGNs, payment details and session or user identifiers. Vercel hosts the web application and provides web analytics. Server logs may contain ordinary technical request and error information needed for security and operation.</p>
      <p>If you use a referral link or code, OpeningFit may store the code, partner name, a random browser identifier, landing path and capture or expiry times to prevent duplicate counts and attribute later registration or purchase. A valid account referral may include purchase status and commission audit amounts.</p>

      <h2>Payments</h2>
      <p>Stripe processes subscription checkout, billing and payment-management sessions. OpeningFit stores subscription entitlement and limited Stripe reference information needed to match access to an account. OpeningFit does not store full payment-card details.</p>

      <h2>Service providers and sharing</h2>
      <p>OpeningFit uses service providers including Supabase for authentication and database services, Vercel for hosting and analytics, Stripe for payments, and Chess.com and Lichess as sources of public chess data. Google processes information when Google OAuth is chosen. These providers process information for their respective services under their own terms and privacy practices. OpeningFit does not describe this provider processing as a sale of personal data.</p>

      <h2>Storage, security and retention</h2>
      <p>OpeningFit uses access controls, authenticated API requests and HTTPS to protect account-linked information. No internet service can guarantee absolute security. Account-linked data is generally retained while the account is active and as needed to provide the service. Local browser or app data remains until it is cleared, overwritten or the app is removed. Operational records, cached public-game results and backups may persist for a limited period according to operational cycles.</p>
      <p>Following a valid deletion, current account-linked data is deleted or anonymised where applicable, subject to technical completion and information that must be retained for fraud prevention, security, accounting, dispute resolution or other legal obligations. Stripe may retain transaction records under its own obligations.</p>

      <h2>Account deletion and your choices</h2>
      <p>You can review or update account information in OpeningFit account settings. You can permanently delete an authenticated OpeningFit account from the Account page, or submit a request using the public <a href="/delete-account">account deletion instructions</a>. You may also contact <a href={supportPath("data")}>{SUPPORT_EMAIL}</a> to request access, correction or deletion, or to ask about other privacy rights available where you live. OpeningFit may need to verify the request before acting.</p>

      <h2>Children&apos;s privacy</h2>
      <p>OpeningFit is not directed to children under 13, or below the minimum age required to consent to online services where they live, and does not knowingly collect their personal information. A parent or guardian who believes a child supplied personal information should contact OpeningFit.</p>

      <h2>Changes to this policy</h2>
      <p>This policy may be updated when the product, providers or legal requirements change. The effective date above will be updated when material changes are published.</p>
    </>,
    deletion: <>
      <h1>Delete your OpeningFit account</h1>
      <p>This public page explains how to request permanent deletion of an OpeningFit account and associated account data.</p>

      <h2>Delete your account in OpeningFit</h2>
      <ol>
        <li>Sign in to the OpeningFit account you want to delete.</li>
        <li>Open <a href="/account">Account</a> and find <strong>Delete account</strong>.</li>
        <li>Select <strong>Delete my account</strong> and confirm the permanent deletion prompt.</li>
      </ol>
      <p>The authenticated deletion flow removes the OpeningFit authentication account and current account profile. Associated current user-owned application data is removed in accordance with the configured database deletion behavior, matching cached chess profiles are cleared, and OpeningFit data stored by the app on that device is cleared after sign-out.</p>

      <h2>Request deletion on the web</h2>
      <p>If you cannot use the signed-in deletion control, email <a href={supportPath("deletion")}>{SUPPORT_EMAIL}</a> with the subject “OpeningFit account deletion”. Send the request from the email address associated with the account where possible. OpeningFit may ask for reasonable verification before deleting data; never send a password or payment-card details.</p>

      <h2>What deletion does not affect</h2>
      <p>Deleting OpeningFit does not delete your Chess.com, Lichess, Google or Stripe account. Those services must be managed directly with their providers. Some transaction, security, fraud-prevention, dispute or accounting information may be retained where legally or operationally required.</p>
      <p>Account deletion is permanent. For more information, read the <a href="/privacy">OpeningFit Privacy Policy</a>.</p>
    </>,
    terms: <>
      <h1>OpeningFit terms and limitations</h1>
      <p>OpeningFit provides training guidance from available public game history. Recommendations do not guarantee results and are not objective assessments of opening soundness. Classification, platform availability and incomplete records can affect results. Users remain responsible for repertoire choices and can override or dismiss recommendations.</p>
      <p>Payments are handled securely by Stripe. For purchase, access or refund questions, use <a href={supportPath("payment")}>payment support</a>.</p>
    </>,
    changelog: <>
      <h1>OpeningFit changelog</h1>
      <p>User-facing improvements, without internal security or infrastructure details.</p>
      {CHANGELOG.map((item) => <article key={`${item.date}-${item.improvement}`}><time>{item.date}</time><h2>{item.improvement}</h2><p>{item.outcome}</p></article>)}
    </>,
  };

  return <div className="publicTrustPage">{appTopNav()}<main className="publicTrustContent">{sections[page]}</main><footer><a href="/about">About</a><a href="/how-it-works">How analysis works</a><a href="/privacy">Privacy</a><a href="/delete-account">Delete account</a><a href="/terms">Terms</a><a href="/changelog">Changelog</a><a href={supportPath("general")}>Support</a></footer></div>;
}
