import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import postgres from "postgres";

const E2E_PAGE = "00000000-0000-0000-0000-0000000000e2";
const E2E_PAGE_B = "00000000-0000-0000-0000-0000000000e3";

// Local Supabase only (playwright.config.ts): synthetic owner accounts, a clean login limiter, and a
// per-run password for vegenus_server, which the migration creates without login (design 3 §3.9).
export default async function globalSetup() {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_DB_URL, VEGENUS_SERVER_DB_PASSWORD } = process.env;
  if (!SUPABASE_DB_URL) return; // no local stack (a11y job): the owner-auth spec is not run there

  const sql = postgres(SUPABASE_DB_URL, { max: 1 });
  await sql.unsafe(`alter role vegenus_server login password '${VEGENUS_SERVER_DB_PASSWORD}'`);
  await sql`truncate public.rate_limit_hits`;

  // T1.5a: two live Token-only pages, each with a random guest token for this run (only hashes are stored).
  // The second page enables a different section, so a test can tell which token opened the guest home.
  for (const [id, env, section] of [
    [E2E_PAGE, "E2E_GUEST_TOKEN", "memories"],
    [E2E_PAGE_B, "E2E_GUEST_TOKEN_B", "zodiac"],
  ]) {
    const token = randomBytes(32).toString("base64url");
    process.env[env] = token;
    await sql`delete from public.pages where id = ${id}`;
    await sql`insert into public.pages (id, theme, default_lang, visibility, timezone, copy_published_at)
      values (${id}, 'a_dreamy', 'en', 'token_only', 'UTC', now())`;
    await sql`update public.page_sections set enabled = true where page_id = ${id} and section in ('home', ${section})`;
    await sql`insert into public.guest_tokens (page_id, version, token_hash, request_id)
      values (${id}, 1, sha256(convert_to(${token}, 'UTF8')), gen_random_uuid())`;
  }
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
