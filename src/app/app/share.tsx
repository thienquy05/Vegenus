"use client";
import { QRCodeCanvas } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Page } from "@/lib/setup";
import type { CopyKey } from "./copy";
import { L, T, post } from "./parts";
import s from "./owner.module.css";

// O8 Share and the O2 Share card (owner UI "O8 Share and O9 Visibility for T2.6"; PRD Q146 10-44; design 1 §3.2). The
// link exists only in the answer to Create or Rotate and lives only in this view's memory (the reveal): never in the
// URL, storage, a form field or a status message. Every other state comes from the owner_page() snapshot.

const both = (f: (lang: "en" | "vi") => string) => [f("en"), f("vi")] as const;
// Q146 29: medium date and short time in the page time zone, as O10.
const day = (iso: string, timeZone: string) => both((lang) => new Intl.DateTimeFormat(lang, { timeZone, dateStyle: "medium" }).format(new Date(iso)));
const clock = (iso: string, timeZone: string) => both((lang) => new Intl.DateTimeFormat(lang, { timeZone, timeStyle: "short" }).format(new Date(iso)));

// O2: the link's state from the snapshot; a Token-only page without a link gets the strong call to action.
export function ShareCard({ page, offline, onOpen }: { page: Page; offline: boolean; onOpen: (opener: string) => void }) {
  const link = page.link ?? null;
  const reason = offline ? "offline-reason" : undefined;
  const key: CopyKey = !link ? "dashboard.shareEmpty" : link.shown_at ? "dashboard.shareCreated" : "dashboard.shareUnshown";
  return (
    <section id="share-card" className={s.surface} aria-labelledby="share-card-title">
      <h3 id="share-card-title" tabIndex={-1}>
        <T k="share.title" />
      </h3>
      <p id="share-state" className={link && !link.shown_at ? s.error : undefined}>
        {offline && (
          <>
            <T k="common.lastKnown" />
            {" · "}
          </>
        )}
        <T k={key} vars={link ? { date: day(link.created_at, page.timezone) } : undefined} />
      </p>
      <p className={s.help}>
        <T k={page.visibility === "private" ? "visibility.privateHelp" : "visibility.explain"} />
      </p>
      <div className={s.usageActions}>
        {!link && page.visibility === "token_only" && (
          <button id="share-create-first" type="button" className={s.secondary} disabled={offline} aria-describedby={reason} onClick={() => onOpen("share-create-first")}>
            <L k="visibility.createFirst" />
          </button>
        )}
        <button id="share-entry" type="button" className={!link ? s.primary : s.secondary} disabled={offline} aria-describedby={reason} onClick={() => onOpen("share-entry")}>
          <L k="share.title" />
        </button>
      </div>
    </section>
  );
}

type Read = "loading" | "ready" | "error" | "401" | "403";
type Phase = "busy" | "unknown" | "changed" | "rejected" | "401" | "403";
type Write = { kind: "create" | "rotate"; request_id: string; expected_version: number | null; phase: Phase };
type Reveal = { link: string; version: number; kind: Write["kind"] };
type Dialog = "rotate" | "done" | "back" | "visibility" | null;

const MESSAGE: Record<Exclude<Phase, "busy"> | "error", CopyKey> = {
  unknown: "share.unknown",
  changed: "share.changed",
  rejected: "share.failed",
  "401": "usage.session",
  "403": "common.accessLost",
  error: "common.readError",
};
const FOCUS: Record<Exclude<Phase, "busy"> | "error", string> = {
  unknown: "share-retry",
  changed: "share-reload",
  rejected: "share-reload",
  "401": "share-signin",
  "403": "share-logout",
  error: "share-retry",
};

// returnFocus: back from O9, focus goes there once the read has drawn it (else the heading keeps it).
export function ShareView({ offline, onBack, onVisibility, returnFocus }: { offline: boolean; onBack: () => void; onVisibility?: () => void; returnFocus?: string }) {
  const [snap, setSnap] = useState<Page | null>(null);
  const [read, setRead] = useState<Read>("loading");
  const [write, setWrite] = useState<Write | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [refused, setRefused] = useState(false); // the clipboard refused: Select link and its hint
  const [failedDownload, setFailedDownload] = useState(false);
  // One polite region; n re-announces a repeated outcome (a second Copy).
  const [said, setSaid] = useState<{ key: CopyKey; n: number } | null>(null);
  const say = (key: CopyKey) => setSaid((old) => ({ key, n: (old?.n ?? 0) + 1 }));
  const heading = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const focusNext = useRef<string | null>(null); // the element to focus once a render has it
  const reads = useRef(0); // the latest read; an older answer is ignored
  const revealRef = useRef<Reveal | null>(null);
  const returning = useRef(!!returnFocus); // only the return read moves focus to returnFocus
  const download = useRef<string | null>(null); // the QR's object URL, freed with the reveal
  useEffect(() => {
    revealRef.current = reveal;
  }, [reveal]);

  const clear = useCallback(() => {
    if (download.current) URL.revokeObjectURL(download.current);
    download.current = null;
    revealRef.current = null;
    getSelection()?.removeAllRanges();
    setReveal(null);
    setRefused(false);
    setFailedDownload(false);
    setDialog(null); // a leave dialog asks about a link that is gone
  }, []);
  // focus: where focus goes once the snapshot shows (the main action after Done or a lost answer).
  const readMeta = useCallback(
    (focus: "main" | null = null) => {
      const n = ++reads.current;
      void post<{ page: Page | null }>("/api/owner/page", {}).then((r) => {
        if (n !== reads.current) return;
        const page = r.status === 200 ? r.body?.page : null;
        const main = page?.link ? "share-rotate" : "share-create";
        if (page) {
          setSnap(page);
          setRead("ready");
          if (returning.current && returnFocus && page.visibility === "private") focusNext.current = returnFocus;
          returning.current = false;
          const shown = revealRef.current;
          if (shown && page.link?.version !== shown.version) {
            clear();
            setSaid((old) => ({ key: "share.replaced", n: (old?.n ?? 0) + 1 }));
            focusNext.current = main;
          } else if (focus) focusNext.current = main;
          return;
        }
        // A failed read never takes the link away, except access lost (CHECKS: access loss scrubs the reveal).
        if (r.status === 403) clear();
        else if (revealRef.current) return;
        const failed: Read = r.status === 401 ? "401" : r.status === 403 ? "403" : "error";
        setRead(failed);
        focusNext.current = FOCUS[failed as keyof typeof FOCUS];
      });
    },
    [clear, returnFocus],
  );

  useEffect(() => {
    heading.current?.focus();
    readMeta();
  }, [readMeta]);
  // Before the focus effect: closing a dialog moves focus back to its opener, which a pending focus then overrides.
  useEffect(() => {
    const d = dialogRef.current;
    if (dialog && !d?.open) {
      d?.showModal();
      document.getElementById("dialog-cancel")?.focus();
    }
    if (!dialog && d?.open) d.close();
  }, [dialog]);
  useEffect(() => {
    const next = focusNext.current && document.getElementById(focusNext.current);
    if (next) {
      focusNext.current = null;
      next.focus();
    }
  });
  // Reconnecting reads the metadata again, so a replacement elsewhere ends the reveal.
  const wasOffline = useRef(offline);
  useEffect(() => {
    if (wasOffline.current && !offline && write?.phase !== "busy") readMeta();
    wasOffline.current = offline;
  }, [offline]); // eslint-disable-line react-hooks/exhaustive-deps
  // While the link shows, leaving the document asks (the browser may skip the prompt; cleanup still runs).
  useEffect(() => {
    if (!reveal) return;
    const ask = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener("beforeunload", ask);
    return () => removeEventListener("beforeunload", ask);
  }, [reveal]);
  // Hiding the page clears the link; a back-forward cache restore reads afresh and never shows a reveal.
  useEffect(() => {
    const hide = () => clear();
    const restore = (e: PageTransitionEvent) => e.persisted && readMeta();
    addEventListener("pagehide", hide);
    addEventListener("pageshow", restore);
    return () => {
      removeEventListener("pagehide", hide);
      removeEventListener("pageshow", restore);
      if (download.current) URL.revokeObjectURL(download.current);
    };
  }, [clear, readMeta]);

  const send = async (w: Write) => {
    setWrite({ ...w, phase: "busy" });
    focusNext.current = w.kind === "create" ? "share-create" : "share-rotate"; // a pressed Try again unmounts
    const r = await post<{ link?: string; version?: number; error?: string }>("/api/owner/token", {
      request_id: w.request_id,
      expected_version: w.expected_version,
    });
    if (r.status === 200 && r.body?.link && r.body.version) {
      const version = r.body.version;
      setWrite(null);
      setReveal({ link: r.body.link, version, kind: w.kind });
      say(w.kind === "create" ? "share.justCreated" : "share.justRotated");
      focusNext.current = "reveal-title";
      // The one acknowledgement (Q146 12); false: the link was replaced, 403: access lost; either way read what is true now.
      void post<{ shown: boolean }>("/api/owner/token/shown", { version }).then((a) => (a.status === 403 || a.body?.shown === false) && readMeta());
      return;
    }
    if (r.status === 409 && r.body?.error === "already_rotated") {
      // That request committed but its answer was lost: the metadata shows "display not confirmed".
      setWrite(null);
      return readMeta("main");
    }
    // Only a confirmed refusal says nothing changed; a timeout, 5xx or lost connection is unknown (Q146 11, 43).
    const rejected = r.status >= 400 && r.status < 500 && ![401, 403, 409].includes(r.status);
    const phase: Phase = rejected ? "rejected" : r.status === 409 ? "changed" : r.status === 401 ? "401" : r.status === 403 ? "403" : "unknown";
    setWrite({ ...w, phase });
    focusNext.current = FOCUS[phase];
  };
  const start = (kind: Write["kind"]) => {
    if (offline) return say("share.offline");
    if (write?.phase === "busy") return;
    void send({ kind, request_id: crypto.randomUUID(), expected_version: snap?.link?.version ?? null, phase: "busy" });
  };
  const closeDialog = (act: boolean) => {
    const which = dialog;
    setDialog(null);
    if (!act) {
      focusNext.current = which === "rotate" ? "share-rotate" : which === "done" ? "share-done" : which === "visibility" ? "share-visibility" : "share-back";
      return;
    }
    if (which === "rotate") return start("rotate");
    clear();
    if (which === "back") return onBack();
    if (which === "visibility") return onVisibility?.();
    readMeta("main");
  };
  const selectLink = () => {
    const el = document.getElementById("reveal-link");
    if (!el) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);
    el.focus();
  };
  const copy = async () => {
    if (!reveal) return;
    try {
      await navigator.clipboard.writeText(reveal.link);
      say("share.copied");
    } catch {
      setRefused(true);
      say("share.select");
      selectLink();
    }
  };
  // Drawn in the browser from the on-screen QR (dark modules on white with a quiet zone); never sent anywhere.
  const save = () => {
    const failed = () => {
      setFailedDownload(true);
      say("share.downloadError");
    };
    const canvas = document.getElementById("share-qr");
    if (!(canvas instanceof HTMLCanvasElement)) return failed();
    try {
      canvas.toBlob((blob) => {
        if (!revealRef.current) return; // the reveal ended while the PNG was encoded
        if (!blob) return failed();
        if (download.current) URL.revokeObjectURL(download.current);
        download.current = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = download.current;
        a.download = "guest-link-qr.png";
        a.click();
        setFailedDownload(false);
        say("share.downloadDone");
      }, "image/png");
    } catch {
      failed();
    }
  };

  const busy = write?.phase === "busy";
  const why = offline ? "share-offline-reason" : undefined;
  const blocked = offline || busy || undefined;
  const link = snap?.link ?? null;
  const recovery = write && write.phase !== "busy" ? write.phase : read === "error" || read === "401" || read === "403" ? read : null;
  const action = (kind: Write["kind"], id: string, label: CopyKey, primary = false) => (
    <button
      id={id}
      type="button"
      className={primary ? s.primary : s.secondary}
      aria-disabled={blocked}
      aria-describedby={why}
      onClick={() => (offline ? say("share.offline") : busy ? undefined : kind === "rotate" ? setDialog("rotate") : start(kind))}
    >
      <L k={busy && write?.kind === kind ? (kind === "create" ? "share.creating" : "share.rotating") : label} />
    </button>
  );

  return (
    <div className={`${s.page} ${s.wide}`}>
      <header className={s.usageTop}>
        <button id="share-back" type="button" className={s.secondary} onClick={() => (reveal ? setDialog("back") : onBack())}>
          <L k="navigation.back" />
        </button>
      </header>
      <main aria-labelledby="share-title">
        <div className={s.usageHeading}>
          <h1 id="share-title" tabIndex={-1} ref={heading}>
            <T k="share.title" />
          </h1>
        </div>
        <p className={s.announcer} role="status" aria-live="polite" aria-atomic="true">
          {said && (
            <span key={said.n}>
              <T k={said.key} />
            </span>
          )}
        </p>
        {offline && (
          <p id="share-offline-reason" className={s.notice}>
            <T k="share.offline" />
          </p>
        )}
        {read === "ready" && snap?.visibility === "private" && !recovery && (
          <div id="share-private" className={s.band}>
            <p>
              <T k="share.private" />
            </p>
            <p>
              <T k="visibility.privateHelp" />
            </p>
            {onVisibility && (
              <button id="share-visibility" type="button" className={s.secondary} onClick={() => (reveal ? setDialog("visibility") : onVisibility())}>
                <L k="dashboard.visibility" />
              </button>
            )}
          </div>
        )}
        {reveal ? (
          <div className={s.reveal}>
            <section className={`${s.panel} ${s.revealLink}`} aria-labelledby="reveal-title">
              <h2 id="reveal-title" tabIndex={-1}>
                <T k={reveal.kind === "create" ? "share.justCreated" : "share.justRotated"} />
              </h2>
              <p className={s.band}>
                <T k="share.once" />
              </p>
              <p id="reveal-link" className={s.linkBox} tabIndex={-1}>
                {reveal.link}
              </p>
              <button id="share-copy" type="button" className={s.secondary} onClick={() => void copy()}>
                <L k="share.copy" />
              </button>
              {refused && (
                <>
                  <button id="share-select" type="button" className={s.secondary} onClick={selectLink}>
                    <L k="share.selectAction" />
                  </button>
                  <p>
                    <T k="share.select" />
                  </p>
                </>
              )}
            </section>
            <section className={`${s.panel} ${s.revealQr}`}>
              <p id="share-qr-label">
                <T k="share.qr" />
              </p>
              <QRCodeCanvas id="share-qr" className={s.qr} role="img" aria-labelledby="share-qr-label" value={reveal.link} size={192} marginSize={4} bgColor="#ffffff" fgColor="#000000" />
              <p className={`${s.band} ${s.bandAlert}`}>
                <T k="share.warning" />
              </p>
              <button id="share-download" type="button" className={s.secondary} onClick={save}>
                <L k="share.download" />
              </button>
              {failedDownload && (
                <p className={s.error}>
                  <T k="share.downloadError" />
                </p>
              )}
            </section>
            <section className={`${s.panel} ${s.revealTag}`} aria-labelledby="tag-title">
              <h2 id="tag-title">
                <T k="share.tag" />
              </h2>
              <ol className={s.checklist}>
                <li>
                  <T k="share.write" />
                </li>
                <li>
                  <T k="share.test" />
                </li>
                <li>
                  <T k="share.lock" />
                </li>
              </ol>
            </section>
            <div className={s.revealDone}>
              <button id="share-done" type="button" className={s.secondary} onClick={() => setDialog("done")}>
                <L k="upload.done" />
              </button>
            </div>
          </div>
        ) : (
          <div className={s.usageBody}>
            {read === "loading" && !write && (
              <section className={`${s.panel} ${s.wideRow}`} aria-busy="true">
                <p>
                  <T k="common.loading" />
                </p>
              </section>
            )}
            {recovery && (
              <section className={`${s.panel} ${s.wideRow}`}>
                <p id="share-error" className={s.error}>
                  <T k={MESSAGE[recovery]} />
                </p>
                <div className={s.usageActions}>
                  {recovery === "401" && (
                    <a id="share-signin" className={s.secondary} href="/login?next=%2Fapp" target="_blank" rel="noopener">
                      <L k="content.signin" />
                    </a>
                  )}
                  {recovery === "403" && (
                    <form method="post" action="/api/owner/logout">
                      <button id="share-logout" type="submit" className={s.secondary} aria-describedby="share-error">
                        <L k="dashboard.logout" />
                      </button>
                    </form>
                  )}
                  {(recovery === "changed" || recovery === "rejected") && (
                    <button
                      id="share-reload"
                      type="button"
                      className={s.secondary}
                      onClick={() => {
                        setWrite(null);
                        heading.current?.focus();
                        readMeta("main");
                      }}
                    >
                      <L k="visibility.reload" />
                    </button>
                  )}
                  {(recovery === "unknown" || recovery === "401" || recovery === "error") && (
                    <button
                      id="share-retry"
                      type="button"
                      className={s.secondary}
                      aria-disabled={offline || undefined}
                      aria-describedby={["share-error", why].filter(Boolean).join(" ")}
                      onClick={() => {
                        if (offline) return say("share.offline");
                        // An unconfirmed write repeats the same request, also after signing in (Q146 11).
                        if (write) return void send(write);
                        heading.current?.focus();
                        setRead("loading");
                        readMeta("main");
                      }}
                    >
                      <L k="common.tryAgain" />
                    </button>
                  )}
                </div>
              </section>
            )}
            {read === "ready" && !recovery && snap && (
              <section className={`${s.panel} ${s.wideRow}`}>
                {!link && (
                  <>
                    <p>
                      <T k="share.intro" />
                    </p>
                    {action("create", "share-create", "share.create", true)}
                  </>
                )}
                {link?.shown_at && (
                  <>
                    <p>
                      <T k="share.shown" vars={{ date: day(link.created_at, snap.timezone), time: clock(link.created_at, snap.timezone) }} />
                    </p>
                    <p className={s.help}>
                      <T k="share.recover" />
                    </p>
                    {action("rotate", "share-rotate", "share.rotate")}
                  </>
                )}
                {link && !link.shown_at && (
                  <>
                    <p className={`${s.band} ${s.bandAlert}`}>
                      <T k="share.unshown" />
                    </p>
                    {action("rotate", "share-rotate", "share.again")}
                  </>
                )}
              </section>
            )}
          </div>
        )}
        <dialog
          id="share-dialog"
          ref={dialogRef}
          className={s.dialog}
          aria-labelledby="share-dialog-title"
          aria-describedby="share-dialog-body"
          onCancel={(event) => {
            event.preventDefault();
            closeDialog(false);
          }}
        >
          {dialog && (
            <div className={s.stack}>
              <h2 id="share-dialog-title">
                <T k={dialog === "rotate" ? "share.rotateQuestion" : "share.leaveQuestion"} />
              </h2>
              <p id="share-dialog-body">
                <T k={dialog === "rotate" ? "share.rotateBody" : "share.leaveBody"} />
              </p>
              <button id="dialog-cancel" type="button" className={s.secondary} onClick={() => closeDialog(false)}>
                <L k={dialog === "rotate" ? "content.cancel" : "share.stay"} />
              </button>
              <button id="dialog-act" type="button" className={`${s.secondary} ${s.danger}`} onClick={() => closeDialog(true)}>
                <L k={dialog === "rotate" ? "share.rotate" : "share.leave"} />
              </button>
            </div>
          )}
        </dialog>
      </main>
    </div>
  );
}
