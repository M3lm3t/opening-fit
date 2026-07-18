import { Component } from "react";
import { supportMailto } from "../lib/supportConfig.js";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      errorMessage: "",
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Something went wrong.",
    };
  }

  componentDidCatch(error, info) {
    console.error("Opening Fit runtime error:", error, info);
  }

  resetApp = () => {
    this.setState({
      hasError: false,
      errorMessage: "",
    });

    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="appCrashFallback">
        <section className="appCrashCard">
          <p className="eyebrow">Opening Fit</p>
          <h1>Something broke, but your app did not disappear.</h1>
          <p>
            Opening Fit hit a display error. This usually happens after a new update,
            unusual game data, or a browser cache issue.
          </p>

          <div className="crashDetails">
            <strong>Error detail</strong>
            <span>{this.state.errorMessage}</span>
          </div>

          <div className="crashActions">
            <button type="button" onClick={this.resetApp}>
              Reload Opening Fit
            </button>

            <a href={supportMailto("Opening Fit bug report")}>
              Report this bug
            </a>
          </div>

          <small>
            Tip: if this keeps happening, clear the browser cache or send a screenshot
            with the username you tried to import.
          </small>
        </section>
      </main>
    );
  }
}
