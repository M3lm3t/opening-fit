import { logUserActivity } from "./retentionService";

const RETENTION_EVENT_KEY = "openingFit:retentionEvents";
const pendingEvents = new Set();

export const RETENTION_EVENTS = {
  session_started: 5,
  session_completed: 25,
  report_generated: 20,
  goal_created: 10,
  goal_completed: 50,
  data_imported: 15,
  profile_updated: 5,
};

function readLoggedEvents() {
  try {
    const stored = JSON.parse(localStorage.getItem(RETENTION_EVENT_KEY) || "{}");
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
}

function writeLoggedEvents(events) {
  try {
    localStorage.setItem(RETENTION_EVENT_KEY, JSON.stringify(events));
  } catch {
    // Retention should never depend on browser storage availability.
  }
}

function hasLoggedEvent(dedupeKey) {
  const events = readLoggedEvents();
  return Boolean(events[dedupeKey]);
}

function markLogged(dedupeKey) {
  if (!dedupeKey) return;

  const events = readLoggedEvents();
  events[dedupeKey] = new Date().toISOString();
  writeLoggedEvents(events);
}

export function buildReportRetentionKey(report, fallback = {}) {
  const username =
    report?.username ||
    report?.playerName ||
    report?.player_name ||
    fallback.username ||
    "unknown";
  const platform =
    report?.platform ||
    report?.importPlatform ||
    report?.import_platform ||
    fallback.platform ||
    "unknown";
  const games =
    report?.gamesImported ||
    report?.games_imported ||
    report?.totalGames ||
    report?.total_games ||
    fallback.games ||
    0;
  const timestamp =
    report?.importedAt ||
    report?.imported_at ||
    report?.lastUpdated ||
    report?.last_updated ||
    fallback.timestamp ||
    "";

  return `${platform}:${username}:${games}:${timestamp}`;
}

export function logRetentionEvent(activityType, metadata = {}, options = {}) {
  const points = RETENTION_EVENTS[activityType];
  if (points === undefined) return false;

  const dedupeKey = options.dedupeKey
    ? `${activityType}:${options.dedupeKey}`
    : "";

  if (dedupeKey && (hasLoggedEvent(dedupeKey) || pendingEvents.has(dedupeKey))) {
    return false;
  }

  if (dedupeKey) pendingEvents.add(dedupeKey);

  Promise.resolve(
    logUserActivity(activityType, points, {
      ...metadata,
      ...(dedupeKey ? { dedupe_key: dedupeKey } : {}),
    })
  )
    .then((result) => {
      if (result && dedupeKey) markLogged(dedupeKey);
    })
    .catch((error) => {
      console.error("OpeningFit retention event failed.", error);
    })
    .finally(() => {
      if (dedupeKey) pendingEvents.delete(dedupeKey);
    });

  return true;
}
