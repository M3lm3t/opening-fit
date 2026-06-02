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
import { startPremiumCheckout, deleteOpeningFitAccount } from "../accountApi";
import { useAuth } from "../context/AuthDataProvider";
import { logRetentionEvent } from "../services/retentionEvents";

const EMPTY_PROFILE = {
  chesscom_username: "",
  lichess_username: "",
};
const AUTH_RETURN_PATH_KEY = "openingFit:authReturnPath";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

function getAuthRedirectTo() {
  const origin = window.location.origin;
  const savedPath = window.localStorage.getItem(AUTH_RETURN_PATH_KEY);
  const currentPath = `${window.location.pathname || "/"}${window.location.search || ""}${window.location.hash || ""}`;
  const returnPath = savedPath || (currentPath === "/login" ? "/" : currentPath);
  const safePath = returnPath.startsWith("/") && !returnPath.startsWith("//") ? returnPath : "/";

  return `${origin}${safePath}`;
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

export default function AccountPanel({ variant = "floating",
  onUserChange,}) {
  const isScreen = variant === "screen";
  const {
    user,
    profile: cloudProfile,
    loading: accountLoading,
    error: accountError,
    hasPremiumAccess,
    profileLoading,
    syncStatus,
    lastSavedAt,
    syncError,
    refreshUserData,
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
  const [saving, setSaving] = useState(false);

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

    setProfile({
      chesscom_username: cloudProfile?.chesscom_username || "",
      lichess_username: cloudProfile?.lichess_username || "",
    });
  }, [cloudProfile, user]);

  const signInWithGoogle = async () => {
    if (!supabase) {
      console.error("OpeningFit signup failed: Supabase client is not configured.");
      setStatus("Supabase is not configured. Add your environment variables first.");
      return;
    }

    setStatus("Opening secure Google sign-in...");

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getAuthRedirectTo(),
        },
      });

      if (error) {
        console.error("OpeningFit Google signup/sign-in failed", error);
        setStatus(error.message || "Could not start Google sign-in.");
        return;
      }

      console.info("OpeningFit Google signup/sign-in started", {
        provider: "google",
        hasUrl: Boolean(data?.url),
      });
    } catch (error) {
      console.error("OpeningFit Google signup/sign-in crashed", error);
      setStatus(error?.message || "Could not start Google sign-in.");
    }
  };

  const sendMagicLink = async () => {
    if (!supabase) {
      console.error("OpeningFit email signup failed: Supabase client is not configured.");
      setStatus("Supabase is not configured. Add your environment variables first.");
      return;
    }

    if (!email.trim()) {
      setStatus("Enter your email first.");
      return;
    }

    setStatus("Sending login link...");

    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: getAuthRedirectTo(),
          shouldCreateUser: true,
        },
      });

      if (error) {
        console.error("OpeningFit email magic-link signup failed", {
          email: email.trim(),
          error,
        });
        setStatus(error.message || "Could not send login link.");
      } else {
        console.info("OpeningFit email magic-link signup requested", {
          email: email.trim(),
          hasUser: Boolean(data?.user),
          hasSession: Boolean(data?.session),
        });
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

  const handleEmailPasswordAuth = async () => {
    if (!supabase) {
      console.error("OpeningFit email auth failed: Supabase client is not configured.");
      setStatus("Supabase is not configured. Add your environment variables first.");
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
          ? await signUpWithEmailPassword({
              email: cleanEmail,
              password,
              displayName: cleanDisplayName || cleanUsername || cleanEmail,
              username: cleanUsername,
              redirectTo: getAuthRedirectTo(),
            })
          : await signInWithEmailPassword({ email: cleanEmail, password });

      if (result.user?.id) {
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

        try {
          await refreshUserData(result.user);
        } catch (refreshError) {
          console.warn("OpeningFit account refresh after email auth failed", refreshError);
        }
      }

      if (authMode === "signup" && result.needsEmailConfirmation) {
        setStatus("Account created. Check your email to confirm before logging in.");
      } else if (authMode === "signup") {
        setStatus(
          result.profileError || profileUpdateFailed
            ? "Account created. Profile details will finish syncing shortly."
            : "Account created and synced."
        );
        setPassword("");
        setConfirmPassword("");
      } else {
        setStatus("Logged in. Your saved OpeningFit data is loaded.");
        setPassword("");
      }
    } catch (error) {
      console.error("OpeningFit email auth failed", {
        mode: authMode,
        email: cleanEmail,
        error,
      });
      setStatus(error?.message || "Supabase could not complete that request.");
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
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(EMPTY_PROFILE);
    setStatus("");
    setIsOpen(false);
  };


  async function handlePremiumCheckout() {
    if (!user) {
      setIsOpen(true);
      setStatus("Please sign in first, then you can unlock premium.");
      return;
    }

    try {
      setStatus("Opening secure Stripe checkout...");
      await startPremiumCheckout(user);
    } catch (error) {
      console.error("Premium checkout failed", error);
      setStatus(error?.message || "Could not start Stripe checkout.");
    }
  }

  async function handleDeleteAccount() {
    if (!user?.id) {
      setStatus("Please sign in before deleting an account.");
      return;
    }

    const confirmed = window.confirm(
      "Delete your Opening Fit account and saved cloud data? This cannot be undone."
    );

    if (!confirmed) return;

    try {
      setStatus("Deleting account...");
      await deleteOpeningFitAccount(user.id);
      await supabase.auth.signOut();
      setProfile(EMPTY_PROFILE);
      setStatus("Account deleted.");
      window.location.reload();
    } catch (error) {
      console.error("Delete account failed", error);
      setStatus(error?.message || "Could not delete account.");
    }
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
              <h3>{user ? "Login and connected accounts" : "Create a secure account"}</h3>
              {isScreen ? (
                <p>
                  {user
                    ? "Manage how you sign in and which chess usernames are attached to this profile."
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
              Supabase is not configured yet. Add your VITE_SUPABASE_URL and
              VITE_SUPABASE_ANON_KEY values to <code>frontend/.env.local</code>.
            </div>
          ) : null}

          {accountLoading ? (
            <div className="accountNotice">Restoring your saved account data...</div>
          ) : null}

          {accountError ? <div className="accountStatus">{accountError}</div> : null}

          {isSupabaseConfigured && !user ? (
            <div className="accountAuthStack">
              <div className="premiumStatusCard accountLoginStatusCard">
                <span>Account status</span>
                <strong>{accountLoading ? "Checking Supabase session..." : "Logged out"}</strong>
                <small>
                  Analyse public games instantly. Create a free account to save reports and sync across devices.
                </small>
              </div>

              <p>
                Sign in to save reports, connect your Chess.com or Lichess username, and keep your profile available across devices.
              </p>

              {!isScreen ? <PreLoginCuriosityHooks /> : null}

              <button
                className="googleSignInBtn"
                type="button"
                onClick={signInWithGoogle}
                disabled={saving || accountLoading || profileLoading}
              >
                Continue with Google
              </button>

              <p className="accountBetaNote">
                Beta note: Google may show our Supabase auth provider during sign-in.
                This is the secure login service OpeningFit uses while in beta.
              </p>

              <div className="accountDivider">
                <span>or</span>
              </div>

              <div className="accountAuthMode" role="tablist" aria-label="Account mode">
                <button
                  type="button"
                  className={authMode === "login" ? "isActive" : ""}
                  onClick={() => {
                    setAuthMode("login");
                    setStatus("");
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

              <button
                className="emailSignInBtn"
                type="button"
                onClick={handleEmailPasswordAuth}
                disabled={saving || accountLoading || profileLoading}
              >
                {saving
                  ? authMode === "signup"
                    ? "Creating account..."
                    : "Logging in..."
                  : authMode === "signup"
                    ? "Create account"
                    : "Log in"}
              </button>

              <p className="accountAuthSwitchHint">
                {authMode === "signup" ? "Already have an account?" : "New to OpeningFit?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === "signup" ? "login" : "signup");
                    setStatus("");
                  }}
                >
                  {authMode === "signup" ? "Log in" : "Create account"}
                </button>
              </p>

              <div className="accountDivider">
                <span>or</span>
              </div>

              <label className="accountLabel">
                Email magic link
                <input
                  type="email"
                  value={email}
                  placeholder="you@example.com"
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>

              <button className="emailSignInBtn" type="button" onClick={sendMagicLink}>
                Send login link
              </button>
            </div>
          ) : null}

          {isSupabaseConfigured && user ? (
            <div className="accountProfileStack">
              <div className="premiumStatusCard">
                <span>Current access</span>
                <strong>{hasPremiumAccess ? "Founder Pass active" : "Free plan"}</strong>
                <small>
                  {hasPremiumAccess
                    ? "Founder Pass access is attached to this account."
                    : "You can upgrade from the Founder Pass card on this page."}
                </small>
              </div>

              <div className="premiumStatusCard accountLoginStatusCard">
                <span>Email / login status</span>
                <strong>{user.email || displayName}</strong>
                <small>
                  Provider: {user.app_metadata?.provider || user.identities?.[0]?.provider || "email"}
                </small>
              </div>

              <div className="premiumStatusCard accountLoginStatusCard">
                <span>Supabase sync</span>
                <strong>
                  {profileLoading
                    ? "Restoring..."
                    : saving
                      ? "Saving..."
                      : syncStatus === "error"
                        ? "Save failed — retry"
                        : "Cloud sync active"}
                </strong>
                <small>
                  Logged in as {user.email || displayName}. Last saved: {formattedLastSaved}
                  {syncError ? ` · ${syncError}` : ""}
                </small>
                {syncStatus === "error" ? (
                  <button
                    className="accountInlineRetry"
                    type="button"
                    onClick={async () => {
                      setStatus("Retrying Supabase profile load...");
                      try {
                        const currentUser = await getCurrentUser();
                        if (!currentUser?.id) {
                          setStatus("Supabase session is no longer active. Please log in again.");
                          return;
                        }

                        const existingProfile = await getUserProfile(currentUser.id);
                        if (!existingProfile) await upsertUserProfile(currentUser);
                        await refreshUserData(currentUser);
                        setStatus("Supabase sync restored.");
                      } catch (retryError) {
                        console.error("OpeningFit Supabase retry failed", retryError);
                        setStatus(retryError?.message || "Supabase retry failed.");
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
                  <strong>{hasPremiumAccess ? "Founder Pass active" : "OpeningFit Founder Pass"}</strong>
                  <p>
                    {hasPremiumAccess
                      ? "Your account has Founder Pass access."
                      : "Support early development and unlock deeper reports on this account."}
                  </p>
                </div>

                {!hasPremiumAccess ? (
                  <button
                    className="accountPrimaryAction"
                    type="button"
                    onClick={handlePremiumCheckout}
                  >
                    Pricing
                  </button>
                ) : (
                  <span className="accountPremiumBadge">Active</span>
                )}
                </div>
              ) : null}

              <div className="accountDangerZone">
                <strong>Delete account</strong>
                <p>You can delete your account and saved data at any time. This action cannot be undone.</p>
                <button
                  className="accountDangerButton"
                  type="button"
                  onClick={handleDeleteAccount}
                >
                  Delete my account
                </button>
              </div>

              <div className="accountActions">
                <button type="button" className="saveAccountBtn" onClick={saveProfile} disabled={saving}>
                  {saving ? "Saving..." : "Save account"}
                </button>

                <button type="button" className="signOutBtn" onClick={signOut}>
                  Log out
                </button>
              </div>
            </div>
          ) : null}

          {status ? <div className="accountStatus">{status}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
