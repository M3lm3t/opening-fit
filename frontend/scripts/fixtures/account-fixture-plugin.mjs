// Service substitution exists only in this loopback test server, never in app code.
export const fixturePlugin = {
  name: 'local-account-fixtures', enforce: 'pre',
  transform(code, id) {
    const file = id.replaceAll('\\', '/');
    if (file.endsWith('/src/context/AuthDataProvider.jsx')) return 'export { AuthDataProvider, useAuth } from "/scripts/fixtures/account-auth.jsx";';
    if (file.endsWith('/src/lib/supabaseClient.js')) return `
      export const isSupabaseConfigured = true;
      export const SUPABASE_AUTH_STORAGE_KEY = 'fixture-auth';
      export const clearStoredSupabaseSession = () => {};
      export const diagnoseSupabase = async () => ({ok:true});
      const query = new Proxy({}, { get: (_t, key) => key === 'then' ? (resolve) => Promise.resolve({data:[],error:null}).then(resolve) : () => query });
      export const supabase = { from: () => query, rpc: async () => ({data:{currentStreak:window.__accountFixture?.ineligible ? 0 : 1},error:null}), auth: { getUser: async () => ({data:{user:null}}), getSession: async () => ({data:{session:window.__accountFixture?.mission ? {access_token:"local-fixture-only"} : null}}), onAuthStateChange: () => ({data:{subscription:{unsubscribe(){}}}}) } };`;
    if (file.endsWith('/src/services/userDataService.js')) return `${code.replace('export async function upsertUserProfile(', 'async function originalUpsertUserProfile(').replace('export async function getCurrentUser(', 'async function originalGetCurrentUser(').replace('export async function getUserProfile(', 'async function originalGetUserProfile(')}
      export { writeFixtureProfile as upsertUserProfile, getFixtureProfile as getUserProfile } from '/scripts/fixtures/account-auth.jsx';
      import { fixtureUser } from '/scripts/fixtures/account-auth.jsx';
      export async function getCurrentUser() { return fixtureUser; }
    `;
  },
};
