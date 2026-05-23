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
        setUserData(data);
        hydrateLegacyStorage(data?.settings?.[0]?.preferences?.legacyStorage || {});
        setHydrated(true);
        return data;
      } catch (refreshError) {
        setError(refreshError.message || "Could not load your saved data.");
        setHydrated(true);
        throw refreshError;
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

    supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError(sessionError.message);

      const nextSession = data?.session || null;
      setSession(nextSession);

      if (nextSession?.user) {
        await refreshUserData(nextSession.user).catch(() => {});
      } else {
        setHydrated(true);
      }

      if (mounted) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        setSession(nextSession || null);

        if (nextSession?.user) {
          setLoading(true);
          await refreshUserData(nextSession.user).catch(() => {});
          setLoading(false);
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
