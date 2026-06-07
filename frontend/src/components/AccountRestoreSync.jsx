import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthDataProvider";

const LOCAL_REPORT_KEY = "openingFit:lastAnalysis";
const MIGRATION_PREFIX = "openingFit:migratedLocalReport:";

function readLocalReport() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_REPORT_KEY) || "null");
    if (!parsed?.analysis) return null;

    const report = parsed.analysis;
    const stableKey = [
      parsed.platform || report.platform || report.importPlatform || "unknown",
      parsed.username || report.username || report.playerName || "unknown",
      report.analysisTimeFormat || report.analysis_time_format || "custom",
      report.importedAt || report.imported_at || report.lastUpdated || parsed.savedAt || "",
      report.gamesImported || report.total_games || report.gamesAnalysed || "",
    ].join(":");

    return {
      ...parsed,
      report,
      stableKey,
    };
  } catch {
    return null;
  }
}

export default function AccountRestoreSync({
  user,
  username,
  setUsername,
  platform,
  setPlatform,
  data,
  setData,
}) {
  const {
    loading,
    profileLoading,
    profileLoaded,
    restoreError,
    profile,
    openingFitUserState,
    reportHistory,
    restoreInProgress,
    saveSettings,
    saveReport,
    upsertUserData,
    refreshUserData,
  } = useAuth();
  const restoredUserRef = useRef(null);
  const lastSavedRef = useRef("");
  const migratedLocalRef = useRef("");

  useEffect(() => {
    if (loading || profileLoading || !profileLoaded || !user?.id) return;
    if (restoreInProgress) return;
    if (restoreError) return;
    if (restoredUserRef.current === user.id) return;

    const primaryWorkspace = openingFitUserState?.[0] || null;
    const latestReport =
      primaryWorkspace?.last_report ||
      profile?.last_report ||
      reportHistory?.[0]?.report ||
      null;
    const localReport = readLocalReport();

    if (
      (primaryWorkspace?.username || profile?.username || localReport?.username || localReport?.report?.username) &&
      typeof setUsername === "function"
    ) {
      setUsername(
        primaryWorkspace?.username ||
          profile.username ||
          localReport?.username ||
          localReport?.report?.username
      );
    }

    if ((primaryWorkspace?.platform || profile?.platform || localReport?.platform || localReport?.report?.platform) && typeof setPlatform === "function") {
      setPlatform(
        primaryWorkspace?.platform ||
          profile.platform ||
          localReport?.platform ||
          localReport?.report?.platform
      );
    }

    if (latestReport && typeof setData === "function") {
      setData(latestReport);
    } else if (localReport?.report && typeof setData === "function") {
      setData(localReport.report);
    }

    restoredUserRef.current = user.id;
  }, [
    loading,
    profileLoaded,
    profileLoading,
    restoreError,
    openingFitUserState,
    profile,
    reportHistory,
    restoreInProgress,
    user?.id,
    setUsername,
    setPlatform,
    setData,
  ]);

  useEffect(() => {
    async function saveAccount() {
      if (!user?.id) return;
      if (restoreInProgress) return;
      if (profileLoading) return;
      if (!profileLoaded) return;
      if (restoreError) return;
      if (restoredUserRef.current !== user.id) return;
      if (!data) {
        const emptySignature = JSON.stringify({
          userId: user.id,
          username,
          platform,
          hasReport: false,
        });
        if (lastSavedRef.current === emptySignature) return;
        lastSavedRef.current = emptySignature;

        await saveSettings({
          preferences: {
            lastUsername: username || "",
            lastPlatform: platform || "",
          },
        });
        return;
      }

      const saveSignature = JSON.stringify({
        userId: user.id,
        username,
        platform,
        hasReport: Boolean(data),
        reportUsername:
          data?.username ||
          data?.playerName ||
          data?.player_name ||
          data?.profile?.username ||
          "",
        reportGames:
          data?.games_imported ||
          data?.gamesImported ||
          data?.total_games ||
          data?.totalGames ||
          "",
      });

      if (lastSavedRef.current === saveSignature) return;

      if (data && profile?.last_report === data && !lastSavedRef.current) {
        lastSavedRef.current = saveSignature;
        return;
      }

      lastSavedRef.current = saveSignature;

      try {
        const localReport = readLocalReport();
        const migrationKey = localReport?.stableKey
          ? `${MIGRATION_PREFIX}${user.id}:${localReport.stableKey}`
          : "";
        const shouldMarkMigrated =
          migrationKey &&
          localStorage.getItem(migrationKey) !== "true" &&
          (localReport?.report === data ||
            JSON.stringify(localReport?.report || null) === JSON.stringify(data || null));

        await upsertUserData(
          "openingfit_user_state",
          {
            platform: platform || "unknown",
            username: username || "guest",
            last_report: data || null,
          },
          { onConflict: "user_id,platform,username" }
        );

        await upsertUserData(
          "profiles",
          {
            ...(profile?.id ? { id: profile.id } : {}),
            email: user.email || "",
            display_name:
              user.user_metadata?.full_name ||
              user.user_metadata?.display_name ||
              user.email ||
              "",
            username: username || null,
            platform: platform || null,
            last_report: data || null,
          },
          { onConflict: "user_id" }
        );

        await saveSettings({
          preferences: {
            lastUsername: username || "",
            lastPlatform: platform || "",
            ...(migrationKey && shouldMarkMigrated ? { lastLocalReportMigrationKey: migrationKey } : {}),
          },
        });

        if (migrationKey && shouldMarkMigrated && migratedLocalRef.current !== migrationKey) {
          await saveReport?.(data, {
            username: username || data?.username || data?.playerName || "Unknown player",
            platform: platform || data?.platform || data?.importPlatform || "unknown",
            games: data?.gamesImported || data?.total_games || data?.gamesAnalysed || 0,
            savedAt: localReport?.savedAt || new Date().toISOString(),
            migratedFromLocal: true,
          });
          localStorage.setItem(migrationKey, "true");
          migratedLocalRef.current = migrationKey;
        }

        await refreshUserData(user);
      } catch (error) {
        console.error("OpeningFit cloud account save failed", error);
      }
    }

    saveAccount();
  }, [data, platform, profile?.id, profile?.last_report, profileLoaded, profileLoading, refreshUserData, restoreError, restoreInProgress, saveReport, saveSettings, upsertUserData, user, username]);

  return null;
}
