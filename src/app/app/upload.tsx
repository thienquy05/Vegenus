"use client";
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import { flushSync } from "react-dom";
import type { Item as Data } from "@/lib/content";
import { processPhoto, processVideo } from "@/lib/media";
import { actions, admit, failedStage, kindOf, megabytes, unfinished, usageLevel, type Stage } from "@/lib/upload";
import type { CopyKey } from "./copy";
import { L, LogOut, T, post, useOnline } from "./parts";
import s from "./owner.module.css";

// O6 upload (owner UI "O6 Upload for T2.3b"; Q139; T2.3b), opened from one saved item. Files are prepared in the browser
// one at a time, each variant goes to its signed upload URL, and only a file the server confirmed is called saved.
// Storage numbers are always the server's, read again after each saved file.
type Props = { id: string; onBack: () => void; onSignedOut: () => void };
type Prepared = Awaited<ReturnType<typeof processPhoto>> | Awaited<ReturnType<typeof processVideo>>;
type Row = {
  key: string;
  file: File;
  kind: "photo" | "video";
  stage: Stage;
  prepared?: Prepared;
  media_id?: string; // the reservation, until it is confirmed or canceled
  progress?: number;
  xhr?: XMLHttpRequest;
  abort?: AbortController; // stops a preparation in progress
  run: number; // bumped by Cancel, Remove and Leave, so a step still in flight knows it was stopped
  go: boolean; // waiting its turn in the queue
  auto: boolean; // interrupted while offline: restarts on reconnect
};
// Tracked apart from connectivity, so reconnecting never lifts one (owner UI O6 screen states).
type Block = "storage" | "session" | "access" | null;
type Queue = { rows: Row[]; block: Block; running: boolean; left: boolean };
type Begun = { media_id: string; files: { variant: string; url: string }[] };
type PageBody = { page?: { storage_used_bytes: number; storage_budget_bytes: number } };
type Load = "loading" | "ready" | "error" | "accessLost" | "notFound";
type Dialog = { name: "leave" } | { name: "remove"; key: string };

const VARIANTS = { photo: ["thumb", "display"], video: ["thumb", "poster", "video"] };
const DEAD: Stage[] = ["unsupported", "heic", "videoUnsupported", "large"]; // never uploaded, so not counted
const ERRORS: Stage[] = [...DEAD, "failed", "notSaved"];
const BLOCKS = { storage: "upload.full", session: "upload.session", access: "common.accessLost" } as const;
const DIALOGS = {
  leave: { title: "upload.leaveTitle", body: "upload.leaveBody", keep: "upload.stay", act: "upload.leave" },
  remove: { title: "upload.removeTitle", body: "upload.removeBody", keep: "upload.keep", act: "upload.remove" },
} as const;

const sizeOf = (p: Prepared) => Object.values(p).reduce((n: number, v) => n + (v instanceof Blob ? v.size : 0), 0);

// XMLHttpRequest, not fetch: only it reports upload progress. A plain PUT with the file's type; the cache lifetime is
// explicit so a replaced file is not served stale for long.
function put(url: string, blob: Blob, onProgress: (loaded: number) => void, hold: (xhr: XMLHttpRequest) => void) {
  return new Promise<"ok" | "failed" | "aborted">((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", blob.type);
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300 ? "ok" : "failed");
    xhr.onerror = () => resolve("failed");
    xhr.onabort = () => resolve("aborted");
    hold(xhr);
    xhr.send(blob);
  });
}

export function Upload({ id, onBack, onSignedOut }: Props) {
  const online = useOnline();
  // The queue lives in a ref for the async steps; each change is copied into state to render.
  const q = useRef<Queue>({ rows: [], block: null, running: false, left: false });
  const [snap, setSnap] = useState<{ rows: Row[]; block: Block }>({ rows: [], block: null });
  const [load, setLoad] = useState<Load>("loading");
  const [read, setRead] = useState(0);
  const [item, setItem] = useState<Data | null>(null);
  const [usage, setUsage] = useState<{ used: number; budget: number } | null>(null);
  const [said, setSaid] = useState<{ name?: string; key: CopyKey } | null>(null);
  const [refused, setRefused] = useState<{ name: string; cap: "capPhoto" | "capVideo" }[]>([]);
  const [problem, setProblem] = useState(false); // a removal the server did not confirm
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const focused = useRef<HTMLElement | null>(null);
  const hint = useRef<{ key: string; prefer: "action" | "file" } | null>(null);

  const sync = () => setSnap({ rows: q.current.rows.map((row) => ({ ...row })), block: q.current.block });
  // Each stage change is drawn at once, so the polite region announces every stage, never a percent.
  const stage = (row: Row, next: Stage, announce = true) => {
    row.stage = next;
    flushSync(() => {
      if (announce) setSaid({ name: row.file.name, key: `upload.${next}` });
      sync();
    });
  };
  const setBlock = (block: Block) => {
    q.current.block = block;
    if (block) setRefused([]); // the block's message replaces it, and the old one is not read out again later
    sync();
  };
  const find = (key: string) => q.current.rows.find((row) => row.key === key);
  const cancelReservation = (row: Row) => {
    if (row.media_id && row.stage !== "ready") void post("/api/owner/upload/cancel", { media_id: row.media_id });
    if (row.stage !== "ready") row.media_id = undefined;
  };

  function usageFrom(r: { status: number; body: PageBody | null }) {
    const page = r.body?.page;
    if (r.status !== 200 || !page) return; // the last server numbers stay
    setUsage({ used: page.storage_used_bytes, budget: page.storage_budget_bytes });
    if (usageLevel(page.storage_used_bytes, page.storage_budget_bytes) === "full") setBlock("storage");
  }

  useEffect(() => {
    let live = true;
    void Promise.all([post<{ item: Data }>("/api/owner/item/get", { id }), post<PageBody>("/api/owner/page", {})]).then(([r, page]) => {
      if (!live) return;
      usageFrom(page);
      if (r.status === 200 && r.body?.item) {
        setItem(r.body.item);
        setLoad("ready");
      } else if (r.status === 401) onSignedOut();
      else setLoad(r.status === 403 ? "accessLost" : r.status === 404 ? "notFound" : "error");
    });
    return () => {
      live = false;
    };
    // usageFrom only sets state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, read, onSignedOut]);
  useEffect(() => heading.current?.focus(), []);
  // Leaving the screen any other way still stops the uploads and gives back their reservations.
  useEffect(() => {
    const queue = q.current;
    queue.left = false;
    return () => {
      if (queue.left) return;
      queue.left = true;
      for (const row of queue.rows) {
        row.abort?.abort();
        row.xhr?.abort();
        if (row.media_id && row.stage !== "ready") void post("/api/owner/upload/cancel", { media_id: row.media_id });
      }
    };
  }, []);
  // Before the focus check below, so a closing dialog has handed focus back to its opener first.
  useLayoutEffect(() => {
    if (dialog && !dialogRef.current?.open) dialogRef.current?.showModal();
    if (!dialog && dialogRef.current?.open) dialogRef.current.close();
  }, [dialog]);
  // When the focused control disappears or is disabled: the same row's next action, else that file, else Back. The row
  // is the one focus was last in (onFocus), or the neighbour of a removed row (drop).
  useLayoutEffect(() => {
    const was = focused.current;
    const active = document.activeElement;
    if (!was || (was.isConnected && !(was as HTMLButtonElement).disabled)) return;
    if (active && active !== document.body && active !== was) return;
    const article = hint.current ? document.getElementById(`row-${hint.current.key}`) : null;
    const action = hint.current?.prefer === "action" ? article?.querySelector<HTMLElement>("[data-action]:not(:disabled)") : null;
    (action ?? article?.querySelector<HTMLElement>("[data-file]") ?? backButton.current)?.focus();
  });

  const pending = snap.rows.some((row) => unfinished(row.stage));
  useEffect(() => {
    if (!pending) return;
    const stay = (event: BeforeUnloadEvent) => event.preventDefault();
    addEventListener("beforeunload", stay);
    return () => removeEventListener("beforeunload", stay);
  }, [pending]);

  // A restart: the old reservation is given back, the prepared files are kept.
  function requeue(row: Row) {
    cancelReservation(row);
    row.progress = 0;
    stage(row, "queued", false);
    row.go = true;
  }

  // One file at a time, while nothing blocks and the browser is online.
  async function pump() {
    const queue = q.current;
    if (queue.running) return;
    queue.running = true;
    try {
      for (let row = queue.rows.find((r) => r.go); row && !queue.block && !queue.left && navigator.onLine; row = queue.rows.find((r) => r.go)) {
        row.go = false;
        await upload(row);
      }
    } finally {
      queue.running = false;
    }
  }

  async function upload(row: Row) {
    const run = ++row.run;
    const live = () => row.run === run && !q.current.left;
    if (row.stage === "notSaved") return confirm(row, live);
    if (!row.prepared) {
      stage(row, row.kind === "photo" ? "preparingPhoto" : "preparingVideo");
      // Cancel frees the queue at once: the video conversion is stopped, and a photo's result is ignored.
      const stop = new AbortController();
      row.abort = stop;
      const stopped = new Promise<never>((_, reject) => stop.signal.addEventListener("abort", () => reject(stop.signal.reason), { once: true }));
      try {
        row.prepared = await Promise.race([row.kind === "photo" ? processPhoto(row.file) : processVideo(row.file, stop.signal), stopped]);
      } catch (error) {
        if (live()) stage(row, failedStage(error, row.file, "VideoEncoder" in globalThis));
        return;
      } finally {
        row.abort = undefined;
      }
      if (!live()) return;
      if (row.kind === "photo") stage(row, "prepared");
    }
    const begun = await post<Begun>("/api/owner/upload/begin", { item_id: id, kind: row.kind, variants: VARIANTS[row.kind] });
    if (!live()) {
      if (begun.body?.media_id) void post("/api/owner/upload/cancel", { media_id: begun.body.media_id });
      return;
    }
    if (begun.status !== 200 || !begun.body) {
      // Storage full, session expired or access lost: nothing was added and the file waits for the block to lift.
      const block = ({ 409: "storage", 401: "session", 403: "access" } as const)[begun.status as 409 | 401 | 403];
      if (!block) {
        row.auto = !navigator.onLine; // lost to the network while offline: restarts on reconnect
        return stage(row, "failed");
      }
      row.go = true;
      stage(row, "queued", false);
      return setBlock(block);
    }
    row.media_id = begun.body.media_id;
    stage(row, "uploading");
    const prepared = row.prepared as Record<string, unknown>;
    const files = begun.body.files.map((f) => ({ url: f.url, blob: prepared[f.variant] as Blob }));
    const total = files.reduce((n, f) => n + f.blob.size, 0) || 1;
    let sent = 0;
    for (const { url, blob } of files) {
      const result = await put(
        url,
        blob,
        (loaded) => {
          row.progress = (sent + loaded) / total;
          sync();
        },
        (xhr) => (row.xhr = xhr),
      );
      row.xhr = undefined;
      if (!live()) return; // Cancel or Leave already told the server
      if (result !== "ok") {
        row.auto = !navigator.onLine;
        return stage(row, "failed");
      }
      sent += blob.size;
    }
    await confirm(row, live);
  }

  async function confirm(row: Row, live: () => boolean) {
    stage(row, "saving");
    const p = row.prepared!;
    const r = await post<{ error?: string }>("/api/owner/upload/complete", {
      media_id: row.media_id,
      width: p.width,
      height: p.height,
      duration_ms: "duration_ms" in p ? p.duration_ms : null,
    });
    if (!live()) return;
    if (r.status === 200) return saved(row);
    if (r.status === 404) {
      // The reservation is gone: an earlier confirmation may have gone through, and then the item holds the file.
      const again = await post<{ item: Data }>("/api/owner/item/get", { id });
      if (!live()) return;
      if (again.status !== 200) return stage(row, "notSaved");
      if (again.body?.item.media.some((m) => m.id === row.media_id)) return saved(row);
      row.media_id = undefined;
      return stage(row, "failed");
    }
    if (r.status === 422) {
      cancelReservation(row);
      return stage(row, "large");
    }
    if (r.status === 409 && r.body?.error === "invalid_file") {
      row.media_id = undefined; // the server refused the content and cancelled the upload; a retry would send the same bytes
      return stage(row, "unsupported");
    }
    if (r.status === 409) return stage(row, "failed"); // not every file arrived: Try again restarts the upload
    stage(row, "notSaved");
    if (r.status === 401) setBlock("session");
    if (r.status === 403) setBlock("access");
  }

  async function saved(row: Row) {
    stage(row, "ready");
    usageFrom(await post<PageBody>("/api/owner/page", {}));
    if (q.current.rows.every((r) => r.stage === "ready")) setSaid({ key: "upload.allDone" });
  }

  const connection = useEffectEvent((on: boolean) => {
    setSaid(null); // coming back must not read out an earlier stage, nor one that failed while offline
    if (!on) return;
    for (const row of q.current.rows) {
      if (!row.auto) continue;
      row.auto = false; // eslint-disable-line react-hooks/immutability -- queue rows are a ref's contents, changed outside render
      requeue(row);
    }
    void pump();
  });
  useEffect(() => {
    const up = () => connection(true);
    const down = () => connection(false);
    addEventListener("online", up);
    addEventListener("offline", down);
    return () => {
      removeEventListener("online", up);
      removeEventListener("offline", down);
    };
  }, []);

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = ""; // the same file can be chosen again after a Remove
    const media = item?.media ?? [];
    const rows = q.current.rows.filter((row) => !DEAD.includes(row.stage));
    const held = {
      photos: media.filter((m) => m.kind === "photo").length + rows.filter((row) => row.kind === "photo").length,
      videos: media.filter((m) => m.kind === "video").length + rows.filter((row) => row.kind === "video").length,
    };
    const { added, refused } = admit(files, held);
    for (const file of added) q.current.rows.push({ key: crypto.randomUUID(), file, kind: kindOf(file), stage: "queued", run: 0, go: false, auto: false });
    setRefused(refused);
    setProblem(false);
    sync();
  }
  function start() {
    // eslint-disable-next-line react-hooks/immutability -- queue rows are a ref's contents, changed outside render
    for (const row of q.current.rows) if (row.stage === "queued") row.go = true;
    sync();
    void pump();
  }
  function cancel(key: string) {
    const row = find(key);
    if (!row) return;
    row.run++;
    row.go = false;
    row.abort?.abort();
    row.xhr?.abort();
    cancelReservation(row);
    stage(row, "canceled");
  }
  function retry(key: string) {
    const row = find(key);
    if (!row) return;
    row.auto = false;
    // Not saved asks the server to confirm again; anything else starts a new upload.
    if (row.stage === "notSaved") row.go = true;
    else requeue(row);
    sync();
    void pump();
  }
  function drop(row: Row) {
    const rows = q.current.rows;
    const at = rows.indexOf(row);
    if (at < 0) return;
    const near = rows[at + 1] ?? rows[at - 1];
    hint.current = near ? { key: near.key, prefer: "file" } : null;
    row.run++;
    row.abort?.abort();
    row.xhr?.abort();
    cancelReservation(row);
    rows.splice(at, 1);
    sync();
  }
  function remove(key: string) {
    const row = find(key);
    if (row?.stage === "ready") setDialog({ name: "remove", key });
    else if (row) drop(row);
  }
  async function removeSaved(row: Row) {
    const r = await post("/api/owner/upload/delete", { media_id: row.media_id });
    // 404: the file is already gone, which is what Remove asked for.
    if (r.status === 200 || r.status === 404) return drop(row);
    if (r.status === 401) setBlock("session");
    else if (r.status === 403) setBlock("access");
    else {
      setRefused([]);
      setProblem(true);
    }
  }
  // Leaving cancels whatever is not confirmed; confirmed files stay on the item.
  function exit() {
    q.current.left = true;
    for (const row of q.current.rows) {
      row.run++; // eslint-disable-line react-hooks/immutability -- queue rows are a ref's contents, changed outside render
      row.abort?.abort();
      row.xhr?.abort();
      cancelReservation(row);
    }
    onBack();
  }
  const back = () => (q.current.rows.some((row) => unfinished(row.stage)) ? setDialog({ name: "leave" }) : exit());
  function act() {
    const open = dialog;
    setDialog(null);
    if (open?.name === "leave") return exit();
    const row = open && find(open.key);
    if (row) void removeSaved(row);
  }
  function resume() {
    setProblem(false);
    setBlock(null);
    void pump();
  }

  const media = item?.media ?? [];
  const counted = snap.rows.filter((row) => !DEAD.includes(row.stage));
  const photos = media.filter((m) => m.kind === "photo").length + counted.filter((row) => row.kind === "photo").length;
  const videos = media.filter((m) => m.kind === "video").length + counted.filter((row) => row.kind === "video").length;
  const level = usage ? usageLevel(usage.used, usage.budget) : "ok";
  const stopped = !!snap.block || !online;
  const current = snap.rows.find((row) => row.key === selected) ?? snap.rows[0];
  const keys = dialog ? DIALOGS[dialog.name] : null;
  const status = !online ? ({ key: "upload.pause" } as const) : said;
  const allDone = snap.rows.length > 0 && snap.rows.every((row) => row.stage === "ready");

  const fileFacts = (row: Row) => (
    <>
      <p className={s.small}>
        <T k={`upload.${row.kind}`} /> · <T k="upload.size" />: {megabytes(row.prepared ? sizeOf(row.prepared) : row.file.size, 1)} MB
      </p>
      {!row.prepared && (
        <p className={s.small}>
          <T k="upload.original" />
        </p>
      )}
      <p className={ERRORS.includes(row.stage) ? s.error : undefined}>
        <T k={`upload.${row.stage}`} />
      </p>
    </>
  );

  return (
    <div
      className={`${s.page} ${s.wide}`}
      onFocus={(event) => {
        focused.current = event.target;
        const key = event.target.closest("article")?.id.slice("row-".length);
        hint.current = key ? { key, prefer: "action" } : null;
      }}
    >
      <header className={`${s.topbar} ${s.bar}`}>
        <h1 className={s.topbarText} tabIndex={-1} ref={heading}>
          <T k="upload.title" />
        </h1>
        <button type="button" className={s.secondary} ref={backButton} onClick={back}>
          <L k="navigation.back" />
        </button>
      </header>
      <main className={s.main}>
        <p className={s.announcer} role="status" aria-live="polite" aria-atomic="true">
          {status && "name" in status && <bdi>{status.name}: </bdi>}
          {status && <T k={status.key} />}
        </p>
        <p className={s.announcer} role="alert" aria-atomic="true">
          {snap.block ? (
            <T k={BLOCKS[snap.block]} />
          ) : problem ? (
            <T k="state.write" />
          ) : load === "error" ? (
            <T k="common.readError" />
          ) : (
            // By position: phone pickers often give every photo the same name.
            refused.map((r, i) => (
              <span key={i}>
                <bdi>{r.name}</bdi>: <T k={`upload.${r.cap}`} />{" "}
              </span>
            ))
          )}
        </p>
        {!online && (
          <p id="offline-reason" className={s.notice}>
            <T k="upload.pause" />
          </p>
        )}
        {snap.block && (
          <div id="notice" className={`${s.notice} ${s.stack}`}>
            <p className={s.error}>
              <T k={BLOCKS[snap.block]} />
            </p>
            {snap.block === "storage" && (
              <a className={s.secondary} href="#usage">
                <L k="upload.viewUsage" />
              </a>
            )}
            {snap.block === "session" && (
              <>
                {/* A new tab, so this one keeps the queue; back here, Try again resumes it. */}
                <a className={s.secondary} href="/login?next=%2Fapp" target="_blank" rel="noopener">
                  <L k="content.signin" />
                </a>
                <button type="button" className={s.secondary} disabled={!online} aria-describedby={online ? undefined : "offline-reason"} onClick={resume}>
                  <L k="common.tryAgain" />
                </button>
              </>
            )}
            {snap.block === "access" && <LogOut />}
          </div>
        )}
        {problem && !snap.block && (
          <p className={`${s.notice} ${s.error}`}>
            <T k="state.write" />
          </p>
        )}
        {refused.length > 0 && (
          <ul className={`${s.notice} ${s.list}`}>
            {refused.map((r, i) => (
              <li key={i}>
                <bdi>{r.name}</bdi>: <T k={`upload.${r.cap}`} />
              </li>
            ))}
          </ul>
        )}
        {level === "warning" && !snap.block && (
          <p className={`${s.notice} ${s.warning}`}>
            <T k="upload.warning" />
          </p>
        )}
        {allDone && (
          <p className={`${s.notice} ${s.status}`}>
            <T k="upload.allDone" />
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
            <button type="button" className={s.secondary} disabled={!online} onClick={() => (setLoad("loading"), setRead((n) => n + 1))}>
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
        {load === "notFound" && (
          <section className={`${s.surface} ${s.stack}`}>
            <h2>
              <T k="content.notFound" />
            </h2>
          </section>
        )}
        {load === "ready" && item && (
          <div className={s.upload}>
            <section className={`${s.surface} ${s.stack} ${s.uploadContext}`} aria-labelledby="context-title">
              <h2 id="context-title">
                <T k="upload.context" />
              </h2>
              <p className={s.fileName} lang={item.lang}>
                {item.title}
              </p>
              <p>
                <T k="upload.queueCounts" vars={{ photos, videos }} />
              </p>
              <p className={s.small}>
                <T k="upload.limits" />
              </p>
              <p className={s.small}>
                <T k="upload.process" />
              </p>
            </section>
            <section className={`${s.surface} ${s.stack} ${s.uploadQueue}`} aria-labelledby="queue-title">
              <h2 id="queue-title">
                <T k="upload.queue" />
              </h2>
              <p className={s.small}>
                <T k="upload.savedCount" />
              </p>
              <div className={s.actions}>
                {/* The native picker, transparent over its label: the whole button is the input's 48 px target. */}
                <label className={`${s.secondary} ${s.picker}`}>
                  <L k="upload.picker" />
                  <input id="files" type="file" multiple accept="image/*,video/*" className={s.fileInput} disabled={stopped} onChange={pick} />
                </label>
                <button
                  type="button"
                  className={s.primary}
                  disabled={stopped || !snap.rows.some((row) => row.stage === "queued" && !row.go)}
                  aria-describedby={online ? undefined : "offline-reason"}
                  onClick={start}
                >
                  <L k="upload.start" />
                </button>
              </div>
              {snap.rows.length === 0 && (
                <p>
                  <T k="upload.empty" />
                </p>
              )}
              {snap.rows.map((row) => {
                const can = actions(row.stage);
                return (
                  <article key={row.key} id={`row-${row.key}`} className={s.uploadRow} aria-labelledby={`name-${row.key}`}>
                    <h3 id={`name-${row.key}`} className={s.fileName} tabIndex={-1} data-file>
                      <bdi>{row.file.name}</bdi>
                    </h3>
                    {fileFacts(row)}
                    {row.stage === "uploading" && <progress className={s.progress} max={1} value={row.progress ?? 0} aria-labelledby={`name-${row.key}`} />}
                    {row.prepared && row.kind === "photo" && (
                      <p className={s.small}>
                        <T k="upload.location" />
                      </p>
                    )}
                    <div className={s.actions}>
                      {can.cancel && (
                        <button type="button" className={s.secondary} data-action onClick={() => cancel(row.key)}>
                          <L k="upload.cancel" />
                        </button>
                      )}
                      {can.retry && (
                        <button type="button" className={s.secondary} data-action disabled={stopped} onClick={() => retry(row.key)}>
                          <L k="common.tryAgain" />
                        </button>
                      )}
                      {can.remove && (
                        <button
                          type="button"
                          className={`${s.secondary} ${s.danger}`}
                          data-action
                          disabled={row.stage === "ready" && stopped}
                          onClick={() => remove(row.key)}
                        >
                          <L k="upload.remove" />
                        </button>
                      )}
                      <button
                        type="button"
                        className={`${s.secondary} ${s.tabletUp}`}
                        aria-pressed={current?.key === row.key}
                        onClick={() => setSelected(row.key)}
                      >
                        <L k="upload.select" />
                      </button>
                    </div>
                  </article>
                );
              })}
              <div className={`${s.actions} ${s.divider}`}>
                <button type="button" className={s.secondary} onClick={back}>
                  <L k="upload.done" />
                </button>
              </div>
            </section>
            <aside className={`${s.surface} ${s.stack} ${s.uploadDetails}`} aria-labelledby="details-title">
              <h2 id="details-title">
                <T k="upload.details" />
              </h2>
              {current ? (
                <>
                  <p className={s.fileName}>
                    <bdi>{current.file.name}</bdi>
                  </p>
                  {fileFacts(current)}
                  {current.prepared && current.kind === "photo" && (
                    <p className={s.small}>
                      <T k="upload.location" />
                    </p>
                  )}
                </>
              ) : (
                <p className={s.small}>
                  <T k="upload.empty" />
                </p>
              )}
            </aside>
            <section id="usage" tabIndex={-1} className={`${s.surface} ${s.stack}`} aria-labelledby="usage-title">
              <h2 id="usage-title">
                <T k="upload.usage" />
              </h2>
              {usage ? (
                <>
                  <p className={level === "ok" ? undefined : s.warning}>
                    <T k="upload.used" vars={{ used: megabytes(usage.used), budget: megabytes(usage.budget) }} />
                  </p>
                  <meter className={s.progress} min={0} max={usage.budget} high={usage.budget * 0.8} value={usage.used} aria-labelledby="usage-title" />
                </>
              ) : (
                <p className={s.error}>
                  <T k="common.readError" />
                </p>
              )}
            </section>
          </div>
        )}
        <dialog
          ref={dialogRef}
          className={s.dialog}
          aria-labelledby="dialog-title"
          aria-describedby="dialog-body"
          onCancel={(event) => {
            event.preventDefault();
            setDialog(null);
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
              <button type="button" className={s.primary} onClick={() => setDialog(null)}>
                <L k={keys.keep} />
              </button>
              <button type="button" className={`${s.secondary} ${s.danger}`} onClick={act}>
                <L k={keys.act} />
              </button>
            </div>
          )}
        </dialog>
      </main>
    </div>
  );
}
