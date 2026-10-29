// The only connection as vegenus_server (design 3 §3.9): writes made without a verified identity. Its
// credentials are server-only; eslint.config.mjs forbids importing this module outside the routes that need it.
import { createHmac } from "node:crypto";
import postgres from "postgres";

// prepare: false because the Supabase pooler runs in transaction mode.
const sql = postgres(process.env.VEGENUS_SERVER_DB_URL!, { max: 1, prepare: false });

// Keys for rate_limit_hits: no raw IP or address reaches the database. A missing secret throws.
const hmac = (value: string) => createHmac("sha256", process.env.VEGENUS_HMAC_SECRET!).update(value).digest();

export async function loginAllowed(ip: string, email: string): Promise<boolean> {
  const [row] = await sql`select public.login_attempt(${hmac(`ip:${ip}`)}, ${hmac(`email:${email}`)}) as ok`;
  return row.ok;
}
