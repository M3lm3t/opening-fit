import { SUPPORT_EMAIL } from "../lib/supportConfig.js";

export default function PublicFooter({ onAccount }) {
  return <footer className="publicFooter" aria-label="OpeningFit legal and support">
    <strong>OpeningFit</strong>
    <nav aria-label="Footer links">
      <a href="/about">About</a><a href="/how-it-works">How analysis works</a>
      <a href="/guides">Guides</a><a href="/premium">Pricing</a>
      <a id="privacy" href="/privacy">Privacy</a><a id="terms" href="/terms">Terms</a>
      <a href="/delete-account">Delete account</a><a href="/changelog">Changelog</a>
      <a id="support" href={`mailto:${SUPPORT_EMAIL}?subject=OpeningFit%20support`}>Support</a>
      {onAccount ? <button type="button" onClick={onAccount}>Account controls</button> : null}
    </nav>
    <p>Independent of Chess.com and Lichess. Training guidance, not a guarantee of results.</p>
  </footer>;
}
