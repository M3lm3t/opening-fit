import { createContext, useContext, useEffect, useState } from "react";
import { loadMissionFeatureState } from "../lib/missionFeatureGate.js";

const MissionFeatureContext = createContext("loading");

export function MissionFeatureProvider({ children }) {
  const [state, setState] = useState("loading");
  useEffect(() => {
    let active = true;
    loadMissionFeatureState().then((next) => { if (active) setState(next); });
    return () => { active = false; };
  }, []);
  return <MissionFeatureContext.Provider value={state}>{children}</MissionFeatureContext.Provider>;
}

export function useMissionFeatureState() { return useContext(MissionFeatureContext); }
