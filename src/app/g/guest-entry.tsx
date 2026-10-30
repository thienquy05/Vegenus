"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GuestSummary } from "@/lib/guest";
import { MIN_TARGET_PX } from "@/lib/ui";
import { GuestHome } from "./guest-home";

// G-E1: the same screen for no token, a wrong, rotated or private one (design 1 §4, E47).
const TAP = "Tap the tag or scan the QR code to see this page.";

type View = { summary: GuestSummary; remembered: boolean };
type State = "loading" | "tap" | "retry" | View;
const dropFragment = () => history.replaceState(null, "", "/g");

// One exchange (design 1 §4 steps 3-6). `stale` turns true once a newer fragment or retry has started;
// from then on this run changes nothing.
async function exchangeOnce(token: string, stale: () => boolean, show: (state: State) => void) {
  const res = await fetch("/api/guest/session", {
    method: "POST",
    headers: { "content-type": "application/json", "x-vegenus-guest": "1" },
    body: JSON.stringify({ token }),
  }).catch(() => null);
  if (stale()) return;
  if (res?.status === 404) {
    dropFragment();
    return show("tap");
  }
  const summary: GuestSummary | null = res?.ok ? await res.json().catch(() => null) : null;
  if (stale()) return;
  if (!summary) {
    dropFragment();
    return show("retry");
  }
  // Did the cookie come back? Only a redirect from the guest home says no; any other probe failure
  // leaves the cookie in place, so the fragment still goes.
  const home = await fetch("/g/home", { redirect: "manual" }).catch(() => null);
  if (stale()) return;
  if (home?.type === "opaqueredirect") {
    // Cookies blocked: the fragment is the only way back after a reload, also after a retry (Codex, round 2).
    history.replaceState(null, "", `/g#${token}`);
    return show({ summary, remembered: false });
  }
  dropFragment();
  if (home?.ok) return location.replace("/g/home");
  show({ summary, remembered: true });
}

// Design 1 §4. The token is read from the fragment, sent only in the POST body, and the fragment is
// removed from the address bar, except when cookies are blocked (E30): then the visit runs from memory
// and the fragment stays, so a reload or "Open in browser" still works.
// A network or server failure is not a wrong token (Codex, T1.5a review): the fragment goes, the token
// stays in memory, and the guest can try again without a new tap.
// ponytail: an empty fragment always shows G-E1; telling a dropped fragment apart (G-E2) comes with T3.5
export function GuestEntry() {
  const [state, setState] = useState<State>("loading");
  const token = useRef("");
  // Each exchange gets a number, and exchanges run one at a time (Codex, rounds 3-4): the server sets the
  // cookie in its answer, so an older answer arriving late would overwrite a newer cookie. A newer token
  // waits for the one in flight; an outdated one never posts.
  // ponytail: per tab. Two tabs exchanging tokens of two different pages at once can end with either cookie
  // (one vegenus_g per browser, Codex round 5). One page per site today; a per-page cookie when tenancy
  // (Q84) arrives.
  const run = useRef(0);
  const queue = useRef(Promise.resolve());

  const exchange = useCallback(() => {
    const id = ++run.current;
    const stale = () => id !== run.current;
    const turn = queue.current.then(() => (stale() ? undefined : exchangeOnce(token.current, stale, setState)));
    queue.current = turn.catch(() => {});
  }, []);

  // On load and whenever only the fragment changes, e.g. a re-tap in the same tab (Codex, round 3).
  // replaceState never fires hashchange, so our own fragment edits do not restart this.
  useEffect(() => {
    const start = () => {
      token.current = location.hash.slice(1);
      if (!token.current) {
        run.current++;
        return setState("tap");
      }
      setState("loading");
      exchange();
    };
    (async () => start())();
    addEventListener("hashchange", start);
    return () => removeEventListener("hashchange", start);
  }, [exchange]);

  if (state === "loading") return <main lang="en" aria-busy="true" />;
  if (state === "tap") {
    return (
      <main lang="en">
        <p>{TAP}</p>
      </main>
    );
  }
  if (state === "retry") {
    return (
      <main lang="en">
        <p role="alert">Couldn’t open the page. Check your connection.</p>
        <button
          type="button"
          style={{ minHeight: MIN_TARGET_PX, minWidth: MIN_TARGET_PX }}
          onClick={() => {
            setState("loading");
            exchange();
          }}
        >
          Try again
        </button>
      </main>
    );
  }
  return (
    <GuestHome summary={state.summary}>
      {!state.remembered && <p role="status">This visit won’t be remembered. Tap the tag again next time.</p>}
    </GuestHome>
  );
}
