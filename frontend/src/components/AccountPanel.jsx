import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import "./AccountPanel.css";

const EMPTY_PROFILE = {
  chesscom_username: "",
  lichess_username: "",
  is_premium: false,
};

export default function AccountPanel({ variant = "floating" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const user = session?.user || null;

  const displayName = useMemo(() => {
    if (!user) return "Account";
    return user.user_metadata?.full_name || user.email || "My account";
  }, [user]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return undefined;

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data?.session || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !user) {
      setProfile(EMPTY_PROFILE);
      return;
    }

    let mounted = true;

    async function loadProfile() {
      setStatus("");

      const { data, error } = await supabase
        .from("profiles")
        .select("chesscom_username, lichess_username, is_premium")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        setStatus(`Could not load profile: ${error.message}`);
        return;
      }

      if (data) {
        setProfile({
          chesscom_username: data.chesscom_username || "",
          lichess_username: data.lichess_username || "",
          is_premium: Boolean(data.is_premium),
        });
        return;
      }

      const { error: insertError } = await supabase.from("profiles").insert({
        id: user.id,
        email: user.email || "",
        chesscom_username: "",
        lichess_username: "",
        is_premium: false,
      });

      if (!mounted) return;

      if (insertError) {
        setStatus(`Could not create profile: ${insertError.message}`);
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [user]);

  const signInWithGoogle = async () => {
    if (!supabase) return;

    setStatus("Opening Google sign in...");

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
    setStatus("Saving account...");

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email || "",
      chesscom_username: profile.chesscom_username.trim(),
      lichess_username: profile.lichess_username.trim(),
      is_premium: Boolean(profile.is_premium),
    });

    setSaving(false);

    if (error) {
      setStatus(error.message);
    } else {
      setStatus("Account saved.");
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(EMPTY_PROFILE);
    setStatus("");
    setIsOpen(false);
  };

  return (
    <div className={`accountPanelShell accountPanelShell--${variant}`}>
      <button
        className={`accountPill accountPill--${variant} ${user ? "isSignedIn" : ""}`}
        type="button"
        onClick={() => setIsOpen((value) => !value)}
      >
        <span className="accountDot" />
        {user ? "My account" : variant === "landing" ? "Sign in to save reports" : "Sign in"}
      </button>

      {isOpen ? (
        <div className={`accountPanel accountPanel--${variant}`}>
          <div className="accountPanelHeader">
            <div>
              <span className="accountEyebrow">OpeningFit account</span>
              <h3>{user ? displayName : "Save your reports"}</h3>
            </div>

            <button className="accountCloseBtn" type="button" onClick={() => setIsOpen(false)}>
              ×
            </button>
          </div>

          {!isSupabaseConfigured ? (
            <div className="accountNotice">
              Supabase is not configured yet. Add your VITE_SUPABASE_URL and
              VITE_SUPABASE_ANON_KEY values to <code>frontend/.env.local</code>.
            </div>
          ) : null}

          {isSupabaseConfigured && !user ? (
            <div className="accountAuthStack">
              <p>
                Sign in to save your Chess.com/Lichess usernames, keep your reports,
                and unlock premium features later.
              </p>

              <button className="googleSignInBtn" type="button" onClick={signInWithGoogle}>
                Continue with Google
              </button>

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
                <span>Premium status</span>
                <strong>{profile.is_premium ? "Premium active" : "Free account"}</strong>
                <small>
                  Payments will connect here next. For now this field is ready for Stripe.
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

              <div className="accountActions">
                <button type="button" className="saveAccountBtn" onClick={saveProfile} disabled={saving}>
                  {saving ? "Saving..." : "Save account"}
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
