import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import "./AccountPanel.css";
import { startPremiumCheckout, deleteOpeningFitAccount } from "../accountApi";
import { useAuth } from "../context/AuthDataProvider";
import { logRetentionEvent } from "../services/retentionEvents";

const EMPTY_PROFILE = {
  chesscom_username: "",
  lichess_username: "",
};

const PRE_LOGIN_TEASERS = [
  {
    label: "Opening fit",
    title: "Keep your latest opening diagnosis attached to your account",
    locked: "Saved report preview",
    detail: "Sign in to return to your analysis and compare it with future imports.",
  },
  {
    label: "Progress",
    title: "Track how your repertoire changes over time",
    locked: "Import history preview",
    detail: "Saved reports make it easier to see what improved after your study block.",
  },
  {
    label: "Account",
    title: "Connect Chess.com and Lichess usernames once",
    locked: "Connected account preview",
    detail: "Your usernames stay ready for the next analysis.",
  },
];

function PreLoginCuriosityHooks() {
  return (
    <div className="preLoginCuriosity" aria-label="Locked OpeningFit report previews">
      <div className="preLoginCuriosityHeader">
        <span>Profile preview</span>
        <strong>Build a profile from your real games.</strong>
        <p>Connect an account to keep reports, import history, and profile details together.</p>
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
          <span>Recent activity</span>
          <strong>Your saved reports and latest analysis will appear here after sign-in.</strong>
        </div>
        <small>Account required.</small>
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
    refreshUserData,
    upsertUserData,
  } = useAuth();
  const [isOpen, setIsOpen] = useState(isScreen);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [email, setEmail] = useState("");
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
    if (!user) return "Your OpeningFit profile";
    return user.user_metadata?.full_name || user.email || "Account details";
  }, [user]);

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
    if (!supabase) return;

    setStatus("Opening secure Google sign-in...");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) setStatus(error.message);
  };

  const sendMagicLink = async () => {
    if (!supabase) return;

    if (!email.trim()) {
      setStatus("Enter your email first.");
      return;
    }

    setStatus("Sending login link...");

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setStatus(error.message);
    } else {
      setStatus("Check your email for your login link.");
    }
  };

  const saveProfile = async () => {
    if (!supabase || !user) return;

    setSaving(true);
      setStatus("Saving account details...");

    try {
      await upsertUserData(
        "profiles",
        {
          ...(cloudProfile?.id ? { id: cloudProfile.id } : {}),
          email: user.email || "",
          display_name:
            user.user_metadata?.full_name ||
            user.user_metadata?.display_name ||
            user.email ||
            "",
          chesscom_username: profile.chesscom_username.trim(),
          lichess_username: profile.lichess_username.trim(),
        },
        { onConflict: "user_id" }
      );
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
      setStatus("Account details saved.");
    } catch (error) {
      setSaving(false);
      setStatus(error.message || "Could not save account details.");
    }

  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(EMPTY_PROFILE);
    setStatus("");
    setIsOpen(false);
  };

  const refreshProfile = async () => {
    if (!user) return;
    setStatus("Refreshing profile...");
    try {
      await refreshUserData(user);
      setStatus("Profile refreshed.");
    } catch (error) {
      setStatus(error?.message || "Could not refresh profile.");
    }
  };


  async function handlePremiumCheckout() {
    if (!user) {
      setIsOpen(true);
      setStatus("Sign in first, then you can unlock Founder Pass.");
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
      "Delete your OpeningFit account and saved reports? This cannot be undone."
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
          {user ? "My account" : "Sign in"}
        </button>
      ) : null}

      {isOpen ? (
        <div className={`accountPanel accountPanel--${variant}`}>
          <div className="accountPanelHeader">
            <div>
              <span className="accountEyebrow">Account details</span>
              <h3>{user ? displayName : "Save your OpeningFit profile"}</h3>
              <p>
                {user
                  ? "Manage your connected chess usernames, Founder Pass status, and account actions."
                  : "Sign in to keep saved reports, import history, and account details across devices."}
              </p>
            </div>

            {!isScreen ? (
              <button className="accountCloseBtn" type="button" onClick={() => setIsOpen(false)}>
                ×
              </button>
            ) : null}
          </div>

          {!isSupabaseConfigured ? (
            <div className="accountNotice">
              Account sign-in is not available in this environment yet.
            </div>
          ) : null}

          {accountLoading ? (
            <div className="accountNotice">Refreshing your profile...</div>
          ) : null}

          {accountError ? <div className="accountStatus">{accountError}</div> : null}

          {isSupabaseConfigured && !user ? (
            <div className="accountAuthStack">
              <p>
                Sign in to save your Chess.com and Lichess usernames, keep saved reports,
                and restore Founder Pass access on this device.
              </p>

              <PreLoginCuriosityHooks />

              <button className="googleSignInBtn" type="button" onClick={signInWithGoogle}>
                Continue with Google
              </button>

              <p className="accountBetaNote">
                Google sign-in opens a secure authentication window for OpeningFit.
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
                <span>Founder Pass</span>
                <strong>{hasPremiumAccess ? "Founder Pass active" : "Free account"}</strong>
                <small>
                  {hasPremiumAccess
                    ? "Your supporter access is attached to this account."
                    : "Upgrade when you want saved premium features and deeper report tools."}
                </small>
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


              <div className="accountPremiumBox">
                <div>
                  <strong>{hasPremiumAccess ? "Founder Pass active" : "Founder Pass"}</strong>
                  <p>
                    {hasPremiumAccess
                      ? "Your account has access to supporter features."
                      : "Support OpeningFit and unlock deeper reports on this account."}
                  </p>
                </div>

                {!hasPremiumAccess ? (
                  <button
                    className="accountPrimaryAction"
                    type="button"
                    onClick={handlePremiumCheckout}
                  >
                    Unlock Founder Pass
                  </button>
                ) : (
                  <span className="accountPremiumBadge">Active</span>
                )}
              </div>

              <div className="accountDangerZone">
                <strong>Account actions</strong>
                <p>Manage sign-out and deletion for this OpeningFit account.</p>
                <button
                  className="accountDangerButton"
                  type="button"
                  onClick={handleDeleteAccount}
                >
                  Delete account
                </button>
              </div>

              <div className="accountActions">
                <button type="button" className="saveAccountBtn" onClick={saveProfile} disabled={saving}>
                  {saving ? "Saving..." : "Save account details"}
                </button>

                <button
                  type="button"
                  className="accountSecondaryAction"
                  onClick={refreshProfile}
                >
                  Refresh profile
                </button>

                <button type="button" className="signOutBtn" onClick={signOut}>
                  Sign out
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
