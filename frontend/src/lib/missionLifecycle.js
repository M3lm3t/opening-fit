export const MISSION_ANALYSIS_COMPLETED_EVENT = "openingfit:mission-analysis-completed";

export function notifyMissionAnalysisCompleted(target = globalThis, detail = null) {
  if (typeof target?.dispatchEvent !== "function") return false;
  const CustomEventConstructor = target.CustomEvent || globalThis.CustomEvent;
  const EventConstructor = target.Event || globalThis.Event;
  if (typeof CustomEventConstructor === "function") target.dispatchEvent(new CustomEventConstructor(MISSION_ANALYSIS_COMPLETED_EVENT, { detail }));
  else if (typeof EventConstructor === "function") target.dispatchEvent(new EventConstructor(MISSION_ANALYSIS_COMPLETED_EVENT));
  else return false;
  return true;
}

export function subscribeToMissionAnalysisCompleted(listener, target = globalThis) {
  if (typeof listener !== "function" || typeof target?.addEventListener !== "function") return () => {};
  target.addEventListener(MISSION_ANALYSIS_COMPLETED_EVENT, listener);
  return () => target.removeEventListener?.(MISSION_ANALYSIS_COMPLETED_EVENT, listener);
}
