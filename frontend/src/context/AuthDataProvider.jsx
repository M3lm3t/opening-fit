import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  clearStoredSupabaseSession,
  isSupabaseConfigured,
  SUPABASE_AUTH_STORAGE_KEY,
  supabase,
} from "../lib/supabaseClient";
import { attachStoredReferralToAuthenticatedUser } from "../lib/referrals";
import { logSupabaseSyncWarning } from "../services/supabaseSyncDebug";
import {
  deleteUserRow,
  createDefaultUserData,
  fetchAllUserData,
  recordActivity,
  saveAnalysedGames,
  saveRecommendationHistory,
  saveRetentionSnapshot,
  saveReport,
  saveSettings,
  uploadUserFile,
  upsertUserRow,
} from "../services/userDataService";
import { resolvePremiumEntitlement } from "../lib/premiumEntitlement";

const AuthDataContext = createContext(null);

const LEGACY_KEY_PREFIXES = ["openingFit:", "openingfit."];
const LEGACY_EXACT_KEYS = ["openingfit_landing_seen"];
const LEGACY_KEYS_TO_PRESERVE_BETWEEN_USERS = new Set([
  "openingFit:theme",
  "openingfit_landing_seen",
  "openingFit:landingSeen",
]);
const DANGEROUS_LEGACY_KEY_PATTERNS = [
  /premium/i,
  /founder/i,
  /supporter/i,
  /paid/i,
  /unlock/i,
];
const RESTORE_TIMEOUT_MS = 15000;
const AUTO_PROFILE_RESTORE_TIMEOUT_MS = 2500;
const AUTO_TABLE_RESTORE_TIMEOUT_MS = 1800;
const DEBUG_CLOUD_RESTORE =
  typeof import.meta !== "undefined" &&
  import.meta.env?.VITE_DEBUG_CLOUD_RESTORE === "true";

const EMPTY_RESTORED_COUNTS = {
  history: 0,
  progress: 0,
  savedGames: 0,
  reports: 0,
  retentionSnapshots: 0,
};
const PROFILE_PARTIAL_RESTORE_MESSAGE =
  "Some profile data could not be loaded. You can still use OpeningFit.";

function mergePartialRestoreData(nextData, currentData) {
  if (!nextData) return nextData;

  const restoreWarnings = Array.isArray(nextData.restoreWarnings) ? nextData.restoreWarnings : [];
  if (!restoreWarnings.length || !currentData) return nextData;

  const merged = { ...nextData };
  if (!merged.profile && currentData.profile) {
    merged.profile = currentData.profile;
  }

  restoreWarnings.forEach((warning) => {
    const table = warning?.table;
    if (!table) return;

    const currentRows = currentData?.[table];
    const nextRows = merged?.[table];
    if (Array.isArray(currentRows) && currentRows.length && (!Array.isArray(nextRows) || !nextRows.length)) {
      merged[table] = currentRows;
    }
  });

  return merged;
}

function getUserVisibleRestoreWarnings(restoreWarnings = []) {
  return restoreWarnings.filter((warning) => warning?.userVisible !== false && warning?.required !== false);
}

function withTimeout(promise, ms = RESTORE_TIMEOUT_MS, label = "Supabase request") {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(`${label} timed out after ${ms}ms`);
      error.name = "WorkspaceRestoreTimeout";
      reject(error);
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

async function withRestoreTimeout(promise, label = "workspace restore") {
  try {
    return await withTimeout(promise, RESTORE_TIMEOUT_MS, label);
  } catch (restoreError) {
    if (restoreError?.name === "WorkspaceRestoreTimeout") {
      console.warn(`OpeningFit ${label} timed out; continuing with default workspace.`);
    }
    throw restoreError;
  }
}

function isPersistedLegacyKey(key) {
  return (
    LEGACY_EXACT_KEYS.includes(key) ||
    LEGACY_KEY_PREFIXES.some((prefix) => String(key).startsWith(prefix))
  );
}

function isSafeLegacySyncKey(key) {
  const value = String(key || "");
  return (
    value !== SUPABASE_AUTH_STORAGE_KEY &&
    isPersistedLegacyKey(value) &&
    !DANGEROUS_LEGACY_KEY_PATTERNS.some((pattern) => pattern.test(value))
  );
}

function readLegacyStorageSnapshot() {
  const snapshot = {};

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && isSafeLegacySyncKey(key)) {
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
      if (isSafeLegacySyncKey(key) && value !== null && value !== undefined) {
        window.localStorage.setItem(key, value);
      }
    });
  } catch {
    // Browser storage can be unavailable in private contexts.
  }
}

function countRows(value) {
  return Array.isArray(value) ? value.length : 0;
}

function hasReportPayload(report) {
  return Boolean(report && typeof report === "object" && Object.keys(report).length);
}

function getRestoreCounts(snapshot = {}) {
  const progressRows = countRows(snapshot.openingfit_user_state);
  const reportRows = countRows(snapshot.report_history || snapshot.analysis_history);
  return {
    history:
      countRows(snapshot.activity_history) +
      countRows(snapshot.recommendation_history) +
      countRows(snapshot.saved_recommendations),
    progress: progressRows,
    savedGames: countRows(snapshot.analysed_games),
    reports: reportRows,
    retentionSnapshots: countRows(snapshot.openingfit_retention_snapshots),
  };
}

function snapshotHasCloudBackup(snapshot = {}) {
  const counts = getRestoreCounts(snapshot);
  const workspaceReport = (snapshot.openingfit_user_state || []).some((row) =>
    hasReportPayload(row?.last_report) || hasReportPayload(row?.coach_progress)
  );
  const profileReport = hasReportPayload(snapshot.profile?.last_report);
  const settingsBackup = (snapshot.settings || []).some((row) =>
    hasReportPayload(row?.preferences?.legacyStorage)
  );
  return (
    workspaceReport ||
    profileReport ||
    settingsBackup ||
    counts.history > 0 ||
    counts.progress > 0 ||
    counts.savedGames > 0 ||
    counts.reports > 0 ||
    counts.retentionSnapshots > 0
  );
}

function friendlyRestoreReason(error, fallback = "Cloud restore failed.") {
  const message = String(error?.message || error?.error_description || "");
  const causeMessage = String(error?.cause?.message || "");
  const combined = `${message} ${causeMessage}`.trim();

  if (/not logged in|missing user|no authenticated|auth session/i.test(combined)) {
    return "not logged in";
  }

  if (/supabase.*not configured|missing.*supabase|env vars/i.test(combined)) {
    return "Supabase config missing";
  }

  if (/row-level security|permission denied|violates row-level security|rls|permission/i.test(combined)) {
    return "permission/RLS error";
  }

  if (/failed to fetch|network|load failed|fetch|timeout/i.test(combined) || error?.name === "TypeError") {
    return "network error";
  }

  if (/format|invalid|parse/i.test(combined)) {
    return "data format error";
  }

  return message || fallback;
}

function clearLegacyStorage() {
  try {
    const keysToRemove = [];

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (
        key &&
        isSafeLegacySyncKey(key) &&
        !LEGACY_KEYS_TO_PRESERVE_BETWEEN_USERS.has(key)
      ) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Browser storage can be unavailable in private contexts.
  }
}

function debugCloudRestore(message, details = {}) {
  if (!DEBUG_CLOUD_RESTORE) return;
  console.debug(`[OpeningFit cloud restore] ${message}`, details);
}

function getSessionRestoreKey(nextSession) {
  const userId = nextSession?.user?.id || "";
  if (!userId) return "";
  return `${userId}:${nextSession?.access_token || ""}`;
}

function createFallbackProfileForUser(nextUser) {
  if (!nextUser?.id) return null;

  const emailName = nextUser.email?.split("@")?.[0] || "";
  const displayName =
    nextUser.user_metadata?.full_name ||
    nextUser.user_metadata?.name ||
    nextUser.user_metadata?.display_name ||
    emailName ||
    "OpeningFit user";

  return {
    id: nextUser.id,
    user_id: nextUser.id,
    email: nextUser.email || "",
    username:
      nextUser.user_metadata?.username ||
      nextUser.user_metadata?.preferred_username ||
      emailName ||
      "OpeningFit user",
    display_name: displayName,
    is_premium: false,
  };
}

export function AuthDataProvider({ children }) {
  const [session, setSession] = useState(null);
  const [userData, setUserData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [cloudRestoreLoading, setCloudRestoreLoading] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState("");
  const [restoreError, setRestoreError] = useState("");
  const [restoreTimedOut, setRestoreTimedOut] = useState(false);
  const [restoreInProgress, setRestoreInProgress] = useState(false);
  const [cloudRestored, setCloudRestored] = useState(false);
  const [manualRestoreResult, setManualRestoreResult] = useState(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [syncState, setSyncState] = useState({ status: "idle", lastSavedAt: "", error: "" });
  const debounceRef = useRef(null);
  const userRef = useRef(null);
  const userDataRef = useRef(null);
  const restoreSeqRef = useRef(0);
  const restoreInFlightRef = useRef(false);
  const restoredUserIdRef = useRef(null);
  const restoredSessionKeyRef = useRef("");
  const legacySyncSuspendedRef = useRef(false);
  const referralAttachInFlightRef = useRef(null);
  const referralAttachedUserRef = useRef(null);

  const user = session?.user || null;
  userRef.current = user;
  userDataRef.current = userData;

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !user?.id) {
      referralAttachInFlightRef.current = null;
      referralAttachedUserRef.current = null;
      return;
    }
    if (referralAttachedUserRef.current === user.id || referralAttachInFlightRef.current === user.id) return;

    referralAttachInFlightRef.current = user.id;
    void attachStoredReferralToAuthenticatedUser({
      rpc: supabase.rpc.bind(supabase),
      onError: (referralError, stage) => logSupabaseSyncWarning(
        "referral_attributions",
        stage,
        referralError,
        { source: "post-auth" }
      ),
    }).then((result) => {
      if (result.success) referralAttachedUserRef.current = user.id;
    }).finally(() => {
      if (referralAttachInFlightRef.current === user.id) referralAttachInFlightRef.current = null;
    });
  }, [user?.id]);

  const refreshUserData = useCallback(
    async (nextUser = userRef.current, options = {}) => {
      const applyState = options.applyState !== false;
      const restoreSeq = options.restoreSeq ?? ++restoreSeqRef.current;

      if (!isSupabaseConfigured || !supabase || !nextUser?.id) {
        if (applyState) {
          setUserData(null);
          setHydrated(true);
          setProfileLoading(false);
          setCloudRestoreLoading(false);
          setProfileLoaded(true);
          setProfileError("");
        }
        return null;
      }

      setError("");
      setRestoreError("");
      setRestoreTimedOut(false);
      if (applyState) {
        setProfileLoading(true);
        setCloudRestoreLoading(true);
        setProfileError("");

        if (!userDataRef.current) {
          const fallbackProfile = createFallbackProfileForUser(nextUser);
          setUserData(createDefaultUserData(fallbackProfile));
          setProfileLoaded(true);
          setHydrated(true);
        } else {
          setProfileLoaded(false);
        }
      }

      try {
        console.info("[OpeningFit restore] cloud restore start", nextUser.id);
        debugCloudRestore("loading user data", { userId: nextUser.id, applyState });
        const data = await withRestoreTimeout(
          fetchAllUserData(nextUser, {
            profileTimeoutMs: AUTO_PROFILE_RESTORE_TIMEOUT_MS,
            tableTimeoutMs: AUTO_TABLE_RESTORE_TIMEOUT_MS,
          }),
          "OpeningFit cloud restore"
        );
        if (applyState && restoreSeq === restoreSeqRef.current) {
          const restoreWarnings = Array.isArray(data?.restoreWarnings) ? data.restoreWarnings : [];
          const userVisibleRestoreWarnings = getUserVisibleRestoreWarnings(restoreWarnings);
          if (restoreWarnings.length) {
            console.warn("OpeningFit cloud restore completed with table warnings", {
              warnings: restoreWarnings.map((warning) => ({
                table: warning.table,
                failureType: warning.failureType || "unknown",
                timedOut: Boolean(warning.timedOut),
                required: Boolean(warning.required),
                optional: Boolean(warning.optional),
                userVisible: warning.userVisible !== false,
                code: warning.code,
                supabaseDetails: warning.supabaseDetails,
                hint: warning.hint,
                query: warning.query,
                message: warning.message,
              })),
              profileNoticeShown: userVisibleRestoreWarnings.length > 0,
            });
          }
          const nextUserData = mergePartialRestoreData(data, userDataRef.current);
          setUserData(nextUserData || null);
          hydrateLegacyStorage(nextUserData?.settings?.[0]?.preferences?.legacyStorage || {});
          setProfileLoaded(true);
          setProfileError(userVisibleRestoreWarnings.length ? PROFILE_PARTIAL_RESTORE_MESSAGE : "");
          setCloudRestored(true);
          setSyncState((current) => ({
            ...current,
            status: "synced",
            error: userVisibleRestoreWarnings.length ? PROFILE_PARTIAL_RESTORE_MESSAGE : "",
            lastSavedAt: current.lastSavedAt || new Date().toISOString(),
          }));
          setHydrated(true);
        }
        console.info("[OpeningFit restore] profile/settings/history complete");
        return data;
      } catch (refreshError) {
        console.warn("[OpeningFit restore] failed; continuing with default workspace.", refreshError);
        if (applyState && restoreSeq === restoreSeqRef.current) {
          const fallbackProfile = createFallbackProfileForUser(nextUser);
          const fallbackData = createDefaultUserData(fallbackProfile);
          const message = PROFILE_PARTIAL_RESTORE_MESSAGE;
          setUserData(fallbackData);
          setError("");
          setProfileError(message);
          setRestoreError(message);
          setRestoreTimedOut(refreshError?.name === "WorkspaceRestoreTimeout");
          setSyncState((current) => ({
            ...current,
            status: "idle",
            error: message,
          }));
          setHydrated(true);
          setProfileLoaded(true);
        }
        return null;
      } finally {
        if (applyState && restoreSeq === restoreSeqRef.current) {
          setHydrated(true);
          setProfileLoading(false);
          setCloudRestoreLoading(false);
        }
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;

    // Clear the durable browser session and UI immediately. Supabase's default
    // global sign-out waits for the auth server, which can otherwise leave the
    // whole account surface stuck when that request is slow or unavailable.
    clearStoredSupabaseSession();
    restoreSeqRef.current += 1;
    restoredUserIdRef.current = null;
    restoredSessionKeyRef.current = "";
    restoreInFlightRef.current = false;
    clearLegacyStorage();
    setSession(null);
    setUserData(null);
    setAuthLoading(false);
    setProfileLoading(false);
    setCloudRestoreLoading(false);
    setCloudRestored(false);
    setProfileLoaded(true);
    setProfileError("");
    setRestoreError("");
    setRestoreTimedOut(false);
    setHydrated(true);
    setSyncState({ status: "logged-out", lastSavedAt: "", error: "" });

    try {
      const { error: signOutError } = await withTimeout(
        supabase.auth.signOut({ scope: "local" }),
        2500,
        "local sign out"
      );
      if (signOutError) throw signOutError;
    } catch (signOutError) {
      // The local session is already gone, so a provider cleanup failure should
      // not put the user back into a loading or error state.
      console.warn("OpeningFit provider sign out cleanup failed", signOutError);
    }
  }, []);

  const retryRestore = useCallback(async () => {
    const nextUser = userRef.current;
    setRestoreAttempt((value) => value + 1);
    setRestoreError("");
    setRestoreTimedOut(false);
    restoredUserIdRef.current = null;

    if (!nextUser?.id) {
      setHydrated(true);
      setProfileLoaded(true);
      return null;
    }

    const restoreSeq = ++restoreSeqRef.current;
    setProfileLoading(true);
    setCloudRestoreLoading(true);
    setProfileLoaded(false);
    setProfileError("");

    try {
      return await refreshUserData(nextUser, { restoreSeq });
    } catch (retryError) {
      const timedOut = retryError?.name === "WorkspaceRestoreTimeout";
      console.warn("OpeningFit manual workspace restore failed; continuing with default state.", retryError);
      if (restoreSeq === restoreSeqRef.current) {
        setRestoreTimedOut(timedOut);
        setProfileLoaded(true);
        setProfileError(
          timedOut
            ? "Supabase restore timed out. You can keep using OpeningFit with local/default data."
            : retryError.message || "Could not restore your saved data."
        );
        setRestoreError(
          timedOut
            ? "Supabase restore timed out. You can keep using OpeningFit with local/default data."
            : retryError.message || "Could not restore your saved data."
        );
        setHydrated(true);
      }
      return null;
    } finally {
      if (restoreSeq === restoreSeqRef.current) {
        setProfileLoading(false);
        setCloudRestoreLoading(false);
      }
    }
  }, [refreshUserData]);

  const restoreCloudSnapshot = useCallback(async (requestedUserId = userRef.current?.id) => {
    if (restoreInProgress) {
      return {
        ok: false,
        reason: "Cloud restore is already running.",
        restoredCounts: EMPTY_RESTORED_COUNTS,
      };
    }

    setRestoreInProgress(true);
    setCloudRestoreLoading(true);
    legacySyncSuspendedRef.current = true;
    setProfileLoaded(false);
    setProfileError("");
    setManualRestoreResult(null);
    setRestoreError("");
    setRestoreTimedOut(false);

    try {
      if (!isSupabaseConfigured || !supabase) {
        setProfileLoaded(true);
        setProfileError("Supabase config missing");
        return {
          ok: false,
          reason: "Supabase config missing",
          restoredCounts: EMPTY_RESTORED_COUNTS,
        };
      }

      const { data, error: sessionError } = await withRestoreTimeout(
        supabase.auth.getSession(),
        "manual cloud restore session check"
      );
      if (sessionError) throw sessionError;

      const nextSession = data?.session || null;
      const sessionUser = nextSession?.user || userRef.current || null;
      if (!sessionUser?.id) {
        setProfileLoaded(true);
        setProfileError("not logged in");
        return {
          ok: false,
          reason: "not logged in",
          restoredCounts: EMPTY_RESTORED_COUNTS,
        };
      }

      if (requestedUserId && requestedUserId !== sessionUser.id) {
        setProfileLoaded(true);
        setProfileError("not logged in");
        return {
          ok: false,
          reason: "not logged in",
          restoredCounts: EMPTY_RESTORED_COUNTS,
        };
      }

      setSession(nextSession);
      restoredSessionKeyRef.current = getSessionRestoreKey(nextSession);
      const restoreSeq = ++restoreSeqRef.current;
      setProfileLoading(true);

      console.info("[OpeningFit] restore start", sessionUser.id);
      const snapshot = await withRestoreTimeout(
        fetchAllUserData(sessionUser, { strict: true }),
        "manual cloud snapshot restore"
      );
      const restoredCounts = getRestoreCounts(snapshot);

      if (!snapshot || typeof snapshot !== "object") {
        setProfileLoaded(true);
        setProfileError("data format error");
        console.warn("[OpeningFit] restore failed", new Error("data format error"));
        return {
          ok: false,
          reason: "data format error",
          restoredCounts,
        };
      }

      if (!snapshotHasCloudBackup(snapshot)) {
        setUserData(snapshot);
        setHydrated(true);
        setProfileLoaded(true);
        setProfileError("");
        setManualRestoreResult({
          ok: false,
          reason: "No cloud backup found for this account yet.",
          restoredCounts,
        });
        console.info("[OpeningFit] restore complete");
        return {
          ok: false,
          reason: "No cloud backup found for this account yet.",
          restoredCounts,
          snapshot,
        };
      }

      if (restoreSeq === restoreSeqRef.current) {
        setUserData(snapshot);
        hydrateLegacyStorage(snapshot?.settings?.[0]?.preferences?.legacyStorage || {});
        setProfileLoaded(true);
        setProfileError("");
        setSyncState({
          status: "synced",
          error: "",
          lastSavedAt: new Date().toISOString(),
        });
        setHydrated(true);
      }

      const result = {
        ok: true,
        reason: "Cloud data restored.",
        restoredCounts,
        snapshot,
      };
      setManualRestoreResult(result);
      console.info("[OpeningFit] restore complete");
      return result;
    } catch (error) {
      console.warn("[OpeningFit] restore failed", error);
      const reason = friendlyRestoreReason(error);
      const result = {
        ok: false,
        reason,
        restoredCounts: EMPTY_RESTORED_COUNTS,
      };
      setRestoreError(reason);
      setProfileLoaded(true);
      setProfileError(reason);
      setSyncState((current) => ({ ...current, status: "error", error: reason }));
      setManualRestoreResult(result);
      return result;
    } finally {
      legacySyncSuspendedRef.current = false;
      setRestoreInProgress(false);
      setProfileLoading(false);
      setCloudRestoreLoading(false);
    }
  }, [restoreInProgress]);

  const runSyncedMutation = useCallback(async (work, fallbackMessage = "Could not save to Supabase.", options = {}) => {
    const mode = options.mode || "required";
    setSyncState((current) => ({ ...current, status: "saving", error: "" }));

    try {
      const result = await work();
      setSyncState({
        status: "synced",
        lastSavedAt: new Date().toISOString(),
        error: "",
      });
      return result;
    } catch (mutationError) {
      const message = mutationError?.message || fallbackMessage;
      if (mode === "optional") {
        console.warn("OpeningFit optional Supabase sync failed", {
          message,
          error: mutationError,
        });
        setSyncState((current) => ({
          ...current,
          status: current.status === "saving" ? "synced" : current.status,
          error: current.error || "",
        }));
        return null;
      }
      setSyncState((current) => ({ ...current, status: "error", error: message }));
      throw mutationError;
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthLoading(false);
      setHydrated(true);
      setCloudRestoreLoading(false);
      setProfileLoaded(true);
      return undefined;
    }

    let cancelled = false;

    async function initAuth() {
      console.info("[OpeningFit restore] auth session start");
      setAuthLoading(true);

      try {
        const { data, error: sessionError } = await withRestoreTimeout(
          supabase.auth.getSession(),
          "auth session restore"
        );
        if (cancelled) return;
        if (sessionError) {
          throw sessionError;
        }

        const nextSession = data?.session || null;
        setSession(nextSession);
        restoredSessionKeyRef.current = getSessionRestoreKey(nextSession);
        console.info("[OpeningFit restore] auth session complete");
      } catch (authError) {
        console.warn("[OpeningFit restore] auth session failed", authError);
        if (!cancelled) {
          setSession(null);
          restoredSessionKeyRef.current = "";
          setError(authError?.message || "Could not restore your session.");
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
          setAuthLoading(false);
        }
      }
    }

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (cancelled) return;
        setSession(nextSession || null);
        const nextSessionKey = getSessionRestoreKey(nextSession);
        restoredSessionKeyRef.current = nextSessionKey;
        setAuthLoading(false);
        setHydrated(true);

        if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
          return;
        }

        if (!nextSession?.user) {
          restoreSeqRef.current += 1;
          restoredUserIdRef.current = null;
          clearLegacyStorage();
          setUserData(null);
          setProfileLoading(false);
          setCloudRestoreLoading(false);
          setCloudRestored(false);
          setProfileLoaded(true);
          setProfileError("");
          setRestoreError("");
          setRestoreTimedOut(false);
          setSyncState({ status: "logged-out", lastSavedAt: "", error: "" });
        }
      }
    );

    return () => {
      cancelled = true;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const nextUser = userRef.current;

    if (!nextUser?.id) {
      restoreInFlightRef.current = false;
      restoredUserIdRef.current = null;
      setCloudRestoreLoading(false);
      setCloudRestored(false);
      return;
    }

    if (restoreInFlightRef.current || restoredUserIdRef.current === nextUser.id) {
      return;
    }

    let cancelled = false;
    const restoreSeq = ++restoreSeqRef.current;
    restoreInFlightRef.current = true;
    setProfileLoading(true);
    setCloudRestoreLoading(true);
    setProfileLoaded(false);
    setProfileError("");
    setRestoreError("");
    setRestoreTimedOut(false);

    refreshUserData(nextUser, { restoreSeq })
      .then(() => {
        if (cancelled || restoreSeq !== restoreSeqRef.current) return;
        restoredUserIdRef.current = nextUser.id;
        setCloudRestored(true);
      })
      .catch((restoreError) => {
        if (cancelled || restoreSeq !== restoreSeqRef.current) return;
        const timedOut = restoreError?.name === "WorkspaceRestoreTimeout";
        const message = timedOut
          ? "Cloud restore is taking longer than expected. Your account is still signed in."
          : restoreError?.message || "Could not restore your saved data.";
        setRestoreTimedOut(timedOut);
        setProfileLoaded(true);
        setProfileError(message);
        setRestoreError(message);
        setHydrated(true);
      })
      .finally(() => {
        if (restoreSeq === restoreSeqRef.current) {
          restoreInFlightRef.current = false;
          setProfileLoading(false);
          setCloudRestoreLoading(false);
          setHydrated(true);
        }
      });

    return () => {
      cancelled = true;
      if (restoreSeq === restoreSeqRef.current) {
        restoreInFlightRef.current = false;
      }
    };
  }, [refreshUserData, user?.id]);

  useEffect(() => {
    if (!user?.id || !hydrated || restoreInProgress || profileLoading || !profileLoaded || restoreError) {
      return undefined;
    }

    const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
    const originalRemoveItem = window.localStorage.removeItem.bind(window.localStorage);

    const queueLegacySync = () => {
      if (legacySyncSuspendedRef.current) return;
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
          setSyncState({
            status: "synced",
            lastSavedAt: new Date().toISOString(),
            error: "",
          });
        } catch (syncError) {
          const message = syncError.message || "Could not sync settings.";
          setError(message);
          setSyncState((current) => ({ ...current, status: "error", error: message }));
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
  }, [hydrated, profileLoaded, profileLoading, restoreError, restoreInProgress, user?.id]);

  const api = useMemo(
    () => {
      const entitlement = userData?.entitlement || resolvePremiumEntitlement(userData?.premium_entitlements || []);
      return ({
      isSupabaseConfigured,
      supabase,
      session,
      user,
      profile: userData?.profile || null,
      premiumEntitlements: userData?.premium_entitlements || [],
      entitlement,
      hasPremiumAccess: entitlement.hasPremiumAccess,
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
      analysedGames: userData?.analysed_games || [],
      recommendationHistory: userData?.recommendation_history || [],
      retentionSnapshots: userData?.openingfit_retention_snapshots || [],
      notificationPreferences: userData?.notification_preferences || [],
      retentionProfile: userData?.user_profiles?.[0] || null,
      retentionActivity: userData?.user_activity_log || [],
      retentionStreaks: userData?.user_streaks || [],
      retentionGoals: userData?.user_goals || [],
      retentionAchievements: userData?.user_achievements || [],
      weeklyReports: userData?.weekly_reports || [],
      userData,
      loading: authLoading,
      authLoading,
      profileLoading,
      cloudRestoreLoading,
      cloudRestored,
      profileLoaded,
      profileError,
      restoringProfile: profileLoading,
      hydrated,
      error,
      restoreError,
      restoreTimedOut,
      restoreInProgress,
      retryCloudRestore: retryRestore,
      manualRestoreResult,
      restoreAttempt,
      syncStatus: syncState.status,
      lastSavedAt: syncState.lastSavedAt,
      syncError: syncState.error,
      refreshUserData,
      retryRestore,
      restoreCloudSnapshot,
      signOut,
      upsertUserData: (table, row, options) =>
        runSyncedMutation(
          () => upsertUserRow(table, user?.id, row, options),
          `Could not save ${table}.`
        ),
      deleteUserData: (table, id) =>
        runSyncedMutation(
          () => deleteUserRow(table, user?.id, id),
          `Could not delete ${table}.`
        ),
      saveSettings: (patch) =>
        runSyncedMutation(() => saveSettings(user?.id, patch), "Could not save settings."),
      saveReport: (report, summary) =>
        runSyncedMutation(() => saveReport(user?.id, report, summary), "Could not save report."),
      saveAnalysedGames: (report, summary) =>
        runSyncedMutation(
          () => saveAnalysedGames(user?.id, report, summary),
          "Could not save analysed games."
        ),
      saveRecommendationHistory: (snapshot) =>
        runSyncedMutation(
          () => saveRecommendationHistory(user?.id, snapshot),
          "Could not save opening recommendations."
        ),
      saveRetentionSnapshot: (report, summary) =>
        runSyncedMutation(
          () => saveRetentionSnapshot(user?.id, report, summary),
          "Could not save retention snapshot.",
          { mode: "optional" }
        ),
      recordActivity: (type, payload) =>
        runSyncedMutation(
          () => recordActivity(user?.id, type, payload),
          "Could not save activity."
        ),
      uploadUserFile: (file, pathPrefix) => uploadUserFile(user?.id, file, pathPrefix),
      });
    },
    [
      authLoading,
      error,
      hydrated,
      profileError,
      profileLoaded,
      profileLoading,
      cloudRestoreLoading,
      cloudRestored,
      refreshUserData,
      restoreAttempt,
      restoreError,
      restoreTimedOut,
      restoreInProgress,
      manualRestoreResult,
      runSyncedMutation,
      syncState,
      retryRestore,
      restoreCloudSnapshot,
      signOut,
      session,
      user,
      userData,
    ]
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    window.openingFitDebug = {
      authState: {
        isSupabaseConfigured,
        hasSession: Boolean(session),
        userId: user?.id || null,
        email: user?.email || null,
        authLoading,
        profileLoading,
        cloudRestoreLoading,
        cloudRestored,
        profileLoaded,
        profileError,
        hydrated,
        restoreError,
        tableCounts: {
          reportHistory: userData?.report_history?.length || 0,
          openingFitUserState: userData?.openingfit_user_state?.length || 0,
          recommendationHistory: userData?.recommendation_history?.length || 0,
          retentionSnapshots: userData?.openingfit_retention_snapshots?.length || 0,
          analysedGames: userData?.analysed_games?.length || 0,
          settings: userData?.settings?.length || 0,
          premiumEntitlements: userData?.premium_entitlements?.length || 0,
          retentionActivity: userData?.user_activity_log?.length || 0,
          weeklyReports: userData?.weekly_reports?.length || 0,
        },
      },
      testSupabaseConnection: async () => {
        if (!isSupabaseConfigured || !supabase) {
          return { ok: false, error: "Supabase is not configured." };
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        return {
          ok: !sessionError,
          hasSession: Boolean(data?.session),
          userId: data?.session?.user?.id || null,
          error: sessionError?.message || null,
        };
      },
      testCloudLoad: async () => {
        const nextUser = userRef.current;
        if (!nextUser?.id) return { ok: false, error: "No authenticated user." };

        try {
          const data = await refreshUserData(nextUser, { applyState: false });
          return {
            ok: true,
            reportHistory: data?.report_history?.length || 0,
            openingFitUserState: data?.openingfit_user_state?.length || 0,
            recommendationHistory: data?.recommendation_history?.length || 0,
            retentionSnapshots: data?.openingfit_retention_snapshots?.length || 0,
            analysedGames: data?.analysed_games?.length || 0,
            premiumEntitlements: data?.premium_entitlements?.length || 0,
          };
        } catch (loadError) {
          return { ok: false, error: loadError?.message || String(loadError) };
        }
      },
      testCloudSave: async () => {
        const nextUser = userRef.current;
        if (!nextUser?.id) return { ok: false, error: "No authenticated user." };

        try {
          const row = await saveSettings(nextUser.id, {
            preferences: {
              debugLastTestAt: new Date().toISOString(),
            },
          });
          return { ok: true, table: "settings", rowId: row?.id || null };
        } catch (saveError) {
          return { ok: false, error: saveError?.message || String(saveError) };
        }
      },
    };

    return () => {
      if (window.openingFitDebug?.authState?.userId === (user?.id || null)) {
        delete window.openingFitDebug;
      }
    };
  }, [
    authLoading,
    hydrated,
    profileError,
    profileLoaded,
    profileLoading,
    cloudRestoreLoading,
    cloudRestored,
    refreshUserData,
    restoreError,
    session,
    user,
    userData,
  ]);

  return (
    <AuthDataContext.Provider value={api}>
      {restoreError ? (
        <div className="restoreNotice" role="status">
          <div>
            <strong>{restoreTimedOut ? "Cloud restore timed out" : "Cloud restore failed"}</strong>
            <p>{restoreError}</p>
          </div>
          <button type="button" onClick={retryRestore} disabled={cloudRestoreLoading}>
            {cloudRestoreLoading ? "Retrying..." : "Retry"}
          </button>
        </div>
      ) : authLoading ? (
        <div className="restoreNotice restoreNoticeLoading" role="status">
          Checking OpeningFit account...
        </div>
      ) : cloudRestoreLoading && !userData ? (
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
