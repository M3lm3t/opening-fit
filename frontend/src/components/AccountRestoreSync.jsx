import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthDataProvider";

const LOCAL_REPORT_KEY = "openingFit:lastAnalysis";
const MIGRATION_PREFIX = "openingFit:migratedLocalReport:";

function getImportedAccountUsername(report, fallback = "") {
  return (
    report?.username ||
    report?.playerName ||
    report?.player_name ||
    report?.requestedUsername ||
    report?.requested_username ||
    report?.profile?.username ||
    report?.account?.username ||
    fallback ||
    ""
  );
}

function getImportedAccountPlatform(report, fallback = "") {
  const value = String(
    report?.platform ||
      report?.importPlatform ||
      report?.import_platform ||
      report?.profile?.platform ||
      report?.account?.platform ||
      fallback ||
      ""
  ).toLowerCase();
  if (value.includes("lichess")) return "lichess";
  if (value.includes("chess.com") || value.includes("chesscom")) return "chesscom";
  return value;
}

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

function hasReportPayload(report) {
  return Boolean(report && typeof report === "object" && Object.keys(report).length);
}

function rowTimestamp(row = {}, report = null) {
  const raw =
    row.updated_at ||
    row.created_at ||
    row.summary?.reportDate ||
    row.summary?.savedAt ||
    report?.lastUpdated ||
    report?.last_updated ||
    report?.importedAt ||
    report?.imported_at ||
    "";
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function latestByTimestamp(items = []) {
  return [...items].filter(Boolean).sort((a, b) => b.timestamp - a.timestamp)[0] || null;
}

function getLatestRestorableReport({ openingFitUserState = [], profile = null, reportHistory = [] }) {
  const workspaceCandidates = (Array.isArray(openingFitUserState) ? openingFitUserState : [])
    .filter((row) => hasReportPayload(row?.last_report))
    .map((row) => ({
      report: row.last_report,
      username: row.username,
      platform: row.platform,
      timestamp: rowTimestamp(row, row.last_report),
    }));

  const profileCandidate = hasReportPayload(profile?.last_report)
    ? [{
        report: profile.last_report,
        username: profile.username,
        platform: profile.platform,
        timestamp: rowTimestamp(profile, profile.last_report),
      }]
    : [];

  const historyCandidates = (Array.isArray(reportHistory) ? reportHistory : [])
    .filter((row) => hasReportPayload(row?.report))
    .map((row) => ({
      report: row.report,
      username: row.username || row.summary?.username,
      platform: row.platform || row.summary?.platform,
      timestamp: rowTimestamp(row, row.report),
    }));

  return latestByTimestamp([...workspaceCandidates, ...profileCandidate, ...historyCandidates]);
}

export default function AccountRestoreSync({
  user,
  username,
  setUsername,
  platform,
  setPlatform,
  data,
  setData,
  onRestoredReport,
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
    saveRetentionSnapshot,
    upsertUserData,
  } = useAuth();
  const restoredUserRef = useRef(null);
  const lastSavedRef = useRef("");
  const migratedLocalRef = useRef("");

  useEffect(() => {
    if (loading || profileLoading || !profileLoaded || !user?.id) return;
    if (restoreInProgress) return;
    if (restoreError) return;
    if (restoredUserRef.current === user.id) return;

    const latestCloudReport = getLatestRestorableReport({ openingFitUserState, profile, reportHistory });
    const latestReport = latestCloudReport?.report || null;
    const localReport = readLocalReport();
    const restoredUsername =
      getImportedAccountUsername(latestReport, latestCloudReport?.username || profile?.username) ||
      getImportedAccountUsername(localReport?.report, localReport?.username) ||
      "";
    const restoredPlatform =
      getImportedAccountPlatform(latestReport, latestCloudReport?.platform || profile?.platform) ||
      getImportedAccountPlatform(localReport?.report, localReport?.platform) ||
      "";

    if (restoredUsername && typeof setUsername === "function") {
      setUsername(restoredUsername);
    }

    if (restoredPlatform && typeof setPlatform === "function") {
      setPlatform(restoredPlatform);
    }

    if (latestReport && typeof setData === "function") {
      setData({
        ...latestReport,
        ...(restoredUsername ? { username: restoredUsername } : {}),
      });
      onRestoredReport?.({
        report: latestReport,
        username: restoredUsername,
        platform: restoredPlatform,
        source: "cloud",
      });
    } else if (localReport?.report && typeof setData === "function") {
      setData({
        ...localReport.report,
        ...(restoredUsername ? { username: restoredUsername } : {}),
      });
      onRestoredReport?.({
        report: localReport.report,
        username: restoredUsername,
        platform: restoredPlatform,
        source: "local",
      });
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
    onRestoredReport,
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

      const importedUsername = getImportedAccountUsername(data, username) || "guest";
      const importedPlatform = getImportedAccountPlatform(data, platform) || "unknown";
      const reportForSave = {
        ...data,
        username: importedUsername,
        importPlatform: data.importPlatform || importedPlatform,
        import_platform: data.import_platform || importedPlatform,
        platform: data.platform || importedPlatform,
      };

      const saveSignature = JSON.stringify({
        userId: user.id,
        username: importedUsername,
        platform: importedPlatform,
        hasReport: Boolean(data),
        reportUsername: importedUsername,
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
            platform: importedPlatform,
            username: importedUsername,
            last_report: reportForSave,
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
            username: importedUsername || null,
            platform: importedPlatform || null,
            last_report: reportForSave,
          },
          { onConflict: "user_id" }
        );

        await saveSettings({
          preferences: {
            lastUsername: importedUsername || "",
            lastPlatform: importedPlatform || "",
            ...(migrationKey && shouldMarkMigrated ? { lastLocalReportMigrationKey: migrationKey } : {}),
          },
        });

        const retentionSnapshot = await saveRetentionSnapshot?.(reportForSave, {
          username: importedUsername || "Unknown player",
          platform: importedPlatform || "unknown",
          games: data?.gamesImported || data?.games_imported || data?.total_games || data?.gamesAnalysed || 0,
          savedAt: reportForSave.importedAt || reportForSave.imported_at || reportForSave.lastUpdated || new Date().toISOString(),
          profileId: profile?.id || user.id,
        });

        if (!retentionSnapshot) {
          window.dispatchEvent(
            new CustomEvent("openingfit-toast", {
              detail: "Report saved. Retention history will sync after the cloud table is ready.",
            })
          );
        }

        if (migrationKey && shouldMarkMigrated && migratedLocalRef.current !== migrationKey) {
          await saveReport?.(reportForSave, {
            username: importedUsername || "Unknown player",
            platform: importedPlatform || "unknown",
            games: data?.gamesImported || data?.total_games || data?.gamesAnalysed || 0,
            savedAt: localReport?.savedAt || new Date().toISOString(),
            migratedFromLocal: true,
          });
          localStorage.setItem(migrationKey, "true");
          migratedLocalRef.current = migrationKey;
        }

      } catch (error) {
        console.error("OpeningFit cloud account save failed", error);
      }
    }

    saveAccount();
  }, [data, platform, profile?.id, profile?.last_report, profileLoaded, profileLoading, restoreError, restoreInProgress, saveReport, saveRetentionSnapshot, saveSettings, upsertUserData, user, username]);

  return null;
}
