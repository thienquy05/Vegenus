"use client";
import { type CSSProperties, type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { GuestSummary } from "@/lib/guest";
import { say, type CopyKey, type Lang } from "./copy";
import { HomeView, ListView, useOnline } from "./views";
import s from "./guest.module.css";
import "../../../themes/a_dreamy/tokens.css";
import "../../../themes/b_cosmic/tokens.css";
import "../../../themes/c_cozy/tokens.css";
import "../../../themes/d_elegant/tokens.css";

// The guest shell (T3.1b): theme, language, the circular menu (theme system §2), the sections built so far and the
// G8 Settings sheet (guest UI §9). The guest's choices live on this device only (`vegenus_prefs`).
// ponytail: one icon set for all four themes; the per-theme icon families (theme system §2) come with the scene work.
export type Section = "home" | "memories" | "guestbook";
const BUILT: Section[] = ["home", "memories", "guestbook"]; // menu order; Together (T3.1c) and Zodiac (T3.9) later
const PATHS: Record<Section, string> = { home: "/g/home", memories: "/g/memories", guestbook: "/g/wishes" };
const THEMES = ["a_dreamy", "b_cosmic", "c_cozy", "d_elegant"];

type Prefs = { lang?: Lang; theme?: string; motion?: "reduce" | "full"; corner?: "left" | "right" };
const PREFS = "vegenus_prefs";
const REDUCE = "(prefers-reduced-motion: reduce)";
const noop = () => () => {};
const watchMotion = (onChange: () => void) => {
  const media = matchMedia(REDUCE);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};
// Only values this build knows: anything else saved on the device is ignored.
function readPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS) ?? "{}") ?? {};
    return {
      lang: ["en", "vi"].includes(raw.lang) ? raw.lang : undefined,
      theme: THEMES.includes(raw.theme) ? raw.theme : undefined,
      motion: ["reduce", "full"].includes(raw.motion) ? raw.motion : undefined,
      corner: ["left", "right"].includes(raw.corner) ? raw.corner : undefined,
    };
  } catch {
    return {};
  }
}
function canStore() {
  try {
    localStorage.setItem(`${PREFS}_probe`, "1");
    localStorage.removeItem(`${PREFS}_probe`);
    return true;
  } catch {
    return false;
  }
}
const overlap = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const ICONS: Record<Section | "settings", ReactNode> = {
  home: <path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" />,
  memories: <path d="M4 6h16v13H4zM4 15l5-5 4 4 3-3 4 4" />,
  guestbook: <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />,
  settings: <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" />,
};
const icon = (name: Section | "settings") => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
    {ICONS[name]}
  </svg>
);

export function GuestApp({ summary, section: initial, token, children }: { summary: GuestSummary; section: Section; token?: string; children?: ReactNode }) {
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

  // localStorage exists only in the browser: the server renders an empty shell and nothing themed flashes; until
  // the guest changes something, the saved choices are read as they are.
  const browser = useSyncExternalStore(noop, () => true, () => false);
  const systemReduce = useSyncExternalStore(watchMotion, () => matchMedia(REDUCE).matches, () => false);
  const prefs = changed ?? (browser ? readPrefs() : null);
  const ready = prefs !== null;

  const lang: Lang = prefs?.lang ?? summary.default_lang;
  const theme = [prefs?.theme, summary.theme].find((x) => x && THEMES.includes(x)) ?? "a_dreamy";
  const reduce = prefs?.motion ? prefs.motion === "reduce" : systemReduce;
  const corner = prefs?.corner ?? "left";
  const t = (key: CopyKey, vars?: Record<string, string | number>) => say(key, lang, vars);
  const online = useOnline();
  const onGone = useCallback(() => setGone(true), []);
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
  }, [ready, theme, lang, reduce]);

  const change = (next: Prefs) => {
    const merged = { ...prefs, ...next };
    setChanged(merged);
    try {
      localStorage.setItem(PREFS, JSON.stringify(merged));
      setStored(true);
    } catch {
      setStored(false);
    }
  };

  // Back and forward between sections, when the address follows them (not in a visit run from memory).
  useEffect(() => {
    if (token) return;
    const back = () => {
      const found = BUILT.find((x) => PATHS[x] === location.pathname);
      if (found) setSection(found);
    };
    addEventListener("popstate", back);
    return () => removeEventListener("popstate", back);
  }, [token]);

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
    setVisits((n) => n + 1); // choosing the section already shown still moves focus to its heading
    if (!token && location.pathname !== PATHS[next]) history.pushState(null, "", PATHS[next]);
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
        hidden={settingsOpen}
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
          {children}
          {!online && <p role="status">{t("state.offline")}</p>}
          {section === "home" ? (
            <HomeView summary={summary} lang={lang} token={token} t={t} onGone={onGone} />
          ) : (
            <ListView key={section} section={section} summary={summary} lang={lang} token={token} t={t} onGone={onGone} />
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
        <fieldset className={s.group}>
          <legend>{t("settings.language")}</legend>
          {(["en", "vi"] as const).map((l) => (
            <label key={l} className={s.row}>
              <input id={`lang-${l}`} type="radio" name="lang" checked={lang === l} onChange={() => change({ lang: l })} />
              <span lang={l}>{l === "en" ? "English" : "Tiếng Việt"}</span>
            </label>
          ))}
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
    </div>
  );
}
