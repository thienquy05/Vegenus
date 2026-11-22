"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { attentionChange, deriveUsage, usageDate, usageSize, type Attention, type Usage } from "@/lib/usage";
import { COPY, type CopyKey } from "./copy";
import { L, T, post, type Vars } from "./parts";
import s from "./owner.module.css";

// O10 Usage, the O2 Usage card and attention line (owner UI "O10 Usage and the O2 attention line for T2.5"; PRD Q145
// 9, 13-16). O2 and O10 are views of /app, so the last accepted snapshot and read outcome live in Owner and both share
// them: Back shows them, offline keeps them labelled with their time, a 401 or 403 clears them.
export type Outcome = "loading" | "ready" | "error" | "401" | "403";
// held: a failed or refused read stays on screen while its Try again runs (the recovery panel is not swapped out).
export type UsageRead = { outcome: Outcome; snapshot: Usage | null; fresh: boolean; held?: Outcome };
const RECOVERY: Outcome[] = ["error", "401", "403"];
export type Said = { key: CopyKey; vars?: Vars; then?: { key: CopyKey; vars?: Vars } } | null;

const both = (f: (lang: "en" | "vi") => string) => [f("en"), f("vi")] as const;
const time = (iso: string, timeZone: string) => both((lang) => usageDate(iso, timeZone, lang));
const size = (bytes: number) => both((lang) => usageSize(bytes, lang));

function changed(change: NonNullable<ReturnType<typeof attentionChange>>, attention: Attention | null) {
  if (change === "usage.attentionCleared" || !attention || change === attention) return { key: change };
  return { key: change, vars: { attention: COPY[attention] } };
}

export function useUsage(online: boolean) {
  const [read, setRead] = useState<UsageRead>({ outcome: "loading", snapshot: null, fresh: false });
  const [said, setSaid] = useState<Said>(null);
  const current = useRef(read);
  const commit = (next: UsageRead) => setRead((current.current = next));
  const latest = useRef(0); // the read in flight; an older or dropped answer is ignored
  const inFlight = useRef(false);
  // The outcome a read in flight replaced: a read cut short restores it (an interrupted Try again keeps Try again).
  const before = useRef<Outcome>("loading");
  const drop = () => {
    latest.current++;
    if (!inFlight.current) return;
    inFlight.current = false;
    commit({ ...current.current, outcome: before.current, held: undefined });
  };

  // asked: the owner pressed Refresh or Try again, so a success is announced ("Usage updated").
  const load = useCallback((asked: boolean) => {
    // Offline, nothing is sent: what is kept stays, labelled offline, and no false read failure is recorded.
    if (!navigator.onLine) return;
    const n = ++latest.current;
    const prev = current.current;
    if (prev.outcome !== "loading") before.current = prev.outcome;
    inFlight.current = true;
    setSaid(null);
    commit({ ...prev, outcome: "loading", held: RECOVERY.includes(prev.outcome) ? prev.outcome : prev.held });
    void post<{ usage: Usage | null }>("/api/owner/usage", {}).then((r) => {
      if (n !== latest.current) return;
      inFlight.current = false;
      const was = current.current;
      // null: this account owns no page (a co-editor, E33), so it reads as access lost.
      if (r.status === 401 || r.status === 403 || (r.status === 200 && r.body?.usage === null)) {
        const outcome = r.status === 401 ? "401" : "403";
        commit({ outcome, snapshot: null, fresh: false });
        return setSaid({ key: outcome === "401" ? "usage.session" : "common.accessLost" });
      }
      if (r.status !== 200 || !r.body?.usage) {
        // A failure after a 401 or 403 keeps that outcome: the figures stay hidden and its own recovery stays.
        const outcome = before.current === "401" || before.current === "403" ? before.current : "error";
        commit({ ...was, outcome, fresh: false, held: undefined });
        return setSaid({ key: outcome === "401" ? "usage.session" : outcome === "403" ? "common.accessLost" : "usage.readError" });
      }
      const next = r.body.usage;
      const attention = deriveUsage(next).attention;
      const change = attentionChange(was.snapshot ? deriveUsage(was.snapshot).attention : null, attention);
      commit({ outcome: "ready", snapshot: next, fresh: true });
      const then = change ? changed(change, attention) : undefined;
      // The first read is static text; a later one announces a new condition once.
      if (asked) setSaid({ key: "usage.announced", then });
      else if (then && was.snapshot) setSaid(then);
    });
  }, []);

  // Going offline drops the read in flight; a change of connection clears the last message, so it is not read again.
  // Reconnecting while a 401 or 403 is kept says so (owner UI O10: "Connection restored" with the session or access).
  const wasOnline = useRef(online);
  const reason = useRef<ReturnType<typeof setTimeout>>(undefined); // a blocked press's reason, still to be said
  const hush = () => {
    clearTimeout(reason.current);
    setSaid(null);
  };
  useEffect(() => {
    if (online === wasOnline.current) return;
    wasOnline.current = online;
    hush();
    // What is kept was read before the connection dropped: last known until a fresh read (Q145 14).
    if (!online) return (drop(), commit({ ...current.current, fresh: false }));
    const o = current.current.outcome;
    if (o === "401" || o === "403") setSaid({ key: "usage.connected", then: { key: o === "401" ? "usage.session" : "common.accessLost" } });
  }, [online]); // eslint-disable-line react-hooks/exhaustive-deps -- drop only touches refs and the stable setter

  return {
    read,
    said,
    load,
    // Cleared first, so a second press of a blocked control is announced again.
    say: (key: CopyKey) => {
      hush();
      reason.current = setTimeout(() => setSaid({ key }), 40);
    },
    clear: hush,
    // Leaving a view: its read in flight is dropped and what is kept reads as last known until the next view reads.
    leave: () => {
      drop();
      hush();
      commit({ ...current.current, fresh: false });
    },
  };
}

export function Spoken({ said }: { said: Said }) {
  if (!said) return null;
  return (
    <>
      <T k={said.key} vars={said.vars} />
      {said.then && (
        <>
          {" · "}
          <T k={said.then.key} vars={said.then.vars} />
        </>
      )}
    </>
  );
}

// A control a lost connection makes unavailable: it stays focusable, says why, and a press only repeats the reason.
function Guarded({ id, blocked, offline, reason, describedBy, onPress, onBlocked, children }: {
  id: string;
  blocked: boolean;
  offline: boolean;
  reason: CopyKey;
  describedBy?: string;
  onPress: () => void;
  onBlocked: (key: CopyKey) => void;
  children: ReactNode;
}) {
  const why = `${id}-reason`;
  return (
    <>
      <button
        id={id}
        type="button"
        className={s.secondary}
        aria-disabled={blocked || undefined}
        aria-describedby={[describedBy, offline && why].filter(Boolean).join(" ") || undefined}
        onClick={() => (!blocked ? onPress() : offline && onBlocked(reason))}
      >
        {children}
      </button>
      {offline && (
        <p id={why} className={s.small}>
          <T k={reason} />
        </p>
      )}
    </>
  );
}

// O2: one persistent line above the cards, only the highest condition (Q145 9); static, not a live region.
export function AttentionLine({ read, offline, onOpen }: { read: UsageRead; offline: boolean; onOpen: () => void }) {
  const attention = read.snapshot && deriveUsage(read.snapshot).attention;
  if (!attention) return null;
  return (
    <div id="usage-attention" className={`${s.notice} ${s.attention}`}>
      <p>{offline || !read.fresh ? <T k="usage.lastKnown" vars={{ attention: COPY[attention] }} /> : <T k={attention} />}</p>
      <button id="usage-attention-link" type="button" className={s.secondary} onClick={onOpen}>
        <L k="upload.viewUsage" />
      </button>
    </div>
  );
}

// O2 Usage card: its own loading, read failure with Try again (never a zero) and offline states.
export function UsageCard({ read, offline, onOpen, onRetry, onBlocked }: {
  read: UsageRead;
  offline: boolean;
  onOpen: () => void;
  onRetry: () => void;
  onBlocked: (key: CopyKey) => void;
}) {
  const u = read.snapshot;
  const outcome = read.held ?? read.outcome;
  return (
    <section id="usage-card" className={s.surface} aria-labelledby="usage-card-title">
      <h3 id="usage-card-title" tabIndex={-1}>
        <T k="usage.title" />
      </h3>
      {outcome === "loading" && !u && !offline && (
        <p aria-busy="true">
          <T k="common.loading" />
        </p>
      )}
      {RECOVERY.includes(outcome) && (
        <p id="usage-card-error" className={s.error}>
          <T k="usage.readError" />
        </p>
      )}
      {outcome === "error" && (
        <Guarded id="usage-retry" blocked={offline} offline={offline} reason="usage.retryOffline" describedBy="usage-card-error" onPress={onRetry} onBlocked={onBlocked}>
          <L k="common.tryAgain" />
        </Guarded>
      )}
      {u && (
        <p>
          <T k="usage.storageSummary" vars={{ used: size(u.total_bytes), budget: size(u.budget_bytes) }} />
        </p>
      )}
      {u && (offline || !read.fresh) && (
        <p className={s.help}>
          <T k={offline ? "usage.offline" : "usage.cached"} vars={{ time: time(u.read_at, u.timezone) }} />
        </p>
      )}
      {offline && !u && (
        <p className={s.help}>
          <T k="common.offline" />
        </p>
      )}
      {!(outcome === "loading" && !u && !offline) && (
        <button id="usage-entry-link" type="button" className={s.secondary} onClick={onOpen}>
          <L k="upload.viewUsage" />
        </button>
      )}
    </section>
  );
}

// A link label with "opens in a new tab" under it, one flex item, so the button keeps it together.
function NewTab({ k }: { k: CopyKey }) {
  return (
    <span className={s.newTab}>
      <L k={k} />
      <span>
        (<T k="usage.newTab" />)
      </span>
    </span>
  );
}

const JOB = { ok: "usage.jobOk", corrected: "usage.jobCorrected", failed: "usage.jobFailed", missed: "usage.jobMissed", never: "usage.jobNever" } as const;

function Panels({ u, onContent }: { u: Usage; onContent: () => void }) {
  const d = deriveUsage(u);
  const alertJob = d.job === "failed" || d.job === "missed";
  const percent = Math.floor(d.percent);
  const n = u.last_success_corrections;
  const band =
    d.level === "zero" ? "usage.zeroBudget"
    : d.level === "notice" ? "usage.notice"
    : d.level === "warning" ? (u.total_bytes * 5 === u.budget_bytes * 4 ? "upload.warning" : "usage.over80")
    : d.level === "full" ? "usage.full"
    : null;
  const storage = (
    <section key="storage" className={s.panel} aria-labelledby="storage-title">
      <h2 id="storage-title">
        <T k="upload.usage" />
      </h2>
      <div className={s.meterRow}>
        <div id="usage-meter" className={s.meter} data-level={d.level} role="meter" aria-labelledby="storage-title" aria-describedby="storage-amount" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <span style={{ width: `${d.percent}%` }} />
        </div>
        <p id="storage-amount">
          <T k="usage.storageUsed" vars={{ used: size(u.total_bytes), budget: size(u.budget_bytes) }} /> ({percent}%)
        </p>
      </div>
      {u.total_bytes === 0 && u.budget_bytes > 0 && (
        <p>
          <T k="usage.empty" />
        </p>
      )}
      {u.uploading_bytes > 0 && (
        <p>
          <T k="usage.uploading" vars={{ size: size(u.uploading_bytes) }} />
        </p>
      )}
      {u.deleting_bytes > 0 && (
        <p>
          <T k="usage.deleting" vars={{ size: size(u.deleting_bytes) }} />
        </p>
      )}
      {u.uploading_bytes + u.deleting_bytes > 0 && (
        <p className={s.small}>
          (<T k="usage.heldIncluded" />)
        </p>
      )}
      {band && (
        <p className={`${s.band} ${d.level === "warning" || d.level === "full" ? s.bandAlert : ""}`}>
          <T k={band} />
        </p>
      )}
      {(d.level === "warning" || d.level === "full") && (
        <button id="usage-content" type="button" className={s.secondary} onClick={onContent}>
          <L k="content.content" />
        </button>
      )}
    </section>
  );
  const job = (
    <section key="job" className={`${s.panel} ${alertJob ? s.jobFirst : s.jobLast}`} aria-labelledby="job-title">
      <h2 id="job-title">
        <T k="usage.job" />
      </h2>
      <p className={alertJob ? `${s.band} ${s.bandAlert}` : undefined}>
        <T k={JOB[d.job]} vars={{ n }} />
      </p>
      {d.job !== "never" && (
        <p>{u.last_success_at ? <T k="usage.lastSuccess" vars={{ time: time(u.last_success_at, u.timezone) }} /> : <T k="usage.noSuccess" />}</p>
      )}
      {alertJob && n > 0 && (
        <p>
          <T k="usage.priorCorrections" vars={{ n }} />
        </p>
      )}
      {d.lastAttemptShown && (
        <p>
          <T k={d.job === "missed" && u.last_attempt_result !== "200" ? "usage.lastAttemptFailed" : "usage.lastAttempt"} vars={{ time: time(u.last_attempt_at!, u.timezone) }} />
        </p>
      )}
      {d.job === "missed" && (
        <>
          <h3>
            <T k="usage.whatToDo" />
          </h3>
          <p>
            <T k="usage.cron" />
          </p>
        </>
      )}
      <p className={s.small}>
        <T k="usage.jobSchedule" />
      </p>
      <p className={s.small}>
        <T k="usage.github" />
      </p>
    </section>
  );
  // Egress is not measured in the app (Q145 1): the quota and a link to the provider's page.
  const egress = (
    <section key="egress" className={`${s.panel} ${s.egressPanel}`} aria-labelledby="egress-title">
      <h2 id="egress-title">
        <T k="usage.egress" />
      </h2>
      <p>
        <T k="usage.quota" />
      </p>
      <p className={s.small}>
        <T k="usage.egressHelp" />
      </p>
      <a id="usage-supabase" className={s.secondary} href="https://supabase.com/dashboard/org/_/usage" target="_blank" rel="noopener noreferrer">
        <NewTab k="usage.openSupabase" />
      </a>
    </section>
  );
  return <>{alertJob ? [job, storage, egress] : [storage, egress, job]}</>;
}

type ViewProps = {
  read: UsageRead;
  said: Said;
  offline: boolean;
  onLoad: (asked: boolean) => void;
  onSay: (key: CopyKey) => void;
  onBack: () => void;
  onContent: () => void;
};

export function UsageView({ read, said, offline, onLoad, onSay, onBack, onContent }: ViewProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const u = read.snapshot;
  const outcome = read.held ?? read.outcome;
  const recovery = RECOVERY.includes(outcome);
  const message = outcome === "401" ? "usage.session" : outcome === "403" ? "common.accessLost" : "usage.readError";
  const asked = useRef(false);
  const press = () => {
    asked.current = true;
    onLoad(true);
  };

  useEffect(() => {
    heading.current?.focus();
    onLoad(false);
    // Entry only: the view reads once when it opens.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Reconnecting starts the first read again when none succeeded and no retry is outstanding (not on entry: the
  // entry effect reads).
  const entered = useRef(false);
  useEffect(() => {
    if (entered.current && !offline && !u && read.outcome === "loading") onLoad(false);
    entered.current = true;
  }, [offline]); // eslint-disable-line react-hooks/exhaustive-deps
  // A redraw that removed the focused control: Try again (or Log out) when the read failed, else the heading.
  useEffect(() => {
    if (document.activeElement !== document.body) return;
    const next = recovery ? (document.getElementById("usage-retry") ?? document.getElementById("usage-logout")) : document.getElementById("usage-refresh");
    (asked.current && next ? next : heading.current)?.focus();
  }, [outcome]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`${s.page} ${s.wide}`}>
      <header className={s.usageTop}>
        <button id="usage-back" type="button" className={s.secondary} onClick={onBack}>
          <L k="navigation.back" />
        </button>
      </header>
      <main aria-labelledby="usage-title">
        <div className={s.usageHeading}>
          <div>
            <h1 id="usage-title" tabIndex={-1} ref={heading}>
              <T k="usage.title" />
            </h1>
            {u && (
              <p id="usage-updated" className={s.small}>
                <T k={offline ? "usage.offline" : read.fresh ? "usage.updated" : "usage.cached"} vars={{ time: time(u.read_at, u.timezone) }} />
              </p>
            )}
          </div>
          {!recovery && (
            <div>
              <Guarded id="usage-refresh" blocked={offline || read.outcome === "loading"} offline={offline} reason="usage.refreshOffline" onPress={press} onBlocked={onSay}>
                <L k="usage.refresh" />
              </Guarded>
            </div>
          )}
        </div>
        <p className={s.announcer} role="status" aria-live="polite" aria-atomic="true">
          <Spoken said={said} />
        </p>
        {offline && !u && (
          <p className={s.small}>
            <T k="common.offline" />
          </p>
        )}
        <div id="usage-body" className={s.usageBody}>
          {outcome === "loading" && !u && !offline && (
            <section className={`${s.panel} ${s.wideRow}`} aria-busy="true">
              <p>
                <T k="common.loading" />
              </p>
              <div className={s.skeleton} aria-hidden="true" />
            </section>
          )}
          {recovery && (
            <section className={`${s.panel} ${s.wideRow}`}>
              <p id="usage-read-error" className={s.error}>
                <T k={message} />
              </p>
              <div className={s.usageActions}>
                {outcome === "401" && (
                  // Keeps its href so Enter still presses it; offline the press only repeats the reason.
                  <a
                    id="usage-signin"
                    className={s.secondary}
                    href="/login?next=%2Fapp"
                    target="_blank"
                    rel="noopener"
                    aria-disabled={offline || undefined}
                    aria-describedby={offline ? "usage-signin-reason" : undefined}
                    onClick={(e) => {
                      if (!offline) return;
                      e.preventDefault();
                      onSay("usage.signInOffline");
                    }}
                  >
                    <NewTab k="content.signin" />
                  </a>
                )}
                {outcome === "401" && offline && (
                  <p id="usage-signin-reason" className={s.small}>
                    <T k="usage.signInOffline" />
                  </p>
                )}
                {outcome === "403" ? (
                  <form method="post" action="/api/owner/logout" onSubmit={(e) => offline && (e.preventDefault(), onSay("usage.logoutOffline"))}>
                    <button
                      id="usage-logout"
                      type="submit"
                      className={s.secondary}
                      aria-disabled={offline || undefined}
                      aria-describedby={["usage-read-error", offline && "usage-logout-reason"].filter(Boolean).join(" ")}
                    >
                      <L k="dashboard.logout" />
                    </button>
                    {offline && (
                      <p id="usage-logout-reason" className={s.small}>
                        <T k="usage.logoutOffline" />
                      </p>
                    )}
                  </form>
                ) : (
                  <Guarded id="usage-retry" blocked={offline} offline={offline} reason="usage.retryOffline" describedBy="usage-read-error" onPress={press} onBlocked={onSay}>
                    <L k="common.tryAgain" />
                  </Guarded>
                )}
              </div>
            </section>
          )}
          {u && outcome !== "401" && outcome !== "403" && <Panels u={u} onContent={onContent} />}
        </div>
      </main>
    </div>
  );
}
