import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import {
  deleteUserRow,
  fetchAllUserData,
  recordActivity,
  saveReport,
  saveSettings,
  uploadUserFile,
  upsertUserRow,
} from "../services/userDataService";

const AuthDataContext = createContext(null);

const LEGACY_KEY_PREFIXES = ["openingFit:", "openingfit."];
const LEGACY_EXACT_KEYS = ["openingfit_landing_seen"];
const RESTORE_TIMEOUT_MS = 8000;

function createRestoreTimeout() {
  let timeoutId;
  const promise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      const error = new Error("Workspace restore timed out.");
      error.name = "WorkspaceRestoreTimeout";
      reject(error);
    }, RESTORE_TIMEOUT_MS);
  });

  return {
    promise,
    clear: () => window.clearTimeout(timeoutId),
  };
}

async function withRestoreTimeout(work, label = "workspace restore") {
  const timeout = createRestoreTimeout();

  try {
    return await Promise.race([work, timeout.promise]);
  } catch (restoreError) {
    if (restoreError?.name === "WorkspaceRestoreTimeout") {
      console.warn(`OpeningFit ${label} timed out; continuing with default workspace.`);
    }
    throw restoreError;
  } finally {
    timeout.clear();
  }
}

function isPersistedLegacyKey(key) {
  return (
    LEGACY_EXACT_KEYS.includes(key) ||
    LEGACY_KEY_PREFIXES.some((prefix) => String(key).startsWith(prefix))
  );
}

function readLegacyStorageSnapshot() {
  const snapshot = {};

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && isPersistedLegacyKey(key)) {
        snapshot[key] = window.localStorage.getItem(key);
      }
    }
  } catch {
    return {};
  }

  return snapshot;
}

function hydrateLegacyStorage(snapshot = {}) {
  try {
    Object.entries(snapshot).forEach(([key, value]) => {
      if (isPersistedLegacyKey(key) && value !== null && value !== undefined) {
        window.localStorage.setItem(key, value);
      }
    });
  } catch {
    // Browser storage can be unavailable in private contexts.
  }
}

export function AuthDataProvider({ children }) {
  const [session, setSession] = useState(null);
  const [userData, setUserData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState("");
  const [restoreError, setRestoreError] = useState("");
  const [restoreTimedOut, setRestoreTimedOut] = useState(false);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const debounceRef = useRef(null);
  const userRef = useRef(null);
  const restoreSeqRef = useRef(0);

  const user = session?.user || null;
  userRef.current = user;

  const refreshUserData = useCallback(
    async (nextUser = userRef.current, options = {}) => {
      const applyState = options.applyState !== false;
      const restoreSeq = options.restoreSeq ?? ++restoreSeqRef.current;

      if (!isSupabaseConfigured || !supabase || !nextUser?.id) {
        if (applyState) {
          setUserData(null);
          setHydrated(true);
          setProfileLoading(false);
        }
        return null;
      }

      setError("");
      setRestoreError("");
      setRestoreTimedOut(false);
      if (applyState) setProfileLoading(true);

      try {
        const data = await withRestoreTimeout(
          fetchAllUserData(nextUser),
          "workspace table restore"
        );
        if (applyState && restoreSeq === restoreSeqRef.current) {
          setUserData(data || null);
          hydrateLegacyStorage(data?.settings?.[0]?.preferences?.legacyStorage || {});
          setHydrated(true);
        }
        return data;
      } catch (refreshError) {
        console.warn("OpeningFit could not restore saved workspace; using default state.", refreshError);
        if (applyState && restoreSeq === restoreSeqRef.current) {
          const message = refreshError.message || "Could not load your saved data.";
          setError(message);
          setRestoreError(message);
          setUserData(null);
          setHydrated(true);
        }
        throw refreshError;
      } finally {
        if (applyState && restoreSeq === restoreSeqRef.current) {
          setHydrated(true);
          setProfileLoading(false);
        }
      }
    },
    []
  );

  const retryRestore = useCallback(async () => {
    let nextUser = userRef.current;
    setRestoreAttempt((value) => value + 1);
    setRestoreError("");
    setRestoreTimedOut(false);

    if (!nextUser?.id) {
      setAuthLoading(true);
      try {
        const { data, error: sessionError } = await withRestoreTimeout(
          supabase.auth.getSession(),
          "manual auth session restore"
        );
        if (sessionError) throw sessionError;

        const nextSession = data?.session || null;
        setSession(nextSession);
        setAuthLoading(false);

        if (!nextSession?.user) {
          setHydrated(true);
          return null;
        }

        nextUser = nextSession.user;
      } catch (authRetryError) {
        const timedOut = authRetryError?.name === "WorkspaceRestoreTimeout";
        console.error("OpeningFit Supabase query failed", {
          table: "auth.sessions",
          operation: "manual auth/session retry",
          error: authRetryError,
        });
        setAuthLoading(false);
        setRestoreTimedOut(timedOut);
        setRestoreError(
          timedOut
            ? "Supabase auth restore timed out. You can keep using OpeningFit locally."
            : authRetryError.message || "Could not restore your session."
        );
        setHydrated(true);
        return null;
      }
    }

    const restoreSeq = ++restoreSeqRef.current;
    setProfileLoading(true);

    try {
      return await withRestoreTimeout(
        refreshUserData(nextUser, { restoreSeq }),
        "manual workspace restore"
      );
    } catch (retryError) {
      const timedOut = retryError?.name === "WorkspaceRestoreTimeout";
      console.warn("OpeningFit manual workspace restore failed; continuing with default state.", retryError);
      if (restoreSeq === restoreSeqRef.current) {
        setRestoreTimedOut(timedOut);
        setRestoreError(
          timedOut
            ? "Supabase restore timed out. You can keep using OpeningFit with local/default data."
            : retryError.message || "Could not restore your saved data."
        );
        setUserData(null);
        setHydrated(true);
      }
      return null;
    } finally {
      if (restoreSeq === restoreSeqRef.current) {
        setProfileLoading(false);
      }
    }
  }, [refreshUserData]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthLoading(false);
      setHydrated(true);
      return undefined;
    }

    let mounted = true;

    async function restoreInitialWorkspace() {
      setAuthLoading(true);

      try {
        const { data, error: sessionError } = await withRestoreTimeout(
          supabase.auth.getSession(),
          "auth session restore"
        );
        if (!mounted) return;
        if (sessionError) {
          console.error("OpeningFit Supabase query failed", {
            table: "auth.sessions",
            operation: "getSession",
            error: sessionError,
          });
          console.warn("OpeningFit auth session restore failed; continuing.", sessionError);
          setError(sessionError.message || "Could not restore your session.");
        }

        const nextSession = data?.session || null;
        setSession(nextSession);
        setAuthLoading(false);

        if (nextSession?.user) {
          const restoreSeq = ++restoreSeqRef.current;
          setProfileLoading(true);
          try {
            await withRestoreTimeout(
              refreshUserData(nextSession.user, { restoreSeq }),
              "initial workspace restore"
            );
          } catch (restoreError) {
            const timedOut = restoreError?.name === "WorkspaceRestoreTimeout";
            console.warn("OpeningFit initial workspace restore failed; using default state.", restoreError);
            if (mounted && restoreSeq === restoreSeqRef.current) {
              setRestoreTimedOut(timedOut);
              setRestoreError(
                timedOut
                  ? "Supabase restore timed out. You can keep using OpeningFit with local/default data."
                  : restoreError.message || "Could not restore your saved data."
              );
              setUserData(null);
              setHydrated(true);
            }
          } finally {
            if (mounted && restoreSeq === restoreSeqRef.current) {
              setProfileLoading(false);
            }
          }
        } else {
          setUserData(null);
          setHydrated(true);
        }
      } catch (restoreError) {
        const timedOut = restoreError?.name === "WorkspaceRestoreTimeout";
        console.error("OpeningFit Supabase query failed", {
          table: "auth.sessions",
          operation: "initial auth/session restore",
          error: restoreError,
        });
        console.warn("OpeningFit auth restore failed; using default state.", restoreError);
        if (mounted) {
          setAuthLoading(false);
          setUserData(null);
          setHydrated(true);
          setRestoreTimedOut(timedOut);
          setRestoreError(
            timedOut
              ? "Supabase auth restore timed out. You can keep using OpeningFit locally."
              : restoreError.message || "Could not restore your session."
          );
        }
      } finally {
        if (mounted) {
          setHydrated(true);
          setAuthLoading(false);
        }
      }
    }

    restoreInitialWorkspace();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        if (!mounted) return;
        setSession(nextSession || null);

        if (nextSession?.user) {
          setAuthLoading(false);
          setProfileLoading(true);
          try {
            const restoreSeq = ++restoreSeqRef.current;
            await withRestoreTimeout(
              refreshUserData(nextSession.user, { restoreSeq }),
              "auth workspace restore"
            );
          } catch (restoreError) {
            const timedOut = restoreError?.name === "WorkspaceRestoreTimeout";
            console.warn("OpeningFit auth workspace restore failed; using default state.", restoreError);
            if (mounted) {
              setRestoreTimedOut(timedOut);
              setRestoreError(
                timedOut
                  ? "Supabase restore timed out. You can keep using OpeningFit with local/default data."
                  : restoreError.message || "Could not restore your saved data."
              );
              setUserData(null);
              setHydrated(true);
            }
          } finally {
            if (mounted) {
              setHydrated(true);
              setProfileLoading(false);
            }
          }
        } else {
          restoreSeqRef.current += 1;
          setUserData(null);
          setHydrated(true);
          setAuthLoading(false);
          setProfileLoading(false);
          setRestoreError("");
          setRestoreTimedOut(false);
        }
      }
    );

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, [refreshUserData]);

  useEffect(() => {
    if (!user?.id || !hydrated) return undefined;

    const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
    const originalRemoveItem = window.localStorage.removeItem.bind(window.localStorage);

    const queueLegacySync = () => {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(async () => {
        try {
          const nextSettings = await saveSettings(user.id, {
            preferences: {
              legacyStorage: readLegacyStorageSnapshot(),
            },
          });

          setUserData((current) => ({
            ...(current || {}),
            settings: nextSettings ? [nextSettings] : current?.settings || [],
          }));
        } catch (syncError) {
          setError(syncError.message || "Could not sync settings.");
        }
      }, 350);
    };

    window.localStorage.setItem = (key, value) => {
      originalSetItem(key, value);
      if (isPersistedLegacyKey(key)) queueLegacySync();
    };

    window.localStorage.removeItem = (key) => {
      originalRemoveItem(key);
      if (isPersistedLegacyKey(key)) queueLegacySync();
    };

    queueLegacySync();

    return () => {
      window.clearTimeout(debounceRef.current);
      window.localStorage.setItem = originalSetItem;
      window.localStorage.removeItem = originalRemoveItem;
    };
  }, [hydrated, user?.id]);

  const api = useMemo(
    () => ({
      isSupabaseConfigured,
      supabase,
      session,
      user,
      profile: userData?.profile || null,
      onboardingAnswers: userData?.onboarding_answers || [],
      measurements: userData?.measurements || [],
      outfits: userData?.outfits || [],
      favorites: userData?.favorites || [],
      uploads: userData?.uploads || [],
      aiGenerations: userData?.ai_generations || [],
      settings: userData?.settings?.[0] || null,
      history: userData?.activity_history || [],
      openingFitUserState: userData?.openingfit_user_state || [],
      reportHistory: userData?.report_history || [],
      userData,
      loading: authLoading,
      authLoading,
      profileLoading,
      restoringProfile: profileLoading,
      hydrated,
      error,
      restoreError,
      restoreTimedOut,
      restoreAttempt,
      refreshUserData,
      retryRestore,
      upsertUserData: (table, row, options) => upsertUserRow(table, user?.id, row, options),
      deleteUserData: (table, id) => deleteUserRow(table, user?.id, id),
      saveSettings: (patch) => saveSettings(user?.id, patch),
      saveReport: (report, summary) => saveReport(user?.id, report, summary),
      recordActivity: (type, payload) => recordActivity(user?.id, type, payload),
      uploadUserFile: (file, pathPrefix) => uploadUserFile(user?.id, file, pathPrefix),
    }),
    [
      authLoading,
      error,
      hydrated,
      profileLoading,
      refreshUserData,
      restoreAttempt,
      restoreError,
      restoreTimedOut,
      retryRestore,
      session,
      user,
      userData,
    ]
  );

  return (
    <AuthDataContext.Provider value={api}>
      {restoreError ? (
        <div className="restoreNotice" role="status">
          <div>
            <strong>{restoreTimedOut ? "Cloud restore timed out" : "Cloud restore failed"}</strong>
            <p>{restoreError}</p>
          </div>
          <button type="button" onClick={retryRestore} disabled={profileLoading}>
            {profileLoading ? "Retrying..." : "Retry"}
          </button>
        </div>
      ) : authLoading ? (
        <div className="restoreNotice restoreNoticeLoading" role="status">
          Checking OpeningFit account...
        </div>
      ) : profileLoading ? (
        <div className="restoreNotice restoreNoticeLoading" role="status">
          Restoring saved OpeningFit workspace...
        </div>
      ) : null}
      {children}
    </AuthDataContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthDataContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthDataProvider.");
  }

  return value;
}
