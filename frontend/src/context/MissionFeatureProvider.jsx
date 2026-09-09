import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { loadMissionFeatureState } from "../lib/missionFeatureGate.js";
import { useAuth } from "./AuthDataProvider.jsx";

const MissionFeatureContext = createContext("loading");
const MissionFeatureRetryContext = createContext(() => {});

export function MissionFeatureProvider({ children }) {
  const { user, session, authLoading } = useAuth();
  const [state, setState] = useState("loading");
  const [retryVersion, setRetryVersion] = useState(0);
  const retry = useCallback(() => setRetryVersion((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    setState("loading");
    if (authLoading) return () => { active = false; };
    loadMissionFeatureState({ userId: user?.id || "", accessToken: session?.access_token || "" })
      .then((next) => { if (active) setState(next); });
    return () => { active = false; };
  }, [authLoading, retryVersion, session?.access_token, user?.id]);
  return <MissionFeatureContext.Provider value={state}><MissionFeatureRetryContext.Provider value={retry}>{children}</MissionFeatureRetryContext.Provider></MissionFeatureContext.Provider>;
}

export function useMissionFeatureState() { return useContext(MissionFeatureContext); }
export function useMissionFeatureRetry() { return useContext(MissionFeatureRetryContext); }
