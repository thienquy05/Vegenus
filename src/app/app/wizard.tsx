"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  browserLang, checkName, finishOutcome, nameErrors, proposeZone, saveBody, saveOutcome, SECTIONS, stepDirty, THEMES,
  type Draft, type Drafts, type Page,
} from "@/lib/setup";
import { COPY, type CopyKey } from "./copy";
import { Announcers, L, LogOut, SectionList, T, useOnline } from "./parts";
import s from "./owner.module.css";
// The four theme token sets, scoped to [data-theme], dress only the guest previews (design 4 §9, Q113).
import "../../../themes/a_dreamy/tokens.css";
import "../../../themes/b_cosmic/tokens.css";
import "../../../themes/c_cozy/tokens.css";
import "../../../themes/d_elegant/tokens.css";

// O3 setup wizard (owner UI "O2 and O3 revision for T2.1b"; Q114, Q121, Q124-Q126, Q128). Five steps: guests choose
// the theme, so the owner never does. Each Next saves every field with the version it read (step 4 advances locally);
// step 5 Finish publishes the wording as Token-only.
type Props = {
  page: Page | null;
  drafts: Drafts | null;
  initialStep: number;
  onExit: (message?: CopyKey) => void;
  uncertain?: boolean;
  onUncertain?: (uncertain: boolean) => void;
};
type Screen = "wizard" | "already" | "accessLost";
// retry names what Try again repeats; it runs against the current render, so it sends the owner's latest choices.
type Retry = { kind: "save"; next: number } | { kind: "finish" } | { kind: "drafts" };
type Status = { key: CopyKey; error: boolean; retry?: Retry; utc?: boolean } | null;
type NameError = "required" | "length" | "characters" | null;

const TITLES: CopyKey[] = ["step.names", "step.zone", "step.sections", "step.wording", "step.review"];
const LANG_NAMES: Record<string, ReactNode> = { en: <span lang="en">English</span>, vi: <span lang="vi">Tiếng Việt</span> };

// shortcut: the browser's own zone list (ICU names) plus UTC; the database checks the name again (400, then R2)
const offeredZones = () => {
  try {
    return [...new Set([...Intl.supportedValuesOf("timeZone"), "UTC"])];
  } catch {
    return ["UTC"];
  }
};
const zoneKnown = (zone: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};
const fill = (text: string, a: string, b: string) => text.replaceAll("{partner_a}", a).replaceAll("{partner_b}", b);

const draftOf = (page: Page | null, zone: string): Draft =>
  page
    ? { ...page, label_a: page.label_a ?? "", label_b: page.label_b ?? "", sections: page.sections.filter((x) => x !== "home") }
    : {
        theme: null,
        default_lang: typeof navigator === "undefined" ? "en" : browserLang(navigator.language),
        label_a: "",
        label_b: "",
        timezone: zone,
        sections: [],
      };

export function Wizard({ page, drafts: initialDrafts, initialStep, onExit, uncertain = false, onUncertain }: Props) {
  const router = useRouter();
  const online = useOnline();
  const [zones] = useState(offeredZones);
  const [proposed] = useState(() => proposeZone(() => Intl.DateTimeFormat().resolvedOptions().timeZone, zones));
  const [saved, setSaved] = useState(page);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [draft, setDraft] = useState(() => draftOf(page, proposed.zone));
  const [step, setStep] = useState(initialStep);
  const [screen, setScreen] = useState<Screen>("wizard");
  const [busy, setBusy] = useState<CopyKey | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [errors, setErrors] = useState<{ a: NameError; b: NameError; zone: boolean }>({ a: null, b: null, zone: false });
  // The UTC fallback is flagged until the owner picks a zone or confirms step 3 in this session (design ruling R1).
  const [fallback, setFallback] = useState(!page && proposed.fallback);
  const [restored, setRestored] = useState(!!page);
  const [dialog, setDialog] = useState<"conflict" | "leave" | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLang, setPreviewLang] = useState(draft.default_lang);
  // The wording preview starts on the owner's suggested theme, if any; switching it saves nothing (like O18).
  const [previewTheme, setPreviewTheme] = useState<string>(draft.theme ?? THEMES[0]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const nameA = useRef<HTMLInputElement>(null);
  const nameB = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLSelectElement>(null);
  const editNames = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const finishing = useRef(false);
  const lostRef = useRef<HTMLParagraphElement>(null);
  // After a name error found on another step, focus goes to that field instead of the step heading (R3).
  const focusName = useRef<"a" | "b" | null>(null);
  const initialDraft = useRef(draft);

  useEffect(() => {
    const target = screen === "accessLost" ? lostRef : focusName.current === "a" ? nameA : focusName.current === "b" ? nameB : headingRef;
    focusName.current = null;
    target.current?.focus();
  }, [step, screen]);
  useEffect(() => {
    if (status?.error) statusRef.current?.focus();
  }, [status]);
  useEffect(() => {
    if (dialog && !dialogRef.current?.open) dialogRef.current?.showModal();
    if (!dialog && dialogRef.current?.open) dialogRef.current.close();
  }, [dialog]);

  const set = (change: Partial<Draft>) => setDraft((current) => ({ ...current, ...change }));
  const go = (next: number) => {
    setStatus(null);
    setRestored(false);
    setStep(next);
  };
  const signedOut = () => router.push("/login?next=%2Fapp");

  // Reads the saved page. "choices": take the saved choices (Reload saved choices); "version": take only the version, so
  // the owner's edits overwrite on the next save (Keep mine); "drafts": only the wording, after the first save, so a
  // save from another session in between is still caught as a conflict (Codex review). Returns the page, or undefined.
  async function reread(mode: "choices" | "version" | "drafts"): Promise<Page | undefined> {
    setBusy("save.busy");
    try {
      const res = await fetch("/api/owner/page", { method: "POST" });
      if (res.status === 401) return void signedOut();
      if (res.status === 403) return void setScreen("accessLost");
      if (!res.ok) throw new Error(String(res.status));
      const body: { page: Page | null; drafts: Drafts | null } = await res.json();
      if (body.page?.setup_completed) return void setScreen("already");
      setDrafts(body.drafts);
      if (mode !== "drafts") setSaved(body.page);
      if (mode === "choices") {
        setDraft(draftOf(body.page, draft.timezone));
        setRestored(true);
        if (step === 5 && body.page) setStep(body.page.label_a && body.page.label_b ? 5 : 1);
      }
      setStatus(null);
      return body.page ?? undefined;
    } catch {
      setStatus({ key: navigator.onLine ? "state.write" : "common.offline", error: true, retry: mode === "drafts" ? { kind: "drafts" } : undefined });
    } finally {
      setBusy(null);
    }
  }

  async function save(next: number, body = saveBody(draft, saved?.version ?? null)) {
    if (!navigator.onLine) return setStatus({ key: "common.offline", error: true });
    setBusy("save.busy");
    setStatus(null);
    let res: Response;
    try {
      res = await fetch("/api/owner/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      setBusy(null);
      return setStatus({ key: navigator.onLine ? "state.write" : "common.offline", error: true, retry: { kind: "save", next } });
    }
    const answer = await res.json().catch(() => null);
    setBusy(null);
    switch (saveOutcome(res.status, answer)) {
      case "ok": {
        const { theme, default_lang, label_a, label_b, timezone, sections } = body;
        const base = saved ?? { visibility: "private", setup_completed: false };
        setSaved({ ...base, theme, default_lang, label_a, label_b, timezone, sections, version: answer.version });
        go(next);
        if (body.expected_version === null) await reread("drafts");
        return;
      }
      case "conflict":
        return setDialog("conflict");
      case "finished":
        return setScreen("already");
      case "invalid":
        return setStatus({ key: "save.invalid", error: true, utc: body.expected_version === null && body.timezone !== "UTC" });
      case "signedOut":
        return signedOut();
      case "accessLost":
        return setScreen("accessLost");
      default:
        return setStatus({ key: "state.write", error: true, retry: { kind: "save", next } });
    }
  }

  async function finish() {
    if (finishing.current) return;
    if (!saved?.label_a || !saved.label_b) return editNames.current?.focus();
    if (!navigator.onLine) return setStatus({ key: "common.offline", error: true });
    finishing.current = true;
    setBusy("finish.busy");
    setStatus(null);
    let outcome;
    try {
      const res = await fetch("/api/owner/finish", { method: "POST" });
      outcome = finishOutcome(res.status, await res.json().catch(() => null), uncertain);
    } catch {
      outcome = finishOutcome(0, null, uncertain);
    }
    finishing.current = false;
    setBusy(null);
    if (outcome === "done" || outcome === "finished") onUncertain?.(false);
    if (outcome === "done") return onExit("setup.published");
    if (outcome === "finished") return setScreen("already");
    if (outcome === "conflict") return setDialog("conflict");
    if (outcome === "signedOut") return signedOut();
    if (outcome === "accessLost") return setScreen("accessLost");
    onUncertain?.(outcome === "uncertain");
    setStatus({ key: outcome === "failed" ? "finish.failed" : "finish.uncertain", error: true, retry: { kind: "finish" } });
  }

  function retry(what: Retry) {
    if (what.kind === "save") void save(what.next);
    else if (what.kind === "finish") void finish();
    else void reread("drafts");
  }

  function next(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (step === 1) {
      const a = checkName(draft.label_a).error;
      const b = checkName(draft.label_b).error;
      setErrors({ ...errors, a, b });
      if (a || b) return (a ? nameA : nameB).current?.focus();
    }
    if (step === 2) {
      const bad = !zoneKnown(draft.timezone);
      setErrors({ ...errors, zone: bad });
      if (bad) return zoneRef.current?.focus();
      setFallback(false);
    }
    if (step === 4) return drafts && go(5);
    if (step === 5) return void finish();
    // A name kept from step 2 is sent with every save: check it first and send the owner back to it (R3).
    const refused = nameErrors(draft);
    if (saved && (refused.a || refused.b)) {
      setErrors({ ...errors, ...refused });
      focusName.current = refused.a ? "a" : "b";
      return go(1);
    }
    void save(step + 1);
  }

  const unsaved = () => stepDirty(step, draft, saved ? draftOf(saved, saved.timezone) : initialDraft.current);

  const nameA_ = draft.label_a.trim() ? checkName(draft.label_a).value : "[PARTNER_A]";
  const nameB_ = draft.label_b.trim() ? checkName(draft.label_b).value : "[PARTNER_B]";
  const showRetry = !!status?.retry && (step === 5 || !(status.key === "finish.failed" || status.key === "finish.uncertain"));
  const uncertainHere = uncertain && step === 5 && !status;
  const known = zoneKnown(draft.timezone);
  const finishBlocked = step === 5 && (showRetry || uncertainHere);

  const preview = (lang: string) => (
    <div className={s.preview} data-theme={previewTheme} lang={lang} inert>
      {drafts?.["home.greeting"] && <p>{fill(drafts["home.greeting"][lang], nameA_, nameB_)}</p>}
      <h3>
        <bdi>{nameA_}</bdi> &amp; <bdi>{nameB_}</bdi>
      </h3>
      <p className={s.guestNotice}>{COPY["preview.photos"][lang === "en" ? 0 : 1]}</p>
      <p className={s.guestNotice}>{COPY["preview.note"][lang === "en" ? 0 : 1]}</p>
      {drafts?.["wishes.button"] && (
        <button type="button" className={s.guestAction} disabled tabIndex={-1}>
          {drafts["wishes.button"][lang]}
        </button>
      )}
    </div>
  );

  const nameField = (id: "a" | "b", ref: typeof nameA) => {
    const value = id === "a" ? draft.label_a : draft.label_b;
    const error = errors[id];
    return (
      <div className={s.field}>
        <div className={s.fieldMeta}>
          <label htmlFor={`name-${id}`}>
            <T k={`name.${id}`} />
          </label>
          <small id={`count-${id}`}>
            {[...value.trim().normalize("NFC")].length}/40
          </small>
        </div>
        <input
          id={`name-${id}`}
          ref={ref}
          type="text"
          autoComplete="off"
          placeholder={id === "a" ? "[PARTNER_A]" : "[PARTNER_B]"}
          value={value}
          readOnly={!!busy}
          aria-required="true"
          aria-invalid={!!error}
          aria-describedby={`help-${id} count-${id}`}
          className={s.input}
          onChange={(event) => set(id === "a" ? { label_a: event.target.value } : { label_b: event.target.value })}
          onBlur={() => set(id === "a" ? { label_a: draft.label_a.normalize("NFC") } : { label_b: draft.label_b.normalize("NFC") })}
        />
        {value.trim() && (
          <p className={s.echo} aria-hidden="true">
            <bdi>{value.trim().normalize("NFC")}</bdi>
          </p>
        )}
        <p id={`help-${id}`} className={error ? s.error : s.small}>
          {error ? (
            <>
              <span aria-hidden="true">! </span>
              <T k={`name.${error}`} />
            </>
          ) : (
            <T k="name.help" />
          )}
        </p>
      </div>
    );
  };

  const reviewRow = (label: CopyKey, to: number, value: ReactNode) => {
    const [en, vi] = COPY[label];
    return (
      <div className={s.reviewRow} key={label}>
        <dt>
          <T k={label} />
        </dt>
        <dd>
          {value}
          <button type="button" className={s.change} onClick={() => go(to)}>
            <span className={s.pair}>
              <span lang="en">Change</span> / <span lang="vi">Đổi</span>
              <span className={s.announcer}>
                <span lang="en">{` ${en.toLowerCase()}`}</span> / <span lang="vi">{` ${vi.toLowerCase()}`}</span>
              </span>
            </span>
          </button>
        </dd>
      </div>
    );
  };

  let body: ReactNode;
  if (step === 1) {
    body = (
      <div className={`${s.stack} ${s.formStep}`}>
        <fieldset className={s.fieldset}>
          <legend>
            <T k="language.label" />
          </legend>
          <div className={s.radio}>
            {(["en", "vi"] as const).map((lang) => (
              <label key={lang}>
                <input
                  type="radio"
                  name="language"
                  checked={draft.default_lang === lang}
                  disabled={!!busy}
                  onChange={() => set({ default_lang: lang })}
                />
                {LANG_NAMES[lang]}
              </label>
            ))}
          </div>
        </fieldset>
        <p className={s.small}>
          <T k="language.help" />
        </p>
        {nameField("a", nameA)}
        {nameField("b", nameB)}
      </div>
    );
  } else if (step === 2) {
    const options = known && !zones.includes(draft.timezone) ? [draft.timezone, ...zones] : zones;
    body = (
      <div className={`${s.stack} ${s.formStep}`}>
        <div className={s.field}>
          <label htmlFor="zone">
            <T k="zone.label" />
          </label>
          <select
            id="zone"
            ref={zoneRef}
            value={known ? draft.timezone : ""}
            disabled={!!busy}
            aria-invalid={errors.zone || !known}
            aria-describedby="zone-help zone-error"
            className={`${s.input} ${s.zone}`}
            onChange={(event) => {
              set({ timezone: event.target.value });
              setFallback(false);
              setErrors({ ...errors, zone: false });
            }}
          >
            {!known && (
              <option value="" disabled>
                Choose / Chọn
              </option>
            )}
            {options.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
          {!known && (
            <p className={s.echo}>
              <span lang="en">
                Saved: <bdi>{draft.timezone}</bdi> (not available)
              </span>{" "}
              / Đã lưu: <bdi>{draft.timezone}</bdi> (không khả dụng)
            </p>
          )}
          <p id="zone-help" className={s.small}>
            <T k="zone.choose" />
            <br />
            <T k="zone.help" />
          </p>
        </div>
        {fallback && (
          <p className={s.small}>
            <T k="zone.fallback" />
          </p>
        )}
        <p id="zone-error" className={s.error}>
          {(errors.zone || !known) && (
            <>
              <span aria-hidden="true">! </span>
              <T k="zone.unavailable" />
            </>
          )}
        </p>
      </div>
    );
  } else if (step === 3) {
    body = (
      <div className={s.formStep}>
        <div className={s.sectionRow}>
          <label htmlFor="home">
            <span>
              <T k="sections.home" />
            </span>
            <input id="home" type="checkbox" checked disabled aria-describedby="home-reason" readOnly />
          </label>
        </div>
        <small id="home-reason" className={s.small}>
          <T k="home.always" />
        </small>
        {SECTIONS.map((section) => (
          <div className={s.sectionRow} key={section}>
            <label htmlFor={`section-${section}`}>
              <span>
                <T k={`sections.${section}`} />
              </span>
              <input
                id={`section-${section}`}
                type="checkbox"
                checked={draft.sections.includes(section)}
                disabled={!!busy}
                onChange={(event) =>
                  set({ sections: event.target.checked ? [...draft.sections, section] : draft.sections.filter((x) => x !== section) })
                }
              />
            </label>
          </div>
        ))}
      </div>
    );
  } else if (step === 4) {
    const sample = (key: string) => {
      const text = drafts?.[key];
      if (!text) return null;
      const chip = (value: string) =>
        value.split(/(\{days\})/).map((part, i) => (part === "{days}" ? <span key={i} className={s.chip}>{part}</span> : part));
      return (
        <p className={s.sample} key={key}>
          <span lang="en">{chip(fill(text.en, nameA_, nameB_))}</span> / {chip(fill(text.vi, nameA_, nameB_))}
        </p>
      );
    };
    body = (
      <div className={s.wordingLayout}>
        <div className={s.stack}>
          <p>
            <T k="wording.privacy" />
          </p>
          {!drafts ? (
            <>
              <p className={s.error}>
                <T k="common.readError" />
              </p>
              <button type="button" className={s.secondary} disabled={!!busy} onClick={() => void reread("drafts")}>
                <L k="common.tryAgain" />
              </button>
            </>
          ) : (
            ["home.greeting", "home.days", "wishes.button"].map(sample)
          )}
          <label className={s.check}>
            <input type="checkbox" checked disabled aria-describedby="wording-reason" readOnly />
            <span>
              <T k="wording.accept" />
            </span>
          </label>
          <p id="wording-reason" className={s.small}>
            <T k="wording.required" />
          </p>
          <small className={s.small}>
            <T k="wording.later" />
          </small>
          <button
            type="button"
            className={`${s.secondary} ${s.previewToggle}`}
            aria-expanded={previewOpen}
            aria-controls="wording-preview"
            onClick={() => setPreviewOpen(!previewOpen)}
          >
            <L k="preview.label" />
          </button>
        </div>
        <div id="wording-preview" className={`${s.stack} ${previewOpen ? "" : s.previewClosed}`}>
          <div className={s.themes} role="group" aria-label={`${COPY["preview.theme"][0]} / ${COPY["preview.theme"][1]}`}>
            {THEMES.map((theme) => (
              <button
                key={theme}
                type="button"
                className={s.choice}
                aria-pressed={previewTheme === theme}
                onClick={() => setPreviewTheme(theme)}
              >
                <L k={`theme.${theme}`} />
              </button>
            ))}
          </div>
          <div className={s.radio} role="group" aria-label={`${COPY["preview.language"][0]} / ${COPY["preview.language"][1]}`}>
            {(["en", "vi"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                lang={lang}
                className={s.choice}
                aria-pressed={previewLang === lang}
                onClick={() => setPreviewLang(lang)}
              >
                {lang === "en" ? "English" : "Tiếng Việt"}
              </button>
            ))}
          </div>
          {preview(previewLang)}
        </div>
      </div>
    );
  } else {
    const missing = !saved?.label_a || !saved.label_b;
    const nameLine = (name: string | null | undefined) => (
      <div className={name ? undefined : s.missing}>{name ? <bdi>{name}</bdi> : <T k="review.notAdded" />}</div>
    );
    body = (
      <div className={`${s.stack} ${s.formStep}`}>
        <p>
          <strong>
            <T k="visibility.token" />
          </strong>
          <br />
          <T k="visibility.explain" />
        </p>
        <dl className={s.review}>
          {reviewRow("review.language", 1, LANG_NAMES[saved?.default_lang ?? draft.default_lang])}
          {reviewRow("review.names", 1, <>{nameLine(saved?.label_a)}{nameLine(saved?.label_b)}</>)}
          {reviewRow(
            "review.zone",
            2,
            <>
              <bdi>{saved?.timezone ?? draft.timezone}</bdi>
              {fallback && (
                <p className={s.small}>
                  <T k="zone.reviewFallback" />
                </p>
              )}
            </>,
          )}
          {reviewRow("review.sections", 3, <SectionList sections={saved?.sections ?? []} />)}
          {reviewRow("review.wording", 4, <T k="wording.accept" />)}
        </dl>
        {missing && (
          <>
            <p className={s.error}>
              <T k="review.missingNames" />
            </p>
            <button type="button" ref={editNames} className={s.secondary} onClick={() => go(1)}>
              <L k="review.editNames" />
            </button>
          </>
        )}
      </div>
    );
  }

  const dialogKeys = dialog === "conflict"
    ? { title: "conflict.title", text: "conflict.message", keep: "conflict.keep", other: "conflict.reload" } as const
    : { title: "leave.title", text: "leave.prompt", keep: "leave.keep", other: "leave.discard" } as const;
  // Esc and Close take the choice that loses nothing and writes nothing (owner UI O3 accessibility): the version stays
  // the one read, so the next save asks again rather than overwriting the other session (Codex review).
  const dismiss = () => setDialog(null);
  // Keep mine: take the new version, then save the owner's choices over it (a save conflict; Finish has nothing to resend).
  const keep = async () => {
    if (dialog !== "conflict") return setDialog(null);
    setDialog(null);
    const latest = await reread("version");
    if (latest && step < 4) void save(step + 1, saveBody(draft, latest.version));
  };
  const other = () => {
    setDialog(null);
    if (dialog === "conflict") void reread("choices");
    else onExit();
  };

  // Errors move focus to their visible text, which is read then; the alert region carries only what nothing focuses.
  const alert = screen === "accessLost" ? "common.accessLost" : uncertainHere ? "finish.uncertain" : null;
  return (
    <div className={s.page}>
      <header className={s.topbar}>
        <h1 className={s.topbarText}>
          <T k="shell.setup" />
        </h1>
      </header>
      <main className={s.main}>
        <Announcers status={busy ?? (restored ? "setup.saved" : null)} alert={alert} />
        {!online && (
          <p id="offline-reason" className={s.notice}>
            <T k="common.offline" />
          </p>
        )}
        {screen === "accessLost" && (
          <section className={`${s.surface} ${s.narrow} ${s.stack}`}>
            <p className={s.error} tabIndex={-1} ref={lostRef}>
              <T k="common.accessLost" />
            </p>
            <LogOut />
          </section>
        )}
        {screen === "already" && (
          <section className={`${s.surface} ${s.narrow} ${s.stack}`}>
            <h2 tabIndex={-1} ref={headingRef}>
              <T k="setup.done" />
            </h2>
            <button type="button" className={s.primary} onClick={() => onExit()}>
              <L k="setup.overview" />
            </button>
          </section>
        )}
        {screen === "wizard" && (
          <form className={s.wizard} noValidate onSubmit={next}>
            <div className={s.wizardHead}>
              {/* Not after an uncertain Finish: the page may already be open to guests (Codex review). */}
              {!uncertain && (
                <p className={s.small}>
                  <T k="private.help" />
                </p>
              )}
              <p className={s.counter}>
                <span lang="en">{`Step ${step} of 5`}</span> / {`Bước ${step}/5`}
              </p>
              <div className={s.steps} aria-hidden="true">
                {TITLES.map((title, i) => (
                  <span key={title} className={i < step ? s.stepDone : undefined} />
                ))}
              </div>
              <h2 tabIndex={-1} ref={headingRef}>
                <T k={TITLES[step - 1]} />
              </h2>
              {restored && (
                <p className={s.small}>
                  <T k="setup.saved" />
                </p>
              )}
            </div>
            <div className={s.wizardBody}>
              <fieldset className={s.fieldset} aria-busy={!!busy}>
                {body}
              </fieldset>
            </div>
            <footer className={s.wizardFooter}>
              {busy && (
                <p className={s.status}>
                  <T k={busy} />
                </p>
              )}
              {(status || uncertainHere) && (
                <p className={s.error} tabIndex={-1} ref={statusRef}>
                  <T k={status?.key ?? "finish.uncertain"} />
                </p>
              )}
              {status?.utc && (
                <button
                  type="button"
                  className={`${s.secondary} ${s.full}`}
                  onClick={() => {
                    set({ timezone: "UTC" });
                    setFallback(true);
                    void save(2, { ...saveBody(draft, null), timezone: "UTC" });
                  }}
                >
                  <L k="zone.useUTC" />
                </button>
              )}
              <div className={s.actions}>
                <button type="button" className={s.secondary} disabled={step === 1 || !!busy} onClick={() => go(step - 1)}>
                  <L k="navigation.back" />
                </button>
                {(showRetry || uncertainHere) && (
                  <button
                    type="button"
                    className={s.secondary}
                    disabled={!!busy || !online}
                    aria-describedby={online ? undefined : "offline-reason"}
                    onClick={() => (status?.retry ? retry(status.retry) : void finish())}
                  >
                    <L k="common.tryAgain" />
                  </button>
                )}
                {!finishBlocked && (
                  <button
                    type="submit"
                    className={s.primary}
                    disabled={(!online && step !== 4) || (step === 4 && !drafts)}
                    aria-disabled={!!busy}
                    aria-describedby={online ? undefined : "offline-reason"}
                  >
                    <L k={step === 5 ? "navigation.finish" : "navigation.next"} />
                  </button>
                )}
              </div>
              <button
                type="button"
                className={`${s.quiet} ${s.full}`}
                disabled={!!busy}
                onClick={() => (unsaved() ? setDialog("leave") : onExit())}
              >
                <L k="leave.label" />
              </button>
            </footer>
          </form>
        )}
        <dialog
          ref={dialogRef}
          className={s.dialog}
          aria-labelledby="dialog-heading"
          aria-describedby="dialog-description"
          onCancel={(event) => {
            event.preventDefault();
            dismiss();
          }}
        >
          {dialog && (
            <div className={s.stack}>
              <div className={s.dialogTop}>
                <h2 id="dialog-heading">
                  <T k={dialogKeys.title} />
                </h2>
                <button type="button" className={s.secondary} aria-label={`${COPY["shell.close"][0]} / ${COPY["shell.close"][1]}`} onClick={dismiss}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" width="24" height="24">
                    <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </button>
              </div>
              <p id="dialog-description">
                <T k={dialogKeys.text} />
              </p>
              <button type="button" className={s.primary} autoFocus onClick={() => void keep()}>
                <L k={dialogKeys.keep} />
              </button>
              <button type="button" className={s.secondary} onClick={other}>
                <L k={dialogKeys.other} />
              </button>
            </div>
          )}
        </dialog>
      </main>
    </div>
  );
}
