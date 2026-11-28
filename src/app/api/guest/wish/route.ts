import type { NextRequest } from "next/server";
import { deviceId, guestAnswer as answer, guestRequest, setDevice } from "@/lib/guest";
import { isUuid } from "@/lib/owner-api";
import { postWish } from "@/lib/server-db";

// The size the database stores at most (10 code points per allowed character, data model §3.5); the caps in
// user-perceived characters (40, 500; Q34c, Q73) are the database's to check. NUL never reaches it: Postgres text
// cannot hold it and would fail with an error the guest could only retry.
const text = (value: unknown, max: number): value is string => typeof value === "string" && !value.includes("\0") && [...value].length <= max;

// Leave a wish, G6 (T3.2a; design 3 §3.9; E11, E46, E47). {submission_id, display_name, body, lang, consent,
// token? | page?} -> {status: "sent"} | 409 {error: "needs_consent"} (an older notice, T3.2c) | 429 {error:
// "rate_limited", retry_after, shared}. A token guest or a visitor on a Published
// page; the device cookie is issued or renewed here (Q103) and only its HMAC reaches the database.
export async function POST(request: NextRequest) {
  const req = await guestRequest(request);
  if (!req) return answer(null, 403);
  const b = req.body;
  if (!isUuid(b?.submission_id) || !text(b.display_name, 400) || !text(b.body, 5000) || !["en", "vi"].includes(b.lang)
    || !Number.isInteger(b.consent) || b.consent < 1 || b.consent > 32767) {
    return answer(null, 400);
  }
  if (!req.cred) return answer({ error: "not_available" }, 404);
  const device = deviceId(request);
  let result;
  try {
    result = await postWish(req.cred, { submission_id: b.submission_id, display_name: b.display_name, body: b.body, lang: b.lang, consent: b.consent }, device, request);
  } catch (error) {
    return (error as { code?: string }).code === "22023" ? answer({ error: "invalid" }, 400) : answer({ error: "unavailable" }, 503);
  }
  if (result === null) return answer({ error: "not_available" }, 404);
  if (result.status === "needs_consent") return answer({ error: "needs_consent" }, 409); // nothing charged, no cookie
  const res =
    result.status === "sent" ? answer({ status: "sent" }, 200)
    : answer({ error: "rate_limited", retry_after: result.retry_after, shared: result.shared }, 429);
  setDevice(res, device, request); // only for a post the page took or limited (privacy table)
  return res;
}
