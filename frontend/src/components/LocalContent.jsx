import { Component, lazy, Suspense } from "react";

export function ContentLoadingState({ label }) {
  return <section className="contentLoadingState" role="status" aria-live="polite" aria-busy="true"><strong>Loading {label}…</strong><div aria-hidden="true"><span /><span /><span /></div></section>;
}

class ContentErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error(`OpeningFit ${this.props.label} could not load`, error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <section className="contentLoadError" role="alert"><h3>{this.props.label} could not load</h3><p>Check your connection and reload this page to try again. You can still use the navigation to open another section.</p><button type="button" className="secondaryBtn" onClick={() => window.location.reload()}>Reload this page</button></section>;
  }
}

// Each lazy feature owns its loading/error state. The top-level boundary remains
// available for initial startup; ordinary navigation keeps the shell mounted.
export function lazyContent(loader, label) {
  const LoadedContent = lazy(loader);
  return function LocalContent(props) {
    return <ContentErrorBoundary label={label}><Suspense fallback={<ContentLoadingState label={label} />}><LoadedContent {...props} /></Suspense></ContentErrorBoundary>;
  };
}
