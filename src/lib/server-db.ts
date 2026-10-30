// The only connection as vegenus_server (design 3 §3.9): writes made without a verified identity. Its
// credentials are server-only; src/lib/server-db.test.ts fails if a module outside the routes that need it imports this.
import { createHmac } from "node:crypto";
import postgres from "postgres";

// prepare: false because the Supabase pooler runs in transaction mode.
const sql = postgres(process.env.VEGENUS_SERVER_DB_URL!, { max: 1, prepare: false });

// Keys for rate_limit_hits: no raw IP or address reaches the database. A missing secret throws.
const hmac = (value: string) => createHmac("sha256", process.env.VEGENUS_HMAC_SECRET!).update(value).digest();

// ponytail: the client IP is the first x-forwarded-for entry, which Vercel sets (unverified until the
// first deploy); on another host this must change
const clientIp = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

export async function exchangeAllowed(request: Request): Promise<boolean> {
  const [row] = await sql`select public.guest_exchange_attempt(${hmac(`ip:${clientIp(request)}`)}) as ok`;
  return row.ok;
}

export async function loginAllowed(request: Request, email: string): Promise<boolean> {
  const [row] = await sql`select public.login_attempt(${hmac(`ip:${clientIp(request)}`)}, ${hmac(`email:${email}`)}) as ok`;
  return row.ok;
}
