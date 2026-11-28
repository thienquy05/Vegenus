"use client";
import { PREFS_KEY } from "@/lib/privacy";
import { type CSSProperties, type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Cred, GuestSummary } from "@/lib/guest";
import { chooseLang, say, type CopyKey, type Lang } from "./copy";
import { chooseMode, hasWebgl2, type Mode } from "./mode";
import { AlbumView, baseOf, HomeView, ListView, type Shortcut, useOnline } from "./views";
import s from "./guest.module.css";
import "../../../themes/a_dreamy/tokens.css";
import "../../../themes/b_cosmic/tokens.css";
import "../../../themes/c_cozy/tokens.css";
import "../../../themes/d_elegant/tokens.css";

// The guest shell (T3.1b): theme, language, the circular menu (theme system §2), the sections built so far and the
// G8 Settings sheet (guest UI §9) and the first-visit theme prompt (Q128). The guest's choices live on this device only
// (`vegenus_prefs`).
// shortcut: the theme changes without the boards' cross-fade (--dur-fast); it comes with the motion work.
// ponytail: one icon set for all four themes; the per-theme icon families (theme system §2) come with the scene work.
export type Section = "home" | "memories" | "together" | "guestbook";
const BUILT: Section[] = ["home", "memories", "together", "guestbook"]; // menu order; Zodiac (T3.9) later
// Under /g (Home at /g/home) or /p/<name> (Home at the name itself, T3.1pc).
const SUFFIX: Record<Section, string> = { home: "/home", memories: "/memories", together: "/together", guestbook: "/wishes" };
const pathOf = (base: string, x: Section) => (x === "home" && base !== "/g" ? base : base + SUFFIX[x]);
const THEMES = ["a_dreamy", "b_cosmic", "c_cozy", "d_elegant"];

type Prefs = { lang?: Lang; theme?: string; motion?: "reduce" | "full"; corner?: "left" | "right"; mode?: Mode };
const REDUCE = "(prefers-reduced-motion: reduce)";
const noop = () => () => {};
const watchMotion = (onChange: () => void) => {
  const media = matchMedia(REDUCE);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};
// Only values this build knows: anything else saved on the device is ignored.
export function readPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") ?? {};
    return {
      lang: ["en", "vi"].includes(raw.lang) ? raw.lang : undefined,
      theme: THEMES.includes(raw.theme) ? raw.theme : undefined,
      motion: ["reduce", "full"].includes(raw.motion) ? raw.motion : undefined,
      corner: ["left", "right"].includes(raw.corner) ? raw.corner : undefined,
      mode: ["page", "static"].includes(raw.mode) ? raw.mode : undefined,
    };
  } catch {
    return {};
  }
}
function canStore() {
  try {
    localStorage.setItem(`${PREFS_KEY}_probe`, "1");
    localStorage.removeItem(`${PREFS_KEY}_probe`);
    return true;
  } catch {
    return false;
  }
}
const overlap = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const ICONS: Record<Section | "settings", ReactNode> = {
  home: <path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" />,
  memories: <path d="M4 6h16v13H4zM4 15l5-5 4 4 3-3 4 4" />,
  together: <path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />,
  guestbook: <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />,
  settings: <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" />,
};
const icon = (name: Section | "settings") => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
    {ICONS[name]}
  </svg>
);


// memoryOnly: cookies are blocked, so this visit is not remembered (E30).
export function GuestApp(props: { summary: GuestSummary; section: Section; item?: string; cred?: Cred; memoryOnly?: boolean }) {
  const { summary, section: initial, cred, memoryOnly } = props;
  const remembered = typeof cred === "string"; // a visit run from memory: the address stays /g
  const base = baseOf(cred);
  const PATHS = Object.fromEntries(BUILT.map((x) => [x, pathOf(base, x)])) as Record<Section, string>;
  const [detail, setDetail] = useState<string | null>(props.item ?? null); // the memory open in G3
  const [changed, setChanged] = useState<Prefs | null>(null);
  const [stored, setStored] = useState(canStore);
  const [gone, setGone] = useState(false);
  const [visits, setVisits] = useState(0);
  const [section, setSection] = useState(initial);
  const [menuOpen, setMenuOpen] = useState(false);
  const [listMode, setListMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const nav = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const focusHeading = useRef(false);
  const wasOpen = useRef(false);
  const promptDialog = useRef<HTMLDialogElement>(null);
  const [preview, setPreview] = useState<string | null>(null); // the prompt's choice before Continue
  const [picked, setPicked] = useState(false); // a choice was made in the prompt: announce if it cannot be kept

  // localStorage exists only in the browser: the server renders an empty shell and nothing themed flashes; until
  // the guest changes something, the saved choices are read as they are.
  const browser = useSyncExternalStore(noop, () => true, () => false);
  const systemReduce = useSyncExternalStore(watchMotion, () => matchMedia(REDUCE).matches, () => false);
  const prefs = changed ?? (browser ? readPrefs() : null);
  const ready = prefs !== null;

  const lang = chooseLang(prefs?.lang, browser ? navigator.languages : [], summary.languages_ready, summary.default_lang);
  const suggested = summary.theme && THEMES.includes(summary.theme) ? summary.theme : "a_dreamy";
  // Q128: no theme saved on this device (or for this visit) yet means the first-visit prompt, over Home.
  const prompting = prefs !== null && !prefs.theme;
  const theme = (prompting && preview) || prefs?.theme || suggested;
  const reduce = prefs?.motion ? prefs.motion === "reduce" : systemReduce;
  const corner = prefs?.corner ?? "left";
  // Decided before any 3D is requested (3D approach §3.2), so a Static device never downloads it. One probe per visit,
  // after the first content is on screen (principle 1: content first); Static, which requests nothing, until then.
  const [webgl, setWebgl] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setWebgl(hasWebgl2()));
    return () => cancelAnimationFrame(frame);
  }, []);
  const device = browser ? (navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number }) : undefined;
  const { mode, locked } = chooseMode({ webgl, reduce, pick: prefs?.mode, saveData: device?.connection?.saveData, deviceMemory: device?.deviceMemory });
  const t = (key: CopyKey, vars?: Record<string, string | number>) => say(key, lang, vars);
  const online = useOnline();
  const onGone = useCallback(() => setGone(true), []);
  // The prompt opens as a native modal on the checked card; Continue, Not now, Close and Escape all end on Home's heading.
  const promptWasOpen = useRef(false);
  useEffect(() => {
    const d = promptDialog.current;
    if (prompting && d && !d.open) {
      d.showModal();
      d.querySelector<HTMLInputElement>("input[type=radio]:checked")?.focus();
    }
    if (!prompting && promptWasOpen.current) document.querySelector<HTMLElement>("main h1")?.focus();
    promptWasOpen.current = prompting;
  }, [prompting]);
  const finishPrompt = (chosen: string) => {
    setPreview(null);
    change({ theme: chosen });
  };

  // The access-gone notice takes focus, so it is spoken and focus does not fall to the page.
  useEffect(() => {
    if (gone) document.querySelector<HTMLElement>("main h1")?.focus();
  }, [gone]);

  useEffect(() => {
    if (!ready) return;
    const html = document.documentElement;
    html.dataset.theme = theme;
    html.lang = lang;
    if (reduce) html.dataset.motion = "reduce";
    else delete html.dataset.motion;
    html.dataset.mode = mode;
  }, [ready, theme, lang, reduce, mode]);

  const change = (next: Prefs) => {
    const merged = { ...prefs, ...next };
    setChanged(merged);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(merged));
      setStored(true);
    } catch {
      setStored(false);
    }
  };

  // Back and forward between sections, when the address follows them (not in a visit run from memory).
  useEffect(() => {
    if (remembered) return;
    const albumOf = new RegExp(`^${base}/memories/([0-9a-f-]{36})$`, "i"); // G3's address
    const back = () => {
      const album = albumOf.exec(location.pathname);
      const found = album ? "memories" : BUILT.find((x) => pathOf(base, x) === location.pathname);
      if (found) setSection(found);
      setDetail(album ? album[1] : null);
      focusHeading.current = !album; // an album focuses its own heading once read
      setVisits((n) => n + 1);
    };
    addEventListener("popstate", back);
    return () => removeEventListener("popstate", back);
  }, [remembered, base]);

  const closeMenu = useCallback((refocus: boolean) => {
    setMenuOpen(false);
    setListMode(false);
    if (refocus) menuButton.current?.focus();
  }, []);

  // Open: focus the first item; a fan with an item off screen or two items touching becomes the labelled list
  // (theme system §2 Fallback), measured before paint so the fan never flashes.
  useLayoutEffect(() => {
    if (!menuOpen || !nav.current) return;
    // Each item's bubble and label; they never touch another item's.
    const items = [...nav.current.querySelectorAll("li")].map((li) => [...li.querySelectorAll("a > span, button > span")].map((x) => x.getBoundingClientRect()));
    const outside = (r: DOMRect) => r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight;
    const clash = items.some((a, i) => items.slice(i + 1).some((b) => a.some((x) => b.some((y) => overlap(x, y)))));
    if (!listMode && (items.flat().some(outside) || clash)) setListMode(true);
    nav.current.querySelector<HTMLElement>("a, button")?.focus();
    const escape = (event: KeyboardEvent) => event.key === "Escape" && closeMenu(true);
    addEventListener("keydown", escape);
    return () => removeEventListener("keydown", escape);
  }, [menuOpen, listMode, closeMenu]);

  const go = (next: Section) => {
    closeMenu(false);
    focusHeading.current = true;
    setSection(next);
    setDetail(null);
    setVisits((n) => n + 1); // choosing the section already shown still moves focus to its heading
    if (!remembered && location.pathname !== PATHS[next]) history.pushState(null, "", PATHS[next]);
  };
  // G3 from a memory card: its own address (not in a visit run from memory); the album focuses its heading once read.
  const openAlbum = (id: string) => {
    setDetail(id);
    if (!remembered) history.pushState({ album: true }, "", `${base}/memories/${id}`);
  };
  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    document.querySelector<HTMLElement>("main h1")?.focus();
  }, [visits]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (settingsOpen && !d.open) {
      d.showModal();
      d.querySelector<HTMLInputElement>("input[name=lang]:checked")?.focus();
    }
    if (!settingsOpen && d.open) d.close();
    // Back to the menu button once it is shown again (it is hidden while the sheet is open, Q68).
    if (!settingsOpen && wasOpen.current) menuButton.current?.focus();
    wasOpen.current = settingsOpen;
  }, [settingsOpen]);

  if (!prefs) return <div className={s.shell} aria-busy="true" />;
  // The four themes as native radios, each card in its own tokens; the owner's suggestion carries a text badge.
  const themeCards = (name: string, checked: string, pick: (id: string) => void) => (
    <fieldset className={s.group}>
      <legend>{t("theme.legend")}</legend>
      <div className={s.themeCards}>
        {THEMES.map((id) => (
          <label key={id} className={s.themeCard} data-theme={id}>
            <input type="radio" name={name} value={id} checked={checked === id} onChange={() => pick(id)} />
            <span className={s.themeName}>{t(`theme.${id}` as CopyKey)}</span>
            {id === summary.theme && <span className={s.badge}>{t("theme.suggested")}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
  // Access gone mid-visit (token rotated, page Private or the section turned off; token flow §6): what was shown
  // goes, and one neutral line stays, the same for every cause.
  if (gone)
    return (
      <div className={s.shell}>
        <main className={s.main}>
          <h1 tabIndex={-1}>{t("state.gone")}</h1>
        </main>
      </div>
    );
  const items = [...BUILT.filter((x) => summary.sections.includes(x)), "settings" as const];
  const step = items.length > 1 ? 90 / (items.length - 1) : 0;
  const entry = (name: Section | "settings", i: number) => {
    const angle = (i * step * Math.PI) / 180;
    // --c/--s place the label outward along the radius, as on the approved menu boards.
    const style = {
      "--x": `${Math.round(Math.cos(angle) * 200) * (corner === "right" ? -1 : 1)}px`,
      "--y": `${Math.round(Math.sin(angle) * 200)}px`,
      "--c": Math.cos(angle).toFixed(3),
      "--s": Math.sin(angle).toFixed(3),
    } as CSSProperties;
    const inner = (
      <>
        <span className={s.bubble}>{icon(name)}</span>
        <span className={s.chip}>{t(`nav.${name}`)}</span>
      </>
    );
    return (
      <li key={name} style={style}>
        {name === "settings" ? (
          <button type="button" className={s.item} onClick={() => { closeMenu(false); setSettingsOpen(true); }}>
            {inner}
          </button>
        ) : (
          <a href={PATHS[name]} className={s.item} aria-current={name === section ? "page" : undefined} onClick={(event) => { event.preventDefault(); go(name); }}>
            {inner}
          </a>
        )}
      </li>
    );
  };

  return (
    <div className={s.shell} data-corner={corner}>
      {menuOpen && (
        <nav id="guest-nav" ref={nav} aria-labelledby="guest-menu" className={listMode ? s.list : s.fan}>
          <ul>{items.map(entry)}</ul>
        </nav>
      )}
      <button
        id="guest-menu"
        ref={menuButton}
        type="button"
        className={s.menuButton}
        data-corner={corner}
        hidden={settingsOpen || prompting}
        aria-expanded={menuOpen}
        aria-controls="guest-nav"
        aria-label={t(menuOpen ? "menu.close" : "menu.open")}
        onClick={() => (menuOpen ? closeMenu(true) : setMenuOpen(true))}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d={menuOpen ? "M6 6l12 12M18 6 6 18" : "M4 7h16M4 12h16M4 17h16"} />
        </svg>
      </button>
      {menuOpen && !listMode && <div className={s.closeLayer} aria-hidden="true" onClick={() => closeMenu(true)} />}
      <div className={s.page} data-open={menuOpen || undefined} inert={menuOpen || undefined}>
        <main className={s.main}>
          {memoryOnly && <p role="status">{t("entry.memoryOnly")}</p>}
          {!online && <p role="status">{t("state.offline")}</p>}
          {section === "home" ? (
            <HomeView
              summary={summary}
              lang={lang}
              cred={cred}
              t={t}
              onGone={onGone}
              shortcuts={BUILT.filter((x): x is Shortcut["name"] => x !== "home" && summary.sections.includes(x)).map((name) => ({ name, href: PATHS[name] }))}
              onGo={go}
            />
          ) : section === "memories" && detail ? (
            <AlbumView key={detail} id={detail} summary={summary} lang={lang} cred={cred} t={t} onGone={onGone} onBack={() => (history.state?.album ? history.back() : go("memories"))} />
          ) : (
            <ListView key={section} section={section} summary={summary} lang={lang} cred={cred} t={t} onGone={onGone} onOpen={openAlbum} />
          )}
        </main>
      </div>
      <dialog ref={dialog} className={s.sheet} aria-labelledby="settings-title" onClose={() => setSettingsOpen(false)}>
        <div className={s.sheetHead}>
          <h2 id="settings-title">{t("nav.settings")}</h2>
          <button type="button" className={s.secondary} onClick={() => setSettingsOpen(false)}>
            {t("settings.close")}
          </button>
        </div>
        {/* A language whose wording is not all published is shown disabled, with the notice (E54). */}
        <fieldset className={s.group} aria-describedby={summary.languages_ready.length < 2 ? "lang-notice" : undefined}>
          <legend>{t("settings.language")}</legend>
          {(["en", "vi"] as const).map((l) => {
            const off = !summary.languages_ready.includes(l);
            return (
              <label key={l} className={s.row}>
                <input id={`lang-${l}`} type="radio" name="lang" disabled={off} checked={lang === l} onChange={() => change({ lang: l })} />
                <span>
                  <span lang={l}>{l === "en" ? "English" : "Tiếng Việt"}</span>
                  {off && ` · ${t("settings.notSetUp")}`}
                </span>
              </label>
            );
          })}
          {summary.languages_ready.length < 2 && (
            <p id="lang-notice" className={s.small}>
              {t(summary.languages_ready.includes("en") ? "settings.langNotSetVi" : "settings.langNotSetEn")}
            </p>
          )}
        </fieldset>
        {themeCards("g8-theme", theme, (id) => change({ theme: id }))}
        {/* Rules 1-2 force Static: Page stays visible, disabled, with the reason (3D approach §3.2). */}
        <fieldset className={s.group} aria-describedby={locked ? "mode-notice" : undefined}>
          <legend>{t("settings.view")}</legend>
          {(["page", "static"] as const).map((m) => (
            <label key={m} className={s.row}>
              <input id={`mode-${m}`} type="radio" name="mode" disabled={m === "page" && !!locked} checked={mode === m} onChange={() => change({ mode: m })} />
              <span>{t(m === "page" ? "settings.page" : "settings.static")}</span>
            </label>
          ))}
          {locked && (
            <p id="mode-notice" className={s.small}>
              {t(locked === "no3d" ? "settings.no3d" : "settings.reduceOn")}
            </p>
          )}
        </fieldset>
        <div className={s.group}>
          <label className={s.row}>
            <input id="reduce-motion" type="checkbox" checked={reduce} onChange={(event) => change({ motion: event.target.checked ? "reduce" : "full" })} />
            <span>{t("settings.motion")}</span>
          </label>
          {prefs.motion ? (
            <button type="button" className={s.secondary} onClick={() => change({ motion: undefined })}>
              {t("settings.useDevice")}
            </button>
          ) : (
            <p className={s.small}>{t("settings.usingDevice")}</p>
          )}
        </div>
        <fieldset className={s.group}>
          <legend>{t("settings.corner")}</legend>
          {(["left", "right"] as const).map((c) => (
            <label key={c} className={s.row}>
              <input id={`corner-${c}`} type="radio" name="corner" checked={corner === c} onChange={() => change({ corner: c })} />
              <span>{t(c === "left" ? "settings.left" : "settings.right")}</span>
            </label>
          ))}
        </fieldset>
        <p className={s.small} role="status">
          {t(stored ? "settings.saved" : "settings.visitOnly")}
        </p>
      </dialog>
      {prompting && (
        <dialog
          ref={promptDialog}
          className={s.sheet}
          aria-labelledby="theme-title"
          onCancel={(event) => {
            event.preventDefault();
            finishPrompt(suggested);
          }}
        >
          <div className={s.sheetHead}>
            <h2 id="theme-title">{t("theme.title")}</h2>
            <button type="button" className={s.secondary} onClick={() => finishPrompt(suggested)}>
              {t("settings.close")}
            </button>
          </div>
          {themeCards("prompt-theme", theme, (id) => {
            setPreview(id);
            setPicked(true);
          })}
          <p className={s.note16}>{t("theme.help")}</p>
          <p className={s.note16} role="status">
            {picked && !stored ? t("settings.visitOnly") : ""}
          </p>
          <div className={s.actions}>
            <button type="button" className={s.secondary} onClick={() => finishPrompt(suggested)}>
              {t("theme.skip")}
            </button>
            <button type="button" className={s.primary} onClick={() => finishPrompt(theme)}>
              {t("theme.continue")}
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
