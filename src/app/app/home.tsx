"use client";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { displayDate, type Lang, type Precision } from "@/lib/content";
import {
  NOTE_MAX,
  changedFields,
  counter,
  deletedCount,
  homeDirty,
  homeDraftOf,
  homeErrors,
  homeSaveBody,
  landed,
  noteLength,
  type Home,
  type HomeDraft,
  type Pending,
  type Pick as Photo,
} from "@/lib/home";
import type { Drafts, Page } from "@/lib/setup";
import { COPY, type CopyKey } from "./copy";
import { Announcers, L, LogOut, T, post, useOnline } from "./parts";
import s from "./owner.module.css";

// O17 Home editor (owner UI "O17 Home editor and the O2 Home card"; PRD Q144; E14, E15). As O5: every write names the
// version read, a 409 re-reads the complete saved Home and lets the owner choose. A write whose outcome is unknown keeps
// its payload; Try again re-reads first and resends only that payload (Q144 default 23). Home is re-read after every
// confirmed write. Photos are picked from the ready photos of published memories; no upload here.
type Props = { page: Page; drafts: Drafts | null; now?: Date; onBack: () => void; onSignedOut: () => void; onContent: () => void };
type Load = "loading" | "ready" | "error" | "accessLost";
type Memory = { item_id: string; lang: Lang; title: string; event_date: string | null; date_precision: Precision; photos: Omit<Photo, "item_id" | "hidden">[] };
type Picker = { state: "loading" | "error" } | { state: "ready"; memories: Memory[]; reread: boolean };
type Conflict = { state: "loading" | "error" | "missing" } | { state: "ready"; home: Home };
type Notice = { key: CopyKey; pending?: Pending; reread?: boolean; sent?: string[]; signin?: boolean; logout?: boolean };
type Status = { key: CopyKey; vars?: Record<string, number> };
type Dialog = "unpublish" | "leave" | "leaveContent";

const MAX_PICKS = 7;
const GET = "/api/owner/home/get";
const DIALOGS = {
  unpublish: { title: "content.unpublishTitle", body: "home.unpublishBody", keep: "content.cancel", act: "content.unpublish" },
  leave: { title: "content.leaveTitle", body: "content.leaveBody", keep: "content.keepWriting", act: "content.discard" },
  leaveContent: { title: "content.leaveTitle", body: "content.leaveBody", keep: "content.keepWriting", act: "content.discard" },
} as const;
const LABELS: Record<string, CopyKey> = { "home-note": "home.note", "home-second-lang": "content.language", "home-second-note": "content.secondText" };
// A <select> option is plain text, so both languages go in one string.
const option = (k: CopyKey) => `${COPY[k][0]} / ${COPY[k][1]}`;
const fill = (text: string, page: Page) => text.replaceAll("{partner_a}", page.label_a ?? "").replaceAll("{partner_b}", page.label_b ?? "");

async function readHome(): Promise<{ status: number; home: Home | null }> {
  const r = await post<{ home: Home | null }>(GET, {});
  return { status: r.status === 200 && !r.body ? 0 : r.status, home: r.body?.home ?? null };
}

export function HomeEditor({ page, drafts, now, onBack, onSignedOut, onContent }: Props) {
  const online = useOnline();
  const lang = page.default_lang as Lang;
  // A new Home carries the id it will be created with, so a retried first save cannot make a second one.
  const [newId] = useState(() => crypto.randomUUID());
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<Load>("loading");
  const [home, setHome] = useState<Home | null>(null);
  const [draft, setDraft] = useState<HomeDraft>(() => homeDraftOf(null, lang));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState<CopyKey | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [created, setCreated] = useState(false); // the 409 met a Home made elsewhere before this screen's first save
  const [stale, setStale] = useState(false); // a write succeeded but its re-read failed: writes wait for a re-read
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [guestsNow, setGuestsNow] = useState(false); // after Unpublish the preview shows what guests see
  const [previewLang, setPreviewLang] = useState<Lang | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [staged, setStaged] = useState<string[]>([]);
  const [wasOnline, setWasOnline] = useState(online);
  const heading = useRef<HTMLHeadingElement>(null);
  const conflictRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pickerRef = useRef<HTMLDialogElement>(null);
  const chooseRef = useRef<HTMLButtonElement>(null);
  const photosRef = useRef<HTMLHeadingElement>(null);
  // Choose photos, or the stack's heading while it is disabled (offline, say): focus never drops to the page.
  const focusChoose = () => (chooseRef.current?.disabled ? photosRef.current : chooseRef.current)?.focus();
  const pickerRead = useRef(0); // the latest picker read; an older answer, or one after Close, is ignored
  const id = home?.id ?? newId;

  useEffect(() => {
    let live = true;
    void readHome().then((r) => {
      if (!live) return;
      if (r.status === 200) {
        setHome(r.home);
        setDraft(homeDraftOf(r.home, lang));
        setLoad("ready");
      } else if (r.status === 401) onSignedOut();
      else setLoad(r.status === 403 ? "accessLost" : "error");
    });
    return () => {
      live = false;
    };
  }, [attempt, lang, onSignedOut]);
  useEffect(() => heading.current?.focus(), [load]);
  useEffect(() => {
    if (conflict?.state === "loading") conflictRef.current?.focus();
  }, [conflict?.state]);
  useEffect(() => {
    for (const [ref, open] of [[dialogRef, !!dialog], [pickerRef, !!picker]] as const) {
      if (open && !ref.current?.open) ref.current?.showModal();
      if (!open && ref.current?.open) ref.current.close();
    }
  }, [dialog, picker]);

  const dirty = homeDirty(draft, home, lang);
  const errors = tried ? homeErrors(draft) : [];
  const errorOf = (control: string) => errors.find(([c]) => c === control)?.[1];
  const blocked = !!busy || !online || !!conflict || stale;
  const reason = online ? undefined : "offline-reason";
  const say = (key: CopyKey, vars?: Record<string, number>) => setStatus({ key, vars });
  // Coming back online keeps any unresolved failure and its Try again, and says the connection is back.
  if (online !== wasOnline) {
    setWasOnline(online);
    setStatus(online ? { key: "home.connected" } : null);
  }
  useEffect(() => {
    if (!dirty) return;
    const stay = (event: BeforeUnloadEvent) => event.preventDefault();
    addEventListener("beforeunload", stay);
    return () => removeEventListener("beforeunload", stay);
  }, [dirty]);

  const set = (change: Partial<HomeDraft>) => {
    setDraft((d) => ({ ...d, ...change }));
    if (guestsNow) {
      setGuestsNow(false);
      say("home.previewWorking");
    }
  };
  const begin = (key: CopyKey) => {
    setBusy(key);
    setNotice(null);
    setStatus(null);
  };
  const accept = (h: Home | null) => {
    setHome(h);
    setDraft(homeDraftOf(h, lang));
  };

  // After a confirmed write: re-read Home; false when the re-read failed. keep: the working copy has later edits that
  // stay unsaved (photos deleted meanwhile still leave it).
  async function settle(key: CopyKey, sent?: string[], keep = false) {
    const r = await readHome();
    const read = r.home;
    if (r.status !== 200 || !read) {
      setStale(true);
      say(key);
      setNotice({ key: "common.readError", reread: true, sent });
      return false;
    }
    setStale(false);
    const gone = sent?.filter((id) => !read.picks.some((p) => p.media_id === id)) ?? [];
    if (keep) {
      setHome(read);
      setDraft((d) => ({ ...d, picks: d.picks.filter((p) => !gone.includes(p.media_id)) }));
    } else accept(read);
    if (gone.length) say("home.deleted", { count: deletedCount(sent!, read) });
    else say(key);
    return true;
  }
  // A refused or unknown write: what the owner typed always stays.
  function failed(code: number, pending: Pending, refused: CopyKey, unconfirmed: CopyKey) {
    if (code === 401) setNotice({ key: "content.session", signin: true, pending });
    else if (code === 403) setNotice({ key: "common.accessLost", logout: true });
    else if (code === 400) setNotice({ key: refused });
    else setNotice({ key: unconfirmed, pending });
  }
  // 409: re-read the complete saved Home; both choices wait for it.
  async function conflicted(mine = home) {
    setCreated(false);
    setConflict({ state: "loading" });
    const r = await readHome();
    // A Home under this screen's own id was made here (a retried create), so it is a plain conflict.
    setCreated(!mine && !!r.home && r.home.id !== newId);
    setConflict(r.status !== 200 ? { state: "error" } : r.home ? { state: "ready", home: r.home } : { state: "missing" });
  }

  // The save request alone; the new version, or null when it was not confirmed.
  async function sendSave(p: Extract<Pending, { op: "save" }>): Promise<number | null> {
    begin("save.busy");
    const r = await post<{ version: number }>("/api/owner/home", p.body);
    if (r.status === 200 && r.body) return r.body.version;
    if (r.status === 409) await conflicted();
    else failed(r.status, p, "content.generic", "home.saveUnconfirmed");
    setBusy(null);
    return null;
  }
  async function sendStatus(p: Extract<Pending, { op: "publish" | "unpublish" }>, sent?: string[], keep = false) {
    const publish = p.op === "publish";
    begin(publish ? "finish.busy" : "home.unpublishing");
    const r = await post<{ version: number }>("/api/owner/item/status", { id, expected_version: p.version, status: publish ? "published" : "draft" });
    if (r.status === 200) {
      await settle(publish ? "content.publishedDone" : "content.unpublishedDone", sent, keep);
      if (!publish) setGuestsNow(true);
    } else if (r.status === 409) await conflicted();
    else {
      // A save this action made is confirmed: re-read it before saying the status change failed.
      // If that re-read failed, its Try again stays: writes are blocked until it succeeds.
      if (sent && !(await settle("content.saved", sent, keep))) return setBusy(null);
      failed(r.status, p, publish ? "home.publishFailed" : "home.unpublishFailed", publish ? "home.publishUnconfirmed" : "home.unpublishUnconfirmed");
    }
    setBusy(null);
  }
  // The save body, or null after moving focus to the first invalid control.
  function body() {
    const found = homeErrors(draft);
    if (!found.length) return homeSaveBody(draft, id, home?.version ?? null);
    flushSync(() => setTried(true)); // the errors are on screen before focus lands, so they are read with the control
    document.getElementById(found[0][0])?.focus();
    return null;
  }
  async function onSave() {
    const b = body();
    if (!b) return;
    if ((await sendSave({ op: "save", body: b, publish: false })) !== null) await settle("content.saved", b.picks);
    setBusy(null);
  }
  async function onPublish() {
    if (home && !dirty) return sendStatus({ op: "publish", version: home.version });
    const b = body();
    if (!b) return;
    const version = await sendSave({ op: "save", body: b, publish: true });
    if (version !== null) await sendStatus({ op: "publish", version }, b.picks);
  }
  // Try again after an unknown outcome: re-read; if the write landed, say so (later edits stay unsaved); otherwise
  // resend the kept payload, never the current working copy.
  async function retry(p: Pending) {
    begin("common.loading");
    const r = await readHome();
    if (r.status !== 200) {
      setBusy(null);
      setNotice(
        r.status === 401
          ? { key: "content.session", signin: true, pending: p }
          : r.status === 403
            ? { key: "common.accessLost", logout: true }
            : { key: "common.readError", pending: p },
      );
      return;
    }
    setStale(false);
    if (landed(p, r.home)) {
      setHome(r.home);
      if (p.op === "save" && p.publish) return sendStatus({ op: "publish", version: r.home!.version }, undefined, true);
      if (p.op === "unpublish") setGuestsNow(true);
      say(p.op === "save" ? "content.saved" : p.op === "publish" ? "content.publishedDone" : "content.unpublishedDone");
      setBusy(null);
      return;
    }
    if (p.op !== "save") return sendStatus(p, undefined, true);
    const version = await sendSave(p);
    if (version === null) return;
    if (p.publish) return sendStatus({ op: "publish", version }, p.body.picks, true);
    await settle("content.saved", p.body.picks, true);
    setBusy(null);
  }
  // The re-read a failed settle offers: the working copy may have edits made since, so it is kept; the photos the
  // write sent still say which were deleted meanwhile.
  async function reread(sent?: string[]) {
    begin("common.loading");
    await settle("home.loaded", sent, true);
    setBusy(null);
  }

  function act() {
    const open = dialog;
    setDialog(null);
    if (open === "leave") return onBack();
    if (open === "leaveContent") return onContent();
    // Unsaved edits stay in the working copy (as O5).
    if (open === "unpublish" && home) void sendStatus({ op: "unpublish", version: home.version }, undefined, true).then(() => document.activeElement === document.body && heading.current?.focus());
  }
  // Keep writing and Esc: the opener of the leave-for-Content dialog was in the closed picker, so focus goes to Choose photos.
  const keepWriting = () => {
    const was = dialog;
    dialogRef.current?.close();
    setDialog(null);
    if (was === "leaveContent") focusChoose();
  };
  const back = () => (dirty && load === "ready" ? setDialog("leave") : onBack());

  // The stack: a moved pick keeps focus on the same button, or its row when that button is now disabled; Remove moves
  // focus to the next pick's Remove, else the previous one's, else Choose photos.
  function move(i: number, by: -1 | 1) {
    const picks = [...draft.picks];
    const [p] = picks.splice(i, 1);
    picks.splice(i + by, 0, p);
    flushSync(() => setStatus(null)); // cleared first, so the same message twice is announced twice
    flushSync(() => {
      set({ picks });
      say("home.photoMoved", { position: i + by + 1 });
    });
    const control = document.getElementById(`${by < 0 ? "up" : "down"}-${p.media_id}`) as HTMLButtonElement | null;
    (control && !control.disabled ? control : document.getElementById(`pick-${p.media_id}`))?.focus();
  }
  function remove(i: number) {
    const picks = draft.picks.filter((_, n) => n !== i);
    flushSync(() => setStatus(null));
    flushSync(() => {
      set({ picks });
      say("home.photoRemoved");
    });
    const next = picks[i] ?? picks[i - 1];
    if (next) document.getElementById(`remove-${next.media_id}`)?.focus();
    else focusChoose();
  }

  // The picker: choices are staged until Use these photos; Close and Esc discard them.
  async function readPicker(again = false) {
    const n = ++pickerRead.current;
    setPicker({ state: "loading" });
    const r = await post<{ memories: Memory[] }>("/api/owner/home/picker", {});
    if (n !== pickerRead.current) return;
    setPicker(r.status === 200 && r.body ? { state: "ready", memories: r.body.memories, reread: again } : { state: "error" });
  }
  const openPicker = () => {
    setStaged(draft.picks.map((p) => p.media_id));
    void readPicker();
  };
  // Closed here, not by the effect, so Choose photos is no longer inert when it takes focus.
  const closePicker = () => {
    pickerRead.current++;
    pickerRef.current?.close();
    setPicker(null);
    focusChoose();
  };
  const shown: Photo[] = picker?.state === "ready" ? picker.memories.flatMap((m) => m.photos.map((p) => ({ ...p, item_id: m.item_id, hidden: false }))) : [];
  const isShown = (mediaId: string) => shown.some((p) => p.media_id === mediaId);
  // Picks the picker does not list (hidden ones, say) stay in the stack and use a slot.
  const outside = draft.picks.filter((p) => !isShown(p.media_id));
  const count = outside.length + shown.filter((p) => staged.includes(p.media_id)).length;
  const full = count >= MAX_PICKS;
  const usePhotos = () => {
    const kept = draft.picks.filter((p) => !isShown(p.media_id) || staged.includes(p.media_id));
    const added = shown.filter((p) => staged.includes(p.media_id) && !draft.picks.some((d) => d.media_id === p.media_id));
    set({ picks: [...kept, ...added] });
    say("home.stackUpdated");
    closePicker();
  };

  const editorCount = counter(draft.start_date || null, home?.timezone ?? page.timezone, now);
  const cover = draft.picks.find((p) => !p.hidden);
  // Preview languages are the Wording's (both); the note resolves on its own, falling back to the main note (Q144 20).
  const shownLang = previewLang ?? draft.lang;
  const ownNote = draft.second && draft.lang_alt === shownLang && draft.body_alt.trim() ? draft.body_alt : null;
  const previewNote = shownLang === draft.lang ? draft.body : (ownNote ?? draft.body);
  const noteLang = shownLang !== draft.lang && ownNote ? draft.lang_alt : draft.lang;
  const greeting = drafts?.["home.greeting"]?.[shownLang];
  const days = drafts?.["home.days"]?.[shownLang];
  const keys = dialog ? DIALOGS[dialog] : null;
  const saveBlocked = blocked || !dirty;
  const publishBlocked = blocked || (!!home?.published && !dirty && !home.unpublished_changes);

  const noteField = (control: string, label: CopyKey, hint: CopyKey, value: string, valueLang: Lang, onChange: (v: string) => void) => (
    <div className={s.field}>
      <label htmlFor={control}>
        <T k={label} />
      </label>
      <textarea
        id={control}
        rows={5}
        className={s.input}
        value={value}
        lang={valueLang}
        readOnly={!!busy}
        aria-invalid={!!errorOf(control)}
        aria-describedby={`${control}-hint ${control}-count ${control}-error`}
        onChange={(event) => onChange(event.target.value)}
      />
      <small id={`${control}-hint`} className={s.small}>
        <T k={hint} />
      </small>
      <small id={`${control}-count`} className={s.small}>
        {`${noteLength(value)}/${NOTE_MAX}`}
      </small>
      <p className={s.error} id={`${control}-error`}>
        {errorOf(control) && <T k={errorOf(control)!} />}
      </p>
    </div>
  );
  const langSelect = (control: string, label: CopyKey, value: Lang, onChange: (l: Lang) => void) => (
    <div className={s.field}>
      <label htmlFor={control}>
        <T k={label} />
      </label>
      <select
        id={control}
        className={s.input}
        value={value}
        disabled={!!busy}
        aria-invalid={!!errorOf(control)}
        aria-describedby={`${control}-error`}
        onChange={(event) => onChange(event.target.value as Lang)}
      >
        <option value="vi">{option("content.vi")}</option>
        <option value="en">{option("content.en")}</option>
      </select>
      <p className={s.error} id={`${control}-error`}>
        {errorOf(control) && <T k={errorOf(control)!} />}
      </p>
    </div>
  );

  return (
    <div className={`${s.page} ${s.wide}`}>
      <header className={`${s.topbar} ${s.bar}`}>
        <h1 className={s.topbarText} tabIndex={-1} ref={heading}>
          <T k="home.edit" />
        </h1>
        <button type="button" className={s.secondary} disabled={!!busy} onClick={back}>
          <L k="navigation.back" />
        </button>
      </header>
      <main className={s.main}>
        <Announcers status={busy ?? (!online ? "common.offline" : status?.key)} vars={busy ? undefined : status?.vars} alert={notice?.key} />
        {!online && (
          <p id="offline-reason" className={s.notice}>
            <T k="common.offline" />
          </p>
        )}
        {notice && (
          <div className={`${s.notice} ${s.stack}`}>
            <p className={s.error}>
              <T k={notice.key} />
            </p>
            {notice.signin && (
              // A new tab, so this one keeps the input; back here, Try again sends it.
              <a className={s.secondary} href="/login?next=%2Fapp" target="_blank" rel="noopener">
                <L k="content.signin" />
              </a>
            )}
            {(notice.pending || notice.reread) && (
              <button
                type="button"
                className={s.secondary}
                disabled={!!busy || !online}
                aria-describedby={reason}
                onClick={() => void (notice.pending ? retry(notice.pending) : reread(notice.sent))}
              >
                <L k="common.tryAgain" />
              </button>
            )}
            {notice.logout && <LogOut />}
          </div>
        )}
        {!busy && !notice && status && (
          <p className={`${s.notice} ${s.status}`}>
            <T k={status.key} vars={status.vars} />
          </p>
        )}
        {load === "loading" && (
          <section className={s.surface} aria-busy="true">
            <p>
              <T k="common.loading" />
            </p>
          </section>
        )}
        {load === "error" && (
          <section className={`${s.surface} ${s.stack}`}>
            <p className={s.error}>
              <T k="common.readError" />
            </p>
            <button type="button" className={s.secondary} disabled={!online} aria-describedby={reason} onClick={() => (setLoad("loading"), setAttempt((n) => n + 1))}>
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
        {load === "ready" && conflict && (
          <section className={`${s.notice} ${s.stack}`}>
            <h2 tabIndex={-1} ref={conflictRef}>
              <T k={created ? "home.created" : "content.conflict"} />
            </h2>
            <p>
              <T k="content.conflictHint" />
            </p>
            {conflict.state === "loading" && (
              <p>
                <T k="common.loading" />
              </p>
            )}
            {conflict.state === "error" && (
              <>
                <p className={s.error}>
                  <T k="common.readError" />
                </p>
                <button type="button" className={s.secondary} disabled={!online} aria-describedby={reason} onClick={() => void conflicted(created ? null : home)}>
                  <L k="common.tryAgain" />
                </button>
              </>
            )}
            {conflict.state === "missing" && (
              <p>
                <T k="content.notFound" />
              </p>
            )}
            {conflict.state === "ready" && (
              <div>
                <h3>
                  <T k="content.reread" />
                </h3>
                <ul id="home-changed" className={s.list}>
                  {changedFields(home, conflict.home).map((key) => (
                    <li key={key}>
                      <T k={key} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className={s.actions}>
              <button
                type="button"
                className={s.secondary}
                disabled={conflict.state !== "ready"}
                onClick={() => {
                  if (conflict.state !== "ready") return;
                  accept(conflict.home);
                  setConflict(null);
                  say("home.loaded");
                  heading.current?.focus();
                }}
              >
                <L k="content.reload" />
              </button>
              <button
                type="button"
                className={s.secondary}
                disabled={conflict.state !== "ready"}
                onClick={() => {
                  if (conflict.state !== "ready") return;
                  setHome(conflict.home);
                  setConflict(null);
                  heading.current?.focus();
                }}
              >
                <L k="conflict.keep" />
              </button>
            </div>
          </section>
        )}
        {load === "ready" && (
          <div className={s.editor}>
            <form
              className={`${s.surface} ${s.stack} ${s.editorForm}`}
              aria-labelledby="form-title"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                if (!saveBlocked) void onSave();
              }}
            >
              <h2 id="form-title">
                <T k="content.workingCopy" />
              </h2>
              <p className={s.badges}>
                <span className={s.tag}>
                  <T k={!home ? "home.new" : home.published ? "content.published" : "content.draft"} />
                </span>
              </p>
              {home?.unpublished_changes && (
                <p className={s.notice}>
                  <T k="content.changesHint" />
                </p>
              )}
              {errors.length > 0 && (
                <div>
                  <p className={s.error}>
                    <T k="content.errors" />
                  </p>
                  <ul id="error-summary" className={s.list}>
                    {errors.map(([control, key]) => (
                      <li key={control}>
                        <a
                          href={`#${control}`}
                          onClick={(event) => {
                            event.preventDefault();
                            document.getElementById(control)?.focus();
                          }}
                        >
                          <T k={LABELS[control]} />: <T k={key} />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className={s.field}>
                <label htmlFor="home-start">
                  <T k="home.start" />
                </label>
                <input
                  id="home-start"
                  type="date"
                  className={s.input}
                  value={draft.start_date}
                  readOnly={!!busy}
                  aria-describedby="home-zone-line home-counter"
                  onChange={(event) => set({ start_date: event.target.value })}
                />
                <p id="home-zone-line" className={s.small}>
                  <T k="review.zone" />: <span id="home-zone">{home?.timezone ?? page.timezone}</span>
                </p>
                <p id="home-counter">
                  {editorCount.kind === "none" && <T k="home.noDate" />}
                  {editorCount.kind === "future" && <T k="home.future" vars={{ date: editorCount.date }} />}
                  {editorCount.kind === "day" && <T k={editorCount.utc ? "home.dayUtc" : "home.day"} vars={{ days: editorCount.days }} />}
                </p>
              </div>
              {langSelect("home-lang", "content.mainLanguage", draft.lang, (l) => set({ lang: l }))}
              {noteField("home-note", "home.note", "home.noteHint", draft.body, draft.lang, (v) => set({ body: v }))}
              <div className={`${s.stack} ${s.divider}`}>
                <label className={s.check} htmlFor="home-second">
                  <input
                    id="home-second"
                    type="checkbox"
                    checked={draft.second}
                    disabled={!!busy}
                    aria-describedby="home-second-hint"
                    onChange={(event) => set({ second: event.target.checked })}
                  />
                  <span>
                    <T k="content.second" />
                  </span>
                </label>
                <p id="home-second-hint" className={s.small}>
                  {!draft.second && home?.body_alt && <T k="home.removeSecondHint" />}
                </p>
                {draft.second && (
                  <>
                    {langSelect("home-second-lang", "content.language", draft.lang_alt, (l) => set({ lang_alt: l }))}
                    {noteField("home-second-note", "content.secondText", "home.fallback", draft.body_alt, draft.lang_alt, (v) => set({ body_alt: v }))}
                  </>
                )}
              </div>
              <section className={`${s.stack} ${s.divider}`} aria-labelledby="home-photos-title">
                <h3 id="home-photos-title" tabIndex={-1} ref={photosRef}>
                  <T k="home.photos" />
                </h3>
                {draft.picks.length < 3 && (
                  <p className={s.small}>
                    <T k="home.pickHint" />
                  </p>
                )}
                <ol id="home-stack" className={s.list}>
                  {draft.picks.map((p, i) => (
                    <li key={p.media_id} id={`pick-${p.media_id}`} tabIndex={-1} className={`${s.stack} ${s.mediaRow}`}>
                      {p.preview_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL; the image optimizer would cache it
                        <img className={s.thumb} src={p.preview_url} alt="" width={p.width ?? undefined} height={p.height ?? undefined} />
                      ) : (
                        <div className={s.thumb} aria-hidden="true" />
                      )}
                      <p>{p.alt ?? p.alt_alt ?? <T k="home.photoNumber" vars={{ number: i + 1 }} />}</p>
                      {p === cover && (
                        <p className={s.badge}>
                          <T k="home.cover" />
                        </p>
                      )}
                      {p.hidden && (
                        <p className={s.notice}>
                          <T k="home.hidden" />
                        </p>
                      )}
                      <div className={s.actions}>
                        {(
                          [
                            ["up", "home.up", -1, i === 0],
                            ["down", "home.down", 1, i === draft.picks.length - 1],
                          ] as const
                        ).map(([name, label, by, edge]) => (
                          <button key={name} id={`${name}-${p.media_id}`} type="button" className={s.secondary} disabled={!!busy || edge} onClick={() => move(i, by)}>
                            <L k={label} />
                            <span className={s.announcer}>{` ${i + 1}`}</span>
                          </button>
                        ))}
                        <button id={`remove-${p.media_id}`} type="button" className={s.secondary} disabled={!!busy} onClick={() => remove(i)}>
                          <L k="home.remove" />
                          <span className={s.announcer}>{` ${i + 1}`}</span>
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
                <button ref={chooseRef} type="button" className={s.secondary} disabled={blocked} aria-describedby={reason} onClick={openPicker}>
                  <L k="home.choose" />
                </button>
              </section>
              <div className={s.actions}>
                <button type="submit" className={s.secondary} disabled={saveBlocked} aria-describedby={reason}>
                  <L k="content.save" />
                </button>
                <button type="button" className={s.primary} disabled={publishBlocked} aria-describedby={reason} onClick={() => void onPublish()}>
                  <L k="content.publish" />
                </button>
              </div>
              {home?.published && (
                <div className={`${s.actions} ${s.divider}`}>
                  <button type="button" className={s.secondary} disabled={blocked} aria-describedby={reason} onClick={() => setDialog("unpublish")}>
                    <L k="content.unpublish" />
                  </button>
                </div>
              )}
            </form>
            <aside id="home-preview" className={`${s.surface} ${s.stack} ${s.editorPreview}`} aria-labelledby="preview-title">
              <h2 id="preview-title">
                <T k={guestsNow ? "home.afterUnpublish" : "content.preview"} />
              </h2>
              {!guestsNow && (
                <p className={s.small}>
                  <T k="content.previewHint" />
                </p>
              )}
              <div className={s.field}>
                <label htmlFor="preview-lang">
                  <T k="preview.language" />
                </label>
                <select id="preview-lang" className={s.input} value={shownLang} onChange={(event) => setPreviewLang(event.target.value as Lang)}>
                  {(["vi", "en"] as const).map((l) => (
                    <option key={l} value={l}>
                      {option(`content.${l}`)}
                    </option>
                  ))}
                </select>
              </div>
              <h3>
                <bdi>{page.label_a}</bdi> &amp; <bdi>{page.label_b}</bdi>
              </h3>
              {greeting && <p lang={shownLang}>{fill(greeting, page)}</p>}
              {!guestsNow && (
                <>
                  {cover?.preview_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL; the image optimizer would cache it
                    <img className={s.thumb} src={cover.preview_url} alt={cover.alt ?? cover.alt_alt ?? ""} width={cover.width ?? undefined} height={cover.height ?? undefined} />
                  ) : (
                    !cover && (
                      <p className={s.small}>
                        <T k="preview.photos" />
                      </p>
                    )
                  )}
                  {previewNote.trim() ? (
                    <p className={s.prose} lang={noteLang}>
                      {previewNote}
                    </p>
                  ) : (
                    <p className={s.small}>
                      <T k="preview.note" />
                    </p>
                  )}
                  {editorCount.kind === "day" && days && <p lang={shownLang}>{days.replaceAll("{days}", String(editorCount.days))}</p>}
                </>
              )}
              <p className={s.small}>
                <T k="home.wordingPointer" />
              </p>
            </aside>
          </div>
        )}
        <dialog
          ref={dialogRef}
          className={s.dialog}
          aria-labelledby="dialog-title"
          aria-describedby="dialog-body"
          onCancel={(event) => {
            event.preventDefault();
            keepWriting();
          }}
        >
          {keys && (
            <div className={s.stack}>
              <h2 id="dialog-title">
                <T k={keys.title} />
              </h2>
              <p id="dialog-body">
                <T k={keys.body} />
              </p>
              {dialog === "unpublish" && !online && (
                <p className={s.notice}>
                  <T k="home.unpublishOffline" />
                </p>
              )}
              <button type="button" className={dialog === "unpublish" ? s.secondary : s.primary} onClick={keepWriting}>
                <L k={keys.keep} />
              </button>
              <button
                type="button"
                className={dialog === "unpublish" ? `${s.secondary} ${s.danger}` : s.secondary}
                disabled={dialog === "unpublish" && blocked}
                onClick={act}
              >
                <L k={keys.act} />
              </button>
            </div>
          )}
        </dialog>
        <dialog
          ref={pickerRef}
          className={s.dialog}
          aria-labelledby="picker-title"
          onCancel={(event) => {
            event.preventDefault();
            closePicker();
          }}
        >
          {picker && (
            <div className={s.stack}>
              <h2 id="picker-title">
                <T k="home.choose" />
              </h2>
              <p className={s.small}>
                <T k="home.altHint" />
              </p>
              {picker.state === "loading" && (
                <p>
                  <T k="common.loading" />
                </p>
              )}
              {picker.state === "error" && (
                <>
                  <p className={s.error} role="alert">
                    <T k="common.readError" />
                  </p>
                  <button type="button" className={s.secondary} disabled={!online} onClick={() => void readPicker(true)}>
                    <L k="common.tryAgain" />
                  </button>
                </>
              )}
              {picker.state === "ready" && picker.memories.length === 0 && (
                <>
                  <p>
                    <T k="home.pickerEmpty" />
                  </p>
                  <button
                    type="button"
                    className={s.secondary}
                    onClick={() => {
                      setPicker(null);
                      if (dirty) setDialog("leaveContent");
                      else onContent();
                    }}
                  >
                    <L k="content.content" />
                  </button>
                </>
              )}
              {picker.state === "ready" && picker.memories.length > 0 && (
                <>
                  <p role="status">
                    {picker.reread && <T k="home.photosReady" />} <T k="home.selected" vars={{ count }} />
                  </p>
                  <p id="picker-limit" className={s.small}>
                    {full && <T k={outside.some((p) => p.hidden) ? "home.hiddenLimit" : "home.limit"} />}
                  </p>
                  {picker.memories.map((m) => (
                    <fieldset key={m.item_id} className={`${s.fieldset} ${s.stack}`}>
                      <legend>
                        <span lang={m.lang}>{m.title}</span>
                        {m.event_date && <> · {displayDate(m.event_date, m.date_precision)}</>}
                      </legend>
                      {m.photos.map((p) => {
                        const checked = staged.includes(p.media_id);
                        return (
                          <label key={p.media_id} className={s.check} htmlFor={`photo-${p.media_id}`}>
                            <input
                              id={`photo-${p.media_id}`}
                              type="checkbox"
                              checked={checked}
                              disabled={full && !checked}
                              aria-describedby="picker-limit"
                              onChange={(event) =>
                                setStaged((ids) => (event.target.checked ? [...ids, p.media_id] : ids.filter((x) => x !== p.media_id)))
                              }
                            />
                            {p.preview_url ? (
                              // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL; the image optimizer would cache it
                              <img className={s.thumb} src={p.preview_url} alt="" width={p.width ?? undefined} height={p.height ?? undefined} />
                            ) : (
                              <span className={s.thumb} aria-hidden="true" />
                            )}
                            {/* one span: the label is a flex row, and T's loose parts would become columns */}
                            {/* alt is in the memory's language; alt_alt's language is not read here, so it is unmarked */}
                            {p.alt ? (
                              <span lang={m.lang}>{p.alt}</span>
                            ) : p.alt_alt ? (
                              <span>{p.alt_alt}</span>
                            ) : (
                              <span>
                                <T k="home.noDescription" />
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </fieldset>
                  ))}
                  <button type="button" className={s.primary} onClick={usePhotos}>
                    <L k="home.usePhotos" />
                  </button>
                </>
              )}
              <button type="button" className={s.secondary} onClick={closePicker}>
                <L k="shell.close" />
              </button>
            </div>
          )}
        </dialog>
      </main>
    </div>
  );
}
