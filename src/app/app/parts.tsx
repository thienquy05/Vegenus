import { useSyncExternalStore } from "react";
import { SECTIONS } from "@/lib/setup";
import { COPY, type CopyKey } from "./copy";
import s from "./owner.module.css";

// Inline text: the English part in lang="en", then the Vietnamese (the document is lang="vi"; Q118).
export function T({ k }: { k: CopyKey }) {
  const [en, vi] = COPY[k];
  return (
    <>
      <span lang="en">{en}</span> / {vi}
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
export function Announcers({ status, alert }: { status?: CopyKey | null; alert?: CopyKey | null }) {
  return (
    <>
      <p className={s.announcer} role="status" aria-live="polite" aria-atomic="true">
        {status && <T k={status} />}
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
