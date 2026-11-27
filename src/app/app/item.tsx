"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import {
  displayDate,
  draftErrors,
  draftOf,
  eventDate,
  isDirty,
  itemAfterSave,
  leapDay,
  otherLang,
  sectionOf,
  saveBody,
  unpublishedChanges,
  type Draft,
  type ErrorKey,
  type Item as Data,
  type Kind,
  type Lang,
  type Media,
  type Precision,
} from "@/lib/content";
import type { CopyKey } from "./copy";
import { Announcers, L, LogOut, T, post, useOnline } from "./parts";
import s from "./owner.module.css";

// O5 item editor (owner UI "O4 Content list and O5 Item editor"; Q140; E12, E13, E15): the simple editor the item
// schema supports. Every write names the version read; a 409 re-reads the whole item and lets the owner choose.
// Adding media is O6's, opened with Add photos or video once the item is saved; removing it and its alt text are here.
type Props = { id: string | null; kind: Kind; lang: Lang; onBack: (status?: CopyKey) => void; onSignedOut: () => void; onUpload: (id: string) => void };
type Load = "loading" | "ready" | "notFound" | "error" | "accessLost";
type Dialog = { name: "unpublish" | "delete" } | { name: "leave"; upload?: boolean } | { name: "remove"; media: Media };
// Try again names the action, so it runs with what is on screen when it is pressed, not when the write failed.
type Retry = "save" | "publish" | "unpublish" | "delete" | "reread" | { remove: Media };
type Notice = { key: CopyKey; retry?: Retry; signin?: boolean; logout?: boolean };
type Reply = { status: number };

const KINDS: Record<"memories" | "together", Kind[]> = { memories: ["memory"], together: ["milestone", "anniversary"] };
const DIALOGS = {
  unpublish: { title: "content.unpublishTitle", body: "content.unpublishBody", keep: "content.cancel", act: "content.unpublish" },
  delete: { title: "content.deleteTitle", body: "content.deleteBody", keep: "content.cancel", act: "content.delete" },
  remove: { title: "content.removeTitle", body: "content.removeBody", keep: "content.keepFile", act: "content.remove" },
  leave: { title: "content.leaveTitle", body: "content.leaveBody", keep: "content.keepWriting", act: "content.discard" },
} as const;

// The field an error summary link names: draftErrors' control ids, plus language-<lang> and alt-<media>-<lang>.
const labelOf = (control: string): CopyKey =>
  control.startsWith("alt-") ? "content.alt" : control.startsWith("language-") ? "content.language" : (`content.${control}` as CopyKey);

// Choosing the second language as the main one swaps the two languages' title, text and alt text (Q141), so nothing
// ends up stored under the wrong language.
function mainLanguage(d: Draft, lang: Lang): Draft {
  if (!d.second || d.lang_alt !== lang) return { ...d, lang };
  const alts = Object.fromEntries(Object.entries(d.alts).map(([key, a]) => [key, { alt: a.alt_alt, alt_alt: a.alt }]));
  return { ...d, lang, lang_alt: d.lang, title: d.title_alt, title_alt: d.title, body: d.body_alt, body_alt: d.body, alts };
}

export function Item({ id: opened, kind, lang, onBack, onSignedOut, onUpload }: Props) {
  const online = useOnline();
  // A new item carries the id it will be created with, so a retried first save cannot make a second item.
  const [id] = useState(() => opened ?? crypto.randomUUID());
  const [read, setRead] = useState(0);
  const [load, setLoad] = useState<Load>(opened ? "loading" : "ready");
  const [item, setItem] = useState<Data | null>(null);
  const [draft, setDraft] = useState<Draft>(() => draftOf(null, { kind, lang }));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState<CopyKey | null>(null);
  const [status, setStatus] = useState<CopyKey | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [conflict, setConflict] = useState<Data | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [gone, setGone] = useState(false); // a 409 whose re-read found no item: the input stays, writes stop
  const [wasOnline, setWasOnline] = useState(online);
  const heading = useRef<HTMLHeadingElement>(null);
  const missing = useRef<HTMLHeadingElement>(null);
  const conflictRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [fresh] = useState(() => draftOf(null, { kind, lang }));

  useEffect(() => {
    if (!opened) return;
    let live = true;
    void post<{ item: Data }>("/api/owner/item/get", { id: opened }).then((r) => {
      if (!live) return;
      if (r.status === 200 && r.body?.item) {
        setItem(r.body.item);
        setDraft(draftOf(r.body.item, { kind, lang }));
        setLoad("ready");
      } else if (r.status === 401) onSignedOut();
      else setLoad(r.status === 403 ? "accessLost" : r.status === 404 ? "notFound" : "error");
    });
    return () => {
      live = false;
    };
  }, [opened, kind, lang, read, onSignedOut]);
  useEffect(() => (load === "notFound" || gone ? missing : heading).current?.focus(), [load, gone]);
  useEffect(() => {
    if (conflict) conflictRef.current?.focus();
  }, [conflict]);
  useEffect(() => {
    if (dialog && !dialogRef.current?.open) dialogRef.current?.showModal();
    if (!dialog && dialogRef.current?.open) dialogRef.current.close();
  }, [dialog]);

  const media = item?.media ?? [];
  const base = item ? draftOf(item, { kind, lang }) : null;
  const dirty = isDirty(draft, base);
  const unsaved = item ? dirty : JSON.stringify(draft) !== JSON.stringify(fresh);
  const errors = tried ? draftErrors(draft, media) : [];
  const errorOf = (control: string) => errors.find(([c]) => c === control)?.[1];
  const set = (change: Partial<Draft>) => setDraft((d) => ({ ...d, ...change }));
  const precision: Precision = draft.kind === "anniversary" ? "day" : draft.precision;
  const blocked = !!busy || !online || !!conflict || gone;
  const reason = online ? undefined : "offline-reason";
  // Coming back online must not read out an earlier result again.
  if (online !== wasOnline) {
    setWasOnline(online);
    if (!online) setStatus(null);
  }
  // The in-app Back asks through the leave dialog; closing or reloading the tab asks through the browser.
  useEffect(() => {
    if (!unsaved) return;
    const stay = (event: BeforeUnloadEvent) => event.preventDefault();
    addEventListener("beforeunload", stay);
    return () => removeEventListener("beforeunload", stay);
  }, [unsaved]);

  // A refused write: what the owner typed always stays.
  function failed(r: Reply, retry: Retry) {
    if (r.status === 401) setNotice({ key: "content.session", signin: true, retry });
    else if (r.status === 403) setNotice({ key: "common.accessLost", logout: true });
    else if (r.status === 400) setNotice({ key: "content.generic" });
    else setNotice({ key: "state.write", retry });
  }
  // 409: re-read the complete confirmed item and offer both versions, without saying whether it was edited or deleted.
  async function conflicted() {
    setBusy("common.loading");
    const r = await post<{ item: Data }>("/api/owner/item/get", { id });
    setBusy(null);
    if (r.status === 200 && r.body?.item) setConflict(r.body.item);
    else if (r.status === 404) setGone(true);
    else failed(r, "reread");
  }
  function run(retry: Retry) {
    if (retry === "save") void onSave();
    else if (retry === "publish") void onPublish();
    else if (retry === "reread") void conflicted();
    else if (typeof retry === "object") void onRemove(retry.remove);
    else if (item) void (retry === "delete" ? onDelete(item) : onUnpublish(item));
  }
  const begin = (key: CopyKey) => {
    setBusy(key);
    setNotice(null);
    setStatus(null);
  };

  // Saves the working copy; the saved item, or null when nothing was saved.
  async function save(retry: Retry = "save"): Promise<Data | null> {
    const found = draftErrors(draft, media);
    if (found.length) {
      flushSync(() => setTried(true)); // the errors are on screen before focus lands, so they are read with the control
      document.getElementById(found[0][0])?.focus();
      return null;
    }
    begin("save.busy");
    const body = saveBody(draft, id, item?.version ?? null, base);
    const r = await post<{ version: number }>("/api/owner/item", body);
    setBusy(null);
    if (r.status === 200 && r.body) {
      const saved = itemAfterSave(item, body, r.body.version);
      setItem(saved);
      return saved;
    }
    if (r.status === 409) await conflicted();
    else failed(r, retry);
    return null;
  }
  async function onSave() {
    if (await save()) setStatus("content.saved");
  }
  async function onPublish() {
    const current = dirty ? await save("publish") : item;
    if (!current) return;
    begin("finish.busy");
    const r = await post<{ version: number }>("/api/owner/item/status", { id, expected_version: current.version, status: "published" });
    setBusy(null);
    if (r.status === 200 && r.body) {
      setItem({ ...current, version: r.body.version, status: "published", published: { ...current } });
      setStatus("content.publishedDone");
    } else if (r.status === 409) await conflicted();
    else failed(r, "publish");
  }
  async function onUnpublish(current: Data) {
    begin("content.statusPending");
    const r = await post<{ version: number }>("/api/owner/item/status", { id, expected_version: current.version, status: "draft" });
    setBusy(null);
    if (r.status === 200 && r.body) {
      setItem({ ...current, version: r.body.version, status: "draft", published: null });
      setStatus("content.unpublishedDone");
    } else if (r.status === 409) await conflicted();
    else failed(r, "unpublish");
  }
  async function onDelete(current: Data) {
    begin("content.deleting");
    const r = await post("/api/owner/item/delete", { id, expected_version: current.version });
    setBusy(null);
    if (r.status === 200) onBack("content.deleted");
    else if (r.status === 409) await conflicted();
    else failed(r, "delete");
  }
  async function onRemove(target: Media) {
    begin("content.removing");
    const r = await post("/api/owner/upload/delete", { media_id: target.id });
    setBusy(null);
    // 404: the file is already gone, which is what Remove asked for.
    if (r.status === 200 || r.status === 404) {
      setItem((current) => current && { ...current, media: current.media.filter((m) => m.id !== target.id) });
      setDraft((d) => ({ ...d, alts: Object.fromEntries(Object.entries(d.alts).filter(([key]) => key !== target.id)) }));
      setStatus("content.removed");
    } else failed(r, { remove: target });
  }
  function act() {
    const open = dialog;
    setDialog(null);
    if (!open) return;
    if (open.name === "leave") return open.upload ? onUpload(id) : onBack();
    // The confirmed button was disabled while the change ran and may be gone now: if focus fell to the page, it goes to
    // the page heading; a conflict or not-found heading that took it keeps it.
    const done = () => document.activeElement === document.body && heading.current?.focus();
    if (open.name === "remove") return void onRemove(open.media).then(done);
    if (item) void (open.name === "delete" ? onDelete(item) : onUnpublish(item)).then(done);
  }
  const back = () => (unsaved && load === "ready" ? setDialog({ name: "leave" }) : onBack());

  const errorText = (control: string) => {
    const error = errorOf(control);
    return (
      <p className={s.error} id={`${control}-error`}>
        {error && <T k={`content.${error}`} />}
      </p>
    );
  };
  const radio = (name: string, value: string, label: CopyKey, checked: boolean, onChange: () => void, disabled = !!busy) => (
    <label className={s.check} htmlFor={`${name}-${value}`} key={value}>
      <input type="radio" name={name} id={`${name}-${value}`} checked={checked} disabled={disabled} onChange={onChange} />
      <span>
        <T k={label} />
      </span>
    </label>
  );
  const textField = (control: string, label: CopyKey, value: string, onChange: (v: string) => void, hint: ReactNode, area = false, valueLang?: Lang) => {
    const props = {
      id: control,
      className: s.input,
      value,
      lang: valueLang,
      readOnly: !!busy,
      "aria-invalid": !!errorOf(control),
      "aria-describedby": `${control}-hint ${control}-error`,
      onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    };
    return (
      <div className={s.field}>
        <label htmlFor={control}>
          <T k={label} />
        </label>
        {area ? <textarea rows={5} {...props} /> : <input type="text" autoComplete="off" {...props} />}
        {!area && value.trim() && (
          <p className={s.echo} aria-hidden="true" lang={valueLang}>
            <bdi>{value.trim()}</bdi>
          </p>
        )}
        <small id={`${control}-hint`} className={s.small}>
          {hint}
        </small>
        {errorText(control)}
      </div>
    );
  };
  const dateField = (control: "year" | "month" | "day", value: string) => (
    <div className={s.field}>
      <label htmlFor={control}>
        <T k={`content.${control}`} />
      </label>
      <input
        id={control}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={s.input}
        value={value}
        readOnly={!!busy}
        aria-invalid={!!errorOf(control)}
        aria-describedby={`date-hint ${control}-error`}
        onChange={(event) => set({ [control]: event.target.value })}
      />
      {errorText(control)}
    </div>
  );
  const altField = (m: Media, which: "alt" | "alt_alt", altLang: Lang) => {
    const control = `alt-${m.id}-${altLang}`;
    const value = draft.alts[m.id]?.[which] ?? "";
    return (
      <div className={s.field} key={control}>
        <label htmlFor={control}>
          <T k="content.alt" /> · <T k={`content.${altLang}`} />
        </label>
        <textarea
          id={control}
          rows={3}
          className={s.input}
          lang={altLang}
          value={value}
          readOnly={!!busy}
          aria-invalid={!!errorOf(control)}
          aria-describedby={`alt-hint-${m.id} ${control}-error`}
          onChange={(event) => {
            const alts = draft.alts[m.id] ?? { alt: "", alt_alt: "" };
            set({ alts: { ...draft.alts, [m.id]: { ...alts, [which]: event.target.value } } });
          }}
        />
        {errorText(control)}
      </div>
    );
  };

  const date = eventDate(draft);
  const keys = dialog ? DIALOGS[dialog.name] : null;
  const saveBlocked = blocked || !dirty;
  const publishBlocked = blocked || (item?.status === "published" && !dirty && !unpublishedChanges(item));
  const shown = busy ?? (notice ? null : status);
  return (
    <div className={`${s.page} ${s.wide}`}>
      <header className={`${s.topbar} ${s.bar}`}>
        <h1 className={s.topbarText} tabIndex={-1} ref={heading}>
          <T k="content.editor" />
        </h1>
        <button type="button" className={s.secondary} disabled={!!busy} onClick={back}>
          <L k="navigation.back" />
        </button>
      </header>
      <main className={s.main}>
        <Announcers status={busy ?? (!online ? "common.offline" : status)} alert={notice?.key} />
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
            {notice.retry && (
              <button type="button" className={s.secondary} disabled={blocked} aria-describedby={reason} onClick={() => run(notice.retry!)}>
                <L k="common.tryAgain" />
              </button>
            )}
            {notice.logout && <LogOut />}
          </div>
        )}
        {shown && (
          <p className={`${s.notice} ${s.status}`}>
            <T k={shown} />
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
            <button type="button" className={s.secondary} disabled={!online} aria-describedby={reason} onClick={() => (setLoad("loading"), setRead((n) => n + 1))}>
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
            <h2 tabIndex={-1} ref={missing}>
              <T k="content.notFound" />
            </h2>
            <button type="button" className={s.secondary} onClick={() => onBack()}>
              <L k="navigation.back" />
            </button>
          </section>
        )}
        {load === "ready" && gone && (
          <section className={`${s.notice} ${s.stack}`}>
            <h2 tabIndex={-1} ref={missing}>
              <T k="content.notFound" />
            </h2>
          </section>
        )}
        {load === "ready" && conflict && (
          <section className={`${s.notice} ${s.stack}`}>
            <h2 tabIndex={-1} ref={conflictRef}>
              <T k="content.conflict" />
            </h2>
            <p>
              <T k="content.conflictHint" />
            </p>
            <div>
              <h3>
                <T k="content.reread" />
              </h3>
              <p lang={conflict.lang}>{conflict.title}</p>
              <p>{displayDate(conflict.event_date, conflict.date_precision)}</p>
            </div>
            <div className={s.actions}>
              <button
                type="button"
                className={s.secondary}
                onClick={() => {
                  setItem(conflict);
                  setDraft(draftOf(conflict, { kind, lang }));
                  setConflict(null);
                }}
              >
                <L k="content.reload" />
              </button>
              <button
                type="button"
                className={s.secondary}
                onClick={() => {
                  setItem(conflict);
                  // A photo only the saved version has keeps its saved alt text.
                  // Alt text typed for media the saved version no longer has is dropped.
                  setDraft((d) => {
                    const kept = Object.entries(d.alts).filter(([key]) => conflict.media.some((m) => m.id === key));
                    return { ...d, alts: { ...draftOf(conflict, { kind, lang }).alts, ...Object.fromEntries(kept) } };
                  });
                  setConflict(null);
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
                  <T k={item?.status === "published" ? "content.published" : "content.draft"} />
                </span>
              </p>
              {item && unpublishedChanges(item) && (
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
                    {errors.map(([control, key]: [string, ErrorKey]) => (
                      <li key={control}>
                        <a
                          href={`#${control}`}
                          onClick={(event) => {
                            event.preventDefault();
                            document.getElementById(control)?.focus();
                          }}
                        >
                          <T k={labelOf(control)} />: <T k={`content.${key}`} />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <fieldset className={s.fieldset}>
                <legend>
                  <T k="content.kind" />
                </legend>
                <div className={s.radio}>
                  {KINDS[sectionOf(draft.kind)].map((k) =>
                    radio("kind", k, `content.${k}`, draft.kind === k, () => set(k === "anniversary" ? { kind: k, precision: "day" } : { kind: k }), !!busy || !!item),
                  )}
                </div>
                <p className={s.small}>
                  <T k="content.kindHint" />
                </p>
              </fieldset>
              <fieldset className={s.fieldset}>
                <legend>
                  <T k="content.mainLanguage" />
                </legend>
                <div className={s.radio}>
                  {(["vi", "en"] as const).map((l) => radio("mainLanguage", l, `content.${l}`, draft.lang === l, () => setDraft((d) => mainLanguage(d, l))))}
                </div>
              </fieldset>
              {textField("title", "content.title", draft.title, (title) => set({ title }), <T k="content.required" />, false, draft.lang)}
              {textField("text", "content.text", draft.body, (body) => set({ body }), <T k="content.textHint" />, true, draft.lang)}
              <fieldset className={`${s.fieldset} ${s.stack}`}>
                <legend>
                  <T k="content.date" />
                </legend>
                <fieldset className={s.fieldset}>
                  <legend>
                    <T k="content.precision" />
                  </legend>
                  <div className={s.radio}>
                    {(["day", "month", "year"] as const).map((p) =>
                      radio("precision", p, `content.${p}`, precision === p, () => set({ precision: p }), !!busy || draft.kind === "anniversary"),
                    )}
                  </div>
                </fieldset>
                <p id="date-hint" className={s.small}>
                  <T k="content.dateHint" />
                </p>
                <div className={s.dateGrid}>
                  {dateField("year", draft.year)}
                  {precision !== "year" && dateField("month", draft.month)}
                  {precision === "day" && dateField("day", draft.day)}
                </div>
              </fieldset>
              {draft.kind === "anniversary" && (
                <>
                  <label className={s.check} htmlFor="repeat">
                    <input id="repeat" type="checkbox" checked={draft.recurs_yearly} disabled={!!busy} onChange={(e) => set({ recurs_yearly: e.target.checked })} />
                    <span>
                      <T k="content.repeat" />
                    </span>
                  </label>
                  <label className={s.check} htmlFor="remind">
                    <input id="remind" type="checkbox" checked={draft.remind_owner} disabled={!!busy} onChange={(e) => set({ remind_owner: e.target.checked })} />
                    <span>
                      <T k="content.remind" />
                    </span>
                  </label>
                </>
              )}
              {leapDay(draft) && (
                <p className={s.notice}>
                  <T k="content.leap" />
                </p>
              )}
              <div className={`${s.stack} ${s.divider}`}>
                <label className={s.check} htmlFor="second">
                  <input
                    id="second"
                    type="checkbox"
                    checked={draft.second}
                    disabled={!!busy}
                    aria-describedby="second-hint"
                    onChange={(e) => set(e.target.checked ? { second: true, lang_alt: otherLang(draft.lang) } : { second: false })}
                  />
                  <span>
                    <T k="content.second" />
                  </span>
                </label>
                <p id="second-hint" className={s.small}>
                  <T k="content.removeSecondHint" />
                </p>
                {draft.second && (
                  <>
                    <p className={s.small}>
                      <T k="content.secondHint" />
                    </p>
                    <fieldset className={s.fieldset} aria-describedby="language-error">
                      <legend>
                        <T k="content.language" />
                      </legend>
                      <div className={s.radio}>
                        {(["en", "vi"] as const).map((l) =>
                          radio("language", l, `content.${l}`, draft.lang_alt === l, () => set({ lang_alt: l })),
                        )}
                      </div>
                    </fieldset>
                    <p className={s.error} id="language-error">
                      {errorOf(`language-${draft.lang_alt}`) && <T k="content.secondError" />}
                    </p>
                    {textField("secondTitle", "content.secondTitle", draft.title_alt, (title_alt) => set({ title_alt }), <T k="content.required" />, false, draft.lang_alt)}
                    {textField("secondText", "content.secondText", draft.body_alt, (body_alt) => set({ body_alt }), <T k="content.secondHint" />, true, draft.lang_alt)}
                  </>
                )}
              </div>
              <div className={s.actions}>
                <button type="submit" className={s.secondary} disabled={saveBlocked} aria-describedby={reason}>
                  <L k="content.save" />
                </button>
                <button type="button" className={s.primary} disabled={publishBlocked} aria-describedby={reason} onClick={() => void onPublish()}>
                  <L k="content.publish" />
                </button>
              </div>
              {item && (
                <div className={`${s.actions} ${s.divider}`}>
                  {item.status === "published" && (
                    <button type="button" className={s.secondary} disabled={blocked} onClick={() => setDialog({ name: "unpublish" })}>
                      <L k="content.unpublish" />
                    </button>
                  )}
                  <button type="button" className={`${s.secondary} ${s.danger}`} disabled={blocked} onClick={() => setDialog({ name: "delete" })}>
                    <L k="content.delete" />
                  </button>
                </div>
              )}
            </form>
            <section className={`${s.surface} ${s.stack}`} aria-labelledby="media-title">
              <h2 id="media-title">
                <T k="content.media" />
              </h2>
              <p className={s.small}>
                <T k="content.limits" />
              </p>
              {item?.status === "published" && (
                <p className={s.small}>
                  <T k="content.mediaLive" />
                </p>
              )}
              {!item && (
                <p className={s.small}>
                  <T k="content.saveFirst" />
                </p>
              )}
              {item && (
                <button type="button" className={s.secondary} disabled={blocked} onClick={() => (unsaved ? setDialog({ name: "leave", upload: true }) : onUpload(id))}>
                  <L k="upload.title" />
                </button>
              )}
              {item && media.length === 0 && (
                <p>
                  <T k="content.noMedia" />
                </p>
              )}
              {media.map((m, i) => (
                <div key={m.id} className={`${s.stack} ${s.mediaRow}`}>
                  {m.preview_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL; the image optimizer would cache it
                    <img className={s.thumb} src={m.preview_url} alt="" width={m.width ?? undefined} height={m.height ?? undefined} />
                  ) : (
                    <div className={s.thumb} aria-hidden="true" />
                  )}
                  {m.kind === "photo" && (
                    <>
                      <p id={`alt-hint-${m.id}`} className={s.small}>
                        <T k="content.altHint" />
                      </p>
                      {altField(m, "alt", draft.lang)}
                      {draft.second && draft.lang_alt !== draft.lang && altField(m, "alt_alt", draft.lang_alt)}
                    </>
                  )}
                  <button type="button" className={`${s.secondary} ${s.danger}`} disabled={blocked} onClick={() => setDialog({ name: "remove", media: m })}>
                    <L k="content.remove" />
                    <span className={s.announcer}>{` ${i + 1}`}</span>
                  </button>
                </div>
              ))}
            </section>
            <aside className={`${s.surface} ${s.stack} ${s.editorPreview}`} aria-labelledby="preview-title">
              <h2 id="preview-title">
                <T k="content.preview" />
              </h2>
              <p className={s.small}>
                <T k="content.previewHint" />
              </p>
              {date && <p>{displayDate(date, precision)}</p>}
              {draft.title.trim() && <h3 lang={draft.lang}>{draft.title.trim()}</h3>}
              {draft.body && (
                <p className={s.prose} lang={draft.lang}>
                  {draft.body}
                </p>
              )}
              {draft.second && (draft.title_alt.trim() || draft.body_alt) && (
                <div className={`${s.stack} ${s.divider}`} lang={draft.lang_alt}>
                  {draft.title_alt.trim() && <h3>{draft.title_alt.trim()}</h3>}
                  {draft.body_alt && <p className={s.prose}>{draft.body_alt}</p>}
                </div>
              )}
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
              {dialog?.name === "remove" && (
                <p>
                  <T k="content.cleanup" />
                </p>
              )}
              <button type="button" className={dialog?.name === "leave" ? s.primary : s.secondary} onClick={() => setDialog(null)}>
                <L k={keys.keep} />
              </button>
              <button
                type="button"
                className={dialog?.name === "leave" ? s.secondary : `${s.secondary} ${s.danger}`}
                disabled={dialog?.name !== "leave" && blocked}
                onClick={act}
              >
                <L k={keys.act} />
              </button>
            </div>
          )}
        </dialog>
      </main>
    </div>
  );
}
