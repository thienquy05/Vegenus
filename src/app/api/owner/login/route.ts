import { NextResponse, type NextRequest } from "next/server";
import { requestAuth, sameOrigin } from "@/lib/auth";
import { safeNext } from "@/lib/routes";
import { loginAllowed } from "@/lib/server-db";

// O1 form post (T1.4). Wrong password, unknown address and the rate limit give one answer (E22).
// ponytail: the client IP is the first x-forwarded-for entry, which Vercel sets (unverified until the
// first deploy); on another host this must change
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  const form = await request.formData().catch(() => null);
  const email = String(form?.get("email") ?? "").trim().toLowerCase();
  const password = String(form?.get("password") ?? "");
  const next = safeNext(String(form?.get("next") ?? ""));
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

  const go = (path: string) => {
    const res = NextResponse.redirect(new URL(path, request.url), 303);
    res.headers.set("Cache-Control", "no-store");
    return res;
  };
  const failed = go(`/login?error=1&next=${encodeURIComponent(next)}`);

  if (!email || !password || !(await loginAllowed(ip, email))) return failed;
  const { error } = await (await requestAuth(request.nextUrl.protocol === "https:")).auth.signInWithPassword({ email, password });
  return error ? failed : go(next);
}
