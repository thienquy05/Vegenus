// Refreshes the owner session cookie before an owner page renders (server components cannot write
// cookies). It gates nothing: requireOwner() in each page does (design 1 §9: never the only gate).
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAuth } from "./lib/auth";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = supabaseAuth(
    {
      getAll: () => request.cookies.getAll(),
      setAll(list, headers) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
    request.nextUrl.protocol === "https:",
  );
  await supabase.auth.getUser();
  return response;
}

// Owner routes only (src/lib/routes.test.ts checks every entry against the route table).
export const config = { matcher: ["/app", "/app/:path*"] };
