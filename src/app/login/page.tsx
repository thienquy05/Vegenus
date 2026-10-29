import type { Metadata } from "next";
import { safeNext } from "@/lib/routes";
import { LoginForm } from "./login-form";
import styles from "./login.module.css";

// O1 Log in. No sign-up link: registration is closed (Q30). Google comes in its own unit.
export const metadata: Metadata = { title: "Sign in · Vegenus", robots: { index: false } };

type Props = { searchParams: Promise<{ error?: string | string[]; next?: string | string[] }> };

export default async function Login({ searchParams }: Props) {
  const { error, next } = await searchParams;
  return (
    <main className={styles.main}>
      <h1>Sign in / Đăng nhập</h1>
      <LoginForm next={safeNext(typeof next === "string" ? next : undefined)} failed={error !== undefined} />
    </main>
  );
}
