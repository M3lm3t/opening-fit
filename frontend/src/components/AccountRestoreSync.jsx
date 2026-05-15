import { useEffect, useRef } from "react";
import { loadAccountProfile, syncAccountProfile } from "../accountApi";

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
  const restoredUserRef = useRef(null);
  const lastSavedRef = useRef("");

  useEffect(() => {
    let cancelled = false;

    async function restoreAccount() {
      if (!user?.id) return;
      if (restoredUserRef.current === user.id) return;

      try {
        const result = await loadAccountProfile(user.id);
        const profile = result?.profile;

        if (!profile || cancelled) {
          restoredUserRef.current = user.id;
          return;
        }

        if (profile.username && typeof setUsername === "function") {
          setUsername(profile.username);
        }

        if (profile.platform && typeof setPlatform === "function") {
          setPlatform(profile.platform);
        }

        if (profile.last_report && typeof setData === "function") {
          setData(profile.last_report);
        }

        if (typeof setIsPremium === "function") {
          setIsPremium(Boolean(profile.is_premium));
        }

        restoredUserRef.current = user.id;
      } catch (error) {
        console.warn("Could not restore Opening Fit account profile", error);
      }
    }

    restoreAccount();

    return () => {
      cancelled = true;
    };
  }, [user?.id, setUsername, setPlatform, setData, setIsPremium]);

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
      lastSavedRef.current = saveSignature;

      try {
        await syncAccountProfile({
          user,
          username,
          platform,
          lastReport: data || null,
        });
      } catch (error) {
        console.warn("Could not save Opening Fit account profile", error);
      }
    }

    saveAccount();
  }, [user, username, platform, data]);

  return null;
}
