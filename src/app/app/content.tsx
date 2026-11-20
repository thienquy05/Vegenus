"use client";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { displayDate, type Kind, type Row, type Section } from "@/lib/content";
import type { CopyKey } from "./copy";
import { Announcers, L, LogOut, T, post, useOnline } from "./parts";
import s from "./owner.module.css";

// O4 content list (owner UI "O4 Content list and O5 Item editor"; Q140): Memories newest first, Together oldest first,
// ordered by the server. A badge changes only after the server confirms; a list never read is never shown as empty.
export type Target = { id: string | null; kind: Kind; section: Section };
type Props = {
  initialSection: Section;
  // A result from the editor ("Item deleted."), shown and announced on arrival.
  status?: CopyKey | null;
  onBack: () => void;
  onOpen: (target: Target) => void;
  onSignedOut: () => void;
};
type Load = "loading" | "ready" | "error" | "accessLost";

export function Content({ initialSection, status: arrived = null, onBack, onOpen, onSignedOut }: Props) {
  const online = useOnline();
  const [section, setSection] = useState(initialSection);
  const [read, setRead] = useState(0); // bumped to read the list again
  const [load, setLoad] = useState<Load>("loading");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<CopyKey | null>(null);
  const [alert, setAlert] = useState<CopyKey | null>(null);
  const [confirm, setConfirm] = useState<Row | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [wasOnline, setWasOnline] = useState(online);
  const refreshed = useRef(false); // a re-read after a 409: say so only once the new list is in
  const heading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => heading.current?.focus(), []);
  // Set after mount: a live region inserted with its text already in it is often not read.
  useEffect(() => {
    if (!arrived) return;
    const timer = setTimeout(() => setStatus(arrived));
    return () => clearTimeout(timer);
  }, [arrived]);
  useEffect(() => {
    let live = true;
    void post<{ items: Row[] }>("/api/owner/items", { section }).then((r) => {
      if (!live) return;
      const conflict = refreshed.current;
      refreshed.current = false;
      if (r.status === 401) return onSignedOut();
      if (r.status === 403) return setLoad("accessLost");
      if (r.status !== 200 || !Array.isArray(r.body?.items)) return setLoad("error");
      flushSync(() => {
        setRows(r.body!.items);
        setLoad("ready");
      });
      if (!conflict) return;
      setAlert("content.listConflict");
      // The row whose change was refused may be gone now, taking focus with it.
      if (document.activeElement === document.body) heading.current?.focus();
    });
    return () => {
      live = false;
    };
  }, [section, read, onSignedOut]);
  useEffect(() => {
    if (confirm && !dialog.current?.open) dialog.current?.showModal();
    if (!confirm && dialog.current?.open) dialog.current.close();
  }, [confirm]);

  const reload = (next = section) => {
    setLoad("loading");
    setStatus(null);
    setAlert(null);
    refreshed.current = false;
    setSection(next);
    setRead((n) => n + 1);
  };
  async function change(row: Row, to: Row["status"]) {
    setConfirm(null);
    setBusy(true);
    setStatus(null);
    setAlert(null);
    const r = await post<{ version: number }>("/api/owner/item/status", { id: row.id, expected_version: row.version, status: to });
    flushSync(() => setBusy(false)); // enabled again before focus returns to it below
    if (r.status === 200 && r.body) {
      const version = r.body.version;
      setRows((all) => all.map((x) => (x.id === row.id ? { ...x, status: to, version, unpublished_changes: false } : x)));
      setStatus("content.statusDone");
    } else if (r.status === 409) {
      // Re-read in place, so the rows stay until the new ones arrive; which change happened is never said.
      refreshed.current = true;
      setRead((n) => n + 1);
    } else if (r.status === 401) onSignedOut();
    else if (r.status === 403) setLoad("accessLost");
    else setAlert("state.write");
    // The button was disabled while the change ran, which drops focus; it comes back to it.
    document.getElementById(`status-${row.id}`)?.focus();
  }

  const blocked = busy || !online;
  const reason = online ? undefined : "offline-reason";
  // Coming back online must not read out an earlier result again.
  if (online !== wasOnline) {
    setWasOnline(online);
    if (!online) setStatus(null);
  }
  const together = section === "together";
  const newKind: Kind = together ? "milestone" : "memory";
  const pick = rows.find((row) => row.id === selected) ?? rows[0];
  const statusOf = (row: Row): CopyKey => (row.status === "published" ? "content.published" : "content.draft");
  return (
    <div className={`${s.page} ${s.wide}`}>
      <header className={`${s.topbar} ${s.bar}`}>
        <h1 className={s.topbarText} tabIndex={-1} ref={heading}>
          <T k="content.content" />
        </h1>
        <button type="button" className={s.secondary} onClick={onBack}>
          <L k="navigation.back" />
        </button>
      </header>
      <main className={s.main}>
        <Announcers status={busy ? "content.statusPending" : !online ? "common.offline" : status} alert={alert} />
        {!online && (
          <div id="offline-reason" className={s.notice}>
            <p>
              <T k="common.offline" />
            </p>
            {load === "ready" && (
              <p className={s.small}>
                <T k="content.stale" />
              </p>
            )}
          </div>
        )}
        {busy && (
          <p className={`${s.notice} ${s.status}`}>
            <T k="content.statusPending" />
          </p>
        )}
        {(alert || (status && !busy)) && load !== "accessLost" && (
          <p className={`${s.notice} ${s.status}`}>
            <T k={alert ?? status!} />
          </p>
        )}
        {load === "loading" && (
          <section className={s.surface} aria-busy="true">
            <p>
              <T k="common.loading" />
            </p>
            <div className={s.skeletons} aria-hidden="true">
              <div className={s.skeleton} />
              <div className={`${s.skeleton} ${s.skeletonBlock}`} />
            </div>
          </section>
        )}
        {load === "error" && (
          <section className={`${s.surface} ${s.stack}`}>
            <p className={s.error}>
              <T k="common.readError" />
            </p>
            <button type="button" className={s.secondary} disabled={!online} aria-describedby={reason} onClick={() => reload()}>
              <L k="common.tryAgain" />
            </button>
          </section>
        )}
        {load === "accessLost" && (
          <section className={`${s.surface} ${s.stack}`}>
            <p className={s.error}>
              <T k="common.accessLost" />
            </p>
            <LogOut />
          </section>
        )}
        {load === "ready" && (
          <div className={s.contentLayout}>
            <nav className={`${s.surface} ${s.stack}`} aria-labelledby="sections-title">
              <h2 id="sections-title">
                <T k="content.sections" />
              </h2>
              <div className={s.sectionSwitch}>
                {(["memories", "together"] as const).map((name) => (
                  <button
                    key={name}
                    type="button"
                    id={name}
                    className={s.secondary}
                    aria-pressed={section === name}
                    disabled={blocked}
                    aria-describedby={reason}
                    onClick={() => section !== name && reload(name)}
                  >
                    <L k={`sections.${name}`} />
                  </button>
                ))}
              </div>
            </nav>
            <section className={s.surface} aria-labelledby="list-title">
              <div className={s.listHead}>
                <h2 id="list-title">
                  <T k={`sections.${section}`} />
                </h2>
                <p className={s.small}>
                  <T k={together ? "content.oldest" : "content.newest"} />
                </p>
                <button type="button" className={s.primary} disabled={blocked} aria-describedby={reason} onClick={() => onOpen({ id: null, kind: newKind, section })}>
                  <L k="content.newItem" />
                </button>
              </div>
              {rows.length === 0 && (
                <div className={`${s.row} ${s.stack}`}>
                  <p>
                    <T k="content.empty" />
                  </p>
                  <button type="button" className={s.primary} disabled={blocked} aria-describedby={reason} onClick={() => onOpen({ id: null, kind: newKind, section })}>
                    <L k={together ? "content.firstTogether" : "content.firstMemory"} />
                  </button>
                </div>
              )}
              {rows.map((row) => (
                <article key={row.id} className={s.row} onFocus={() => setSelected(row.id)}>
                  <p className={s.badges}>
                    <span className={s.tag}>
                      <T k={statusOf(row)} />
                    </span>
                    {row.unpublished_changes && (
                      <span className={`${s.tag} ${s.tagAccent}`}>
                        <T k="content.changes" />
                      </span>
                    )}
                  </p>
                  <h3 lang={row.lang}>{row.title}</h3>
                  <p className={s.small}>
                    {displayDate(row.event_date, row.date_precision)}
                    {together && (
                      <>
                        {" · "}
                        <T k={`content.${row.kind}`} />
                      </>
                    )}
                  </p>
                  <div className={s.actions}>
                    <button type="button" className={s.secondary} disabled={blocked} aria-describedby={reason} onClick={() => onOpen({ id: row.id, kind: row.kind, section })}>
                      <L k="content.open" />
                      <span className={s.announcer} lang={row.lang}>{` ${row.title}`}</span>
                    </button>
                    <button
                      type="button"
                      id={`status-${row.id}`}
                      className={s.secondary}
                      disabled={blocked}
                      aria-describedby={reason}
                      onClick={() => (row.status === "published" ? setConfirm(row) : void change(row, "published"))}
                    >
                      <L k={row.status === "published" ? "content.unpublish" : "content.publish"} />
                      <span className={s.announcer} lang={row.lang}>{` ${row.title}`}</span>
                    </button>
                  </div>
                </article>
              ))}
            </section>
            {pick && (
              <aside className={`${s.surface} ${s.stack} ${s.wideOnly}`} aria-labelledby="selected-title">
                <h2 id="selected-title">
                  <T k="content.selected" />
                </h2>
                <p className={s.small}>
                  <T k="content.status" />
                </p>
                <p>
                  <T k={statusOf(pick)} />
                </p>
                <h3 lang={pick.lang}>{pick.title}</h3>
                <p>{displayDate(pick.event_date, pick.date_precision)}</p>
                <p className={s.small}>
                  <T k="content.previewHint" />
                </p>
              </aside>
            )}
          </div>
        )}
        <dialog
          ref={dialog}
          className={s.dialog}
          aria-labelledby="unpublish-title"
          aria-describedby="unpublish-body"
          onCancel={(event) => {
            event.preventDefault();
            setConfirm(null);
          }}
        >
          {confirm && (
            <div className={s.stack}>
              <h2 id="unpublish-title">
                <T k="content.unpublishTitle" />
              </h2>
              <p id="unpublish-body">
                <T k="content.unpublishBody" />
              </p>
              <button type="button" className={s.secondary} onClick={() => setConfirm(null)}>
                <L k="content.cancel" />
              </button>
              <button type="button" className={s.primary} disabled={blocked} onClick={() => void change(confirm, "draft")}>
                <L k="content.unpublish" />
              </button>
            </div>
          )}
        </dialog>
      </main>
    </div>
  );
}
