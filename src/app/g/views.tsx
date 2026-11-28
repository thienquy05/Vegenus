"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent, type FormEvent } from "react";
import { counter } from "@/lib/home";
import type { Cred, GuestMediaRef, GuestSummary, GuestVariant } from "@/lib/guest";
import { PRIVACY } from "@/lib/privacy";
import { PrivacyNotice } from "../privacy/notice";
import p from "../privacy/privacy.module.css";
import { pickLang, type CopyKey, type Lang } from "./copy";
import s from "./guest.module.css";

type T = (key: CopyKey, vars?: Record<string, string | number>) => string;
type Props = { summary: GuestSummary; lang: Lang; cred?: Cred; t: T; onGone: () => void };
// Where the views live: /g for a guest, /p/<name> for a visitor of a Published page (T3.1pc).
export const baseOf = (cred?: Cred) => (typeof cred === "object" ? `/p/${cred.page}` : "/g");

// Every guest read: the token cookie goes by itself; a visit run from memory (cookies blocked, E30) sends the token.
// A 404 is the not-available answer: the token no longer opens the page (token flow §6).
export class Gone extends Error {}
export class NotFound extends Error {} // the item is gone while the page and section still open
const send = (path: string, body: object, cred?: Cred) =>
  fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-vegenus-guest": "1" },
    body: JSON.stringify(cred === undefined ? body : typeof cred === "string" ? { ...body, token: cred } : { ...body, page: cred.page }),
  });
async function guestPost<R>(path: string, body: object, cred?: Cred): Promise<R> {
  const res = await send(path, body, cred);
  if (res.status === 404) throw (await res.json().catch(() => null))?.error === "not_found" ? new NotFound() : new Gone();
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

const watchOnline = (onChange: () => void) => {
  addEventListener("online", onChange);
  addEventListener("offline", onChange);
  return () => {
    removeEventListener("online", onChange);
    removeEventListener("offline", onChange);
  };
};
export const useOnline = () => useSyncExternalStore(watchOnline, () => navigator.onLine, () => true);

const MEDIA_IDS = 100; // the media route's limit per request
const RESIGN_MS = 240_000; // signed URLs last 5 minutes (Q29); one older than 4 is signed again when it fails

// Signed URLs for media ids (T3.1a). Each id is signed once, in requests of at most 100; refresh() signs again the ids
// whose URLs are about to expire, so a guest who stays past 5 minutes still gets photos. A failure leaves photos out.
function useMedia(ids: string[], variant: GuestVariant, cred: Cred | undefined, onGone: () => void) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const asked = useRef(new Map<string, number>());
  const [online, setOnline] = useState(0); // counts reconnections: ids whose signing failed are asked again
  const ask = useCallback(
    (want: string[]) => {
      for (let i = 0; i < want.length; i += MEDIA_IDS) {
        const chunk = want.slice(i, i + MEDIA_IDS);
        const at = Date.now();
        for (const id of chunk) asked.current.set(id, at);
        guestPost<{ urls: Record<string, string> }>("/api/guest/media", { ids: chunk, variant }, cred)
          .then((r) => setUrls((old) => ({ ...old, ...r.urls })))
          .catch((error) => {
            for (const id of chunk) asked.current.delete(id);
            if (error instanceof Gone) onGone();
          });
      }
    },
    [variant, cred, onGone],
  );
  const key = ids.join(",");
  useEffect(() => {
    const want = key ? key.split(",").filter((id) => !asked.current.has(id)) : [];
    if (want.length) ask(want);
  }, [key, ask, online]);
  useEffect(() => {
    const back = () => setOnline((n) => n + 1);
    addEventListener("online", back);
    return () => removeEventListener("online", back);
  }, []);
  const refresh = () => {
    const old = [...asked.current].filter(([, at]) => Date.now() - at >= RESIGN_MS).map(([id]) => id);
    if (old.length) ask(old);
  };
  const retry = () => setOnline((n) => n + 1); // asks again for ids whose signing failed, like a reconnection
  return { urls, refresh, retry };
}

// The couple's published wording in the shown language, else the other one, with its tokens filled.
function wordText({ summary, lang }: Pick<Props, "summary" | "lang">, key: string, vars: Record<string, string | number> = {}) {
  const entry = summary.copy[key] ?? {};
  const found = pickLang(lang, [["en", entry.en], ["vi", entry.vi]]);
  if (!found) return null;
  const all = { partner_a: summary.names[0] ?? "", partner_b: summary.names[1] ?? "", ...vars };
  return { lang: found.lang, text: Object.entries(all).reduce((x, [name, value]) => x.replaceAll(`{${name}}`, String(value)), found.text) };
}
function wording(props: Props, key: string, vars: Record<string, string | number> = {}) {
  const found = wordText(props, key, vars);
  return found && <p lang={found.lang}>{found.text}</p>;
}

const altOf = (m: GuestMediaRef, lang: Lang) => pickLang(lang, [[m.lang, m.alt], [m.lang_alt, m.alt_alt]]);

// G1 (screens G1; owner UI "Guest Home states"): the couple title and greeting always; photos, note and counter only
// from a published Home, which shows the fixed notices (Q83) where it has no photo or no note. A future start date
// shows no counter. Shortcuts are plain links to the enabled sections, opened like the menu does.
export type Shortcut = { name: "memories" | "together" | "guestbook"; href: string };
export function HomeView(props: Props & { shortcuts: Shortcut[]; onGo: (name: Shortcut["name"]) => void }) {
  const { summary, lang, cred, t, onGone, shortcuts, onGo } = props;
  const word = (key: string, vars?: Record<string, string | number>) => wording(props, key, vars);
  const home = summary.home;
  const picks = home?.picks ?? [];
  const { urls, refresh } = useMedia(picks.map((p) => p.id), "display", cred, onGone);
  const [shown, setShown] = useState(0);
  const note = home && pickLang(lang, [[home.lang, home.body], [home.lang_alt, home.body_alt]]);
  const count = home ? counter(home.start_date, summary.timezone) : null;
  const pick = picks[shown % Math.max(picks.length, 1)];
  const alt = pick && altOf(pick, lang);
  const step = (by: number) => setShown((n) => (n + by + picks.length) % picks.length);
  return (
    <div className={s.home}>
      <header className={s.homeHead}>
        <h1 tabIndex={-1}>{summary.names.filter(Boolean).join(" & ")}</h1>
        {word("home.greeting")}
      </header>
      {pick && (
        <figure className={s.stackWrap}>
          <button id="photo-stack" type="button" className={s.stack} aria-label={urls[pick.id] && alt?.text ? undefined : t("home.photo", { n: (shown % picks.length) + 1, total: picks.length })} onClick={() => step(1)}>
            {urls[pick.id] ? (
              // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL; the image optimizer would cache it
              <img src={urls[pick.id]} alt={alt?.text ?? ""} lang={alt?.lang} width={pick.width ?? undefined} height={pick.height ?? undefined} onError={refresh} />
            ) : (
              <span className={s.photoSlot} style={{ aspectRatio: `${pick.width ?? 4} / ${pick.height ?? 3}` }} />
            )}
          </button>
          <div className={s.stackControls}>
            {picks.length > 1 && (
              <button type="button" className={s.secondary} aria-label={t("home.prev")} onClick={() => step(-1)}>
                ‹
              </button>
            )}
            <p id="photo-count" className={s.small} role="status">
              {t("home.photo", { n: (shown % picks.length) + 1, total: picks.length })}
            </p>
            {picks.length > 1 && (
              <button type="button" className={s.secondary} aria-label={t("home.next")} onClick={() => step(1)}>
                ›
              </button>
            )}
          </div>
          <figcaption className={s.small}>{word("home.photoHint")}</figcaption>
        </figure>
      )}
      {home && !pick && <p className={s.small}>{t("home.noPhotos")}</p>}
      {home && (
        <section className={s.note}>
          {note ? <p lang={note.lang}>{note.text}</p> : <p className={s.small}>{t("home.noNote")}</p>}
          {count?.kind === "day" && word("home.days", { days: count.days })}
        </section>
      )}
      {shortcuts.length > 0 && (
        <nav aria-label={t("home.shortcuts")} className={s.shortcuts}>
          {shortcuts.map((x) => (
            <a key={x.name} href={x.href} onClick={(event) => { event.preventDefault(); onGo(x.name); }}>
              {t(`nav.${x.name}`)}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}

type Item = {
  id: string; lang: Lang; title: string | null; lang_alt: Lang | null; title_alt: string | null;
  body: string | null; body_alt: string | null;
  event_date: string | null; date_precision: "day" | "month" | "year" | null; sort_order: number;
  media: (GuestMediaRef & { kind: string })[] | null;
};
type Entry = { id: string; display_name: string; body: string; lang: Lang; created_at: string };
type Row = Item | Entry;
const PAGE = 50; // the database's page size (list_items, list_entries)

function guestDate(date: string, precision: "day" | "month" | "year", lang: Lang) {
  const parts = precision === "day" ? { day: "numeric", month: "long", year: "numeric" } : precision === "month" ? { month: "long", year: "numeric" } : { year: "numeric" };
  return new Intl.DateTimeFormat(lang === "vi" ? "vi-VN" : "en-GB", { ...(parts as Intl.DateTimeFormatOptions), timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

// G2 Memories and G5 Wishes (with Leave a wish, G6, since T3.2b): newest page first, Load more after a
// full page, a failure keeps what is loaded and offers Try again (guest UI §6 common states, §7). The footer button
// stays in place while it reads, so focus stays on it; when it goes, focus moves to the first new card, else the heading.
// shortcut: {count} in the intro is the number loaded so far (exact up to 50); a server total when a page needs more.
// Accents and case aside, so "ca phe" finds "Cà phê" (G4 search).
const fold = (x: string) => x.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase();

export function ListView(props: Props & { section: "memories" | "together" | "guestbook"; onOpen?: (id: string) => void }) {
  const { section, lang, cred, t, onGone, onOpen } = props;
  const word = (key: string, vars?: Record<string, string | number>) => wording(props, key, vars);
  const online = useOnline();
  const wishes = section === "guestbook";
  const together = section === "together";
  const copyKey = wishes ? "wishes" : section; // the editable wording's prefix (editable copy §3)
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null); // the place shown in the sheet
  const [rows, setRows] = useState<Row[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [more, setMore] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [asking, setAsking] = useState(false); // a click is being answered: its button stays in place
  const clicked = useRef(false);
  const firstNew = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const [writing, setWriting] = useState(false); // G6 open
  const [draft, setDraft] = useState(NO_DRAFT); // kept in memory while the sheet is closed by View the wishes
  const wishButton = useRef<HTMLButtonElement>(null);
  const wasWriting = useRef(false);
  // The sheet gives focus back to Leave a wish once it is gone (it is inert while the sheet is open).
  useEffect(() => {
    if (wasWriting.current && !writing) wishButton.current?.focus();
    wasWriting.current = writing;
  }, [writing]);
  const leave = wordText(props, "wishes.button");

  useEffect(() => {
    let live = true;
    const last = rows.at(-1);
    const after = !last || attempt === 0 ? undefined : wishes ? { created_at: (last as Entry).created_at, id: last.id } : { sort: (last as Item).sort_order, id: last.id };
    const read = wishes
      ? guestPost<{ entries: Entry[] }>("/api/guest/wishes", after ? { after } : {}, cred).then((r) => r.entries)
      : guestPost<{ items: Item[] }>("/api/guest/list", after ? { section, after } : { section }, cred).then((r) => r.items);
    read
      .then((page) => {
        if (!live) return;
        firstNew.current = page.length ? (after ? rows.length : 0) : null;
        setRows((old) => (after ? [...old, ...page] : page));
        setMore(page.length === PAGE);
        setState("ready");
        setAsking(false);
        if (wishes && after) {
          // Cleared first, so two loads of the same size are both announced.
          setAnnounce("");
          setTimeout(() => live && setAnnounce(t("wishes.loaded", { n: page.length })), 50);
        }
      })
      .catch((error) => {
        if (!live) return;
        setAsking(false);
        if (error instanceof Gone) onGone();
        else setState("error");
      });
    return () => {
      live = false;
    };
    // attempt drives every read: the first one, Load more and Try again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // After a click whose button is gone (last page, or a retry that worked), focus goes on, not to the page.
  useEffect(() => {
    if (!clicked.current || state === "loading") return;
    if (more || state === "error") return void (clicked.current = false);
    clicked.current = false;
    const target = firstNew.current === null ? root.current?.querySelector("h1") : root.current?.querySelectorAll("li > :first-child")[firstNew.current];
    (target as HTMLElement | null | undefined)?.focus();
  }, [state, more]);

  const { urls: thumbs, refresh: rethumb } = useMedia(wishes ? [] : (rows as Item[]).flatMap((r) => r.media?.find((m) => m.kind === "photo")?.id ?? []), "thumb", cred, onGone);
  const next = () => {
    if (state === "loading") return;
    clicked.current = true;
    setAsking(true);
    setState("loading");
    setAttempt((n) => n + 1); // with rows loaded this reads the page after the last one, else the first page again
  };
  const q = fold(query.trim());
  const shown = together && q ? (rows as Item[]).filter((r) => [r.title, r.title_alt].some((x) => x && fold(x).includes(q))) : rows;
  const at = together && open ? (shown as Item[]).findIndex((r) => r.id === open) : -1;
  // The sheet closes on its place's card, so focus goes back where the guest was (guest UI §5 test 3).
  const closeSheet = () => {
    const id = open;
    setOpen(null);
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-place="${id}"]`)?.focus());
  };
  const footer = state === "error" || more || asking;
  const label = more ? t("list.more") : t("state.retry");

  return (
    <div className={s.section} ref={root}>
      <header>
        <h1 tabIndex={-1}>{t(`nav.${section}`)}</h1>
        {(rows.length > 0 || state === "ready") && word(`${copyKey}.intro`, { count: rows.length })}
        {wishes && (
          <button ref={wishButton} type="button" className={s.primary} lang={leave?.lang} onClick={() => setWriting(true)}>
            {leave?.text ?? t("wish.leave")}
          </button>
        )}
        {together && rows.length > 0 && <p className={s.small}>{rows.length === 1 ? t("together.one") : t("together.count", { n: rows.length })}</p>}
        {together && rows.length > 0 && (
          <label className={s.search}>
            <span className={s.visuallyHidden}>{t("together.search")}</span>
            <input type="search" value={query} placeholder={t("together.search")} onChange={(event) => setQuery(event.target.value)} />
          </label>
        )}
      </header>
      {state === "ready" && rows.length === 0 && word(`${copyKey}.empty`)}
      {together && <p role="status">{rows.length > 0 && shown.length === 0 ? t("together.noMatch") : ""}</p>}
      <ul className={s.cards}>
        {shown.map((row) => (
          <li key={row.id}>
            {together ? (
              <PlaceCard item={row as Item} url={thumbs} onExpired={rethumb} lang={lang} onOpen={() => setOpen(row.id)} />
            ) : "display_name" in row ? (
              <article className={s.card} tabIndex={-1}>
                <h2 className={s.cardTitle}>{row.display_name}</h2>
                <p lang={row.lang}>{row.body}</p>
              </article>
            ) : (
              <a
                className={s.cardLink}
                href={`${baseOf(cred)}/memories/${row.id}`}
                aria-labelledby={`card-${row.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  onOpen?.(row.id);
                }}
              >
                <MemoryCard item={row} url={thumbs} onExpired={rethumb} lang={lang} />
              </a>
            )}
          </li>
        ))}
      </ul>
      {state === "loading" && <p role="status">{t("state.loading")}</p>}
      {state === "error" && online && <p role="alert">{t("state.readFailed")}</p>}
      {footer && (
        <button type="button" className={s.secondary} aria-disabled={state === "loading" || undefined} onClick={next}>
          {label}
        </button>
      )}
      <p className={s.visuallyHidden} role="status">
        {announce}
      </p>
      {at >= 0 && (
        <PlaceSheet
          item={(shown as Item[])[at]}
          lang={lang}
          cred={cred}
          t={t}
          onGone={onGone}
          count={shown.length}
          onStep={(by) => setOpen((shown as Item[])[(at + by + shown.length) % shown.length].id)}
          onClose={closeSheet}
        />
      )}
      {writing && (
        <WishSheet
          {...props}
          draft={draft}
          setDraft={setDraft}
          onClose={(keep) => {
            if (!keep) setDraft(NO_DRAFT);
            setWriting(false);
          }}
        />
      )}
    </div>
  );
}

// G6 Leave a wish and G7 sent (guest UI §8; T3.2b). One submission_id per composed wish: sending again after an
// uncertain answer reuses it, so the server answers the first result and counts it once (Q73); any edit makes a new
// wish. Nothing is resent by itself and nothing is stored on the device.
type Draft = { name: string; body: string; sub: string | null };
const NO_DRAFT: Draft = { name: "", body: "", sub: null };
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const lines = (text: string) => text.replace(/\r\n?/g, "\n"); // as the server stores line breaks
// What the server counts (Q73): line breaks as one, NFC, trimmed, in user-perceived characters.
const perceived = (text: string) => [...graphemes.segment(lines(text).normalize("NFC").trim())].length;
// What wish_text refuses (controls, bidi controls, line separators); a line break only in the wish.
const REFUSED = /[\0-\x09\x0b-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069\u2028\u2029]/;
const FIELDS = {
  name: { cap: 40, required: "wish.nameRequired", long: "wish.nameLong" },
  body: { cap: 500, required: "wish.bodyRequired", long: "wish.bodyLong" },
} as const;
type Field = keyof typeof FIELDS;
const problemOf = (field: Field, value: string): CopyKey | undefined => {
  const n = perceived(value);
  const text = lines(value);
  if (n === 0) return FIELDS[field].required;
  const kept = text.trim(); // wish_text trims exactly this set (JavaScript's \s) before it checks
  if (REFUSED.test(kept) || (field === "name" && kept.includes("\n"))) return "wish.characters";
  return n > FIELDS[field].cap ? FIELDS[field].long : undefined;
};

function WishSheet(props: Props & { draft: Draft; setDraft: (draft: Draft) => void; onClose: (keep: boolean) => void }) {
  const { summary, lang, cred, t, onGone, draft, setDraft, onClose } = props;
  const online = useOnline();
  const dialog = useRef<HTMLDialogElement>(null);
  const [panel, setPanel] = useState<"form" | "discard" | "sent">("form");
  const [errors, setErrors] = useState<Partial<Record<Field, CopyKey>>>({});
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<CopyKey | null>(null);
  const [limit, setLimit] = useState<{ now: number; wait: number; shared: boolean } | null>(null);
  // T3.2c consent (privacy design §4.1): each wish its own, never remembered; P1 opens stacked over the form.
  const [agreed, setAgreed] = useState(false);
  const [consentError, setConsentError] = useState<CopyKey | null>(null);
  const [reading, setReading] = useState(false);
  const focusTo = useRef<string | null>("#wish-name"); // where focus goes once the next render is in
  const live = useRef(true); // a late answer after the sheet is gone never touches a newer draft
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);
  useEffect(() => {
    if (!focusTo.current) return;
    dialog.current?.querySelector<HTMLElement>(focusTo.current)?.focus();
    focusTo.current = null;
  });
  const show = (next: typeof panel, focus: string) => {
    focusTo.current = focus;
    setPanel(next);
  };
  const close = () => {
    if (panel === "discard") show("form", "#wish-body");
    else if (panel === "form" && (draft.name.trim() || draft.body.trim())) show("discard", "[data-keep]");
    else onClose(false);
  };
  const edit = (field: Field, value: string) => {
    setDraft({ ...draft, [field]: value, sub: null });
    setErrors((old) => ({ ...old, [field]: undefined }));
    setProblem(null);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (sending || !online) return;
    const found = { name: problemOf("name", draft.name), body: problemOf("body", draft.body) };
    setErrors(found);
    setConsentError(agreed ? null : "wish.consentRequired");
    const first = found.name ? "#wish-name" : found.body ? "#wish-body" : agreed ? null : "#wish-consent";
    if (first) return dialog.current?.querySelector<HTMLElement>(first)?.focus();
    const sub = draft.sub ?? crypto.randomUUID();
    setDraft({ ...draft, sub });
    setSending(true);
    setProblem(null);
    let res: Response;
    try {
      res = await send("/api/guest/wish", { submission_id: sub, display_name: draft.name, body: draft.body, lang, consent: PRIVACY.version }, cred);
    } catch {
      if (!live.current) return;
      setSending(false);
      return setProblem("wish.uncertain");
    }
    const r = await res.json().catch(() => null);
    if (!live.current) return;
    setSending(false);
    // G7 only for the server's own "sent"; any other success shape is unconfirmed.
    if (res.ok) {
      if (r?.status !== "sent") return setProblem("wish.uncertain");
      setDraft(NO_DRAFT);
      return show("sent", "h2");
    }
    if (res.status === 404) return onGone();
    if (res.status === 409 && r?.error === "needs_consent") {
      // The notice changed while the form was open: nothing was stored or counted; tick again (privacy design §4.1).
      focusTo.current = "#wish-consent";
      setAgreed(false);
      return setConsentError("wish.consentAgain");
    }
    // A 429 without a wait is not ours (a platform limit): nothing was stored.
    if (res.status === 429 && Number(r?.retry_after) > 0) return setLimit({ now: Date.now(), wait: Number(r.retry_after), shared: r.shared === true });
    if (res.status === 429) return setProblem("wish.notSent");
    // A refused request stored nothing; anything else (503, a proxy error) may have.
    setProblem(res.status === 400 || res.status === 403 ? "wish.notSent" : "wish.uncertain");
  };
  const leave = wordText(props, "wishes.button");
  const owner = summary.names.filter(Boolean).join(" & ");
  const sent = wordText(props, "wishes.sent");
  const sentBody = wordText(props, "wishes.sentBody", { owner });
  const back = wordText(props, "wishes.back");
  const field = (name: Field, label: CopyKey, placeholder: string) => {
    const n = perceived(draft[name]);
    const id = `wish-${name}`;
    const Tag = name === "name" ? "input" : "textarea";
    return (
      <div className={s.field}>
        <label htmlFor={id}>{t(label)}</label>
        <Tag
          id={id}
          value={draft[name]}
          placeholder={wordText(props, placeholder)?.text}
          autoComplete={name === "name" ? "nickname" : "off"}
          readOnly={sending}
          aria-required="true"
          aria-invalid={errors[name] ? true : undefined}
          aria-describedby={`${id}-error ${id}-count`}
          onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => edit(name, event.target.value)}
        />
        <span id={`${id}-count`} className={s.small}>
          {n}/{FIELDS[name].cap}
        </span>
        {errors[name] && (
          <p id={`${id}-error`} className={s.error}>
            {t(errors[name])}
          </p>
        )}
      </div>
    );
  };
  const sheet = (
    <dialog
      ref={dialog}
      className={s.sheet}
      aria-labelledby="wish-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      // The browser may close it without asking (a second back gesture): keep the draft and let it open again.
      onClose={() => onClose(true)}
    >
      <div className={s.sheetHead}>
        <h2 id="wish-title" tabIndex={-1} lang={(panel === "sent" ? sent : leave)?.lang}>
          {panel === "sent" ? (sent?.text ?? t("wish.sent")) : (leave?.text ?? t("wish.leave"))}
        </h2>
        <button type="button" className={s.secondary} onClick={close}>
          {t("settings.close")}
        </button>
      </div>
      {panel === "sent" && (
        <>
          <p lang={sentBody?.lang}>{sentBody?.text ?? t("wish.sentBody", { owner })}</p>
          <button type="button" className={s.primary} lang={back?.lang} onClick={() => onClose(false)}>
            {back?.text ?? t("wish.back")}
          </button>
        </>
      )}
      {panel === "discard" && (
        <>
          <p>{t("wish.discardText")}</p>
          <div className={s.actions}>
            <button type="button" className={s.primary} data-keep onClick={() => show("form", "#wish-body")}>
              {t("wish.keep")}
            </button>
            <button type="button" className={s.secondary} onClick={() => onClose(false)}>
              {t("wish.discard")}
            </button>
          </div>
        </>
      )}
      {panel === "form" && (
        <form className={s.wishForm} noValidate onSubmit={submit}>
          {field("name", "wish.name", "wishes.namePlaceholder")}
          {field("body", "wish.body", "wishes.messagePlaceholder")}
          <div className={s.field}>
            <label className={s.consent}>
              <input
                type="checkbox"
                id="wish-consent"
                checked={agreed}
                aria-invalid={consentError ? true : undefined}
                aria-describedby="wish-consent-error"
                onChange={(event) => {
                  if (sending) return;
                  setAgreed(event.target.checked);
                  setConsentError(null);
                }}
              />
              <span>{t("wish.consent", { owner })}</span>{" "}
              {/* Inside the label but interactive, so it opens P1 without toggling the box. */}
              <a
                href="/privacy"
                onClick={(event) => {
                  event.preventDefault();
                  setReading(true);
                }}
              >
                {t("wish.consentLink")}
              </a>
            </label>
            {consentError && (
              <p id="wish-consent-error" className={s.error}>
                {t(consentError)}
              </p>
            )}
          </div>
          <p className={s.small}>{t("wish.privacy")}</p>
          {!online && <p role="status">{t("wish.offline")}</p>}
          {problem && <p role="alert">{t(problem)}</p>}
          <button type="submit" className={s.primary} aria-disabled={sending || !online || undefined}>
            {t(sending ? "wish.sending" : "wish.send")}
          </button>
        </form>
      )}
      {limit && (
        <LimitNotice
          {...limit}
          lang={lang}
          t={t}
          onOk={() => {
            focusTo.current = "[type=submit], [data-keep]"; // the form, or the discard question if Close came first
            setLimit(null);
          }}
          onView={() => onClose(true)}
        />
      )}
    </dialog>
  );
  return (
    <>
      {sheet}
      {reading && (
        <NoticeSheet
          lang={lang}
          t={t}
          onClose={() => {
            focusTo.current = "a[href='/privacy']"; // back to the link, the draft and the box as they were
            setReading(false);
          }}
        />
      )}
    </>
  );
}

// P1 stacked over G6 in the page's theme (privacy design §3.1): Close and Escape return to the form. One way out
// (owner, 2026-11-28): Back and Close would do the same here.
function NoticeSheet({ lang, t, onClose }: { lang: Lang; t: T; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={p.sheet}
      aria-labelledby="privacy-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <div className={p.sheetHead}>
        <button type="button" className={s.secondary} onClick={onClose}>
          {t("settings.close")}
        </button>
      </div>
      <PrivacyNotice lang={lang} level={2} />
    </dialog>
  );
}

// The daily-limit notice (canvas page 14, Q75): kind wording and the exact come-back time from the latest-expiring
// exceeded limit, no rule numbers; the shared-network line when the IP limit was the one reached (Q78).
function LimitNotice(props: { now: number; wait: number; shared: boolean; lang: Lang; t: T; onOk: () => void; onView: () => void }) {
  const { now, wait, shared, lang, t, onOk, onView } = props;
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);
  const until = new Date(Math.ceil((now + wait * 1000) / 60_000) * 60_000); // rounded up: never a minute too early
  const time = until.toLocaleTimeString(lang === "vi" ? "vi-VN" : "en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const minutes = Math.ceil(wait / 60);
  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      className={s.sheet}
      aria-labelledby="limit-title"
      aria-describedby="limit-description limit-return"
      // React passes these up to the sheet's own handlers: stop them, so one Escape closes the notice only.
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOk();
      }}
      onClose={(event) => {
        event.stopPropagation();
        onOk();
      }}
    >
      <h2 id="limit-title">{t("limit.title")}</h2>
      <p id="limit-description">{t(shared ? "limit.textShared" : "limit.text")}</p>
      <p id="limit-return">{t(until.toDateString() === new Date(now).toDateString() ? "limit.at" : "limit.atNextDay", { time })}</p>
      <p className={s.small}>{t("limit.in", { h: Math.floor(minutes / 60), m: minutes % 60 })}</p>
      {shared && <p>{t("limit.shared")}</p>}
      <div className={s.actions}>
        <button type="button" className={s.primary} onClick={onOk}>
          {t("limit.ok")}
        </button>
        <button type="button" className={s.secondary} onClick={onView}>
          {t("limit.view")}
        </button>
      </div>
    </dialog>
  );
}

function MemoryCard({ item, url, onExpired, lang }: { item: Item; url: Record<string, string>; onExpired: () => void; lang: Lang }) {
  const title = pickLang(lang, [[item.lang, item.title], [item.lang_alt, item.title_alt]]);
  const photo = item.media?.find((m) => m.kind === "photo");
  const alt = photo && pickLang(lang, [[item.lang, photo.alt], [item.lang_alt, photo.alt_alt]]);
  return (
    // The id names the card's link (aria-labelledby): Chromium does not name a link from an article inside it.
    <article className={s.card} id={`card-${item.id}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL; the image optimizer would cache it */}
      {photo && url[photo.id] && <img className={s.thumb} src={url[photo.id]} alt={alt?.text ?? ""} lang={alt?.lang} width={photo.width ?? undefined} height={photo.height ?? undefined} onError={onExpired} />}
      {title && (
        <h2 className={s.cardTitle} lang={title.lang}>
          {title.text}
        </h2>
      )}
      {item.event_date && item.date_precision && <p className={s.small}>{guestDate(item.event_date, item.date_precision, lang)}</p>}
    </article>
  );
}

function PlaceCard({ item, url, onExpired, lang, onOpen }: { item: Item; url: Record<string, string>; onExpired: () => void; lang: Lang; onOpen: () => void }) {
  const title = pickLang(lang, [[item.lang, item.title], [item.lang_alt, item.title_alt]]);
  const photo = item.media?.find((m) => m.kind === "photo");
  return (
    <button type="button" className={`${s.card} ${s.placeCard}`} data-place={item.id} onClick={onOpen}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL; the image optimizer would cache it */}
      {photo && url[photo.id] && <img className={s.thumb} src={url[photo.id]} alt="" width={photo.width ?? undefined} height={photo.height ?? undefined} onError={onExpired} />}
      {title && (
        <span className={s.cardTitle} lang={title.lang}>
          {title.text}
        </span>
      )}
      {item.event_date && item.date_precision && <span className={s.small}>{guestDate(item.event_date, item.date_precision, lang)}</span>}
    </button>
  );
}

// G4 place sheet (Phase 3, Q150): a native modal; focus on its heading; previous and next wrap; Escape and Close return
// focus to the place's card. The page's menu button hides under it (Q68, guest.module.css).
function PlaceSheet(props: { item: Item; count: number; lang: Lang; cred?: Cred; t: T; onGone: () => void; onStep: (by: number) => void; onClose: () => void }) {
  const { item, count, lang, cred, t, onGone, onStep, onClose } = props;
  const dialog = useRef<HTMLDialogElement>(null);
  const photo = item.media?.find((m) => m.kind === "photo");
  const { urls, refresh } = useMedia(photo ? [photo.id] : [], "display", cred, onGone);
  const title = pickLang(lang, [[item.lang, item.title], [item.lang_alt, item.title_alt]]);
  const note = pickLang(lang, [[item.lang, item.body], [item.lang_alt, item.body_alt]]);
  const alt = photo && pickLang(lang, [[item.lang, photo.alt], [item.lang_alt, photo.alt_alt]]);
  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    d?.querySelector<HTMLElement>("h2")?.focus();
  }, [item.id]);
  return (
    <dialog
      ref={dialog}
      className={s.sheet}
      aria-labelledby="place-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className={s.sheetHead}>
        <h2 id="place-title" tabIndex={-1} lang={title?.lang}>
          {title?.text}
        </h2>
        <button type="button" className={s.secondary} onClick={onClose}>
          {t("settings.close")}
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL; the image optimizer would cache it */}
      {photo && urls[photo.id] && <img className={s.sheetPhoto} src={urls[photo.id]} alt={alt?.text ?? ""} lang={alt?.lang} width={photo.width ?? undefined} height={photo.height ?? undefined} onError={refresh} />}
      {item.event_date && item.date_precision && <p className={s.small}>{guestDate(item.event_date, item.date_precision, lang)}</p>}
      {[title, note].some((x) => x && x.lang !== lang) && <p className={s.small}>{t("detail.original")}</p>}
      {note && <p lang={note.lang}>{note.text}</p>}
      {count > 1 && (
        <div className={s.actions}>
          <button type="button" className={s.secondary} aria-label={t("together.prev")} onClick={() => onStep(-1)}>
            ‹
          </button>
          <button type="button" className={s.secondary} aria-label={t("together.next")} onClick={() => onStep(1)}>
            ›
          </button>
        </div>
      )}
    </dialog>
  );
}

type Page = { k: "open" } | { k: "msg" } | { k: "ph"; from: number; photos: (GuestMediaRef & { kind: string })[] } | { k: "vid" };
const PER_PAGE = 4; // photos on a photo page after the cover (approved album, phone)

// G3 memory album (screens G3; T3.1c): the opening page with the cover, the message with its voice note, photo pages,
// the video page. Previous and next keep focus on their buttons; the page label opens the contents; a photo opens the
// viewer, whose Escape returns focus to that photo. Video and voice are signed only when played (G2 -> G3 rule 2).
// shortcut: one page at a time at every size and no page-turn effect; the laptop spread and the turn come with the
// motion work.
export function AlbumView(props: Props & { id: string; onBack: () => void }) {
  const { id, lang, cred, t, onGone, onBack } = props;
  const [item, setItem] = useState<Item | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(0);
  const [contents, setContents] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [viewing, setViewing] = useState<number | null>(null);
  const [playVideo, setPlayVideo] = useState(false);
  const [playVoice, setPlayVoice] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const label = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    guestPost<{ item: Item }>("/api/guest/item", { id }, cred)
      .then((r) => {
        if (!live) return;
        setItem(r.item);
        setState("ready");
      })
      .catch((error) => {
        if (!live) return;
        if (error instanceof Gone) onGone();
        else setState(error instanceof NotFound ? "missing" : "error");
      });
    return () => {
      live = false;
    };
  }, [id, cred, onGone, attempt]);

  // The heading (or the gone notice) takes focus once there is something to read (guest UI §5).
  useEffect(() => {
    if (state === "ready" || state === "missing") root.current?.querySelector<HTMLElement>("h1")?.focus();
  }, [state]);

  const all = item?.media ?? [];
  const photos = all.filter((m) => m.kind === "photo");
  const video = all.find((m) => m.kind === "video");
  const voice = all.find((m) => m.kind === "audio");
  const { urls: shown, refresh: reshown } = useMedia(photos.map((m) => m.id), "display", cred, onGone);
  const { urls: poster, refresh: reposter } = useMedia(video ? [video.id] : [], "poster", cred, onGone);
  const { urls: videoUrl, refresh: revideo, retry: retryVideo } = useMedia(playVideo && video ? [video.id] : [], "video", cred, onGone);
  const { urls: voiceUrl, refresh: revoice, retry: retryVoice } = useMedia(playVoice && voice ? [voice.id] : [], "audio", cred, onGone);

  const back = (
    <a className={s.back} href={`${baseOf(cred)}/memories`} onClick={(event) => { event.preventDefault(); onBack(); }}>
      {t("detail.back")}
    </a>
  );
  if (state !== "ready" || !item)
    return (
      <div className={s.section} ref={root}>
        {state === "loading" && <p role="status">{t("state.loading")}</p>}
        {state === "missing" && <h1 tabIndex={-1}>{t("detail.gone")}</h1>}
        {state === "error" && (
          <>
            <p role="alert">{t("state.readFailed")}</p>
            <button type="button" className={s.secondary} onClick={() => { setState("loading"); setAttempt((n) => n + 1); }}>
              {t("state.retry")}
            </button>
          </>
        )}
        {state !== "loading" && back}
      </div>
    );

  const title = pickLang(lang, [[item.lang, item.title], [item.lang_alt, item.title_alt]]);
  const note = pickLang(lang, [[item.lang, item.body], [item.lang_alt, item.body_alt]]);
  const transcript = voice && pickLang(lang, [[item.lang, voice.alt], [item.lang_alt, voice.alt_alt]]);
  const altOfPhoto = (m: GuestMediaRef) => pickLang(lang, [[item.lang, m.alt], [item.lang_alt, m.alt_alt]]);
  const pages: Page[] = [{ k: "open" }];
  if (note || voice) pages.push({ k: "msg" });
  for (let i = 1; i < photos.length; i += PER_PAGE) pages.push({ k: "ph", from: i, photos: photos.slice(i, i + PER_PAGE) });
  if (video) pages.push({ k: "vid" });
  const chapterName = { open: t("detail.opening"), msg: t("detail.message"), ph: t("detail.photos"), vid: t("detail.video") };
  const chapters = (["open", "msg", "ph", "vid"] as const).map((k) => ({ k, at: pages.findIndex((p) => p.k === k) })).filter((c) => c.at >= 0);
  const here = pages[Math.min(page, pages.length - 1)];
  const turn = (to: number) => {
    if (to < 0 || to >= pages.length) return;
    setPage(to);
    setAnnounce(`${t("detail.page", { n: to + 1, total: pages.length })} · ${chapterName[pages[to].k]}`);
  };
  const photoButton = (m: GuestMediaRef, i: number) => {
    const alt = altOfPhoto(m);
    return (
      <button
        key={m.id}
        type="button"
        className={`album-photo ${s.albumPhoto}`}
        aria-label={shown[m.id] && alt?.text ? undefined : t("home.photo", { n: i + 1, total: photos.length })}
        onClick={(event) => { opener.current = event.currentTarget; setViewing(i); }}>
        {shown[m.id] ? (
          // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL; the image optimizer would cache it
          <img src={shown[m.id]} alt={alt?.text ?? ""} lang={alt?.lang} width={m.width ?? undefined} height={m.height ?? undefined} onError={reshown} />
        ) : (
          <span className={s.photoSlot} style={{ aspectRatio: `${m.width ?? 4} / ${m.height ?? 3}` }} />
        )}
      </button>
    );
  };

  return (
    <div className={s.album} ref={root}>
      {back}
      <header>
        <h1 tabIndex={-1} lang={title?.lang}>
          {title?.text}
        </h1>
        {item.event_date && item.date_precision && <p className={s.small}>{guestDate(item.event_date, item.date_precision, lang)}</p>}
        {title && title.lang !== lang && <p className={s.small}>{t("detail.original")}</p>}
      </header>
      <section className={s.albumPage} aria-label={chapterName[here.k]}>
        {here.k === "open" && photos[0] && photoButton(photos[0], 0)}
        {here.k === "msg" && (
          <>
            <h2>{t("detail.message")}</h2>
            {/* One note per screen: the header's, shown on every page, already says it when the title fell back. */}
            {note && note.lang !== lang && title?.lang === lang && <p className={s.small}>{t("detail.original")}</p>}
            {note && <p lang={note.lang}>{note.text}</p>}
            {voice && (
              <div className={s.voice}>
                <h3>{t("detail.voice")}</h3>
                {voiceUrl[voice.id] ? (
                  <audio controls autoPlay src={voiceUrl[voice.id]} onError={revoice} />
                ) : (
                  <button type="button" className={s.secondary} onClick={() => { setPlayVoice(true); retryVoice(); }}>
                    {t("detail.playVoice")}
                  </button>
                )}
                {transcript && (
                  <details>
                    <summary>{t("detail.transcript")}</summary>
                    <p lang={transcript.lang}>{transcript.text}</p>
                  </details>
                )}
              </div>
            )}
          </>
        )}
        {here.k === "ph" && <div className={s.albumGrid}>{here.photos.map((m, j) => photoButton(m, here.from + j))}</div>}
        {here.k === "vid" && video && (
          <div className={s.video}>
            {videoUrl[video.id] ? (
              <video controls autoPlay src={videoUrl[video.id]} poster={poster[video.id]} width={video.width ?? undefined} height={video.height ?? undefined} onError={revideo} />
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL; the image optimizer would cache it */}
                {poster[video.id] && <img src={poster[video.id]} alt="" width={video.width ?? undefined} height={video.height ?? undefined} onError={reposter} />}
                <button type="button" className={s.primary} onClick={() => { setPlayVideo(true); retryVideo(); }}>
                  {t("detail.playVideo")}
                </button>
              </>
            )}
          </div>
        )}
      </section>
      <nav className={s.albumNav} aria-label={t("detail.contents")}>
        <button type="button" className={s.secondary} aria-label={t("detail.prev")} aria-disabled={page === 0 || undefined} onClick={() => turn(page - 1)}>
          ←
        </button>
        <button ref={label} type="button" className={s.secondary} aria-expanded={contents} aria-controls="album-contents" onClick={() => setContents((x) => !x)}>
          {t("detail.page", { n: page + 1, total: pages.length })}
        </button>
        <button type="button" className={s.secondary} aria-label={t("detail.next")} aria-disabled={page === pages.length - 1 || undefined} onClick={() => turn(page + 1)}>
          →
        </button>
      </nav>
      {contents && (
        <ul id="album-contents" className={s.contents}>
          {chapters.map((c) => (
            <li key={c.k}>
              <button type="button" className={s.secondary} aria-current={here.k === c.k || undefined} onClick={() => { turn(c.at); setContents(false); label.current?.focus(); }}>
                {chapterName[c.k]}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className={s.visuallyHidden} role="status">
        {announce}
      </p>
      {viewing !== null && photos[viewing] && (
        <PhotoViewer
          photo={photos[viewing]}
          url={shown[photos[viewing].id]}
          onExpired={reshown}
          alt={altOfPhoto(photos[viewing])}
          n={viewing + 1}
          total={photos.length}
          t={t}
          onStep={(by) => setViewing((viewing + by + photos.length) % photos.length)}
          onClose={() => {
            setViewing(null);
            requestAnimationFrame(() => opener.current?.focus());
          }}
        />
      )}
    </div>
  );
}

function PhotoViewer(props: {
  photo: GuestMediaRef; url?: string; alt: { text: string; lang: Lang } | null; n: number; total: number; t: T;
  onStep: (by: number) => void; onClose: () => void; onExpired: () => void;
}) {
  const { photo, url, alt, n, total, t, onStep, onClose, onExpired } = props;
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>("button")?.focus();
    }
  }, []);
  return (
    <dialog
      ref={dialog}
      className={s.viewer}
      aria-label={t("home.photo", { n, total })}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <button type="button" className={s.secondary} onClick={onClose}>
        {t("settings.close")}
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL; the image optimizer would cache it */}
      {url && <img src={url} alt={alt?.text ?? ""} lang={alt?.lang} width={photo.width ?? undefined} height={photo.height ?? undefined} onError={onExpired} />}
      <div className={s.stackControls}>
        <button type="button" className={s.secondary} aria-label={t("home.prev")} onClick={() => onStep(-1)}>
          ‹
        </button>
        <p className={s.small} role="status">
          {t("home.photo", { n, total })}
        </p>
        <button type="button" className={s.secondary} aria-label={t("home.next")} onClick={() => onStep(1)}>
          ›
        </button>
      </div>
    </dialog>
  );
}
