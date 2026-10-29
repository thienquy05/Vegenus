"use client";

import { useState, type FormEvent } from "react";
import styles from "./login.module.css";

// O1 (owner UI): a plain form post to /api/owner/login, so it also works before scripts load.
// Offline, the submit is held so the typed fields stay and nothing claims success.
export function LoginForm({ next, failed }: { next: string; failed: boolean }) {
  const [show, setShow] = useState(false);
  const [offline, setOffline] = useState(false);

  function onSubmit(event: FormEvent) {
    if (navigator.onLine) return;
    event.preventDefault();
    setOffline(true);
  }

  return (
    <form method="post" action="/api/owner/login" className={styles.form} onSubmit={onSubmit}>
      {failed && !offline && (
        <p role="alert" className={styles.alert}>
          Couldn’t sign in. Check your details. / Chưa đăng nhập được. Kiểm tra thông tin.
        </p>
      )}
      {offline && (
        <p role="alert" className={styles.alert}>
          You’re offline. Please try again when you’re connected. / Bạn đang ngoại tuyến. Vui lòng hãy thử lại khi có mạng.
        </p>
      )}
      <input type="hidden" name="next" value={next} />
      <label className={styles.field}>
        Email
        <input name="email" type="email" autoComplete="username" required className={styles.input} />
      </label>
      <label className={styles.field}>
        Password
        <input name="password" type={show ? "text" : "password"} autoComplete="current-password" required className={styles.input} />
      </label>
      <label className={styles.check}>
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
        Show password / Hiện mật khẩu
      </label>
      <button type="submit" className={styles.button}>
        Sign in / Đăng nhập
      </button>
    </form>
  );
}
