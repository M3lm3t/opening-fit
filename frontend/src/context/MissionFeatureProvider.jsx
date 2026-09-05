import { createContext, useContext, useEffect, useState } from "react";
import { loadMissionFeatureState } from "../lib/missionFeatureGate.js";
import { useAuth } from "./AuthDataProvider.jsx";

const MissionFeatureContext = createContext("loading");

export function MissionFeatureProvider({ children }) {
  const { user, session, authLoading } = useAuth();
  const [state, setState] = useState("loading");
  useEffect(() => {
    let active = true;
    setState("loading");
    if (authLoading) return () => { active = false; };
    loadMissionFeatureState({ userId: user?.id || "", accessToken: session?.access_token || "" })
      .then((next) => { if (active) setState(next); });
    return () => { active = false; };
  }, [authLoading, session?.access_token, user?.id]);
  return <MissionFeatureContext.Provider value={state}>{children}</MissionFeatureContext.Provider>;
}

export function useMissionFeatureState() { return useContext(MissionFeatureContext); }
