import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

// Local Supabase only (playwright.config.ts): synthetic owner accounts, a clean login limiter, and a
// per-run password for vegenus_server, which the migration creates without login (design 3 §3.9).
export default async function globalSetup() {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_DB_URL, VEGENUS_SERVER_DB_PASSWORD } = process.env;
  if (!SUPABASE_DB_URL) return; // no local stack (a11y job): the owner-auth spec is not run there

  const sql = postgres(SUPABASE_DB_URL, { max: 1 });
  await sql.unsafe(`alter role vegenus_server login password '${VEGENUS_SERVER_DB_PASSWORD}'`);
  await sql`truncate public.rate_limit_hits`;
  await sql.end();

  // Closed registration: accounts exist only because the owner (here: this setup) creates them.
  const admin = createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!).auth.admin;
  for (const name of ["chromium", "webkit", "chromium-limited", "webkit-limited"]) {
    const { error } = await admin.createUser({
      email: `owner-${name}@example.test`,
      password: "placeholder-password-1",
      email_confirm: true,
    });
    if (error && error.code !== "email_exists") throw error;
  }

  // Teardown: back to the migration's state (roles outlive `supabase db reset`; the schema lint checks it).
  return async () => {
    const sql = postgres(SUPABASE_DB_URL, { max: 1 });
    await sql`alter role vegenus_server nologin password null`;
    await sql.end();
  };
}
