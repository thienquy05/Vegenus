"use client";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { CopyKey } from "./copy";
import { Announcers, L, LANG_NAMES, LogOut, T, post, useOnline } from "./parts";
import s from "./owner.module.css";

// O7 wish moderation (owner UI O7; T3.2). The queue oldest first, the approved and rejected histories newest first, 50
// at a time (owner_wishes). A wish moves only once the server confirms; a failure keeps it; a decision made elsewhere
// first (409) re-reads the list. The guest's words are shown exactly as sent, never rewritten.
// shortcut: every wish in full in one list at every size (no separate reading panel, no bulk select or undo from the
// boards); add them if the queue grows past what one list reads well.
type Status = "pending" | "approved" | "rejected";
type Entry = { id: string; display_name: string; body: string; lang: string; created_at: string };
type Load = "loading" | "ready" | "error" | "accessLost";
const VIEWS: Status[] = ["pending", "approved", "rejected"];
const PAGE = 50;
const pad = (n: number) => String(n).padStart(2, "0");
// The submission time on this device's clock, in a form both languages read.
const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function Wishes({ onBack, onSignedOut }: { onBack: () => void; onSignedOut: () => void }) {
  const online = useOnline();
  const [view, setView] = useState<Status>("pending");
  const [read, setRead] = useState(0); // bumped to read the list again
  const [load, setLoad] = useState<Load>("loading");
  const [rows, setRows] = useState<Entry[]>([]);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState<"saving" | "loading" | null>(null);
  const [status, setStatus] = useState<CopyKey | null>(null);
  const [alert, setAlert] = useState<CopyKey | null>(null);
  // A re-read the owner caused: "conflict" (a 409 or 404, say so) or "next" (a full page was emptied, so more may
  // wait); focus goes into the new list, or to Try again if the read fails.
  const refreshed = useRef<"conflict" | "next" | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const list = useRef<HTMLElement>(null);

  // After a wish leaves, focus goes to the wish now in its place (else the one before it), else the empty heading.
  const focusAt = (index: number) => {
    const cards = list.current?.querySelectorAll("article") ?? [];
    const card = cards[Math.min(index, cards.length - 1)];
    (card?.querySelector("button") ?? document.getElementById("wishes-empty"))?.focus();
  };
  useEffect(() => heading.current?.focus(), []);
  useEffect(() => {
    let live = true;
    void post<{ entries: Entry[] }>("/api/owner/wishes", { status: view }).then((r) => {
      if (!live) return;
      const caused = refreshed.current;
      refreshed.current = null;
      if (r.status === 401) return onSignedOut();
      const failed = r.status === 403 ? "accessLost" : r.status !== 200 || !Array.isArray(r.body?.entries) ? "error" : null;
      flushSync(() => {
        if (failed) return setLoad(failed);
        setRows(r.body!.entries);
        setMore(r.body!.entries.length === PAGE);
        setLoad("ready");
        if (caused === "conflict") setAlert("wishes.conflict");
      });
      // Only into the void the owner's own action left: never take focus they moved meanwhile.
      if (!caused || (document.activeElement && document.activeElement !== document.body)) return;
      if (failed) list.current?.querySelector("button")?.focus(); // Try again, or Log out
      else focusAt(0);
    });
    return () => {
      live = false;
    };
    // focusAt reads the DOM only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, read, onSignedOut]);

  const show = (next: Status) => {
    setLoad("loading");
    setStatus(null);
    setAlert(null);
    refreshed.current = null;
    setView(next);
    setRead((n) => n + 1);
  };
  async function moderate(entry: Entry, to: Status, index: number) {
    setBusy("saving");
    setStatus(null);
    setAlert(null);
    const r = await post<{ status: Status }>("/api/owner/wishes/moderate", { id: entry.id, status: to, expected: view });
    flushSync(() => setBusy(null)); // enabled again before focus returns below
    if (r.status === 200 && more && rows.length === 1) {
      // The shown page is done but more may wait: read the queue again rather than say "All caught up".
      setStatus(to === "approved" ? "wishes.approvedDone" : "wishes.rejectedDone");
      refreshed.current = "next";
      setLoad("loading");
      return setRead((n) => n + 1);
    }
    if (r.status === 200) {
      flushSync(() => {
        setRows((all) => all.filter((x) => x.id !== entry.id));
        setStatus(to === "approved" ? "wishes.approvedDone" : "wishes.rejectedDone");
      });
      return focusAt(index);
    }
    if (r.status === 409 || r.status === 404) {
      // Decided elsewhere first, or gone: read again in place; which change happened is never guessed.
      refreshed.current = "conflict";
      setLoad("loading"); // no stale buttons while it reads
      return setRead((n) => n + 1);
    }
    if (r.status === 401) return onSignedOut();
    if (r.status === 403) return setLoad("accessLost");
    setAlert("wishes.failed");
    document.getElementById(`${to}-${entry.id}`)?.focus();
  }
  async function loadMore() {
    const last = rows.at(-1)!;
    const first = rows.length;
    setBusy("loading");
    setAlert(null);
    const r = await post<{ entries: Entry[] }>("/api/owner/wishes", { status: view, after: { created_at: last.created_at, id: last.id } });
    flushSync(() => setBusy(null));
    if (r.status === 401) return onSignedOut();
    if (r.status === 403) return setLoad("accessLost");
    // Disabled while loading, the button lost focus: give it back while it stays.
    const again = () => document.getElementById("wishes-more")?.focus();
    if (r.status !== 200 || !Array.isArray(r.body?.entries)) {
      setAlert("common.readError");
      return again();
    }
    const page = r.body.entries;
    flushSync(() => {
      setRows((all) => [...all, ...page]);
      setMore(page.length === PAGE);
    });
    if (page.length < PAGE) focusAt(first); // the button is gone: focus goes on to the first new wish
    else again();
  }

  const blocked = !!busy || !online;
  const reason = online ? undefined : "offline-reason";
  return (
    <div className={`${s.page} ${s.wide}`}>
      <header className={`${s.topbar} ${s.bar}`}>
        <h1 className={s.topbarText} tabIndex={-1} ref={heading}>
          <T k="sections.guestbook" />
        </h1>
        <button type="button" className={s.secondary} onClick={onBack}>
          <L k="navigation.back" />
        </button>
      </header>
      <main className={s.main}>
        <Announcers status={busy === "saving" ? "wishes.saving" : busy === "loading" ? "common.loading" : !online ? "common.offline" : status} alert={alert} />
        {!online && (
          <p id="offline-reason" className={s.notice}>
            <T k="common.offline" />
          </p>
        )}
        {(alert || (status && !busy)) && load !== "accessLost" && (
          <p className={`${s.notice} ${s.status}`}>
            <T k={alert ?? status!} />
          </p>
        )}
        <div className={s.contentLayout}>
          <nav className={`${s.surface} ${s.stack}`} aria-labelledby="views-title">
            <h2 id="views-title">
              <T k="wishes.views" />
            </h2>
            <div className={s.sectionSwitch}>
              {VIEWS.map((name) => (
                <button key={name} type="button" className={s.secondary} aria-pressed={view === name} disabled={!!busy} onClick={() => view !== name && show(name)}>
                  <L k={`wishes.${name}`} />
                </button>
              ))}
            </div>
            <p className={s.small}>
              <T k="wishes.only" />
            </p>
          </nav>
          <section className={`${s.surface} ${s.stack}`} aria-labelledby="views-title" ref={list}>
            {load === "loading" && (
              <p aria-busy="true">
                <T k="common.loading" />
              </p>
            )}
            {load === "error" && (
              <>
                <p className={s.error}>
                  <T k="common.readError" />
                </p>
                <button type="button" className={s.secondary} disabled={!online} aria-describedby={reason} onClick={() => {
                    show(view);
                    refreshed.current = "next"; // focus into the list once it is in
                  }}>
                  <L k="common.tryAgain" />
                </button>
              </>
            )}
            {load === "accessLost" && (
              <>
                <p className={s.error}>
                  <T k="common.accessLost" />
                </p>
                <LogOut />
              </>
            )}
            {load === "ready" && rows.length === 0 && (
              <h2 id="wishes-empty" tabIndex={-1}>
                <T k={view === "pending" ? "wishes.caughtUp" : "wishes.none"} />
              </h2>
            )}
            {load === "ready" && rows.length > 0 && (
              <p className={s.small}>
                <T k="wishes.verbatim" />
              </p>
            )}
            {load === "ready" &&
              rows.map((entry, index) => (
                <article key={entry.id} className={s.row}>
                  <h3>
                    <bdi>{entry.display_name}</bdi>
                  </h3>
                  <p className={s.small}>
                    {when(entry.created_at)} · {LANG_NAMES[entry.lang]}
                  </p>
                  <blockquote className={s.wishBody} lang={entry.lang}>
                    {entry.body}
                  </blockquote>
                  <div className={s.actions}>
                    {view !== "approved" && (
                      <button type="button" id={`approved-${entry.id}`} className={s.primary} disabled={blocked} aria-describedby={reason} onClick={() => void moderate(entry, "approved", index)}>
                        <L k="wishes.approve" />
                        <span className={s.announcer}>{` ${entry.display_name}`}</span>
                      </button>
                    )}
                    {view !== "rejected" && (
                      <button type="button" id={`rejected-${entry.id}`} className={s.secondary} disabled={blocked} aria-describedby={reason} onClick={() => void moderate(entry, "rejected", index)}>
                        <L k="wishes.reject" />
                        <span className={s.announcer}>{` ${entry.display_name}`}</span>
                      </button>
                    )}
                  </div>
                </article>
              ))}
            {load === "ready" && more && (
              <button id="wishes-more" type="button" className={s.secondary} disabled={blocked} aria-describedby={reason} onClick={() => void loadMore()}>
                <L k="wishes.more" />
              </button>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
