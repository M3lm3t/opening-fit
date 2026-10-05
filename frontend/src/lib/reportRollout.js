export const REPORT_CAPABILITIES = Object.freeze([
  "report_decision_v7", "repertoire_health_v4", "opening_suitability_v2",
  "deterministic_opening_fit_metrics_v2", "report_comparison_v1", "isolated_report_store_v1",
]);
// A new client build must opt in; backend and database switches also default off.
export const STAGE6_REPORTS = import.meta.env?.VITE_STAGE6_REPORTS_ENABLED === "true";
export const PILOT_CLIENT = "web-report-pilot-v1";
export const REPORT_ONLY_MESSAGE = "This pilot supports report import and reading only. Missions, repertoire changes and training completion are unavailable. Those actions cannot save changes or record completion.";
let pilotActive = false;
export const isReportPilot = () => pilotActive;
export function setReportPilot(active) { pilotActive = active === true; }
const resolveEnabled = (enabled) => typeof enabled === "function" ? enabled() : enabled;
export const REPORT_COLLECTIONS = new Set([
  "report_history", "profiles", "openingfit_user_state", "openingfit_retention_snapshots",
  "recommendation_history", "analysed_games", "activity_history", "analysis_history",
  "saved_recommendations", "weekly_reports", "user_profiles", "repertoire", "saved_openings",
  "weekly_training_plans", "coaching_weekly_reviews", "coaching_response_plans",
  "repertoire_entries", "repertoires", "settings",
]);

export function hasNewReport(value) {
  if (typeof value === "string") return REPORT_CAPABILITIES.concat("stage6_v1").some((marker) => value.includes(marker));
  return value != null && typeof value === "object" && Object.values(value).some(hasNewReport);
}

export function reportStorageKey(key, enabled = isReportPilot) {
  enabled = resolveEnabled(enabled);
  if (enabled && /^openingfit\.(?!stage6\.).*(report|analysis|progress|repertoire|coach|training|recommendation|study|opportunity|habit)/i.test(String(key))) {
    return String(key).replace("openingfit.", "openingfit.stage6.");
  }
  return enabled && /^openingFit:(?!stage6:).*(report|analysis|progress|repertoire|coach|training|recommendation|study|opportunity|habit)/i.test(String(key))
    ? String(key).replace("openingFit:", "openingFit:stage6:") : key;
}

export function isolatedLocalStorage(getStorage, enabled = isReportPilot) {
  return {
    getItem(key) {
      const storage = getStorage();
      const mapped = reportStorageKey(key, enabled);
      const value = storage?.getItem(mapped);
      if (value === "__openingfit_deleted__") return null;
      return value ?? (mapped !== key ? storage?.getItem(key) : null);
    },
    setItem(key, value) { getStorage()?.setItem(reportStorageKey(key, enabled), value); },
    removeItem(key) {
      const storage = getStorage();
      const mapped = reportStorageKey(key, enabled);
      if (mapped !== key) storage?.setItem(mapped, "__openingfit_deleted__");
      else storage?.removeItem(key);
    },
  };
}

export const reportLocalStorage = isolatedLocalStorage(() => globalThis.localStorage);

export function isolatedReportClient(client, { enabled = isReportPilot, request } = {}) {
  if (!client) return client;
  const failure = () => Promise.resolve({ data: null, error: { code: "REPORT_ISOLATION", message: REPORT_ONLY_MESSAGE } });
  function query(collection) {
    const payload = { capabilities: REPORT_CAPABILITIES, collection, operation: "select", filters: [], order: [], limit: 50 };
    let invalid = false;
    let pending;
    const builder = {
      select() { return builder; },
      insert(values) { payload.operation = "insert"; payload.values = values; return builder; },
      upsert(values) { payload.operation = "upsert"; payload.values = values; return builder; },
      update(values) { payload.operation = "update"; payload.values = values; return builder; },
      delete() { invalid = true; return builder; },
      eq(field, value) { payload.filters.push([field, "eq", value]); return builder; },
      neq(field, value) { payload.filters.push([field, "neq", value]); return builder; },
      in(field, value) { payload.filters.push([field, "in", value]); return builder; },
      is(field, value) { payload.filters.push([field, "is", value]); return builder; },
      gte(field, value) { payload.filters.push([field, "gte", value]); return builder; },
      lte(field, value) { payload.filters.push([field, "lte", value]); return builder; },
      order(field, options = {}) { payload.order.push([field, options.ascending !== false]); return builder; },
      limit(value) { payload.limit = value; return builder; },
      single() { payload.single = "single"; return builder; },
      maybeSingle() { payload.single = "maybeSingle"; return builder; },
      then(resolve, reject) { pending ||= invalid ? failure() : request(payload); return pending.then(resolve, reject); },
    };
    return builder;
  }
  return new Proxy(client, {
    get(target, property) {
      if (property === "from") return (table) => {
        const active = resolveEnabled(enabled);
        if (active && REPORT_COLLECTIONS.has(table)) return query(table);
        const original = target.from(table);
        // Default-off builds must also refuse accidentally restored v4 payloads.
        return new Proxy(original, { get(builder, method) {
          if (active && method === "delete") return () => { const blocked = query(table); blocked.delete(); return blocked; };
          if (["insert", "upsert", "update"].includes(method)) return (value, ...args) => {
            if (hasNewReport(value) || (active && table !== "notification_preferences")) {
              const blocked = query(table); blocked.delete(); return blocked;
            }
            return builder[method](value, ...args);
          };
          const member = builder[method];
          return typeof member === "function" ? member.bind(builder) : member;
        } });
      };
      if (property === "rpc") return (name, params) => {
        // Legacy report-derived RPC mutations are deliberately not part of v2.
        // Never fall back to a legacy writer when a v2 operation is unsupported.
        if (hasNewReport(params) || (resolveEnabled(enabled) && name !== "get_meaningful_consistency")) return failure();
        return target.rpc(name, params);
      };
      const member = target[property];
      return typeof member === "function" ? member.bind(target) : member;
    },
  });
}
