"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { Kind, Lang, Section } from "@/lib/content";
import { cardState, counter, type Home, type HomeRead } from "@/lib/home";
import { dashState, resumeStep, type Drafts, type Page } from "@/lib/setup";
import { Content } from "./content";
import type { CopyKey } from "./copy";
import { HomeEditor } from "./home";
import { Item } from "./item";
import { Announcers, L, LogOut, SectionList, T, post, useOnline } from "./parts";
import { Upload } from "./upload";
import { AttentionLine, Spoken, UsageCard, UsageView, useUsage } from "./usage";
import { Wizard } from "./wizard";
import s from "./owner.module.css";

// O2 dashboard (owner UI "O2 and O3 revision for T2.1b"; E55). It reads the saved page in the browser, so loading,
// offline, access lost and a failed read are states of this screen; a read that never succeeded is never "empty".
type State = "loading" | "empty" | "resumed" | "done" | "error" | "accessLost";
type Read = { state: State | "signedOut"; page?: Page | null; drafts?: Drafts | null };

async function fetchPage(): Promise<Read> {
  if (!navigator.onLine) return { state: "error" };
  try {
    const res = await fetch("/api/owner/page", { method: "POST" });
    if (res.status === 401) return { state: "signedOut" };
    if (res.status === 403) return { state: "accessLost" };
    if (!res.ok) return { state: "error" };
    const body = await res.json();
    return { state: dashState(body.page), ...body };
  } catch {
    return { state: "error" };
  }
}

type Props = {
  state: State;
  page: Page | null;
  offline: boolean;
  onSetup: () => void;
  onRetry: () => void;
  onContent: () => void;
  status?: CopyKey | null;
  // The result's heading or message, focused after a read the owner asked for.
  headingRef?: RefObject<HTMLElement | null>;
  // The read was the owner's: focus reads the message, so the alert region stays empty (announced once).
  focused?: boolean;
  // The Home card (owner UI O17 and the O2 Home card): its own read, the time its counter is computed at, its actions.
  home?: HomeRead;
  now?: Date;
  onHome?: () => void;
  onHomeRetry?: () => void;
  // O10's entries on O2 (T2.5b): the attention line above the cards, the Usage card, and what their reads announce.
  attention?: ReactNode;
  usageCard?: ReactNode;
  said?: ReactNode;
};

export function Dashboard({ state, page, offline, onSetup, onRetry, onContent, status, headingRef, focused = false, home, now, onHome, onHomeRetry, attention, usageCard, said }: Props) {
  const h2 = headingRef as RefObject<HTMLHeadingElement | null> | undefined;
  const message = headingRef as RefObject<HTMLParagraphElement | null> | undefined;
  const reason = offline ? "offline-reason" : undefined;
  const alert = focused ? null : state === "error" ? "common.readError" : state === "accessLost" ? "common.accessLost" : null;
  return (
    <div className={s.page}>
      <header className={s.topbar}>
        <h1 className={s.topbarText}>
          <T k="dashboard.overview" />
        </h1>
      </header>
      <main className={s.main}>
        <Announcers status={offline ? "common.offline" : status} alert={alert}>
          {state === "done" && said}
        </Announcers>
        {offline && (
          <p id="offline-reason" className={s.notice}>
            <T k="common.offline" />
          </p>
        )}
        {state === "loading" && (
          <section className={`${s.surface} ${s.narrow}`} aria-busy="true">
            <p>
              <T k="common.loading" />
            </p>
            <div className={s.skeletons} aria-hidden="true">
              <div className={s.skeleton} />
              <div className={s.skeleton} />
              <div className={`${s.skeleton} ${s.skeletonBlock}`} />
            </div>
          </section>
        )}
        {state === "error" && (
          <section className={`${s.surface} ${s.narrow}`}>
            <p className={s.error} tabIndex={-1} ref={message}>
              <T k="common.readError" />
            </p>
            <button type="button" className={s.secondary} disabled={offline} aria-describedby={reason} onClick={onRetry}>
              <L k="common.tryAgain" />
            </button>
          </section>
        )}
        {state === "accessLost" && (
          <section className={`${s.surface} ${s.narrow}`}>
            <p className={s.error} tabIndex={-1} ref={message}>
              <T k="common.accessLost" />
            </p>
          </section>
        )}
        {(state === "empty" || state === "resumed") && (
          <section className={`${s.surface} ${s.narrow} ${s.empty}`}>
            <h2 tabIndex={-1} ref={h2}>
              <T k="dashboard.empty" />
            </h2>
            {state === "resumed" && (
              <>
                <p className={s.badge}>
                  <T k="visibility.private" />
                </p>
                <p className={s.help}>
                  <T k="resume.help" />
                </p>
                <p className={s.help}>
                  <T k="private.help" />
                </p>
              </>
            )}
            <ol className={s.checklist}>
              <li>
                <T k="empty.one" />
              </li>
              <li>
                <T k="empty.two" />
              </li>
              <li>
                <T k="empty.three" />
              </li>
            </ol>
            <button type="button" className={s.primary} disabled={offline} aria-describedby={reason} onClick={onSetup}>
              <L k={state === "empty" ? "dashboard.setup" : "dashboard.continue"} />
            </button>
          </section>
        )}
        {state === "done" && page && status && (
          <p className={s.notice}>
            <T k={status} />
          </p>
        )}
        {state === "done" && page && attention}
        {state === "done" && page && (
          <div className={s.dashboard}>
            <section className={`${s.surface} ${s.summary}`}>
              <h2 tabIndex={-1} ref={h2}>
                <bdi>{page.label_a}</bdi> &amp; <bdi>{page.label_b}</bdi>
              </h2>
              <button type="button" className={s.primary} disabled={offline} aria-describedby={reason} onClick={onContent}>
                <L k="content.content" />
              </button>
            </section>
            <section className={s.surface}>
              <h3>
                <T k="dashboard.visibility" />
              </h3>
              <p className={s.badge}>
                <T k={page.visibility === "private" ? "visibility.private" : "visibility.token"} />
              </p>
            </section>
            <section className={`${s.surface} ${s.sectionsPanel}`}>
              <h3>
                <T k="review.sections" />
              </h3>
              <SectionList sections={page.sections} />
            </section>
            {home && <HomeCard home={home} now={now} offline={offline} onHome={onHome} onRetry={onHomeRetry} />}
            {usageCard}
          </div>
        )}
        <LogOut />
      </main>
    </div>
  );
}

const CARD_STATUS = { new: "home.new", draft: "home.cardDraft", published: "content.published", changes: "home.cardChanged" } as const;

// O2 Home card (PRD Q144 defaults 1, 8 and 11): read before any status or counter is shown; the counter is the
// published Home's, in the page time zone; a failed read has its own Try again and never reads as "No Home yet".
function HomeCard({ home, now, offline, onHome, onRetry }: { home: HomeRead; now?: Date; offline: boolean; onHome?: () => void; onRetry?: () => void }) {
  const reason = offline ? "offline-reason" : undefined;
  const ready = home.state === "ready" ? home.home : undefined;
  const start = ready?.published ? counter(ready.published.start_date, ready.timezone, now) : null;
  return (
    <section className={s.surface}>
      <h3 id="home-card-title" tabIndex={-1}>
        <T k="sections.home" />
      </h3>
      {home.state === "loading" && (
        <p role="status">
          <T k="common.loading" />
        </p>
      )}
      {home.state === "error" && (
        <>
          <p className={s.error} role="alert">
            <T k="common.readError" />
          </p>
          <button id="home-retry" type="button" className={s.secondary} disabled={offline} aria-describedby={reason} onClick={onRetry}>
            <L k="common.tryAgain" />
          </button>
        </>
      )}
      {ready !== undefined && (
        <>
          <p className={s.badge}>
            <T k={CARD_STATUS[cardState(ready)]} />
          </p>
          {start?.kind === "none" && (
            <p>
              <T k="home.noDate" />
            </p>
          )}
          {start?.kind === "future" && (
            <p>
              <T k="home.future" vars={{ date: start.date }} />
            </p>
          )}
          {start?.kind === "day" && (
            <p>
              <T k="home.day" vars={{ days: start.days }} />
            </p>
          )}
          <button id="home-action" type="button" className={s.secondary} disabled={offline} aria-describedby={reason} onClick={onHome}>
            <L k={ready ? "home.edit" : "home.setup"} />
          </button>
        </>
      )}
    </section>
  );
}

export default function Owner() {
  const router = useRouter();
  const online = useOnline();
  const [state, setState] = useState<State>("loading");
  const [data, setData] = useState<{ page: Page | null; drafts: Drafts | null }>({ page: null, drafts: null });
  const [wizard, setWizard] = useState(false);
  // O4, O5 and O6 are views of /app, not routes (dynamic routes are refused, src/lib/routes.ts).
  const [view, setView] = useState<
    | { name: "dashboard" }
    | { name: "content"; section: Section; status?: CopyKey }
    | { name: "item"; id: string | null; kind: Kind; section: Section }
    | { name: "upload"; id: string; kind: Kind; section: Section }
    | { name: "home" }
    | { name: "usage" }
  >({ name: "dashboard" });
  // The usage snapshot O2 and O10 share (owner UI O10): read on the dashboard like the Home card, and by O10 itself.
  const usage = useUsage(online);
  const usageOpener = useRef<string | null>(null); // the O2 control that opened O10, focused again on Back
  const usageRetry = useRef(false);
  // The Home card's own read (owner UI O2 Home card): on the dashboard once the page is set up, again on each return
  // to it and on reconnecting; until it answers the card claims nothing.
  const [home, setHome] = useState<HomeRead>({ state: "loading" });
  const focusHome = useRef(false);
  const homeRead = useRef(0); // the latest Home read; an older answer is ignored
  const [status, setStatus] = useState<CopyKey | null>(null);
  // A Finish whose outcome is unknown keeps its retry through Leave and resume (owner UI O3 states).
  const [uncertain, setUncertain] = useState(false);
  const heading = useRef<HTMLElement>(null);
  const focusResult = useRef(false);
  // Only the first read is not the owner's; every later one moves focus to its result.
  const [asked, setAsked] = useState(false);
  // A message from the wizard ("Your page is set up") waits for the read, so the dashboard's mounted live region
  // announces it and it shows with the result.
  const pending = useRef<CopyKey | null>(null);

  const apply = useCallback(
    ({ state, page = null, drafts = null }: Read) => {
      if (state === "signedOut") return router.push("/login?next=%2Fapp");
      if (state === "empty" || state === "resumed" || state === "done") setData({ page, drafts });
      if (state === "done") setUncertain(false);
      setStatus(pending.current);
      pending.current = null;
      setState(state);
    },
    [router],
  );
  const signedOut = useCallback(() => router.push("/login?next=%2Fapp"), [router]);
  // announce: the owner asked (Try again), so the result is announced; a failure is the card's alert.
  const readHome = useCallback(
    (announce = false) => {
      const n = ++homeRead.current;
      void post<{ home: Home | null }>("/api/owner/home/get", {}).then((r) => {
        if (n !== homeRead.current) return;
        if (r.status === 401) return signedOut();
        const ok = r.status === 200 && r.body;
        setHome(ok ? { state: "ready", home: r.body!.home } : { state: "error" });
        if (announce && ok) setStatus("home.cardLoaded");
      });
    },
    [signedOut],
  );
  const onDashboard = state === "done" && view.name === "dashboard" && !wizard;
  useEffect(() => {
    if (onDashboard && online) readHome();
  }, [onDashboard, online, readHome]);
  // On each arrival at the dashboard; on reconnecting only while nothing has been read yet (the boards' rule), so a
  // kept error and its Try again are not swapped out under the owner.
  useEffect(() => {
    if (onDashboard) usage.load(false);
  }, [onDashboard]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (onDashboard && online && !usage.read.snapshot && usage.read.outcome === "loading") usage.load(false);
  }, [online]); // eslint-disable-line react-hooks/exhaustive-deps
  // Focus inside the Usage card or the attention line, kept when a redraw removes the focused control (no focusin then).
  const usageFocus = useRef(false);
  useEffect(() => {
    const seen = (e: FocusEvent) => (usageFocus.current = !!(e.target as Element).closest?.("#usage-card, #usage-attention"));
    document.addEventListener("focusin", seen);
    return () => document.removeEventListener("focusin", seen);
  }, []);
  useEffect(() => {
    if (view.name !== "dashboard" || !usageFocus.current || document.activeElement !== document.body) return;
    (document.getElementById("usage-retry") ?? document.getElementById("usage-entry-link") ?? document.getElementById("usage-card-title"))?.focus();
  }, [usage.read, view.name]);
  // A failed Try again on the card focuses its Try again again (owner UI O10 accessibility).
  useEffect(() => {
    if (usageRetry.current && usage.read.outcome !== "loading") {
      usageRetry.current = false;
      if (usage.read.outcome === "error") document.getElementById("usage-retry")?.focus();
    }
  }, [usage.read.outcome]);
  useEffect(() => {
    if (focusHome.current && view.name === "dashboard") {
      focusHome.current = false;
      document.getElementById("home-card-title")?.focus();
    }
    if (usageOpener.current && view.name === "dashboard") {
      (document.getElementById(usageOpener.current) ?? document.getElementById("usage-card-title"))?.focus();
      usageOpener.current = null;
    }
  }, [view]);
  const leave = (next: typeof view) => {
    homeRead.current++; // a read still in flight belongs to the dashboard just left
    usage.leave();
    setHome({ state: "loading" });
    setView(next);
  };
  const read = () => {
    setState("loading");
    void fetchPage().then(apply);
  };

  useEffect(() => {
    void fetchPage().then(apply);
  }, [apply]);

  useEffect(() => {
    if (focusResult.current && state !== "loading") {
      focusResult.current = false;
      heading.current?.focus();
    }
  }, [state, wizard, view]);

  if (wizard) {
    return (
      <Wizard
        page={data.page}
        drafts={data.drafts}
        initialStep={data.page ? resumeStep(data.page) : 1}
        uncertain={uncertain}
        onUncertain={setUncertain}
        onExit={(message) => {
          pending.current = message ?? null;
          setStatus(null);
          setWizard(false);
          focusResult.current = true;
          setAsked(true);
          read();
        }}
      />
    );
  }
  if (view.name === "content") {
    return (
      <Content
        initialSection={view.section}
        status={view.status}
        onSignedOut={signedOut}
        onOpen={({ id, kind, section }) => setView({ name: "item", id, kind, section })}
        onBack={() => {
          focusResult.current = true;
          setStatus(null);
          setView({ name: "dashboard" });
        }}
      />
    );
  }
  if (view.name === "item") {
    return (
      <Item
        id={view.id}
        kind={view.kind}
        lang={(data.page?.default_lang ?? "vi") as Lang}
        onSignedOut={signedOut}
        onBack={(status) => setView({ name: "content", section: view.section, status })}
        onUpload={(id) => setView({ name: "upload", id, kind: view.kind, section: view.section })}
      />
    );
  }
  if (view.name === "home" && data.page) {
    return (
      <HomeEditor
        page={data.page}
        drafts={data.drafts}
        onSignedOut={signedOut}
        onContent={() => setView({ name: "content", section: "memories" })}
        onBack={() => {
          focusHome.current = true;
          setStatus(null);
          setView({ name: "dashboard" });
        }}
      />
    );
  }
  if (view.name === "usage") {
    return (
      <UsageView
        read={usage.read}
        said={usage.said}
        offline={!online}
        onLoad={usage.load}
        onSay={usage.say}
        onContent={() => {
          usage.leave();
          setView({ name: "content", section: "memories" });
        }}
        onBack={() => {
          usage.leave();
          setStatus(null);
          setView({ name: "dashboard" });
        }}
      />
    );
  }
  if (view.name === "upload") {
    return <Upload id={view.id} onSignedOut={signedOut} onBack={() => setView({ name: "item", id: view.id, kind: view.kind, section: view.section })} />;
  }
  return (
    <Dashboard
      state={state}
      page={data.page}
      offline={!online}
      status={status}
      headingRef={heading}
      focused={asked}
      onSetup={() => {
        setStatus(null);
        setWizard(true);
      }}
      onContent={() => leave({ name: "content", section: "memories" })}
      home={home}
      onHome={() => leave({ name: "home" })}
      said={<Spoken said={usage.said} />}
      attention={
        <AttentionLine
          read={usage.read}
          offline={!online}
          onOpen={() => {
            usageOpener.current = "usage-attention-link";
            leave({ name: "usage" });
          }}
        />
      }
      usageCard={
        <UsageCard
          read={usage.read}
          offline={!online}
          onBlocked={usage.say}
          onOpen={() => {
            usageOpener.current = "usage-entry-link";
            leave({ name: "usage" });
          }}
          onRetry={() => {
            setStatus(null);
            document.getElementById("usage-card-title")?.focus();
            usageRetry.current = true;
            usage.load(true);
          }}
        />
      }
      onHomeRetry={() => {
        // Try again leaves with the error, so focus goes to the card's title first, never to the page.
        document.getElementById("home-card-title")?.focus();
        usage.clear(); // the status region is shared: an older usage message is not read again with Home's
        setStatus(null);
        setHome({ state: "loading" });
        readHome(true);
      }}
      onRetry={() => {
        focusResult.current = true;
        setAsked(true);
        read();
      }}
    />
  );
}
