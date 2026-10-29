import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { requestAuth, sameOrigin } from "@/lib/auth";

// Log out (O12, E34): ends this device's session and clears its cookies. Local scope, because both
// partners share the one owner account (Q35) and one logging out must not sign out the other.
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  try {
    await (await requestAuth(request.nextUrl.protocol === "https:")).auth.signOut({ scope: "local" });
  } catch {}
  // Clear the cookies whatever Auth answered: when a refresh or revocation fails the SDK writes nothing,
  // and a kept cookie could be refreshed later without a new login (E34; Codex, T1.4 review). Same jar
  // as the SDK, so one writer decides each cookie.
  const jar = await cookies();
  for (const { name } of jar.getAll()) if (name.startsWith("sb-")) jar.delete(name);
  const res = NextResponse.redirect(new URL("/login", request.url), 303);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
