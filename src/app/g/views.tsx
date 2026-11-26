"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { counter } from "@/lib/home";
import type { GuestMediaRef, GuestSummary } from "@/lib/guest";
import { pickLang, type CopyKey, type Lang } from "./copy";
import s from "./guest.module.css";

type T = (key: CopyKey, vars?: Record<string, string | number>) => string;
type Props = { summary: GuestSummary; lang: Lang; token?: string; t: T; onGone: () => void };

// Every guest read: the token cookie goes by itself; a visit run from memory (cookies blocked, E30) sends the token.
// A 404 is the not-available answer: the token no longer opens the page (token flow §6).
export class Gone extends Error {}
async function guestPost<R>(path: string, body: object, token?: string): Promise<R> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-vegenus-guest": "1" },
    body: JSON.stringify(token ? { ...body, token } : body),
  });
  if (res.status === 404) throw new Gone();
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
function useMedia(ids: string[], variant: "display" | "thumb", token: string | undefined, onGone: () => void) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const asked = useRef(new Map<string, number>());
  const [online, setOnline] = useState(0); // counts reconnections: ids whose signing failed are asked again
  const ask = useCallback(
    (want: string[]) => {
      for (let i = 0; i < want.length; i += MEDIA_IDS) {
        const chunk = want.slice(i, i + MEDIA_IDS);
        const at = Date.now();
        for (const id of chunk) asked.current.set(id, at);
        guestPost<{ urls: Record<string, string> }>("/api/guest/media", { ids: chunk, variant }, token)
          .then((r) => setUrls((old) => ({ ...old, ...r.urls })))
          .catch((error) => {
            for (const id of chunk) asked.current.delete(id);
            if (error instanceof Gone) onGone();
          });
      }
    },
    [variant, token, onGone],
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
  return { urls, refresh };
}

// The couple's published wording in the shown language, else the other one, with its tokens filled.
function wording({ summary, lang }: Props, key: string, vars: Record<string, string | number> = {}) {
  const entry = summary.copy[key] ?? {};
  const found = pickLang(lang, [["en", entry.en], ["vi", entry.vi]]);
  if (!found) return null;
  const all = { partner_a: summary.names[0] ?? "", partner_b: summary.names[1] ?? "", ...vars };
  const text = Object.entries(all).reduce((x, [name, value]) => x.replaceAll(`{${name}}`, String(value)), found.text);
  return <p lang={found.lang}>{text}</p>;
}

const altOf = (m: GuestMediaRef, lang: Lang) => pickLang(lang, [[m.lang, m.alt], [m.lang_alt, m.alt_alt]]);

// G1 (screens G1; owner UI "Guest Home states"): the couple title and greeting always; photos, note and counter only
// from a published Home. A future start date shows no counter.
export function HomeView(props: Props) {
  const { summary, lang, token, t, onGone } = props;
  const word = (key: string, vars?: Record<string, string | number>) => wording(props, key, vars);
  const home = summary.home;
  const picks = home?.picks ?? [];
  const { urls, refresh } = useMedia(picks.map((p) => p.id), "display", token, onGone);
  const [shown, setShown] = useState(0);
  const note = home && pickLang(lang, [[home.lang, home.body], [home.lang_alt, home.body_alt]]);
  const count = home ? counter(home.start_date, summary.timezone) : null;
  const pick = picks[shown % Math.max(picks.length, 1)];
  const alt = pick && altOf(pick, lang);
  return (
    <div className={s.home}>
      <header className={s.homeHead}>
        <h1 tabIndex={-1}>{summary.names.filter(Boolean).join(" & ")}</h1>
        {word("home.greeting")}
      </header>
      {pick && (
        <figure className={s.stackWrap}>
          <button id="photo-stack" type="button" className={s.stack} onClick={() => setShown((n) => (n + 1) % picks.length)}>
            {urls[pick.id] ? (
              // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL; the image optimizer would cache it
              <img src={urls[pick.id]} alt={alt?.text ?? ""} lang={alt?.lang} width={pick.width ?? undefined} height={pick.height ?? undefined} onError={refresh} />
            ) : (
              <span className={s.photoSlot} style={{ aspectRatio: `${pick.width ?? 4} / ${pick.height ?? 3}` }} />
            )}
            <span className={s.small}>{t("home.photo", { n: (shown % picks.length) + 1, total: picks.length })}</span>
          </button>
          <figcaption className={s.small}>{word("home.photoHint")}</figcaption>
        </figure>
      )}
      {(note || count?.kind === "day") && (
        <section className={s.note}>
          {note && <p lang={note.lang}>{note.text}</p>}
          {count?.kind === "day" && word("home.days", { days: count.days })}
        </section>
      )}
    </div>
  );
}

type Item = {
  id: string; lang: Lang; title: string | null; lang_alt: Lang | null; title_alt: string | null;
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

// G2 Memories and G5 Wishes (read-only in T3.1b; Leave a wish comes with T3.2): newest page first, Load more after a
// full page, a failure keeps what is loaded and offers Try again (guest UI §6 common states, §7). The footer button
// stays in place while it reads, so focus stays on it; when it goes, focus moves to the first new card, else the heading.
// shortcut: {count} in the intro is the number loaded so far (exact up to 50); a server total when a page needs more.
export function ListView(props: Props & { section: "memories" | "guestbook" }) {
  const { section, lang, token, t, onGone } = props;
  const word = (key: string, vars?: Record<string, string | number>) => wording(props, key, vars);
  const online = useOnline();
  const wishes = section === "guestbook";
  const [rows, setRows] = useState<Row[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [more, setMore] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [asking, setAsking] = useState(false); // a click is being answered: its button stays in place
  const clicked = useRef(false);
  const firstNew = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    const last = rows.at(-1);
    const after = !last || attempt === 0 ? undefined : wishes ? { created_at: (last as Entry).created_at, id: last.id } : { sort: (last as Item).sort_order, id: last.id };
    const read = wishes
      ? guestPost<{ entries: Entry[] }>("/api/guest/wishes", after ? { after } : {}, token).then((r) => r.entries)
      : guestPost<{ items: Item[] }>("/api/guest/list", after ? { section, after } : { section }, token).then((r) => r.items);
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
    const target = firstNew.current === null ? root.current?.querySelector("h1") : root.current?.querySelectorAll("article")[firstNew.current];
    (target as HTMLElement | null | undefined)?.focus();
  }, [state, more]);

  const { urls: thumbs } = useMedia(wishes ? [] : (rows as Item[]).flatMap((r) => r.media?.find((m) => m.kind === "photo")?.id ?? []), "thumb", token, onGone);
  const next = () => {
    if (state === "loading") return;
    clicked.current = true;
    setAsking(true);
    setState("loading");
    setAttempt((n) => n + 1); // with rows loaded this reads the page after the last one, else the first page again
  };
  const footer = state === "error" || more || asking;
  const label = more ? t("list.more") : t("state.retry");

  return (
    <div className={s.section} ref={root}>
      <header>
        <h1 tabIndex={-1}>{t(wishes ? "nav.guestbook" : "nav.memories")}</h1>
        {(rows.length > 0 || state === "ready") && word(wishes ? "wishes.intro" : "memories.intro", { count: rows.length })}
      </header>
      {state === "ready" && rows.length === 0 && word(wishes ? "wishes.empty" : "memories.empty")}
      <ul className={s.cards}>
        {rows.map((row) => (
          <li key={row.id}>
            {"display_name" in row ? (
              <article className={s.card} tabIndex={-1}>
                <h2 className={s.cardTitle}>{row.display_name}</h2>
                <p lang={row.lang}>{row.body}</p>
              </article>
            ) : (
              <MemoryCard item={row} url={thumbs} lang={lang} />
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
    </div>
  );
}

function MemoryCard({ item, url, lang }: { item: Item; url: Record<string, string>; lang: Lang }) {
  const title = pickLang(lang, [[item.lang, item.title], [item.lang_alt, item.title_alt]]);
  const photo = item.media?.find((m) => m.kind === "photo");
  const alt = photo && pickLang(lang, [[item.lang, photo.alt], [item.lang_alt, photo.alt_alt]]);
  return (
    <article className={s.card} tabIndex={-1}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL; the image optimizer would cache it */}
      {photo && url[photo.id] && <img className={s.thumb} src={url[photo.id]} alt={alt?.text ?? ""} lang={alt?.lang} width={photo.width ?? undefined} height={photo.height ?? undefined} />}
      {title && (
        <h2 className={s.cardTitle} lang={title.lang}>
          {title.text}
        </h2>
      )}
      {item.event_date && item.date_precision && <p className={s.small}>{guestDate(item.event_date, item.date_precision, lang)}</p>}
    </article>
  );
}
