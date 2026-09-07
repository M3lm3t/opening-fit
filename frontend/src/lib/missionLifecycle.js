export const MISSION_ANALYSIS_COMPLETED_EVENT = "openingfit:mission-analysis-completed";

export function notifyMissionAnalysisCompleted(target = globalThis) {
  if (typeof target?.dispatchEvent !== "function") return false;
  const EventConstructor = target.Event || globalThis.Event;
  if (typeof EventConstructor !== "function") return false;
  target.dispatchEvent(new EventConstructor(MISSION_ANALYSIS_COMPLETED_EVENT));
  return true;
}

export function subscribeToMissionAnalysisCompleted(listener, target = globalThis) {
  if (typeof listener !== "function" || typeof target?.addEventListener !== "function") return () => {};
  target.addEventListener(MISSION_ANALYSIS_COMPLETED_EVENT, listener);
  return () => target.removeEventListener?.(MISSION_ANALYSIS_COMPLETED_EVENT, listener);
}
