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
const RESTORE_TIMEOUT_MS = 6500;

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
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef(null);
  const userRef = useRef(null);

  const user = session?.user || null;
  userRef.current = user;

  const refreshUserData = useCallback(
    async (nextUser = userRef.current) => {
      if (!isSupabaseConfigured || !supabase || !nextUser?.id) {
        setUserData(null);
        setHydrated(true);
        return null;
      }

      setError("");

      try {
        const data = await fetchAllUserData(nextUser);
        setUserData(data || null);
        hydrateLegacyStorage(data?.settings?.[0]?.preferences?.legacyStorage || {});
        setHydrated(true);
        return data;
      } catch (refreshError) {
        console.warn("OpeningFit could not restore saved workspace; using default state.", refreshError);
        setError(refreshError.message || "Could not load your saved data.");
        setUserData(null);
        setHydrated(true);
        throw refreshError;
      } finally {
        setHydrated(true);
      }
    },
    []
  );

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      setHydrated(true);
      return undefined;
    }

    let mounted = true;

    async function restoreInitialWorkspace() {
      setLoading(true);

      try {
        await withRestoreTimeout(
          (async () => {
            const { data, error: sessionError } = await supabase.auth.getSession();
            if (!mounted) return;
            if (sessionError) {
              console.warn("OpeningFit auth session restore failed; continuing.", sessionError);
              setError(sessionError.message || "Could not restore your session.");
            }

            const nextSession = data?.session || null;
            setSession(nextSession);

            if (nextSession?.user) {
              await refreshUserData(nextSession.user);
            } else {
              setUserData(null);
              setHydrated(true);
            }
          })(),
          "initial workspace restore"
        );
      } catch (restoreError) {
        console.warn("OpeningFit initial workspace restore failed; using default state.", restoreError);
        if (mounted) {
          setUserData(null);
          setHydrated(true);
        }
      } finally {
        if (mounted) {
          setHydrated(true);
          setLoading(false);
        }
      }
    }

    restoreInitialWorkspace();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        if (!mounted) return;
        setSession(nextSession || null);

        if (nextSession?.user) {
          setLoading(true);
          try {
            await withRestoreTimeout(
              refreshUserData(nextSession.user),
              "auth workspace restore"
            );
          } catch (restoreError) {
            console.warn("OpeningFit auth workspace restore failed; using default state.", restoreError);
            if (mounted) {
              setUserData(null);
              setHydrated(true);
            }
          } finally {
            if (mounted) {
              setHydrated(true);
              setLoading(false);
            }
          }
        } else {
          setUserData(null);
          setHydrated(true);
          setLoading(false);
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
      reportHistory: userData?.report_history || [],
      userData,
      loading: loading || !hydrated,
      error,
      refreshUserData,
      upsertUserData: (table, row, options) => upsertUserRow(table, user?.id, row, options),
      deleteUserData: (table, id) => deleteUserRow(table, user?.id, id),
      saveSettings: (patch) => saveSettings(user?.id, patch),
      saveReport: (report, summary) => saveReport(user?.id, report, summary),
      recordActivity: (type, payload) => recordActivity(user?.id, type, payload),
      uploadUserFile: (file, pathPrefix) => uploadUserFile(user?.id, file, pathPrefix),
    }),
    [error, hydrated, loading, refreshUserData, session, user, userData]
  );

  if (api.loading) {
    return (
      <AuthDataContext.Provider value={api}>
        <div className="page dark" data-theme="dark">
          <div className="loadingCard">Restoring your saved workspace...</div>
        </div>
      </AuthDataContext.Provider>
    );
  }

  return <AuthDataContext.Provider value={api}>{children}</AuthDataContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthDataContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthDataProvider.");
  }

  return value;
}
