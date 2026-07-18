import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import {
  signInWithEmailPassword,
  signUpWithEmailPassword,
  getCurrentUser,
  getUserProfile,
  upsertUserProfile,
} from "../services/userDataService";
import "./AccountPanel.css";
import { createSubscriptionPortalSession, deleteOpeningFitAccount } from "../accountApi";
import { useAuth } from "../context/AuthDataProvider";
import { logRetentionEvent } from "../services/retentionEvents";
import { trackProductEvent } from "../lib/productAnalytics";
import ReferralCodeEntry from "./ReferralCodeEntry";
import { SUPPORT_EMAIL, supportMailto } from "../lib/supportConfig.js";

const EMPTY_PROFILE = {
  chesscom_username: "",
  lichess_username: "",
};
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const AUTH_REQUEST_TIMEOUT_MS = 12000;
const SUPPORT_MAILTO = supportMailto("OpeningFit support");
const DELETE_REQUEST_MAILTO = supportMailto("OpeningFit account deletion request");
const PRODUCTION_AUTH_ORIGIN = "https://www.openingfit.com";
const GOOGLE_SIGN_IN_ENABLED = true;
const GOOGLE_PROVIDER_UNAVAILABLE_MESSAGE =
  "Google sign-in is taking too long at the auth provider. Email login and login links are still available.";

function getStableAuthRedirectTo() {
  if (typeof window === "undefined") return `${PRODUCTION_AUTH_ORIGIN}/account`;

  const { hostname, origin } = window.location;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const authOrigin =
    isLocalhost || hostname.endsWith(".localhost")
      ? origin
      : hostname === "www.openingfit.com" || hostname === "openingfit.com" || hostname.endsWith(".vercel.app")
        ? PRODUCTION_AUTH_ORIGIN
        : origin;

  return `${authOrigin}/account`;
}

async function withAuthTimeout(request, message = "Supabase auth is taking too long. Please try again shortly.") {
  let timeoutId;
  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise((_, reject) => {
        timeoutId = globalThis.setTimeout(() => reject(new Error(message)), AUTH_REQUEST_TIMEOUT_MS);
      }),
    ]);
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

const PRE_LOGIN_TEASERS = [
  {
    label: "Weakness scan",
    title: "We found 3 weaknesses in your opening prep",
    locked: "French pressure point",
    detail: "One defence keeps dragging you into positions where your plan disappears.",
  },
  {
    label: "Hidden strength",
    title: "Your actual strongest opening may surprise you",
    locked: "Best scoring line hidden",
    detail: "Most players guess their best opening wrong because memory favors dramatic wins.",
  },
  {
    label: "Confidence leak",
    title: "Most players misuse their best openings",
    locked: "Move 8 confidence drop",
    detail: "The report shows where the opening stops feeling familiar and starts costing decisions.",
  },
];

function PreLoginCuriosityHooks() {
  return (
    <div className="preLoginCuriosity" aria-label="Locked OpeningFit report previews">
      <div className="preLoginCuriosityHeader">
        <span>Locked report preview</span>
        <strong>Your openings are probably telling on you.</strong>
        <p>Connect an account to keep reports and reveal the personal patterns behind your results.</p>
      </div>

      <div className="preLoginTeaserGrid">
        {PRE_LOGIN_TEASERS.map((item) => (
          <article className="preLoginTeaserCard" key={item.title}>
            <div className="preLoginTeaserTop">
              <span>{item.label}</span>
              <small>Locked</small>
            </div>
            <h4>{item.title}</h4>
            <div className="blurredInsightReport" aria-hidden="true">
              <strong>{item.locked}</strong>
              <p>{item.detail}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="preLoginLockedInsight">
        <div>
          <span>Curiosity hook</span>
          <strong>See which opening your opponents should keep choosing against you.</strong>
        </div>
        <small>Personal report locked until sign-in.</small>
      </div>
    </div>
  );
}

function entitlementDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(date);
}

function SubscriptionManagement({
  entitlement,
  loading,
  checkoutLoading,
  portalLoading,
  portalError,
  onUpgrade,
  onManage,
}) {
  if (loading) {
    return <section className="accountSubscriptionCard" aria-busy="true"><span>Subscription</span><strong>Loading your access...</strong><p>Checking the protected entitlement attached to this account.</p></section>;
  }

  const accessType = entitlement?.accessType || "free";
  const status = entitlement?.status || "expired";
  const periodDate = entitlementDate(entitlement?.currentPeriodEnd);
  const isSubscriber = accessType === "monthly_subscription" || accessType === "annual_subscription";
  const isLifetime = accessType === "lifetime";
  const planName = accessType === "monthly_subscription"
    ? "OpeningFit Monthly"
    : accessType === "annual_subscription"
      ? "OpeningFit Annual"
      : isLifetime
        ? "OpeningFit Lifetime"
        : "OpeningFit Free";
  const accessLabel = accessType.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
  const statusLabel = accessType === "free"
    ? "Not subscribed"
    : status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
  const canManage = Boolean(
    entitlement?.stripeCustomerId
    && (isSubscriber || (isLifetime && entitlement?.stripeSubscriptionId))
  );
  const badgeLabel = entitlement?.hasPremiumAccess ? "Active" : accessType === "free" ? "Free" : "Inactive";

  let dateMessage = "No renewal date applies to free access.";
  if (isLifetime) dateMessage = "Lifetime access";
  else if ((status === "past_due" || status === "incomplete") && entitlement?.hasPremiumAccess) {
    dateMessage = periodDate ? `Payment needs attention. Access remains active until ${periodDate}.` : "Payment needs attention.";
  } else if (status === "past_due" || status === "incomplete") {
    dateMessage = "Payment needs attention";
  } else if (periodDate && (entitlement?.cancelAtPeriodEnd || status === "canceled")) {
    dateMessage = `Access remains active until ${periodDate}.`;
  } else if (periodDate && isSubscriber) {
    dateMessage = `Renews on ${periodDate}.`;
  } else if (isSubscriber) {
    dateMessage = "Stripe is still confirming the next billing date.";
  }

  return (
    <section className="accountSubscriptionCard" aria-labelledby="account-subscription-title">
      <div className="accountSubscriptionHeader">
        <div><span>Subscription</span><strong id="account-subscription-title">{planName}</strong></div>
        <em className={entitlement?.hasPremiumAccess ? "isActive" : ""}>{badgeLabel}</em>
      </div>
      <dl className="accountSubscriptionDetails">
        <div><dt>Access type</dt><dd>{accessLabel}</dd></div>
        <div><dt>Subscription status</dt><dd>{statusLabel}</dd></div>
        <div><dt>Cancellation scheduled</dt><dd>{isSubscriber ? (entitlement?.cancelAtPeriodEnd ? "Yes" : "No") : "Not applicable"}</dd></div>
        <div><dt>Renewal or access end</dt><dd>{isLifetime ? "Lifetime access" : periodDate || "Not available"}</dd></div>
      </dl>
      <p>{dateMessage}</p>
      {portalError ? <p className="accountSubscriptionError" role="alert">{portalError}</p> : null}
      <div className="accountSubscriptionActions">
        {canManage ? <button type="button" onClick={onManage} disabled={portalLoading}>{portalLoading ? "Opening Stripe..." : "Manage subscription"}</button> : null}
        {accessType === "free" ? <button type="button" onClick={onUpgrade} disabled={checkoutLoading}>{checkoutLoading ? "Opening checkout..." : "Upgrade OpeningFit"}</button> : null}
      </div>
      {isSubscriber && !canManage ? <small>No Stripe customer account is linked yet. Refresh after Stripe finishes synchronising.</small> : null}
    </section>
  );
}

export default function AccountPanel({ variant = "floating",
  onUserChange,
  onCloudRestore,
}) {
  const isScreen = variant === "screen";
  const {
    user,
    profile: cloudProfile,
    loading: accountLoading,
    error: accountError,
    hasPremiumAccess,
    entitlement,
    profileLoading,
    profileLoaded,
    profileError,
    authLoading,
    hydrated: authHydrated,
    restoreInProgress,
    syncStatus,
    lastSavedAt,
    syncError,
    refreshUserData,
    signOut: signOutAccount,
  } = useAuth();
  const [isOpen, setIsOpen] = useState(isScreen);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [signupDisplayName, setSignupDisplayName] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [status, setStatus] = useState("");
  const [googleRedirectUrl, setGoogleRedirectUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState("");
  const authBusy = saving || oauthLoading || accountLoading || !authHydrated;

  useEffect(() => {
    if (isScreen) setIsOpen(true);
  }, [isScreen]);

  useEffect(() => {
    if (typeof onUserChange === "function") {
      onUserChange(user);
    }
  }, [user, onUserChange]);

  const displayName = useMemo(() => {
    if (!user) return "Account";
    return user.user_metadata?.full_name || user.email || "My account";
  }, [user]);

  const formattedLastSaved = useMemo(() => {
    if (!lastSavedAt) return "Not saved yet";
    const date = new Date(lastSavedAt);
    if (Number.isNaN(date.getTime())) return "Not saved yet";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [lastSavedAt]);

  useEffect(() => {
    if (!user) {
      setProfile(EMPTY_PROFILE);
      return;
    }

    if (!profileLoaded || profileLoading) return;

    setProfile({
      chesscom_username: cloudProfile?.chesscom_username || "",
      lichess_username: cloudProfile?.lichess_username || "",
    });
  }, [cloudProfile, profileLoaded, profileLoading, user]);

  const signInWithGoogle = async () => {
    if (!supabase) {
      console.error("OpeningFit signup failed: Supabase client is not configured.");
      setStatus("Secure sign-in is not connected in this environment.");
      return;
    }

    setStatus("Opening secure Google sign-in...");
    setGoogleRedirectUrl("");
    setOauthLoading(true);

    try {
      const { data, error } = await withAuthTimeout(
        supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: getStableAuthRedirectTo(),
            skipBrowserRedirect: true,
            queryParams: {
              prompt: "select_account",
            },
          },
        }),
        "Google sign-in is taking too long. Please try email login or try again shortly."
      );

      if (error) {
        console.error("OpeningFit Google signup/sign-in failed", error);
        setStatus(error.message || "Could not start Google sign-in.");
        return;
      }

      if (data?.url) {
        const googleWindow = window.open(data.url, "_blank", "noopener,noreferrer");

        if (googleWindow) {
          setGoogleRedirectUrl("");
          setStatus(
            "Google sign-in opened in a new tab. If it times out, use email login or send yourself a login link below."
          );
        } else {
          setGoogleRedirectUrl(data.url);
          setStatus("Your browser blocked the Google sign-in tab. Use the secure link below or try email login.");
        }
        return;
      }

      setStatus("Google sign-in could not open. Please try email login.");

      if (import.meta.env.DEV) {
        console.info("OpeningFit Google signup/sign-in started", {
          provider: "google",
          hasUrl: Boolean(data?.url),
        });
      }
    } catch (error) {
      console.error("OpeningFit Google signup/sign-in crashed", error);
      setStatus(error?.message || GOOGLE_PROVIDER_UNAVAILABLE_MESSAGE);
    } finally {
      setOauthLoading(false);
    }
  };

  const sendMagicLink = async () => {
    if (!supabase) {
      console.error("OpeningFit email signup failed: Supabase client is not configured.");
      setStatus("Secure sign-in is not connected in this environment.");
      return;
    }

    if (!email.trim()) {
      setStatus("Enter your email first.");
      return;
    }

    setStatus("Sending login link...");

    try {
      const { data, error } = await withAuthTimeout(
        supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            emailRedirectTo: getStableAuthRedirectTo(),
            shouldCreateUser: true,
          },
        })
      );

      if (error) {
        console.error("OpeningFit email magic-link signup failed", {
          email: email.trim(),
          error,
        });
        setStatus(error.message || "Could not send login link.");
      } else {
        if (import.meta.env.DEV) {
          console.info("OpeningFit email magic-link signup requested", {
            email: email.trim(),
            hasUser: Boolean(data?.user),
            hasSession: Boolean(data?.session),
          });
        }
        setStatus("Check your email for your login link.");
      }
    } catch (error) {
      console.error("OpeningFit email magic-link signup crashed", {
        email: email.trim(),
        error,
      });
      setStatus(error?.message || "Could not send login link.");
    }
  };

  const handleEmailPasswordAuth = async (event) => {
    event?.preventDefault?.();

    if (!supabase) {
      console.error("OpeningFit email auth failed: Supabase client is not configured.");
      setStatus("Secure sign-in is not connected in this environment.");
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanDisplayName = signupDisplayName.trim();
    const cleanUsername = signupUsername.trim();

    if (!cleanEmail) {
      setStatus("Enter your email first.");
      return;
    }

    if (!EMAIL_PATTERN.test(cleanEmail)) {
      setStatus("Enter a valid email address.");
      return;
    }

    if (!password) {
      setStatus("Enter your password first.");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setStatus(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (authMode === "signup" && !confirmPassword) {
      setStatus("Confirm your password first.");
      return;
    }

    if (authMode === "signup" && password !== confirmPassword) {
      setStatus("Passwords do not match.");
      return;
    }

    setSaving(true);
    setStatus(authMode === "signup" ? "Creating your OpeningFit account..." : "Logging in...");

    try {
      let profileUpdateFailed = false;
      const result =
        authMode === "signup"
          ? await withAuthTimeout(
              signUpWithEmailPassword({
                email: cleanEmail,
                password,
                displayName: cleanDisplayName || cleanUsername || cleanEmail,
                username: cleanUsername,
                redirectTo: getStableAuthRedirectTo(),
              })
            )
          : await withAuthTimeout(signInWithEmailPassword({ email: cleanEmail, password }));

      const hasAuthenticatedSession = Boolean(result.session);

      if (result.user?.id && hasAuthenticatedSession) {
        if (authMode === "signup" && result.session) {
          try {
            await upsertUserProfile(result.user, {
              display_name: cleanDisplayName || cleanUsername || cleanEmail,
              username: cleanUsername || null,
              chesscom_username: cleanUsername || "",
            });
          } catch (profileError) {
            profileUpdateFailed = true;
            console.warn("OpeningFit profile update after signup failed; restore will retry later.", profileError);
          }
        }

        // AuthDataProvider owns the post-auth cloud restore.
      }

      if (authMode === "signup" && result.needsEmailConfirmation) {
        setStatus("Account created. Check your email to confirm before logging in.");
      } else if (authMode === "signup") {
        setStatus(
          result.profileError || profileUpdateFailed
            ? "Account created. Profile details will finish syncing shortly."
            : "Your account was created. You can now continue."
        );
        setPassword("");
        setConfirmPassword("");
        void trackProductEvent("account_created", { authenticated: true, source: "email_account" });
      } else {
        setStatus("Logged in. Your saved OpeningFit data is loaded.");
        setPassword("");
        void trackProductEvent("sign_in_completed", { authenticated: true, source: "email_account" });
      }
    } catch (error) {
      console.error("OpeningFit email auth failed", {
        mode: authMode,
        email: cleanEmail,
        error,
      });
      setStatus(error?.message || "We could not complete that account request. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async () => {
    if (!supabase || !user) return;

    setSaving(true);
    setStatus("Saving account...");

    try {
      await upsertUserProfile(user, {
        ...(cloudProfile?.id ? { id: cloudProfile.id } : {}),
        chesscom_username: profile.chesscom_username.trim(),
        lichess_username: profile.lichess_username.trim(),
      });
      await refreshUserData(user);
      logRetentionEvent(
        "profile_updated",
        {
          source: "account_panel",
          hasChesscomUsername: Boolean(profile.chesscom_username.trim()),
          hasLichessUsername: Boolean(profile.lichess_username.trim()),
        },
        {
          dedupeKey: `${user.id}:${profile.chesscom_username.trim()}:${profile.lichess_username.trim()}`,
        }
      );

      setSaving(false);
      setStatus("Account saved.");
    } catch (error) {
      console.error("OpeningFit profile save failed", {
        userId: user.id,
        email: user.email,
        error,
      });
      setSaving(false);
      setStatus(error.message || "Could not save account.");
    }

  };

  const signOut = async () => {
    if (!signOutAccount) return;
    setSaving(true);
    setStatus("Logging out...");
    try {
      await signOutAccount();
      setProfile(EMPTY_PROFILE);
      setStatus("");
      setIsOpen(false);
    } catch (error) {
      console.warn("OpeningFit sign out cleanup failed", error);
      setStatus("You were logged out on this device. Refresh if the account panel still appears signed in.");
    } finally {
      setSaving(false);
    }
  };


  async function handlePremiumCheckout() {
    if (!user) {
      setIsOpen(true);
      setStatus("Please sign in or create an account before upgrading.");
      return;
    }

    if (checkoutLoading) return;

    setCheckoutLoading(true);
    setPortalError("");
    setStatus("Opening monthly and annual plans...");
    void trackProductEvent("upgrade_clicked", { authenticated: true, source: "account_subscription" });
    window.location.assign("/premium");
  }

  async function handleManageSubscription() {
    if (!user?.id || portalLoading) return;
    setPortalLoading(true);
    setPortalError("");
    void trackProductEvent("subscription_manage_clicked", { authenticated: true, source: "account_subscription" });
    try {
      const portalUrl = await createSubscriptionPortalSession(user);
      window.location.assign(portalUrl);
    } catch (error) {
      console.error("OpeningFit subscription portal failed", error);
      const message = error?.message || "We could not open subscription management. Please try again.";
      setPortalError(message);
      void trackProductEvent("portal_open_failed", { authenticated: true, source: "account_subscription", errorCategory: "portal_unavailable" });
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleDeleteAccount() {
    if (!user?.id) {
      setStatus("Please sign in before deleting an account.");
      return;
    }

    const confirmed = window.confirm(
      "Permanently delete your OpeningFit profile, saved reports, analysed games, repertoire, training and progress data? Stripe may retain transaction records required for accounting. This cannot be undone."
    );

    if (!confirmed) return;

    try {
      setStatus("Deleting account...");
      await deleteOpeningFitAccount(user.id);
      await signOutAccount?.();
      Object.keys(localStorage).filter((key) => key.startsWith("openingFit:") || key.startsWith("openingfit:")).forEach((key) => localStorage.removeItem(key));
      setProfile(EMPTY_PROFILE);
      setStatus("Account deleted.");
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      console.error("Delete account failed", error);
      setStatus(error?.message || "Could not delete account.");
    }
  }

  function handleRequestDeleteAccount(event) {
    event?.preventDefault?.();
    window.location.href = `${DELETE_REQUEST_MAILTO}&body=${encodeURIComponent(
      `Please delete my OpeningFit account and saved cloud data.\n\nAccount email: ${user?.email || ""}`
    )}`;
  }

  async function handleCloudRestoreClick(event) {
    if (!onCloudRestore) {
      setStatus("Cloud restore is not available here.");
      return;
    }

    setStatus("Restoring cloud data...");
    const result = await onCloudRestore(event);
    setStatus(result?.reason || (result?.ok ? "Cloud data restored." : "Cloud restore failed."));
  }


  useEffect(() => {
    const handleFounderPassIntent = () => {
      setIsOpen(true);

      setTimeout(() => {
        const panel =
          document.getElementById("account") ||
          document.getElementById("login") ||
          document.querySelector(".accountPanel") ||
          document.querySelector(".account-panel") ||
          document.querySelector("[data-section='account']");

        if (panel && panel.scrollIntoView) {
          panel.scrollIntoView({ behavior: "smooth", block: "center" });
        }

        const paymentArea =
          document.getElementById("payment") ||
          document.getElementById("checkout") ||
          panel?.querySelector?.("[data-section='payment']") ||
          panel?.querySelector?.("[data-section='checkout']") ||
          panel?.querySelector?.(".checkout") ||
          panel?.querySelector?.(".payment");

        if (paymentArea && paymentArea.scrollIntoView) {
          paymentArea.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 180);
    };

    window.addEventListener("openingfit:founder-pass-intent", handleFounderPassIntent);

    return () => {
      window.removeEventListener("openingfit:founder-pass-intent", handleFounderPassIntent);
    };
  }, []);



  return (
    <div className={`accountPanelShell accountPanelShell--${variant}`}>
      {!isScreen ? (
        <button
          className={`accountPill accountPill--${variant} ${user ? "isSignedIn" : ""}`}
          type="button"
          onClick={() => setIsOpen((value) => !value)}
        >
          <span className="accountDot" />
          {user ? "Account" : "Login"}
        </button>
      ) : null}

      {isOpen ? (
        <div className={`accountPanel accountPanel--${variant}`}>
          <div className="accountPanelHeader">
            <div>
              <span className="accountEyebrow">Account security</span>
              <h3>{user ? "Account details" : "Create a secure account"}</h3>
              {isScreen ? (
                <p>
                  {user
                    ? "Manage sign-in, chess usernames, sync, and account actions."
                    : "Sign in to keep saved reports and chess account details attached to your OpeningFit account."}
                </p>
              ) : null}
            </div>

            {!isScreen ? (
              <button className="accountCloseBtn" type="button" onClick={() => setIsOpen(false)}>
                ×
              </button>
            ) : null}
          </div>

          {!isSupabaseConfigured ? (
            <div className="accountNotice">
              Secure sign-in is not connected in this environment. You can still analyse games locally.
            </div>
          ) : null}

          {accountLoading ? (
            <div className="accountNotice">Restoring your saved account data...</div>
          ) : null}

          {accountError ? <div className="accountStatus">{accountError}</div> : null}
          {profileError && profileError !== accountError ? (
            <div className="accountStatus">{profileError}</div>
          ) : null}

          {isSupabaseConfigured && !user ? (
            <form className="accountAuthStack" onSubmit={handleEmailPasswordAuth}>
              <div className="accountAuthIntro">
                <span>Free account</span>
                <strong>{accountLoading ? "Checking your session..." : "Save reports across devices"}</strong>
                <p>Log in with your email and password, or send yourself a secure login link.</p>
              </div>

              {!isScreen ? <PreLoginCuriosityHooks /> : null}

              {GOOGLE_SIGN_IN_ENABLED ? (
                <>
                  <button
                    className="googleSignInBtn"
                    type="button"
                    onClick={signInWithGoogle}
                    disabled={authBusy}
                  >
                    Continue with Google
                  </button>

                  <p className="accountBetaNote">
                    Beta note: Google may show OpeningFit's secure auth provider during sign-in.
                  </p>

                  <div className="accountDivider">
                    <span>or</span>
                  </div>
                </>
              ) : (
                <div className="accountNotice accountProviderNotice" role="status">
                  Google sign-in is temporarily unavailable while the auth provider is timing out. Use email login
                  or send a login link below.
                </div>
              )}

              <div className="accountAuthMode" role="tablist" aria-label="Account mode">
                <button
                  type="button"
                  className={authMode === "login" ? "isActive" : ""}
                  onClick={() => {
                    setAuthMode("login");
                    setStatus("");
                    setGoogleRedirectUrl("");
                  }}
                >
                  Log in
                </button>
                <button
                  type="button"
                  className={authMode === "signup" ? "isActive" : ""}
                  onClick={() => {
                    setAuthMode("signup");
                    setStatus("");
                    setGoogleRedirectUrl("");
                  }}
                >
                  Create account
                </button>
              </div>

              {authMode === "signup" ? (
                <>
                  <label className="accountLabel">
                    Display name
                    <input
                      type="text"
                      value={signupDisplayName}
                      placeholder="Your name"
                      autoComplete="name"
                      onChange={(event) => setSignupDisplayName(event.target.value)}
                    />
                  </label>

                  <label className="accountLabel">
                    Chess username
                    <input
                      type="text"
                      value={signupUsername}
                      placeholder="Optional, e.g. melmet"
                      autoComplete="username"
                      onChange={(event) => setSignupUsername(event.target.value)}
                    />
                  </label>
                </>
              ) : null}

              <label className="accountLabel">
                Email
                <input
                  type="email"
                  value={email}
                  placeholder="you@example.com"
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>

              <label className="accountLabel">
                Password
                <input
                  type="password"
                  value={password}
                  placeholder="Minimum 6 characters"
                  autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>

              {authMode === "signup" ? (
                <label className="accountLabel">
                  Confirm password
                  <input
                    type="password"
                    value={confirmPassword}
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </label>
              ) : null}

              {authMode === "signup" ? <ReferralCodeEntry /> : null}

              <button
                className="emailSignInBtn"
                type="submit"
                disabled={authBusy}
              >
                {saving
                  ? authMode === "signup"
                    ? "Creating account..."
                    : "Logging in..."
                  : authMode === "signup"
                    ? "Create free account"
                    : "Log in"}
              </button>

              <p className="accountAuthSwitchHint">
                {authMode === "signup" ? "Already have an account?" : "New to OpeningFit?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === "signup" ? "login" : "signup");
                    setStatus("");
                    setGoogleRedirectUrl("");
                  }}
                >
                  {authMode === "signup" ? "Log in" : "Create one"}
                </button>
              </p>

              <button
                className="accountTextButton"
                type="button"
                onClick={sendMagicLink}
                disabled={authBusy}
              >
                Send login link
              </button>

              {status ? (
                <div className="accountStatus accountAuthStatus" role="status" aria-live="polite">
                  {status}
                  {googleRedirectUrl ? (
                    <a className="accountStatusLink" href={googleRedirectUrl} target="_blank" rel="noreferrer">
                      Open Google sign-in
                    </a>
                  ) : null}
                </div>
              ) : null}
            </form>
          ) : null}

          {isSupabaseConfigured && user ? (
            <div className="accountProfileStack">
              <SubscriptionManagement
                entitlement={entitlement}
                loading={profileLoading || !profileLoaded}
                checkoutLoading={checkoutLoading}
                portalLoading={portalLoading}
                portalError={portalError}
                onUpgrade={handlePremiumCheckout}
                onManage={handleManageSubscription}
              />

              <div className="premiumStatusCard accountLoginStatusCard">
                <span>Email / login status</span>
                <strong>{user.email || displayName}</strong>
                <small>
                  Provider: {user.app_metadata?.provider || user.identities?.[0]?.provider || "email"}
                </small>
              </div>

              <div className="premiumStatusCard accountLoginStatusCard">
                <span>Account sync</span>
                <strong>
                  {profileLoading || !profileLoaded
                    ? "Restoring..."
                    : saving
                      ? "Saving..."
                      : syncStatus === "error"
                        ? "Save failed - retry"
                        : "Cloud sync active"}
                </strong>
                <small>
                  Logged in as {user.email || displayName}. Last saved: {formattedLastSaved}
                  {syncError ? ` - ${syncError}` : ""}
                </small>
                {syncStatus === "error" ? (
                  <button
                    className="accountInlineRetry"
                    type="button"
                    onClick={async () => {
                      setStatus("Retrying account sync...");
                      try {
                        const currentUser = await getCurrentUser();
                        if (!currentUser?.id) {
                          setStatus("Your session is no longer active. Please log in again.");
                          return;
                        }

                        const existingProfile = await getUserProfile(currentUser.id);
                        if (!existingProfile) await upsertUserProfile(currentUser);
                        await refreshUserData(currentUser);
                        setStatus("Account sync restored.");
                      } catch (retryError) {
                        console.error("OpeningFit account sync retry failed", retryError);
                        setStatus(retryError?.message || "Sync retry failed.");
                      }
                    }}
                  >
                    Retry sync
                  </button>
                ) : null}
              </div>

              <label className="accountLabel">
                Chess.com username
                <input
                  value={profile.chesscom_username}
                  placeholder="e.g. melmet"
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      chesscom_username: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="accountLabel">
                Lichess username
                <input
                  value={profile.lichess_username}
                  placeholder="e.g. DrNykterstein"
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      lichess_username: event.target.value,
                    }))
                  }
                />
              </label>


              {!isScreen ? (
                <div className="accountPremiumBox">
                <div>
                  <strong>{hasPremiumAccess ? "Paid access active" : "OpeningFit Plus"}</strong>
                  <p>
                    {hasPremiumAccess
                      ? "Your account has paid or preserved lifetime access."
                      : "Choose monthly or annual access for ongoing repertoire and training tools."}
                  </p>
                </div>

                {!hasPremiumAccess ? (
                  <button
                    className="accountPrimaryAction"
                    type="button"
                    onClick={handlePremiumCheckout}
                    disabled={checkoutLoading}
                  >
                    {checkoutLoading ? "Opening checkout..." : "Pricing"}
                  </button>
                ) : (
                  <span className="accountPremiumBadge">Active</span>
                )}
                </div>
              ) : null}

              <div className="accountDangerZone">
                <strong>Delete account</strong>
                <p>Deletes your profile, reports, analysed games, repertoire, training and progress data. Stripe may retain transaction records required for accounting. Confirmation is required.</p>
                <button
                  className="accountDangerButton"
                  type="button"
                  onClick={handleDeleteAccount}
                >
                  Delete my account
                </button>
                <a className="accountDangerLink" href={DELETE_REQUEST_MAILTO} onClick={handleRequestDeleteAccount}>
                  Request account deletion by email
                </a>
              </div>

              <div className="accountActions">
                <button
                  type="button"
                  className="saveAccountBtn"
                  onClick={saveProfile}
                  disabled={saving || profileLoading || !profileLoaded}
                >
                  {saving ? "Saving..." : "Save account"}
                </button>

                <button
                  type="button"
                  className="saveAccountBtn"
                  onClick={handleCloudRestoreClick}
                  disabled={
                    saving ||
                    authLoading ||
                    !authHydrated ||
                    profileLoading ||
                    !profileLoaded ||
                    restoreInProgress
                  }
                >
                  {restoreInProgress ? "Restoring..." : "Cloud Restore"}
                </button>

                <button type="button" className="signOutBtn" onClick={signOut}>
                  Sign out
                </button>
              </div>
            </div>
          ) : null}

          {status && user ? <div className="accountStatus">{status}</div> : null}

          <nav className="accountLegalLinks" aria-label="Account help and legal links">
            <a href="#privacy">Privacy Policy</a>
            <a href="#terms">Terms</a>
            <a href={SUPPORT_MAILTO}>Support</a>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
