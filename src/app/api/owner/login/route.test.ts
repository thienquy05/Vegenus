import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

// Rules recheck (2026-10-29): a failing limiter or Auth call is the same generic answer as a wrong
// password (E22), a 303 back to the form, never a framework 500 (as Codex found for the guest route, T1.5a).
const signInWithPassword = vi.fn();
vi.mock("@/lib/server-db", () => ({ loginAllowed: vi.fn() }));
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  requestAuth: vi.fn(async () => ({ auth: { signInWithPassword } })),
}));
const { loginAllowed } = await import("@/lib/server-db");
const { POST } = await import("./route");

const FAILED = "http://localhost:3000/login?error=1&next=%2Fapp";
const login = () =>
  POST(
    new NextRequest("http://localhost:3000/api/owner/login", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      body: new URLSearchParams({ email: "owner@example.test", password: "placeholder-password-1", next: "/app" }),
    }),
  );

beforeEach(() => {
  vi.mocked(loginAllowed).mockReset().mockResolvedValue(true);
  signInWithPassword.mockReset().mockResolvedValue({ error: null });
});

test("a valid login goes to the next owner page", async () => {
  const res = await login();
  expect(res.status).toBe(303);
  expect(res.headers.get("location")).toBe("http://localhost:3000/app");
});

test("a limiter failure is the generic failed answer", async () => {
  vi.mocked(loginAllowed).mockRejectedValue(new Error("db down"));
  const res = await login();
  expect(res.status).toBe(303);
  expect(res.headers.get("location")).toBe(FAILED);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(signInWithPassword).not.toHaveBeenCalled();
});

test("an Auth failure that throws is the generic failed answer", async () => {
  signInWithPassword.mockRejectedValue(new Error("auth down"));
  const res = await login();
  expect(res.status).toBe(303);
  expect(res.headers.get("location")).toBe(FAILED);
});
