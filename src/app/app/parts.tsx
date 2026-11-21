import { useSyncExternalStore } from "react";
import { SECTIONS } from "@/lib/setup";
import { COPY, type CopyKey } from "./copy";
import s from "./owner.module.css";

// Inline text: the English part in lang="en", then the Vietnamese (the document is lang="vi"; Q118). vars fill the
// copy's {name} slots, such as server numbers.
export function T({ k, vars }: { k: CopyKey; vars?: Record<string, string | number> }) {
  const fill = (text: string) => (vars ? text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name])) : text);
  const [en, vi] = COPY[k];
  return (
    <>
      <span lang="en">{fill(en)}</span> / {fill(vi)}
    </>
  );
}

// A button or link label: one wrapper, each language on its own line on phones (design ruling R10).
export function L({ k }: { k: CopyKey }) {
  const [en, vi] = COPY[k];
  return (
    <span className={s.pair}>
      <span lang="en">{en}</span>
      <span className={s.slash}> / </span>
      <span lang="vi">{vi}</span>
    </span>
  );
}

// The persistent live regions: they stay in the tree, so a message is announced once when it appears.
export function Announcers({ status, alert, vars }: { status?: CopyKey | null; alert?: CopyKey | null; vars?: Record<string, string | number> }) {
  return (
    <>
      <p className={s.announcer} role="status" aria-live="polite" aria-atomic="true">
        {status && <T k={status} vars={vars} />}
      </p>
      <p className={s.announcer} role="alert" aria-atomic="true">
        {alert && <T k={alert} />}
      </p>
    </>
  );
}

// Home always first, then the enabled sections in their fixed order; guestbook reads "Wishes".
export function SectionList({ sections }: { sections: readonly string[] }) {
  return (
    <ul className={s.list}>
      {["home", ...SECTIONS.filter((section) => sections.includes(section))].map((section) => (
        <li key={section}>
          <T k={`sections.${section}` as CopyKey} />
        </li>
      ))}
    </ul>
  );
}

export function LogOut() {
  return (
    <form method="post" action="/api/owner/logout" className={s.logout}>
      <button type="submit" className={s.secondary}>
        <L k="dashboard.logout" />
      </button>
    </form>
  );
}

const subscribe = (change: () => void) => {
  addEventListener("online", change);
  addEventListener("offline", change);
  return () => {
    removeEventListener("online", change);
    removeEventListener("offline", change);
  };
};
// navigator.onLine, kept current (design ruling R4); the server render assumes online.
export const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine, () => true);

// POST JSON to an owner route: its status and parsed body (null when there is none); status 0 when the network failed.
export async function post<T>(url: string, body: object): Promise<{ status: number; body: T | null }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json().catch(() => null) };
  } catch {
    return { status: 0, body: null };
  }
}
