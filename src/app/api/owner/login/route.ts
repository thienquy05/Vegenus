import { NextResponse, type NextRequest } from "next/server";
import { requestAuth, sameOrigin } from "@/lib/auth";
import { safeNext } from "@/lib/routes";
import { loginAllowed } from "@/lib/server-db";

// O1 form post (T1.4). Wrong password, unknown address and the rate limit give one answer (E22).
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  const form = await request.formData().catch(() => null);
  const email = String(form?.get("email") ?? "").trim().toLowerCase();
  const password = String(form?.get("password") ?? "");
  const next = safeNext(String(form?.get("next") ?? ""));

  const go = (path: string) => {
    const res = NextResponse.redirect(new URL(path, request.url), 303);
    res.headers.set("Cache-Control", "no-store");
    return res;
  };
  const failed = go(`/login?error=1&next=${encodeURIComponent(next)}`);

  if (!email || !password) return failed;
  try {
    if (!(await loginAllowed(request, email))) return failed;
    const { error } = await (await requestAuth(request.nextUrl.protocol === "https:")).auth.signInWithPassword({ email, password });
    return error ? failed : go(next);
  } catch {
    // A limiter or Auth failure looks like any failed login (E22), not a framework 500.
    return failed;
  }
}
