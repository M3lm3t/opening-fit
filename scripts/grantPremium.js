const fs = require("fs");
const path = require("path");

function requireSupabaseClient() {
  try {
    return require("@supabase/supabase-js");
  } catch (rootError) {
    try {
      return require(path.resolve(__dirname, "../frontend/node_modules/@supabase/supabase-js"));
    } catch {
      throw rootError;
    }
  }
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArguments(argv) {
  const apply = argv.includes("--apply");
  const positional = argv.filter((value) => !value.startsWith("--"));
  const userId = String(positional[0] || "").trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(userId)) {
    throw new Error("Usage: npm run grant-premium -- <user-uuid> [--apply]");
  }
  return { apply, userId };
}

function redactUserId(userId) {
  return `${userId.slice(0, 8)}…${userId.slice(-4)}`;
}

function inspectEntitlement(row) {
  if (!row) return { allowed: true, action: "create_lifetime" };
  if (["monthly_subscription", "annual_subscription"].includes(row.access_type)) {
    return { allowed: false, reason: "existing_subscription" };
  }
  const canonicalLifetime = row.access_type === "lifetime"
    && !row.stripe_subscription_id
    && row.checkout_mode !== "subscription"
    && !row.plan_interval
    && !row.stripe_status
    && !row.current_period_start
    && !row.current_period_end
    && !row.expires_at;
  if (!canonicalLifetime) return { allowed: false, reason: "ambiguous_entitlement" };
  return { allowed: true, action: "preserve_lifetime" };
}

async function run(argv = process.argv.slice(2)) {
  const { apply, userId } = parseArguments(argv);
  const root = path.resolve(__dirname, "..");
  loadEnvFile(path.join(root, ".env"));
  loadEnvFile(path.join(root, ".env.local"));

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Refusing to run: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const { createClient } = requireSupabaseClient();
  const client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const target = redactUserId(userId);

  const [{ data: profiles, error: profileError }, { data: entitlements, error: entitlementError }] = await Promise.all([
    client.from("profiles").select("user_id,is_premium").eq("user_id", userId).limit(1),
    client.from("premium_entitlements")
      .select("access_type,status,expires_at,stripe_subscription_id,checkout_mode,plan_interval,stripe_status,current_period_start,current_period_end")
      .eq("user_id", userId).limit(1),
  ]);
  if (profileError) throw new Error(`Profile preflight failed: ${profileError.message}`);
  if (entitlementError) throw new Error(`Entitlement preflight failed: ${entitlementError.message}`);
  if (!profiles?.length) throw new Error(`Target profile ${target} does not exist.`);

  const decision = inspectEntitlement(entitlements?.[0] || null);
  if (!decision.allowed) {
    throw new Error(`Manual lifetime grant refused for ${target}: ${decision.reason}.`);
  }

  if (!apply) {
    console.log(JSON.stringify({ mode: "dry-run", target, would: decision.action }, null, 2));
    console.log("No changes made. Re-run with --apply after reviewing this result.");
    return { mode: "dry-run", action: decision.action };
  }

  const { data, error } = await client.rpc("grant_manual_lifetime_entitlement", {
    p_user_id: userId,
    p_reason: "manual_support",
  });
  if (error) throw new Error(`Atomic manual lifetime grant failed: ${error.message}`);

  console.log(JSON.stringify({ mode: "applied", target, result: data }, null, 2));
  return { mode: "applied", result: data };
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}

module.exports = { inspectEntitlement, parseArguments, redactUserId, run };
