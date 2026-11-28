"use client";
import { Fragment, useEffect, useRef, useState, type ClipboardEvent, type MouseEvent } from "react";
import { SECTIONS } from "@/lib/setup";
import { normalizeVanity } from "@/lib/vanity";
import { COPY, type CopyKey } from "./copy";
import { L, T, post, type Vars } from "./parts";
import {
  activeSave, addressError, conflictReload, dialogParts, dirtySections, dirtyVisibility, editable, initial, transition,
  type Area, type Event, type Payload, type State,
} from "./visibility-state";
import s from "./owner.module.css";

// O9 Visibility (owner UI "O8 Share and O9 Visibility for T2.6" and "O9 Published address and the O2 Visibility row for
// T3.1p"; PRD Q146, Q155-Q157; `.design/published/CHECKS.md`). Two panels drawn from one owner_page() snapshot; the
// rules live in ./visibility-state, this file draws them, runs the reads and saves, and moves focus.

const URL_OF: Record<Area, string> = { visibility: "/api/owner/visibility", sections: "/api/owner/sections" };
const VIS_KEY: Record<string, CopyKey> = { private: "visibility.private", token_only: "visibility.token", published: "visibility.published" };
const RECOVERY: Record<string, string> = { "401": "visibility-signin", "403": "visibility-logout", "read-error": "visibility-retry", setup: "visibility-setup" };
const DIALOG: Record<string, [CopyKey, CopyKey, CopyKey]> = {
  private: ["visibility.privateQuestion", "content.cancel", "visibility.makePrivate"],
  public: ["visibility.publicQuestion", "content.cancel", "visibility.makePublic"],
  rename: ["visibility.renameQuestion", "content.cancel", "visibility.rename"],
  discard: ["visibility.discardQuestion", "share.stay", "visibility.discard"],
};
const site = () => (typeof window === "undefined" ? { origin: "", host: "" } : window.location);
const shown = (name: string) => `${site().host}/p/${name}`;
const savedUrl = (name: string) => `${site().origin}/p/${name}`;
const labels = (sections: readonly string[]) =>
  [0, 1].map((i) => ["home", ...SECTIONS].filter((x) => sections.includes(x)).map((x) => COPY[`sections.${x}` as CopyKey][i]).join(", ")) as [string, string];

// A copy pair whose {address} or {name} is drawn as wrapping address text.
function Filled({ k, value }: { k: CopyKey; value?: string }) {
  const fill = (text: string) =>
    text.split(/\{(?:address|name)\}/).flatMap((part, i) => (i ? [<span key={i} className={s.address}>{value}</span>, part] : [part]));
  const [en, vi] = COPY[k];
  return (
    <>
      <span lang="en">{fill(en)}</span> / {fill(vi)}
    </>
  );
}

export function VisibilityView({
  offline,
  onBack,
  onShare,
  onSetup,
  returnFocus = false,
}: {
  offline: boolean;
  onBack: () => void;
  onShare: () => void;
  onSetup: () => void;
  returnFocus?: boolean;
}) {
  // The drawn state and the render it belongs to; `model` mirrors it for the synchronous rules in dispatch.
  const [{ st, drawn }, show] = useState(() => ({ st: initial(offline), drawn: 0 }));
  const model = useRef(st);
  const version = useRef(0); // bumped by every change; a focus plan waits for the render that draws it
  const [said, setSaid] = useState<{ key: CopyKey; n: number } | null>(null);
  const say = (key: CopyKey) => setSaid((old) => ({ key, n: (old?.n ?? 0) + 1 }));
  const heading = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Focus the first of these ids after the next render. A completion moves focus only while it is still where the owner's
  // press or this screen left it (nothing, a removed control, the pressed control, or what this screen focused last), so
  // focus that the owner moved stays put (the carried review case: Reload, a failed read, Try again, then Save).
  const focusPlan = useRef<{ ids: string[]; movable: boolean; at: number } | null>(null);
  const placed = useRef<Element | null>(null);
  const pressed = useRef<Element | null>(null);
  const opener = useRef("visibility-back");
  const first = useRef(true);

  const plan = (ids: string[], movable = false) => (focusPlan.current = { ids, movable, at: version.current });
  const read = (area: Area | null) => {
    const before = model.current.readId;
    dispatch({ type: "read-request", area });
    const readId = model.current.readId;
    if (readId === before) return;
    void post("/api/owner/page", {}).then((reply) => dispatch({ type: "read-result", area, readId, reply }));
  };
  const save = (area: Area, payload: Payload) => void post(URL_OF[area], payload).then((reply) => dispatch({ type: "result", area, reply }));

  function dispatch(e: Event) {
    const before = model.current;
    const next = transition(before, e);
    if (next === before) return;
    model.current = next.go ? { ...next, go: null } : next;
    show({ st: model.current, drawn: ++version.current });
    if (next.go) return next.go === "back" ? onBack() : onShare();
    react(before, next, e);
  }

  // What a change starts (a read or a save) and where focus and announcements go.
  function react(before: State, next: State, e: Event) {
    const area = "area" in e && e.area ? e.area : next.area;
    const busy = activeSave(next);
    if (next.screen === "loading" && before.screen !== "loading" && !next.offline) read(busy ?? null);
    if (next.screen === "ready" && !next.offline) {
      const phase = busy && next.panels[busy].phase;
      if (busy && (phase !== before.panels[busy].phase || before.offline || before.screen !== "ready")) {
        if (phase === "saving") save(busy, next.panels[busy].payload!);
        else if (phase === "reloading") read(busy);
      } else if (!busy && next.refreshPending) read(null);
    }

    const fieldError = next.screen === "ready" && !next.dialog && !!next.addressError
      && (e.type === "save-visibility" || (e.type === "result" && e.area === "visibility" && next.panels.visibility.phase === "ready" && !next.panels.visibility.note));
    const completed = !!area && next.screen === "ready"
      && ((e.type === "result" && before.panels[area].phase === "saving") || (e.type === "read-result" && before.panels[area].phase === "reloading"));
    const other: Area = area === "sections" ? "visibility" : "sections";
    const otherConflict = (e.type === "result" || e.type === "read-result") && before.panels[other].phase !== "conflict" && next.panels[other].phase === "conflict";
    if (fieldError) {
      plan(["page-address"], e.type === "result");
      say("visibility.addressSummary");
    } else if (next.screen !== before.screen && RECOVERY[next.screen]) {
      plan([RECOVERY[next.screen]], true);
    } else if (next.screen === "loading" && before.screen !== "loading") {
      plan(["visibility-title"]);
    } else if (completed && area) {
      const phase = next.panels[area].phase;
      if (phase !== "reloading") plan([phase === "conflict" ? `${area}-reload` : phase === "unconfirmed" ? `retry-${area}` : `save-${area}`], true);
      const note = next.panels[area].note;
      if (note) say(note);
      if (otherConflict && note !== "visibility.conflict") say("visibility.conflict");
    } else if (e.type === "read-result" && otherConflict) {
      plan(["visibility-reload"], true);
      say("visibility.conflict");
    } else if (e.type === "read-result" && before.screen === "loading" && next.screen === "ready" && first.current) {
      first.current = false;
      if (returnFocus) plan(["visibility-create-first", "visibility-heading"], true);
    } else if ((e.type === "reload" || e.type === "retry-read") && area && next.panels[area].phase === "reloading") {
      plan([`save-${area}`], true);
    } else if (e.type === "retry-write" || e.type === "confirm") {
      plan([`save-${area}`]);
    } else if (e.type === "dismiss") {
      plan([before.dialog === "discard" ? opener.current : "save-visibility"]);
    } else if (e.type === "signed-in" && busy) {
      plan([`retry-${busy}`]);
    } else if (e.type === "copied" || e.type === "copy-refused") {
      if (next.copyNote) say(next.copyNote);
      if (e.type === "copy-refused") requestAnimationFrame(selectAddress);
    } else if (e.type === "connection" && area && before.panels[area].phase === "saving" && next.panels[area].phase === "unconfirmed") {
      say("visibility.unconfirmed");
    }
  }

  useEffect(() => {
    heading.current?.focus();
    placed.current = heading.current;
    read(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (offline !== model.current.offline) dispatch({ type: "connection", offline });
  }, [offline]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const d = dialogRef.current;
    const now = document.activeElement; // before close() restores the opener, so a removed dialog button reads as body
    if (!st.dialog && d?.open) d.close(); // an open modal makes the page inert: close it before focusing behind it
    if (st.dialog && !d?.open) {
      d?.showModal();
      document.getElementById("dialog-cancel")?.focus();
    }
    const p = focusPlan.current;
    if (!p || drawn < p.at) return; // an earlier render's late effect: wait for the one that draws the plan
    focusPlan.current = null;
    if (p.movable && now && now !== document.body && now.isConnected && now !== placed.current && now !== pressed.current) return;
    const el = p.ids.map((id) => document.getElementById(id)).find(Boolean);
    if (!el) return;
    el.focus();
    placed.current = el;
  });
  const press = (event: MouseEvent, e: Event) => {
    pressed.current = event.currentTarget;
    placed.current = null;
    dispatch(e);
  };
  const leave = (type: "back" | "create-link", id: string) => {
    opener.current = id;
    dispatch({ type });
  };
  function selectAddress() {
    const el = document.getElementById("saved-address");
    if (!el) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);
    el.focus();
  }
  const copy = async (name: string) => {
    try {
      await navigator.clipboard.writeText(savedUrl(name));
      dispatch({ type: "copied" });
    } catch {
      dispatch({ type: "copy-refused" });
    }
  };
  // A pasted line break shows the format error at once, each break drawn as a space (CHECKS name rules).
  const paste = (event: ClipboardEvent<HTMLInputElement>) => {
    const field = event.currentTarget;
    const text = event.clipboardData.getData("text/plain");
    const draft = field.value.slice(0, field.selectionStart ?? 0) + text + field.value.slice(field.selectionEnd ?? 0);
    if (!/[\r\n]/.test(text) || !/[\r\n]/.test(normalizeVanity(draft))) return;
    event.preventDefault();
    field.setRangeText(text.replace(/\r\n|[\r\n]/g, " "), field.selectionStart ?? 0, field.selectionEnd ?? 0, "end");
    dispatch({ type: "address", value: field.value, paste: true });
  };

  const busy = activeSave(st);
  const snap = st.snap;
  const offlineReason = offline ? "visibility-offline-reason" : undefined;
  const lockVisibility = conflictReload(st);
  const recovery = ["read-error", "401", "403", "setup"].includes(st.screen);
  const signInRetry = st.screen === "401" && !!busy && st.authArea === busy && st.panels[busy].phase === "unconfirmed";

  const saveArea = (area: Area, dirty: boolean) => {
    const { phase, note } = st.panels[area];
    const feedback = area === "visibility" && st.draftVis === "published" && st.addressError && !note ? "visibility.addressSummary" : note;
    const conflict = phase === "conflict";
    const waiting = busy && busy !== area ? busy : undefined;
    const status = feedback ?? (dirty ? "visibility.unsaved" : null);
    const blocked = offline || !dirty || conflict || !!busy;
    const savedLine: { k: CopyKey; vars: Vars } =
      area === "sections"
        ? { k: "visibility.savedSections", vars: { sections: labels(snap ? editable(snap.sections) : []) } }
        : { k: "visibility.savedVisibility", vars: { visibility: COPY[VIS_KEY[snap?.visibility ?? ""] ?? "visibility.token"] } };
    const describe = [`${area}-heading`, `${area}-status`, waiting && `${area}-wait`, offlineReason].filter(Boolean).join(" ");
    const isError = conflict || (!!feedback && ["state.write", "visibility.addressSummary", "visibility.unconfirmed", "visibility.saveNotConfirmed"].includes(feedback));
    return (
      <>
        <p id={`${area}-status`} className={isError ? s.error : s.help}>
          {status && (phase === "unconfirmed" ? <span id={`${area}-unconfirmed`}><T k={status} /></span> : <T k={status} />)}
          {conflict && note && note !== status && (
            <>
              <br />
              <T k={note} />
            </>
          )}
          {conflict && note !== "visibility.conflict" && (
            <>
              <br />
              <T k="visibility.conflict" />
            </>
          )}
          {dirty && status !== "visibility.unsaved" && phase !== "unconfirmed" && (
            <>
              <br />
              <T k="visibility.unsaved" />
            </>
          )}
          {dirty && (
            <>
              <br />
              <T k={savedLine.k} vars={savedLine.vars} />
            </>
          )}
        </p>
        {waiting && (
          <p id={`${area}-wait`} className={s.help}>
            <T k={waiting === "sections" && st.panels.sections.phase === "reloading" && !st.panels.sections.payload ? "visibility.reloadingSections" : "visibility.waitForSave"} />
          </p>
        )}
        <div className={s.usageActions}>
          {phase === "unconfirmed" && (
            <button
              id={`retry-${area}`}
              type="button"
              className={s.secondary}
              aria-disabled={offline || undefined}
              aria-describedby={[`${area}-unconfirmed`, offlineReason].filter(Boolean).join(" ")}
              onClick={(event) => !offline && press(event, { type: "retry-write" })}
            >
              <L k="common.tryAgain" />
            </button>
          )}
          {phase === "unconfirmed" && st.authArea === area && (
            <button
              id={`check-${area}`}
              type="button"
              className={s.secondary}
              aria-disabled={offline || undefined}
              aria-describedby={offlineReason}
              onClick={(event) => !offline && press(event, { type: "retry-read" })}
            >
              <L k="visibility.readLatest" />
            </button>
          )}
          {conflict && (
            <button
              id={`${area}-reload`}
              type="button"
              className={s.secondary}
              aria-disabled={offline || !!waiting || undefined}
              aria-describedby={[waiting && `${area}-wait`, offlineReason].filter(Boolean).join(" ") || undefined}
              onClick={(event) => !offline && !waiting && press(event, { type: "reload", area })}
            >
              <L k={area === "sections" ? "visibility.reloadSections" : "visibility.reload"} />
            </button>
          )}
          {(!conflict || waiting) && phase !== "unconfirmed" && (
            <button
              id={`save-${area}`}
              type="button"
              className={s.primary}
              aria-disabled={blocked || undefined}
              aria-describedby={describe}
              onClick={(event) => !blocked && press(event, { type: area === "visibility" ? "save-visibility" : "save-sections", id: crypto.randomUUID() })}
            >
              <L k={phase === "saving" || phase === "reloading" ? "save.busy" : "visibility.save"} />
            </button>
          )}
        </div>
      </>
    );
  };
  const radio = (value: string, help: CopyKey) => (
    <div>
      <label className={s.check} htmlFor={`vis-${value}`}>
        <input
          id={`vis-${value}`}
          type="radio"
          name="visibility"
          value={value}
          checked={st.draftVis === value}
          disabled={lockVisibility}
          aria-describedby={lockVisibility ? `vis-${value}-help visibility-reloading` : `vis-${value}-help`}
          onChange={() => dispatch({ type: "visibility", value })}
        />
        <L k={VIS_KEY[value]} />
      </label>
      <p id={`vis-${value}-help`} className={s.help}>
        <T k={help} />
      </p>
    </div>
  );

  const addressPanel = () => {
    if (!snap) return null;
    const name = snap.vanity_name ?? null;
    const live = snap.visibility === "published" ? name : null;
    const draftName = normalizeVanity(st.draftName);
    const echo = !st.addressError && !addressError(st.draftName) && draftName !== live;
    return (
      <>
        {live && st.draftVis !== "published" && (
          <p className={s.band}>
            <Filled k="visibility.unpublish" value={shown(live)} /> <T k="visibility.searchResults" />
          </p>
        )}
        {st.draftVis === "published" && (
          <div className={s.field}>
            <label htmlFor="page-address">
              <L k="visibility.address" />
            </label>
            <code id="address-prefix" className={s.address}>{`${site().host}/p/`}</code>
            <input
              id="page-address"
              className={s.input}
              type="text"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              value={st.draftName}
              disabled={lockVisibility}
              aria-invalid={st.addressError ? true : undefined}
              aria-describedby={["address-prefix", "address-hint", lockVisibility && "visibility-reloading", st.addressError && "address-error"].filter(Boolean).join(" ")}
              onChange={(event) => dispatch({ type: "address", value: event.currentTarget.value })}
              onPaste={paste}
            />
            <p id="address-hint" className={s.help}>
              <T k="visibility.addressHint" />
            </p>
            {st.addressError && (
              <p id="address-error" className={s.error}>
                <T k={st.addressError} />
              </p>
            )}
            {echo && (
              <>
                <p>
                  <T k="visibility.newAddress" />
                </p>
                <code id="address-echo" className={s.address}>
                  {shown(draftName)}
                </code>
              </>
            )}
          </div>
        )}
        {live ? (
          <div className={s.field}>
            <p id="saved-address-label">
              <T k="visibility.savedAddress" />
            </p>
            <p id="saved-address" className={s.linkBox} tabIndex={0} aria-describedby="saved-address-label">
              {savedUrl(live)}
            </p>
            <div className={s.usageActions}>
              <a id="open-page" className={s.secondary} href={savedUrl(live)} target="_blank" rel="noopener">
                <L k="visibility.openPage" />{" "}
                <span className={s.announcer}>
                  <T k="visibility.openPageNewTab" />
                </span>
              </a>
              <button id="copy-address" type="button" className={s.secondary} onClick={() => void copy(live)}>
                <L k="visibility.copyAddress" />
              </button>
              {st.copyNote === "share.select" && (
                <button id="select-address" type="button" className={s.secondary} onClick={selectAddress}>
                  <L k="share.selectAction" />
                </button>
              )}
            </div>
            {st.copyNote && (
              <p className={s.help}>
                <T k={st.copyNote} />
              </p>
            )}
          </div>
        ) : (
          name && st.draftVis !== "published" && (
            <p id="address-kept">
              <Filled k="visibility.addressKept" value={name} />
            </p>
          )
        )}
        {lockVisibility && (
          <p id="visibility-reloading" className={s.help}>
            <T k="visibility.reloadingVisibility" />
          </p>
        )}
      </>
    );
  };

  const reloadingSections = st.panels.sections.phase === "reloading";
  const parts = dialogParts(st);

  return (
    <div className={`${s.page} ${s.wide}`}>
      <header className={s.usageTop}>
        <button id="visibility-back" type="button" className={s.secondary} onClick={() => leave("back", "visibility-back")}>
          <L k="navigation.back" />
        </button>
      </header>
      <main aria-labelledby="visibility-title">
        <div className={s.usageHeading}>
          <h1 id="visibility-title" tabIndex={-1} ref={heading}>
            <T k="visibility.title" />
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
          <p id="visibility-offline-reason" className={s.notice}>
            <T k="visibility.offline" />
          </p>
        )}
        <div className={s.usageBody}>
          {st.screen === "loading" && (
            <section className={`${s.panel} ${s.wideRow}`} aria-busy="true">
              <p>
                <T k="common.loading" />
              </p>
            </section>
          )}
          {recovery && (
            <section className={`${s.panel} ${s.wideRow}`}>
              {st.screen === "setup" ? (
                <>
                  <p id="visibility-setup-message">
                    <T k="visibility.setup" />
                  </p>
                  <button id="visibility-setup" type="button" className={s.secondary} onClick={onSetup}>
                    <L k="visibility.setupLink" />
                  </button>
                </>
              ) : (
                <>
                  <p id="visibility-error" className={s.error}>
                    <T k={st.screen === "401" ? "usage.session" : st.screen === "403" ? "common.accessLost" : "common.readError"} />
                  </p>
                  <div className={s.usageActions}>
                    {st.screen === "401" && (
                      <a id="visibility-signin" className={s.secondary} href="/login?next=%2Fapp" target="_blank" rel="noopener">
                        <L k="content.signin" />
                      </a>
                    )}
                    {st.screen === "403" ? (
                      <form method="post" action="/api/owner/logout">
                        <button id="visibility-logout" type="submit" className={s.secondary} aria-describedby="visibility-error">
                          <L k="dashboard.logout" />
                        </button>
                      </form>
                    ) : (
                      <button
                        id="visibility-retry"
                        type="button"
                        className={s.secondary}
                        aria-disabled={offline || undefined}
                        aria-describedby={["visibility-error", offlineReason].filter(Boolean).join(" ")}
                        // After signing in, an Unconfirmed retry goes back to its Try again; anything else revalidates.
                        onClick={(event) => !offline && press(event, { type: signInRetry ? "signed-in" : "retry-read" })}
                      >
                        <L k="common.tryAgain" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </section>
          )}
          {st.screen === "ready" && snap && (
            <>
              <section className={s.panel}>
                <fieldset className={`${s.fieldset} ${s.stack}`}>
                  <legend id="visibility-heading" tabIndex={-1}>
                    <T k="visibility.who" />
                  </legend>
                  {radio("private", "visibility.privateHelp")}
                  {radio("token_only", snap.link ? "visibility.explain" : "visibility.noGuestLink")}
                  {!snap.link && st.draftVis === "token_only" && (
                    <button id="visibility-create-first" type="button" className={s.secondary} onClick={() => leave("create-link", "visibility-create-first")}>
                      <L k="visibility.createFirst" />
                    </button>
                  )}
                  {radio("published", "visibility.publicHelp")}
                </fieldset>
                {addressPanel()}
                {saveArea("visibility", dirtyVisibility(st))}
              </section>
              <section className={s.panel}>
                <fieldset className={`${s.fieldset} ${s.stack}`} aria-describedby="sections-help">
                  <legend id="sections-heading">
                    <T k="visibility.sections" />
                  </legend>
                  <div id="sections-help" className={s.help}>
                    <p>
                      <T k="visibility.publishedItems" />
                    </p>
                    <p>
                      <T k="visibility.sectionHelp" />
                    </p>
                  </div>
                  {reloadingSections && (
                    <p id="sections-reloading" className={s.help}>
                      <T k="visibility.reloadingSections" />
                    </p>
                  )}
                  <div>
                    <label className={s.check} htmlFor="section-home">
                      <input id="section-home" type="checkbox" checked disabled aria-describedby="section-home-help" />
                      <L k="sections.home" />
                    </label>
                    <p id="section-home-help" className={s.help}>
                      <T k="visibility.homeHelp" />
                    </p>
                  </div>
                  {SECTIONS.map((section) => (
                    <label key={section} className={s.check} htmlFor={`section-${section}`}>
                      <input
                        id={`section-${section}`}
                        type="checkbox"
                        checked={st.draftSections.includes(section)}
                        aria-disabled={reloadingSections || undefined}
                        aria-describedby={reloadingSections ? "sections-help sections-reloading" : "sections-help"}
                        onClick={(event) => reloadingSections && event.preventDefault()}
                        onChange={() => dispatch({ type: "section", value: section })}
                      />
                      <L k={`sections.${section}` as CopyKey} />
                    </label>
                  ))}
                </fieldset>
                {saveArea("sections", dirtySections(st))}
              </section>
            </>
          )}
        </div>
        <dialog
          id="visibility-dialog"
          ref={dialogRef}
          className={s.dialog}
          aria-labelledby="visibility-dialog-title"
          aria-describedby={parts.length ? "visibility-dialog-body" : undefined}
          onCancel={(event) => {
            event.preventDefault();
            dispatch({ type: "dismiss" });
          }}
        >
          {st.dialog && (
            <div className={s.stack}>
              <h2 id="visibility-dialog-title">
                <T k={DIALOG[st.dialog][0]} />
              </h2>
              {parts.length > 0 && (
                <p id="visibility-dialog-body">
                  {parts.map((part, i) =>
                    part.key === "visibility.currentAddress" ? (
                      <Fragment key={i}>
                        <T k={part.key} /> ·{" "}
                      </Fragment>
                    ) : part.key === "visibility.newAddress" ? (
                      <Fragment key={i}>
                        <br />
                        <T k={part.key} /> · <span className={s.address}>{shown(part.address!)}</span>
                        <br />
                      </Fragment>
                    ) : (
                      <Fragment key={i}>
                        <Filled k={part.key} value={part.address === undefined ? undefined : shown(part.address)} />{" "}
                      </Fragment>
                    ),
                  )}
                </p>
              )}
              <button id="dialog-cancel" type="button" className={s.secondary} onClick={() => dispatch({ type: "dismiss" })}>
                <L k={DIALOG[st.dialog][1]} />
              </button>
              <button
                id="dialog-act"
                type="button"
                className={st.dialog === "public" || st.dialog === "rename" ? s.secondary : `${s.secondary} ${s.danger}`}
                aria-disabled={(offline && st.dialog !== "discard") || undefined}
                aria-describedby={offline && st.dialog !== "discard" ? offlineReason : undefined}
                onClick={() => dispatch(st.dialog === "discard" ? { type: "discard" } : { type: "confirm", id: crypto.randomUUID() })}
              >
                <L k={DIALOG[st.dialog][2]} />
              </button>
            </div>
          )}
        </dialog>
      </main>
    </div>
  );
}
