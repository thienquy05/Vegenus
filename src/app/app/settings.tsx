"use client";
import { useEffect, useRef, useState } from "react";
import { checkName, THEMES, type Page } from "@/lib/setup";
import { offeredZones, zoneKnown } from "@/lib/zone";
import { COPY, type CopyKey } from "./copy";
import { L, LANG_NAMES, T, post } from "./parts";
import s from "./owner.module.css";
// The swatches wear each theme's own tokens (owner UI O19 panel 3).
import "../../../themes/a_dreamy/tokens.css";
import "../../../themes/b_cosmic/tokens.css";
import "../../../themes/c_cozy/tokens.css";
import "../../../themes/d_elegant/tokens.css";

// O19 Page settings (owner UI "O19 Page settings"; PRD Q115; `.design/settings/CHECKS.md` "Build contract" and focus
// table): three panels, each saved on its own and live once its save succeeds. A panel's draft holds only the touched
// fields, each with the saved value it was edited against; Save sends those (T2.8a `/api/owner/settings`). O9's rules
// otherwise: one save at a time, a read counter that makes older replies stale, Try again repeating the same request,
// Reload clearing only its panel, the leave dialog.
type PanelId = "names" | "timezone" | "theme";
type Field = "label_a" | "label_b" | "default_lang" | "timezone" | "theme";
type Value = string | null;
type Values = Partial<Record<Field, Value>>;
type Edit = { value: Value; base: Value };
type Req = { panel: PanelId; request_id: string; base: Values; fields: Values };
// readFailed: a Reload that failed; its Try again reads again (resume: it was released offline and reads on reconnect).
type Phase = "ready" | "saving" | "conflict" | "reloading" | "unconfirmed" | "readFailed";
// known: the Conflict came from a snapshot, so choosing the saved values clears it; a 409's Conflict waits for a read.
// errors: each with the normalized value it refused, shown while the field still holds that value.
type Panel = { phase: Phase; note: CopyKey | null; req: Req | null; errors: Partial<Record<Field, { key: CopyKey; value: Value }>>; known?: boolean; resume?: boolean };
type Screen = "loading" | "ready" | "error" | "401" | "403" | "setup";
type State = {
  screen: Screen; snap: Page | null; edits: Partial<Record<Field, Edit>>; panels: Record<PanelId, Panel>;
  auth: Req | null; authRead: PanelId | null; // the save or the panel read that met a 401, repeated after signing in
};

const FIELDS: Record<PanelId, Field[]> = { names: ["label_a", "label_b", "default_lang"], timezone: ["timezone"], theme: ["theme"] };
const PANELS = Object.keys(FIELDS) as PanelId[];
const ALL = PANELS.flatMap((p) => FIELDS[p]);
const TITLE: Record<PanelId, CopyKey> = { names: "step.names", timezone: "step.zone", theme: "settings.theme" };
const panelOf = (f: Field) => PANELS.find((p) => FIELDS[p].includes(f))!;
const READY: Panel = { phase: "ready", note: null, req: null, errors: {} };
const BUSY: Phase[] = ["saving", "unconfirmed", "reloading"];
const NAME_ERRORS = ["required", "length", "characters"];
const fieldId = (f: Field, v: Value) => (f === "theme" ? `settings-theme-${v ?? "none"}` : f === "default_lang" ? `settings-lang-${v}` : `settings-${f}`);
const isolate = (text: string | null) => String.fromCharCode(0x2068) + (text ?? "") + String.fromCharCode(0x2069); // FSI ... PDI

const saved = (page: Page, f: Field): Value => page[f] as Value;
const norm = (f: Field, v: Value) => (v !== null && (f === "label_a" || f === "label_b") ? checkName(v).value : v);
// A 200 must carry a complete finished page, or the save stays unconfirmed (CHECKS "Build contract").
const isPage = (x: unknown): x is Page => {
  const p = x as Page | null;
  const r = x as Record<string, unknown> | null;
  return !!p && !!r && p.setup_completed === true && typeof p.version === "number" && typeof p.label_a === "string"
    && typeof p.label_b === "string" && (p.default_lang === "en" || p.default_lang === "vi") && typeof p.timezone === "string"
    && (p.theme === null || THEMES.includes(p.theme as (typeof THEMES)[number])) && typeof p.visibility === "string"
    && Array.isArray(p.sections) && "link" in r && typeof r.storage_used_bytes === "number" && typeof r.storage_budget_bytes === "number";
};
const withPanel = (st: State, p: PanelId, panel: Partial<Panel>): State => ({ ...st, panels: { ...st.panels, [p]: { ...READY, ...panel } } });
const ready = (st: State): State => ({ ...st, screen: "ready", auth: null });
const dirty = (st: State, p: PanelId) => FIELDS[p].some((f) => st.edits[f]);
const active = (st: State) => PANELS.find((p) => BUSY.includes(st.panels[p].phase));
const shown = (st: State, f: Field): Value => (st.edits[f] ? st.edits[f]!.value : st.snap ? saved(st.snap, f) : null);
const themeName = (theme: Value): CopyKey => (theme ? (`theme.${theme}` as CopyKey) : "settings.none");
const newConflicts = (before: State, after: State) =>
  PANELS.filter((p) => after.panels[p].phase === "conflict" && before.panels[p].phase !== "conflict").map((p): CopyKey[] => [TITLE[p], "visibility.conflict"]);
// Focus may move to a panel's result only while the owner is in that panel or nowhere (the focus table).
const inPanel = (p: PanelId) => {
  const a = document.activeElement;
  return !a || a === document.body || !!a.closest(`#${p}-panel`);
};

// An accepted snapshot: submitted fields left unchanged are done (Saved or Superseded), a field now equal to its saved
// value is clean, an edit made after submission keeps its base unless this save set that field; Conflict is recomputed
// for every idle panel against the new saved values (CHECKS "Build contract").
function accept(st: State, page: Page, req: Req | null = null): State {
  const edits: State["edits"] = {};
  for (const f of ALL) {
    const e = st.edits[f];
    if (!e) continue;
    const sent = !!req && f in req.fields;
    if (sent && norm(f, e.value) === req!.fields[f]) continue;
    if (e.value === saved(page, f)) continue;
    edits[f] = { value: e.value, base: sent && saved(page, f) === req!.fields[f] ? saved(page, f) : e.base };
  }
  const panels = { ...st.panels };
  for (const p of PANELS) {
    if (panels[p].phase !== "ready" && panels[p].phase !== "conflict") continue;
    if (FIELDS[p].some((f) => edits[f] && edits[f]!.base !== saved(page, f))) panels[p] = { ...READY, phase: "conflict", note: "visibility.conflict", known: true };
    else if (panels[p].phase === "conflict") panels[p] = READY;
  }
  return { ...st, snap: page, screen: "ready", edits, panels };
}

export function SettingsView({ offline, onBack, onSetup }: { offline: boolean; onBack: (snap: Page | null) => void; onSetup: () => void }) {
  const [st, setSt] = useState<State>({ screen: "loading", snap: null, edits: {}, panels: { names: READY, timezone: READY, theme: READY }, auth: null, authRead: null });
  const [dialog, setDialog] = useState<{ opener: string } | null>(null);
  const [dialogNote, setDialogNote] = useState<CopyKey[] | null>(null);
  const [said, setSaid] = useState<{ groups: CopyKey[][]; n: number } | null>(null);
  const say = (...groups: CopyKey[][]) => setSaid((old) => ({ groups, n: (old?.n ?? 0) + 1 }));
  const [zones] = useState(offeredZones);
  const heading = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const focusNext = useRef<string[] | null>(null);
  // The last rendered state, for replies that announce what they changed (an updater cannot set other state).
  const latest = useRef(st);
  const reads = useRef(0);
  const accepted = useRef(false); // a null page after an accepted one is access lost (CHECKS "Build contract")

  // panel: that panel's Reload; null: a general read.
  const read = (panel: PanelId | null) => {
    const n = ++reads.current;
    void post<{ page: Page | null }>("/api/owner/page", {}).then((r) => {
      if (n !== reads.current) return;
      const page = r.status === 200 ? r.body?.page : undefined;
      const onRecovery = !!document.activeElement?.hasAttribute("data-recovery");
      if (page?.setup_completed) {
        accepted.current = true;
        if (!panel) return setSt((old) => accept({ ...old, authRead: null }, page));
        // An ordinary conflict's edits go; an edit restored to the last accepted value stays as a draft against the new
        // saved value (a 409 kept it), and accept() drops it if it matches.
        const old = latest.current;
        const edits = { ...old.edits };
        for (const f of FIELDS[panel]) {
          const e = edits[f];
          if (e && old.snap && norm(f, e.value) === saved(old.snap, f)) edits[f] = { value: e.value, base: saved(page, f) };
          else delete edits[f];
        }
        const next = accept(withPanel({ ...old, edits, authRead: null }, panel, {}), page);
        setSt(next);
        latest.current = next;
        say(["settings.reloaded"], ...newConflicts(old, next));
        if (inPanel(panel) || onRecovery) focusNext.current = [next.panels[panel].phase === "conflict" ? `reload-${panel}` : fieldId(FIELDS[panel][0], shown(next, FIELDS[panel][0]))];
        return;
      }
      const lost = r.status === 403 || (r.status === 200 && page === null && accepted.current);
      const screen: Screen = r.status === 401 ? "401" : lost ? "403" : r.status === 200 && page !== undefined ? "setup" : "error";
      if (panel && screen === "error") {
        // A failed Reload keeps the panel and every draft; its Try again reads again.
        const onRetry = document.activeElement?.id === `reload-${panel}`;
        setSt((old) => withPanel({ ...old, screen: "ready", authRead: null }, panel, { phase: "readFailed", note: "common.readError" }));
        if (!onRetry && (inPanel(panel) || onRecovery)) focusNext.current = [`reload-${panel}`];
        else say([TITLE[panel], "common.readError"]);
        return;
      }
      setSt((old) => ({
        ...(panel ? withPanel(old, panel, { phase: "readFailed", note: "common.readError" }) : old),
        screen,
        auth: null,
        authRead: screen === "401" ? panel : null,
        ...(lost && { edits: {}, snap: null }),
      }));
      if (screen === "401" && onRecovery) say(["settings.signInFirst"]);
      else focusNext.current = [screen === "401" ? "settings-signin" : screen === "403" ? "settings-logout" : screen === "setup" ? "settings-setup" : "settings-retry"];
    });
  };
  useEffect(() => {
    heading.current?.focus();
    read(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    latest.current = st;
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
  // Losing the connection releases a running Reload (its reply is made stale); reconnecting reads that panel again.
  useEffect(() => {
    const find = (test: (panel: Panel) => boolean) => PANELS.find((q) => test(latest.current.panels[q]));
    const drop = () => {
      const p = find((panel) => panel.phase === "reloading");
      if (!p) return;
      reads.current++;
      setSt((old) => withPanel(old, p, { phase: "readFailed", note: "common.readError", resume: true }));
    };
    const resume = () => {
      const p = find((panel) => panel.phase === "readFailed" && !!panel.resume);
      if (!p) return;
      setSt((old) => withPanel(old, p, { phase: "reloading" }));
      read(p);
    };
    addEventListener("offline", drop);
    addEventListener("online", resume);
    return () => {
      removeEventListener("offline", drop);
      removeEventListener("online", resume);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Browser Back, reload and closing ask while a draft or a sent save is pending (the Item and Home pattern).
  const pending = PANELS.some((p) => dirty(st, p)) || !!active(st);
  useEffect(() => {
    if (!pending) return;
    const stop = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener("beforeunload", stop);
    return () => removeEventListener("beforeunload", stop);
  }, [pending]);

  const send = async (req: Req) => {
    const p = req.panel;
    const repeat = st.auth === req; // Try again from the sign-in screen: it stays until the answer
    reads.current++; // a save makes every outstanding read stale
    if (!repeat) focusNext.current = [`save-${p}`];
    setSt((old) => withPanel(repeat ? old : ready(old), p, { phase: "saving", req }));
    const r = await post<{ page?: unknown; error?: string; fields?: Record<string, string> }>("/api/owner/settings", req);
    const page = r.status === 200 ? r.body?.page : undefined;
    // A repeat from the sign-in screen counts as in the panel: that screen and its Try again go away with the answer.
    const here = inPanel(p) || (repeat && !!document.activeElement?.hasAttribute("data-recovery"));
    if (isPage(page)) {
      const done = (Object.keys(req.fields) as Field[]).every((f) => saved(page, f) === req.fields[f]);
      const note: CopyKey = done ? "visibility.saved" : "visibility.saveSuperseded";
      const old = latest.current;
      const next = accept(withPanel(ready(old), p, { note }), page, req);
      setSt(next);
      latest.current = next; // a reply landing before the render builds on this one
      say([TITLE[p], note], ...newConflicts(old, next));
      setDialogNote([done ? "settings.leaveSaved" : note, ...(dirty(next, p) ? (["settings.leaveNewer"] as CopyKey[]) : [])]);
      if (here && next.panels[p].phase === "conflict") focusNext.current = [`reload-${p}`];
      else if (here && repeat) focusNext.current = [`save-${p}`];
      return;
    }
    const error = r.body?.error;
    // Each result moves focus only while the owner is in its panel; otherwise the live region says it, once.
    const result = (id: string, key: CopyKey) => (here ? (focusNext.current = [id]) : say([TITLE[p], key]));
    if (r.status === 409 && error === "conflict") {
      setSt((old) => withPanel(ready(old), p, { phase: "conflict", note: "visibility.conflict" }));
      setDialogNote(["settings.leaveFailed"]);
      return result(`reload-${p}`, "visibility.conflict");
    }
    // A 401, 403 or setup answer closes an open leave dialog: the owner chooses again after recovery.
    if (r.status === 409 && error === "setup_not_finished") {
      setDialog(null);
      setSt((old) => withPanel({ ...ready(old), screen: "setup" }, p, {}));
      focusNext.current = ["settings-setup"];
      return;
    }
    if (r.status === 401) {
      setDialog(null);
      setSt((old) => withPanel({ ...old, screen: "401", auth: req }, p, {}));
      if (repeat) say(["settings.signInFirst"]);
      focusNext.current = [repeat ? `retry-${p}` : "settings-signin"];
      return;
    }
    if (r.status === 403) {
      setDialog(null);
      setSt((old) => ({ ...old, screen: "403", snap: null, edits: {}, panels: { names: READY, timezone: READY, theme: READY }, auth: null, authRead: null }));
      focusNext.current = ["settings-logout"];
      return;
    }
    // A refusal counts only when it matches this panel and its fields; anything else may have committed (unconfirmed).
    const errors = refusal(req, r.status, error, r.body?.fields);
    if (errors) {
      setSt((old) => withPanel(ready(old), p, { errors }));
      setDialogNote(["settings.leaveFailed"]);
      const f = (["label_a", "label_b", "default_lang", "timezone"] as Field[]).find((x) => errors[x])!;
      return result(fieldId(f, req.fields[f] ?? null), errors[f]!.key);
    }
    setSt((old) => withPanel(ready(old), p, { phase: "unconfirmed", note: "visibility.unconfirmed", req }));
    setDialogNote(["settings.leaveUnconfirmed"]);
    result(`retry-${p}`, "visibility.unconfirmed");
  };
  const save = (p: PanelId) => {
    const touched = FIELDS[p].filter((f) => st.edits[f]);
    const errors: Panel["errors"] = {};
    for (const f of touched.filter((x) => x === "label_a" || x === "label_b")) {
      const { value, error } = checkName(st.edits[f]!.value ?? "");
      if (error) errors[f] = { key: `name.${error}` as CopyKey, value };
    }
    const first = errors.label_a ? "label_a" : errors.label_b ? "label_b" : null;
    if (first) {
      setSt((old) => withPanel(old, p, { errors }));
      // The field already has focus: its new description is read through the live region (setup's rule).
      if (document.activeElement?.id === `settings-${first}`) say([errors[first]!.key]);
      focusNext.current = [`settings-${first}`];
      return;
    }
    const of = (pick: (e: Edit, f: Field) => Value) => Object.fromEntries(touched.map((f) => [f, pick(st.edits[f]!, f)]));
    void send({ panel: p, request_id: crypto.randomUUID(), base: of((e) => e.base), fields: of((e, f) => norm(f, e.value)) });
  };
  const setField = (f: Field, value: Value) =>
    setSt((old) => {
      const p = panelOf(f);
      const panel = old.panels[p];
      if (panel.phase === "reloading" || !old.snap) return old;
      const edits = { ...old.edits };
      // Back to the saved value (exactly: a trailing space is still typing) is clean, except for a field whose save is
      // on its way (accept() rebases it) and while the saved values are unknown (a 409, a failed Reload).
      const keep = (!!panel.req && f in panel.req.fields && (panel.phase === "saving" || panel.phase === "unconfirmed"))
        || (panel.phase === "conflict" && !panel.known) || panel.phase === "readFailed";
      if (!keep && value === saved(old.snap, f)) delete edits[f];
      else edits[f] = { value, base: old.edits[f]?.base ?? saved(old.snap, f) };
      const cleared = panel.phase === "conflict" && panel.known && !FIELDS[p].some((x) => edits[x] && edits[x]!.base !== saved(old.snap!, x));
      const next = cleared ? READY : { ...panel, note: panel.phase === "ready" ? null : panel.note };
      return { ...old, edits, panels: { ...old.panels, [p]: next } };
    });
  const leave = (opener: string) => {
    if (!pending) return onBack(st.snap);
    setDialogNote(null);
    setDialog({ opener });
  };
  const closeDialog = (act: boolean) => {
    const was = dialog;
    setDialog(null);
    if (act) return onBack(st.snap);
    if (was) focusNext.current = [was.opener];
  };

  const busy = active(st);
  const snap = st.snap;
  const recovery = st.screen === "error" || st.screen === "401" || st.screen === "403" || st.screen === "setup";
  const offlineReason = offline ? "settings-offline-reason" : undefined;
  const sending = !!busy && ["saving", "unconfirmed"].includes(st.panels[busy].phase);

  const savedLine = (p: PanelId): readonly [string, string] => {
    if (!snap) return ["", ""];
    if (p === "timezone") return [snap.timezone, snap.timezone];
    if (p === "theme") return COPY[themeName(snap.theme)];
    const lang = COPY[snap.default_lang === "en" ? "content.en" : "content.vi"];
    const names = `${isolate(snap.label_a)}, ${isolate(snap.label_b)}`;
    return [`${names}, ${lang[0]}`, `${names}, ${lang[1]}`];
  };
  // A restored edit (back to the last accepted value) in a 409's Conflict: Reload keeps it if it still differs.
  const restored = (p: PanelId) => !!snap && FIELDS[p].some((f) => st.edits[f] && norm(f, st.edits[f]!.value) === saved(snap, f));
  const saveArea = (p: PanelId) => {
    const { phase, note, req } = st.panels[p];
    const isDirty = dirty(st, p);
    const waiting = busy && busy !== p ? busy : undefined;
    const empty = p === "timezone" && !zoneKnown(shown(st, "timezone") ?? "");
    const blocked = offline || !isDirty || !!busy || empty;
    const status = note && note !== "visibility.saved" ? note : isDirty ? "visibility.unsaved" : note;
    const describe = [`${p}-heading`, `${p}-status`, waiting && `${p}-wait`, offlineReason].filter(Boolean).join(" ");
    const reload = phase === "conflict" || phase === "reloading" || phase === "readFailed";
    const help: CopyKey | null = phase === "readFailed" ? "settings.retryReadHelp" : phase === "conflict" ? (restored(p) ? "settings.reconcileHelp" : "settings.reloadHelp") : null;
    return (
      <>
        <p id={`${p}-status`} className={note && ["visibility.conflict", "visibility.unconfirmed", "common.readError"].includes(note) ? s.error : s.help}>
          {status && <T k={status} />}
          {isDirty && status !== "visibility.unsaved" && (
            <>
              <br />
              <T k="visibility.unsaved" />
            </>
          )}
          {(isDirty || phase === "conflict") && (
            <>
              <br />
              <T k="settings.savedValues" vars={{ values: savedLine(p) }} />
            </>
          )}
        </p>
        {waiting && (
          <p id={`${p}-wait`} className={s.help}>
            <T k={st.panels[waiting].phase === "reloading" ? "settings.reloading" : "visibility.waitForSave"} />
          </p>
        )}
        <div className={s.usageActions}>
          {phase === "unconfirmed" && req && (
            <button
              id={`retry-${p}`}
              type="button"
              className={s.secondary}
              aria-disabled={offline || undefined}
              aria-describedby={[`${p}-status`, offlineReason].filter(Boolean).join(" ")}
              onClick={() => !offline && void send(req)}
            >
              <L k="common.tryAgain" />
            </button>
          )}
          {reload && (
            <button
              id={`reload-${p}`}
              type="button"
              className={s.secondary}
              aria-disabled={offline || !!waiting || phase === "reloading" || undefined}
              aria-describedby={[help && `${p}-reload-help`, waiting && `${p}-wait`, offlineReason].filter(Boolean).join(" ") || undefined}
              onClick={() => {
                if (offline || waiting || phase === "reloading") return;
                setSt((old) => withPanel(old, p, { phase: "reloading" }));
                read(p);
              }}
            >
              <L k={phase === "reloading" ? "settings.reloading" : phase === "readFailed" ? "common.tryAgain" : "visibility.reload"} />
            </button>
          )}
          {help && (
            <p id={`${p}-reload-help`} className={s.help}>
              <T k={help} />
            </p>
          )}
          {!reload && phase !== "unconfirmed" && (
            <button
              id={`save-${p}`}
              type="button"
              className={s.primary}
              aria-disabled={blocked || undefined}
              aria-describedby={describe}
              onClick={() => !blocked && save(p)}
            >
              <L k={phase === "saving" ? "save.busy" : "visibility.save"} />
            </button>
          )}
        </div>
      </>
    );
  };
  // A field's error while it still holds the value that was refused.
  const errorOf = (f: Field) => {
    const e = st.panels[panelOf(f)].errors[f];
    return e && norm(f, shown(st, f)) === e.value ? e.key : undefined;
  };
  const held = (p: PanelId) => st.panels[p].phase === "reloading";

  const nameField = (f: "label_a" | "label_b") => {
    const error = errorOf(f);
    return (
      <div className={s.field}>
        <label htmlFor={`settings-${f}`}>
          <T k={f === "label_a" ? "name.a" : "name.b"} />
        </label>
        <input
          id={`settings-${f}`}
          type="text"
          dir="auto"
          autoComplete="off"
          className={s.input}
          value={shown(st, f) ?? ""}
          readOnly={held("names")}
          aria-required="true"
          aria-invalid={!!error}
          aria-describedby={`settings-${f}-help`}
          onChange={(e) => setField(f, e.target.value)}
        />
        <p id={`settings-${f}-help`} className={error ? s.error : s.small}>
          {error ? <T k={error} /> : <T k="name.help" />}
        </p>
      </div>
    );
  };
  const zone = shown(st, "timezone") ?? "";
  const zoneOk = zoneKnown(zone);
  const savedZone = snap?.timezone ?? "";
  const savedRejected = !!snap && !zoneKnown(savedZone);
  const zoneOptions = zoneOk && !zones.includes(zone) ? [zone, ...zones] : zones;
  const zoneError = errorOf("timezone") ?? (zone === savedZone && savedRejected ? "zone.savedUnavailable" : undefined);
  const lang = shown(st, "default_lang");
  const langError = errorOf("default_lang");

  return (
    <div className={`${s.page} ${s.wide}`}>
      <header className={s.usageTop}>
        <button id="settings-back" type="button" className={s.secondary} onClick={() => leave("settings-back")}>
          <L k="navigation.back" />
        </button>
      </header>
      <main aria-labelledby="settings-title">
        <div className={s.usageHeading}>
          <h1 id="settings-title" tabIndex={-1} ref={heading}>
            <T k="settings.title" />
          </h1>
          <p className={s.help}>
            <T k="settings.live" />
          </p>
        </div>
        <p className={s.announcer} role="status" aria-live="polite" aria-atomic="true">
          {said && (
            <span key={said.n}>
              {said.groups.map((group, i) => (
                <span key={i}>
                  {i > 0 && " "}
                  {group.map((k, j) => (
                    <span key={k}>
                      {j > 0 && ": "}
                      <T k={k} />
                    </span>
                  ))}
                </span>
              ))}
            </span>
          )}
        </p>
        {offline && (
          <p id="settings-offline-reason" className={s.notice}>
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
                  <p id="settings-setup-message">
                    <T k="visibility.setup" />
                  </p>
                  <button id="settings-setup" type="button" className={s.secondary} aria-describedby="settings-setup-message" onClick={onSetup}>
                    <L k="visibility.setupLink" />
                  </button>
                </>
              ) : (
                <>
                  <p id="settings-error" className={s.error}>
                    <T k={st.screen === "401" ? "usage.session" : st.screen === "403" ? "common.accessLost" : "common.readError"} />
                  </p>
                  <div className={s.usageActions}>
                    {st.screen === "401" && (
                      <a id="settings-signin" className={s.secondary} href="/login?next=%2Fapp" target="_blank" rel="noopener">
                        <L k="content.signin" />
                      </a>
                    )}
                    {st.screen === "403" ? (
                      <form method="post" action="/api/owner/logout">
                        <button id="settings-logout" type="submit" className={s.secondary} aria-describedby="settings-error">
                          <L k="dashboard.logout" />
                        </button>
                      </form>
                    ) : (
                      <button
                        id={st.auth ? `retry-${st.auth.panel}` : "settings-retry"}
                        type="button"
                        className={s.secondary}
                        data-recovery=""
                        aria-disabled={offline || !!busy || undefined}
                        aria-describedby={["settings-error", offlineReason].filter(Boolean).join(" ")}
                        onClick={() => {
                          if (offline || busy) return; // one save at a time: the repeat is already on its way
                          // After signing in, the save or the Reload that met the 401 is repeated as it was.
                          if (st.auth) return void send(st.auth);
                          const p = st.authRead;
                          if (p) {
                            setSt((old) => withPanel(old, p, { phase: "reloading" }));
                            return read(p);
                          }
                          heading.current?.focus();
                          setSt((old) => ({ ...old, screen: "loading" }));
                          read(null);
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
              <section id="names-panel" className={s.panel} aria-labelledby="names-heading">
                <h2 id="names-heading">
                  <T k="step.names" />
                </h2>
                <p className={s.help}>
                  <T k="settings.namesHelp" />
                </p>
                {nameField("label_a")}
                {nameField("label_b")}
                <fieldset className={s.fieldset}>
                  <legend>
                    <T k="language.label" />
                  </legend>
                  <div className={s.radio}>
                    {(["en", "vi"] as const).map((l) => (
                      <label key={l}>
                        <input
                          id={`settings-lang-${l}`}
                          type="radio"
                          name="settings-lang"
                          checked={lang === l}
                          aria-disabled={held("names") || undefined}
                          aria-invalid={(!!langError && lang === l) || undefined}
                          aria-describedby={langError && lang === l ? "settings-lang-error settings-lang-help" : "settings-lang-help"}
                          onChange={() => setField("default_lang", l)}
                        />
                        {LANG_NAMES[l]}
                      </label>
                    ))}
                  </div>
                  <p id="settings-lang-help" className={s.small}>
                    <T k="settings.languageHelp" />
                  </p>
                  {/* shortcut: no link to O18 until the wording editor exists (Phase 3). Finish publishes every wording
                      field in both languages, so the refusal cannot occur before O18 can change the wording; link it then. */}
                  {langError && (
                    <p id="settings-lang-error" className={s.error}>
                      <T k={langError} />
                    </p>
                  )}
                </fieldset>
                {saveArea("names")}
              </section>
              <section id="timezone-panel" className={s.panel} aria-labelledby="timezone-heading">
                <h2 id="timezone-heading">
                  <T k="step.zone" />
                </h2>
                <div className={s.field}>
                  <label htmlFor="settings-timezone">
                    <T k="zone.label" />
                  </label>
                  <select
                    id="settings-timezone"
                    className={`${s.input} ${s.zone}`}
                    value={zoneOk ? zone : ""}
                    aria-disabled={held("timezone") || undefined}
                    aria-invalid={!!zoneError}
                    aria-describedby={[zoneError && "settings-zone-error", savedRejected && "settings-zone-saved", "settings-zone-note"].filter(Boolean).join(" ")}
                    onChange={(e) => setField("timezone", e.target.value)}
                  >
                    {!zoneOk && (
                      <option value="" disabled>
                        Choose / Chọn
                      </option>
                    )}
                    {zoneOptions.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                  {savedRejected && (
                    <p id="settings-zone-saved" className={s.small}>
                      <T k="zone.savedLabel" vars={{ zone: savedZone }} />
                    </p>
                  )}
                  {zoneError && (
                    <p id="settings-zone-error" className={s.error}>
                      <T k={zoneError} />
                    </p>
                  )}
                  <p id="settings-zone-note" className={s.small}>
                    <T k="settings.zoneNote" />
                  </p>
                </div>
                {saveArea("timezone")}
              </section>
              <section id="theme-panel" className={s.panel} aria-labelledby="theme-heading">
                <fieldset className={`${s.fieldset} ${s.stack}`} aria-describedby="settings-theme-help">
                  <legend id="theme-heading">
                    <T k="settings.theme" />
                  </legend>
                  <p id="settings-theme-help" className={s.small}>
                    <T k="settings.themeHelp" />
                  </p>
                  <div className={s.swatches}>
                    {[...THEMES, null].map((theme) => (
                      <label key={theme ?? "none"} className={s.swatch} data-theme={theme ?? undefined}>
                        <input
                          id={`settings-theme-${theme ?? "none"}`}
                          type="radio"
                          name="settings-theme"
                          checked={shown(st, "theme") === theme}
                          aria-disabled={held("theme") || undefined}
                          onChange={() => setField("theme", theme)}
                        />
                        <L k={themeName(theme)} />
                      </label>
                    ))}
                  </div>
                </fieldset>
                {saveArea("theme")}
              </section>
            </>
          )}
        </div>
        <dialog
          id="settings-dialog"
          ref={dialogRef}
          className={s.dialog}
          aria-labelledby="settings-dialog-title"
          aria-describedby={sending ? "settings-dialog-body" : undefined}
          onCancel={(event) => {
            event.preventDefault();
            closeDialog(false);
          }}
        >
          {dialog && (
            <div className={s.stack}>
              <h2 id="settings-dialog-title">
                <T k={sending ? "settings.leaveTitle" : pending ? "visibility.discardQuestion" : "settings.leaveSettledTitle"} />
              </h2>
              {sending && (
                <p id="settings-dialog-body">
                  <T k="settings.leavePending" />
                </p>
              )}
              <p role="status" aria-live="polite" aria-atomic="true">
                {dialogNote?.map((k, i) => (
                  <span key={k}>
                    {i > 0 && " "}
                    <T k={k} />
                  </span>
                ))}
                {dialogNote?.[0] === "settings.leaveFailed" && pending && (
                  <>
                    {" "}
                    <T k="settings.leaveUnsaved" />
                  </>
                )}
              </p>
              <button id="dialog-cancel" type="button" className={s.secondary} onClick={() => closeDialog(false)}>
                <L k="share.stay" />
              </button>
              <button id="dialog-act" type="button" className={`${s.secondary} ${s.danger}`} onClick={() => closeDialog(true)}>
                <L k={!sending && pending ? "visibility.discard" : "settings.leave"} />
              </button>
            </div>
          )}
        </dialog>
      </main>
    </div>
  );
}

// A refusal the client may trust: it matches the panel and the fields sent (CHECKS "Build contract"), so this request
// did not commit. Field errors by field, each with the value refused; null for anything else (the outcome stays unconfirmed).
function refusal(req: Req, status: number, error: unknown, fields: unknown): Panel["errors"] | null {
  if (status !== 400) return null;
  if (error === "invalid_name" && req.panel === "names" && fields && typeof fields === "object") {
    const entries = Object.entries(fields as Record<string, unknown>);
    const fine = entries.length > 0 && entries.every(([f, v]) => (f === "label_a" || f === "label_b") && f in req.fields && NAME_ERRORS.includes(v as string));
    return fine ? Object.fromEntries(entries.map(([f, v]) => [f, { key: `name.${v}` as CopyKey, value: req.fields[f as Field] ?? null }])) : null;
  }
  if (error === "invalid_timezone" && "timezone" in req.fields) return { timezone: { key: "zone.refused", value: req.fields.timezone ?? null } };
  if (error === "wording_incomplete" && "default_lang" in req.fields) return { default_lang: { key: "language.wordingIncomplete", value: req.fields.default_lang ?? null } };
  return null;
}
