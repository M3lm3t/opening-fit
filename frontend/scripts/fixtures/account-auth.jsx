// Imported only by the local Playwright/Vite harness. Never part of the app entry.
import { useSyncExternalStore } from 'react';
import { resolvePremiumEntitlement } from '/src/lib/premiumEntitlement.js';

const config = window.__accountFixture || {};
const listeners = new Set();
const user = config.signedOut ? null : { id: '00000000-0000-4000-8000-000000000021', email: config.long ? 'alexandra.margaret.worthington.long.account.name@example.test' : 'alex@example.test', user_metadata: { full_name: config.long ? 'Alexandra-Margaret Baldegger-Worthington with a long display name' : 'Alex Morgan' }, app_metadata: { provider: 'email' } };
const rows = config.plan && config.plan !== 'free' ? [{ access_type: config.plan, status: 'active', current_period_end: '2099-01-01T00:00:00Z', stripe_customer_id: 'cus_fixture', is_grandfathered_lifetime: config.plan === 'lifetime' }] : [];
const entitlement = resolvePremiumEntitlement(rows);
let savedProfile = { id: user?.id, chesscom_username: config.empty ? '' : config.long ? 'AlexandraMargaretVeryLongChessUsername' : 'AlexMorganChess', lichess_username: config.empty ? '' : 'AlexLichess' };
let state;
const emit = (patch) => { state = { ...state, ...patch }; for (const listener of listeners) listener(); };
const noop = async () => ({});
export async function writeFixtureProfile(_user, patch) {
  window.__accountTest.writes.push({ table: 'profiles', patch });
  if (window.__accountTest.holdSave) await new Promise(resolve => { window.__accountTest.releaseSave = resolve; });
  await new Promise(resolve => setTimeout(resolve, 180));
  if (window.__accountTest.failSave) throw new Error('Fixture save failed. Your changes have not been saved.');
  savedProfile = { ...savedProfile, ...patch };
  return savedProfile;
}
const refresh = async () => {
  if (window.__accountTest.failRefresh) return null;
  emit({ profile: savedProfile, profileLoading: false, profileLoaded: true, syncStatus: 'synced', lastSavedAt: '2026-09-19T12:00:00Z' });
  return { profile: savedProfile };
};
state = {
  user, session: user ? { user, access_token: 'local-fixture-only' } : null,
  profile: config.loading ? null : savedProfile, entitlement, hasPremiumAccess: entitlement.hasPremiumAccess,
  isSupabaseConfigured: true, loading: false, authLoading: false, hydrated: true,
  profileLoading: Boolean(config.loading), profileLoaded: !config.loading, cloudRestored: true,
  profileError: config.error ? 'Fixture cloud restore failed. Your saved account data could not be loaded.' : '',
  error: '', restoreError: '', restoreInProgress: false, syncStatus: config.error ? 'error' : 'idle', lastSavedAt: null, syncError: '',
  reportHistory: [], analysedGames: [], retentionSnapshots: [], recommendationHistory: [], openingFitUserState: config.history ? [{ coach_progress: { openingTraining: { completedLines: { 'fixture-line': true } } } }] : [], history: [],
  settings: { preferences: {} }, notificationPreferences: [], premiumEntitlements: rows,
  retentionActivity: [], retentionStreaks: [], retentionGoals: [], retentionAchievements: [], weeklyReports: [],
  refreshUserData: refresh, restoreCloudSnapshot: async () => ({ ok: true, reason: 'Local fixture restored.' }),
  saveReport: noop, saveAnalysedGames: noop, recordActivity: noop, saveSettings: noop, saveRecommendationHistory: noop, saveRetentionSnapshot: noop,
  signOut: async () => emit({ user: null, session: null }),
  upsertUserData: async (table, patch) => {
    window.__accountTest.writes.push({ table, patch });
    await new Promise(resolve => setTimeout(resolve, 180));
    if (window.__accountTest.failSave) throw new Error('Fixture save failed. Changes remain unsaved.');
    if (table === 'notification_preferences') emit({ notificationPreferences: [{ ...patch }] });
    return patch;
  },
};
window.__accountTest = { writes: [], failSave: false, failRefresh: false, patch: emit, refresh };
export function AuthDataProvider({ children }) { return children; }
export function useAuth() { return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => state); }
export const fixtureUser = user;
export const getFixtureProfile = () => savedProfile;
