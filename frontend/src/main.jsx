import React from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App";
import "./index.css";
import "./styles/uiFoundation.css";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthDataProvider } from "./context/AuthDataProvider";
import ReferralCaptureNotice from "./components/ReferralCaptureNotice";

const AdminReferralsPage = React.lazy(() => import("./components/AdminReferralsPage"));
const isReferralAdminRoute = window.location.pathname === "/admin/referrals";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthDataProvider>
        <ReferralCaptureNotice />
        <React.Suspense fallback={<main className="routeLoadingFallback" role="status" aria-live="polite"><div aria-hidden="true" /><p>Loading OpeningFit…</p></main>}>
          {isReferralAdminRoute ? <AdminReferralsPage /> : <App />}
        </React.Suspense>
      </AuthDataProvider>
      <Analytics />
    </ErrorBoundary>
  </React.StrictMode>
);


if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
