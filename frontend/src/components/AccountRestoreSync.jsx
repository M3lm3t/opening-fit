import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthDataProvider";

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
    restoreError,
    profile,
    openingFitUserState,
    reportHistory,
    saveSettings,
    upsertUserData,
    refreshUserData,
  } = useAuth();
  const restoredUserRef = useRef(null);
  const lastSavedRef = useRef("");

  useEffect(() => {
    if (loading || profileLoading || !user?.id) return;
    if (restoreError) return;
    if (restoredUserRef.current === user.id) return;

    const primaryWorkspace = openingFitUserState?.[0] || null;
    const latestReport =
      primaryWorkspace?.last_report ||
      profile?.last_report ||
      reportHistory?.[0]?.report ||
      null;

    if ((primaryWorkspace?.username || profile?.username) && typeof setUsername === "function") {
      setUsername(primaryWorkspace?.username || profile.username);
    }

    if ((primaryWorkspace?.platform || profile?.platform) && typeof setPlatform === "function") {
      setPlatform(primaryWorkspace?.platform || profile.platform);
    }

    if (latestReport && typeof setData === "function") {
      setData(latestReport);
    }

    restoredUserRef.current = user.id;
  }, [
    loading,
    profileLoading,
    restoreError,
    openingFitUserState,
    profile,
    reportHistory,
    user?.id,
    setUsername,
    setPlatform,
    setData,
  ]);

  useEffect(() => {
    async function saveAccount() {
      if (!user?.id) return;
      if (profileLoading) return;
      if (restoreError) return;
      if (restoredUserRef.current !== user.id) return;

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
          },
        });

        await refreshUserData(user);
      } catch (error) {
        console.warn("Could not save Opening Fit account data", error);
      }
    }

    saveAccount();
  }, [data, platform, profile?.id, profile?.last_report, profileLoading, refreshUserData, restoreError, saveSettings, upsertUserData, user, username]);

  return null;
}
