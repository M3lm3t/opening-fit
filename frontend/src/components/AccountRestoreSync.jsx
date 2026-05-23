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
  setIsPremium,
}) {
  const {
    loading,
    profile,
    reportHistory,
    saveSettings,
    upsertUserData,
    refreshUserData,
  } = useAuth();
  const restoredUserRef = useRef(null);
  const lastSavedRef = useRef("");

  useEffect(() => {
    if (loading || !user?.id) return;
    if (restoredUserRef.current === user.id) return;

    const latestReport = profile?.last_report || reportHistory?.[0]?.report || null;

    if (profile?.username && typeof setUsername === "function") {
      setUsername(profile.username);
    }

    if (profile?.platform && typeof setPlatform === "function") {
      setPlatform(profile.platform);
    }

    if (latestReport && typeof setData === "function") {
      setData(latestReport);
    }

    if (typeof setIsPremium === "function") {
      setIsPremium(Boolean(profile?.is_premium));
    }

    restoredUserRef.current = user.id;
  }, [
    loading,
    profile,
    reportHistory,
    user?.id,
    setUsername,
    setPlatform,
    setData,
    setIsPremium,
  ]);

  useEffect(() => {
    async function saveAccount() {
      if (!user?.id) return;

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
  }, [data, platform, profile?.id, refreshUserData, saveSettings, upsertUserData, user, username]);

  return null;
}
