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

const { createClient } = requireSupabaseClient();

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

const root = path.resolve(__dirname, "..");
loadEnvFile(path.join(root, ".env"));
loadEnvFile(path.join(root, ".env.local"));

const email = String(process.argv[2] || "").trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Usage: npm run grant-premium -- user@example.com");
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error("Refusing to run: SUPABASE_URL is missing.");
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error("Refusing to run: SUPABASE_SERVICE_ROLE_KEY is missing.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function updateProfileById(profileId, payload) {
  const optionalColumns = new Set([
    "premium_status",
    "premium_source",
    "premium_updated_at",
  ]);
  const activePayload = { ...payload };

  while (true) {
    const { data, error } = await supabase
      .from("profiles")
      .update(activePayload)
      .eq("id", profileId)
      .select("*");

    if (!error) return data || [];

    const missing = [...optionalColumns].filter(
      (column) => column in activePayload && String(error.message || "").includes(column)
    );
    if (!missing.length) throw error;

    for (const column of missing) delete activePayload[column];
  }
}

async function main() {
  const { data: profiles, error: selectError } = await supabase
    .from("profiles")
    .select("*")
    .ilike("email", email)
    .limit(1);

  if (selectError) throw selectError;
  if (!profiles || profiles.length < 1) {
    console.error(`No public.profiles row found for ${email}.`);
    process.exit(1);
  }

  const now = new Date().toISOString();
  const updated = await updateProfileById(profiles[0].id, {
    is_premium: true,
    updated_at: now,
    premium_status: "active",
    premium_source: "manual_support",
    premium_updated_at: now,
  });

  if (!updated.length) {
    console.error(`No row updated for ${email}.`);
    process.exit(1);
  }

  console.log("Updated premium profile:");
  console.log(JSON.stringify(updated[0], null, 2));
}

main().catch((error) => {
  console.error("Grant premium failed:", error.message || error);
  process.exit(1);
});
