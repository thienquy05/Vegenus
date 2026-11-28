"use client";
import Link from "next/link";
import { useSyncExternalStore, type MouseEvent } from "react";
import { NOTICE, PREFS_KEY } from "@/lib/privacy";
import { PrivacyNotice, type NoticeLang } from "./notice";
import s from "./privacy.module.css";

// The language chosen in G8 on this device wins over the browser's (privacy design §3.2).
const savedLang = (): NoticeLang | null => {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}")?.lang;
    return saved === "en" || saved === "vi" ? saved : null;
  } catch {
    return null; // storage blocked or unreadable: the browser language stays
  }
};
const never = () => () => {};

export function Standalone({ initial }: { initial: NoticeLang }) {
  const lang = useSyncExternalStore(never, savedLang, () => null) ?? initial;
  const i = lang === "en" ? 0 : 1;
  // Back uses history, or goes to / when this is the first page in the tab.
  const back = (event: MouseEvent) => {
    if (history.length < 2) return;
    event.preventDefault();
    history.back();
  };
  return (
    <div className={s.page} lang={lang}>
      <header className={s.bar}>
        <span>{NOTICE.header[i]}</span>
        <Link className={s.back} href="/" onClick={back}>
          {NOTICE.back[i]}
        </Link>
      </header>
      <main className={s.main}>
        <PrivacyNotice lang={lang} level={1} />
      </main>
    </div>
  );
}
