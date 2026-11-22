"use client";
import { useEffect, useRef, useState } from "react";
import { SECTIONS, type Page } from "@/lib/setup";
import { COPY, type CopyKey } from "./copy";
import { L, T, post, type Vars } from "./parts";
import s from "./owner.module.css";

// O9 Visibility (owner UI "O8 Share and O9 Visibility for T2.6"; PRD Q146 10-44; `.design/share/CHECKS.md`). Two
// independent panels, each with its own draft, Save and status, drawn from the one owner_page() snapshot. One save at a
// time; each carries a request id, so Try again after a lost answer or a sign-in repeats it without applying twice.

type Area = "visibility" | "sections";
type Phase = "ready" | "saving" | "conflict" | "reloading" | "unconfirmed";
type Payload = { request_id: string; visibility?: string; confirm?: true; base_sections?: readonly string[]; sections?: string[] };
type Panel = { phase: Phase; note: CopyKey | null; payload: Payload | null };
type Screen = "loading" | "ready" | "error" | "401" | "403" | "setup";
type State = {
  screen: Screen;
  snap: Page | null;
  vis: string; // the visibility draft
  secs: string[]; // the sections draft (Home and the switchable ones; zodiac waits for T3.9)
  base: readonly string[]; // the saved flags the sections draft was based on (Q146 20)
  panels: Record<Area, Panel>;
  auth: { area: Area; payload: Payload } | null; // the write that met a 401, repeated after signing in
};
type Dialog = { kind: "private" } | { kind: "discard"; then: () => void; opener: string } | null;

const READY: Panel = { phase: "ready", note: null, payload: null };
const URL_OF: Record<Area, string> = { visibility: "/api/owner/visibility", sections: "/api/owner/sections" };
const VIS_KEY: Record<string, CopyKey> = { private: "visibility.private", token_only: "visibility.token", published: "visibility.published" };
const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));
const editable = (page: Page) => page.sections.filter((x) => x !== "zodiac");
const visDirty = (st: State) => !!st.snap && st.vis !== st.snap.visibility;
const secDirty = (st: State) => !!st.snap && !same(st.secs, editable(st.snap));
const active = (st: State) => (Object.keys(st.panels) as Area[]).find((a) => ["saving", "unconfirmed", "reloading"].includes(st.panels[a].phase));
const labels = (sections: readonly string[]) =>
  [0, 1].map((i) => ["home", ...SECTIONS].filter((x) => sections.includes(x)).map((x) => COPY[`sections.${x}` as CopyKey][i]).join(", ")) as [string, string];

// An accepted snapshot updates the saved values and keeps unrelated dirty drafts; the saved panel takes the snapshot
// unless the owner edited it while the request ran (CHECKS defaults 29, 32).
function accept(st: State, page: Page, area: Area | null, payload: Payload | null = null): State {
  const keepVis = area === "visibility" ? !!payload && st.vis !== payload.visibility : visDirty(st) || st.panels.visibility.phase !== "ready";
  const keepSec =
    area === "sections" ? !!payload?.sections && !same(st.secs, payload.sections) : secDirty(st) || st.panels.sections.phase !== "ready";
  const baseKept = keepSec && !(area === "sections" && payload?.sections && same(payload.sections, editable(page)));
  return {
    ...st,
    snap: page,
    screen: page.setup_completed ? "ready" : "setup",
    vis: keepVis ? st.vis : page.visibility,
    secs: keepSec ? st.secs : editable(page),
    base: baseKept ? st.base : page.sections,
  };
}
const withPanel = (st: State, area: Area, panel: Partial<Panel>): State => ({ ...st, panels: { ...st.panels, [area]: { ...READY, ...panel } } });

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
  const [st, setSt] = useState<State>({ screen: "loading", snap: null, vis: "", secs: [], base: [], panels: { visibility: READY, sections: READY }, auth: null });
  const [dialog, setDialog] = useState<Dialog>(null);
  const [said, setSaid] = useState<{ key: CopyKey; n: number } | null>(null);
  const say = (key: CopyKey) => setSaid((old) => ({ key, n: (old?.n ?? 0) + 1 }));
  const heading = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const focusNext = useRef<string[] | null>(null); // the first of these that the next render has
  const reads = useRef(0); // the latest read; a save or a newer read makes older answers stale

  // area: a sections Reload (clears only the section edits); null: a general read.
  const read = (area: Area | null, focus: string[] | null) => {
    const n = ++reads.current;
    void post<{ page: Page | null }>("/api/owner/page", {}).then((r) => {
      if (n !== reads.current) return;
      const page = r.status === 200 ? r.body?.page : null;
      if (page) {
        setSt((old) => (area ? withPanel(accept(old, page, area), area, {}) : accept(old, page, null)));
        focusNext.current = page.setup_completed ? focus : ["visibility-setup"];
        return;
      }
      const screen: Screen = r.status === 401 ? "401" : r.status === 403 ? "403" : "error";
      setSt((old) => ({ ...(area ? withPanel(old, area, { phase: "conflict", note: "visibility.conflict" }) : old), screen, auth: null }));
      focusNext.current = [screen === "401" ? "visibility-signin" : screen === "403" ? "visibility-logout" : "visibility-retry"];
    });
  };
  useEffect(() => {
    heading.current?.focus();
    read(null, returnFocus ? ["visibility-create-first", "visibility-heading"] : null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const ids = focusNext.current;
    if (!ids) return;
    focusNext.current = null;
    ids.map((id) => document.getElementById(id)).find(Boolean)?.focus();
  });
  useEffect(() => {
    const d = dialogRef.current;
    if (dialog && !d?.open) {
      d?.showModal();
      document.getElementById("dialog-cancel")?.focus();
    }
    if (!dialog && d?.open) d.close();
  }, [dialog]);

  const send = async (area: Area, payload: Payload) => {
    reads.current++; // a save makes every outstanding read stale (CHECKS default 29)
    focusNext.current = [`save-${area}`]; // a pressed Try again unmounts: focus goes to the busy Save
    setSt((old) => withPanel({ ...old, screen: "ready", auth: null }, area, { phase: "saving", payload }));
    const r = await post<{ page?: Page; error?: string }>(URL_OF[area], payload);
    const page = r.status === 200 ? r.body?.page : undefined;
    if (page) {
      const done = area === "visibility" ? page.visibility === payload.visibility : same(editable(page), payload.sections ?? []);
      const note: CopyKey = done ? "visibility.saved" : "visibility.saveSuperseded";
      setSt((old) => withPanel(accept(old, page, area, payload), area, { note }));
      return say(note);
    }
    const error = r.body?.error;
    if (r.status === 409 && error === "conflict") {
      setSt((old) => withPanel(old, area, { phase: "conflict", note: "visibility.conflict" }));
      focusNext.current = ["sections-reload"];
      return say("visibility.conflict");
    }
    if (r.status === 409 && (error === "setup_not_finished" || error === "wording_not_published")) {
      setSt((old) => withPanel({ ...old, screen: "setup" }, area, {}));
      focusNext.current = ["visibility-setup"];
      return;
    }
    if (r.status === 401) {
      setSt((old) => withPanel({ ...old, screen: "401", auth: { area, payload } }, area, {}));
      focusNext.current = ["visibility-signin"];
      return;
    }
    if (r.status === 403) {
      // Access is gone: the drafts go with it (CHECKS default 29).
      setSt((old) => ({
        ...old,
        screen: "403",
        vis: old.snap?.visibility ?? "",
        secs: old.snap ? editable(old.snap) : [],
        panels: { visibility: READY, sections: READY },
        auth: null,
      }));
      focusNext.current = ["visibility-logout"];
      return;
    }
    // Only a confirmed refusal says nothing was saved; a lost answer or a 5xx is unconfirmed (Q146 35).
    const refused = r.status >= 400 && r.status < 500;
    const note: CopyKey = refused ? "state.write" : "visibility.unconfirmed";
    setSt((old) => withPanel(old, area, refused ? { note } : { phase: "unconfirmed", note, payload }));
    focusNext.current = [refused ? `save-${area}` : `retry-${area}`];
    say(note);
  };
  const saveVisibility = (confirmed = false) => {
    if (st.vis === "private" && !confirmed) return setDialog({ kind: "private" });
    void send("visibility", { request_id: crypto.randomUUID(), visibility: st.vis, ...(st.vis === "private" ? { confirm: true as const } : {}) });
  };
  const saveSections = () => void send("sections", { request_id: crypto.randomUUID(), base_sections: st.base, sections: st.secs });
  // Back and the Share shortcut ask before unsaved changes or an unsettled save are dropped.
  const guard = (then: () => void, opener: string) =>
    visDirty(st) || secDirty(st) || active(st) ? setDialog({ kind: "discard", then, opener }) : then();
  const closeDialog = (act: boolean) => {
    const was = dialog;
    setDialog(null);
    if (!was) return;
    if (!act) {
      focusNext.current = [was.kind === "private" ? "save-visibility" : was.opener];
      return;
    }
    if (was.kind === "private") return saveVisibility(true);
    was.then();
  };

  const busy = active(st);
  const snap = st.snap;
  const recovery = st.screen === "error" || st.screen === "401" || st.screen === "403" || st.screen === "setup";
  const offlineReason = offline ? "visibility-offline-reason" : undefined;

  const saveArea = (area: Area, dirty: boolean) => {
    const { phase, note, payload } = st.panels[area];
    const waiting = busy && busy !== area ? busy : undefined;
    const blocked = offline || !dirty || !!busy;
    const status = note && note !== "visibility.saved" ? note : dirty ? "visibility.unsaved" : note;
    const savedLine: { k: CopyKey; vars: Vars } =
      area === "sections"
        ? { k: "visibility.savedSections", vars: { sections: labels(snap ? editable(snap) : []) } }
        : { k: "visibility.savedVisibility", vars: { visibility: COPY[VIS_KEY[snap?.visibility ?? ""] ?? "visibility.token"] } };
    const describe = [`${area}-heading`, `${area}-status`, waiting && `${area}-wait`, offlineReason].filter(Boolean).join(" ");
    return (
      <>
        <p id={`${area}-status`} className={note && ["state.write", "visibility.conflict", "visibility.unconfirmed"].includes(note) ? s.error : s.help}>
          {status && <T k={status} />}
          {dirty && status !== "visibility.unsaved" && (
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
            <T k={st.panels[waiting].phase === "reloading" ? "visibility.reloadingSections" : "visibility.waitForSave"} />
          </p>
        )}
        <div className={s.usageActions}>
          {phase === "unconfirmed" && payload && (
            <button
              id={`retry-${area}`}
              type="button"
              className={s.secondary}
              aria-disabled={offline || undefined}
              aria-describedby={[`${area}-status`, offlineReason].filter(Boolean).join(" ")}
              onClick={() => !offline && void send(area, payload)}
            >
              <L k="common.tryAgain" />
            </button>
          )}
          {phase === "conflict" && (
            <button
              id="sections-reload"
              type="button"
              className={s.secondary}
              aria-disabled={offline || !!waiting || undefined}
              aria-describedby={[waiting && `${area}-wait`, offlineReason].filter(Boolean).join(" ") || undefined}
              onClick={() => {
                if (offline || waiting) return;
                setSt((old) => withPanel(old, "sections", { phase: "reloading" }));
                read("sections", ["save-sections"]);
              }}
            >
              <L k="visibility.reloadSections" />
            </button>
          )}
          {phase !== "conflict" && phase !== "unconfirmed" && (
            <button
              id={`save-${area}`}
              type="button"
              className={s.primary}
              aria-disabled={blocked || undefined}
              aria-describedby={describe}
              onClick={() => !blocked && (area === "visibility" ? saveVisibility() : saveSections())}
            >
              <L k={phase === "saving" ? "save.busy" : "visibility.save"} />
            </button>
          )}
        </div>
      </>
    );
  };
  const radio = (value: string, help: CopyKey, disabled = false) => (
    <div>
      <label className={s.check} htmlFor={`vis-${value}`}>
        <input
          id={`vis-${value}`}
          type="radio"
          name="visibility"
          value={value}
          checked={!disabled && st.vis === value}
          disabled={disabled}
          aria-describedby={`vis-${value}-help`}
          onChange={() => setSt((old) => (old.panels.visibility.phase === "ready" ? withPanel({ ...old, vis: value }, "visibility", {}) : { ...old, vis: value }))}
        />
        <L k={VIS_KEY[value]} />
      </label>
      <p id={`vis-${value}-help`} className={s.help}>
        <T k={help} />
      </p>
    </div>
  );
  const reloading = st.panels.sections.phase === "reloading";
  const toggle = (section: string) =>
    setSt((old) => {
      const panel = old.panels.sections;
      const next = {
        ...old,
        base: panel.phase === "ready" && !secDirty(old) && old.snap ? old.snap.sections : old.base,
        secs: old.secs.includes(section) ? old.secs.filter((x) => x !== section) : [...old.secs, section],
      };
      return panel.phase === "ready" ? withPanel(next, "sections", {}) : next;
    });

  return (
    <div className={`${s.page} ${s.wide}`}>
      <header className={s.usageTop}>
        <button id="visibility-back" type="button" className={s.secondary} onClick={() => guard(onBack, "visibility-back")}>
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
                        id={st.auth ? `retry-${st.auth.area}` : "visibility-retry"}
                        type="button"
                        className={s.secondary}
                        aria-disabled={offline || undefined}
                        aria-describedby={["visibility-error", offlineReason].filter(Boolean).join(" ")}
                        onClick={() => {
                          if (offline) return;
                          // After signing in, the write that met the 401 is repeated as it was (CHECKS default 29).
                          if (st.auth) return void send(st.auth.area, st.auth.payload);
                          heading.current?.focus();
                          setSt((old) => ({ ...old, screen: "loading" }));
                          read(null, null);
                        }}
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
                  {radio("token_only", "visibility.explain")}
                  {!snap.link && (
                    <button id="visibility-create-first" type="button" className={s.secondary} onClick={() => guard(onShare, "visibility-create-first")}>
                      <L k="visibility.createFirst" />
                    </button>
                  )}
                  {radio("published", "visibility.publishedHelp", true)}
                </fieldset>
                {saveArea("visibility", visDirty(st))}
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
                  {reloading && (
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
                        checked={st.secs.includes(section)}
                        aria-disabled={reloading || undefined}
                        aria-describedby={reloading ? "sections-help sections-reloading" : "sections-help"}
                        onClick={(e) => reloading && e.preventDefault()}
                        onChange={() => !reloading && toggle(section)}
                      />
                      <L k={`sections.${section}` as CopyKey} />
                    </label>
                  ))}
                </fieldset>
                {saveArea("sections", secDirty(st))}
              </section>
            </>
          )}
        </div>
        <dialog
          id="visibility-dialog"
          ref={dialogRef}
          className={s.dialog}
          aria-labelledby="visibility-dialog-title"
          aria-describedby={dialog?.kind === "private" ? "visibility-dialog-body" : undefined}
          onCancel={(event) => {
            event.preventDefault();
            closeDialog(false);
          }}
        >
          {dialog && (
            <div className={s.stack}>
              <h2 id="visibility-dialog-title">
                <T k={dialog.kind === "private" ? "visibility.privateQuestion" : "visibility.discardQuestion"} />
              </h2>
              {dialog.kind === "private" && (
                <p id="visibility-dialog-body">
                  <T k="visibility.privateBody" />
                </p>
              )}
              <button id="dialog-cancel" type="button" className={s.secondary} onClick={() => closeDialog(false)}>
                <L k={dialog.kind === "private" ? "content.cancel" : "share.stay"} />
              </button>
              <button id="dialog-act" type="button" className={`${s.secondary} ${s.danger}`} onClick={() => closeDialog(true)}>
                <L k={dialog.kind === "private" ? "visibility.makePrivate" : "visibility.discard"} />
              </button>
            </div>
          )}
        </dialog>
      </main>
    </div>
  );
}
