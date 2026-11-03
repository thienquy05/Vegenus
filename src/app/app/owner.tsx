"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { dashState, resumeStep, type Drafts, type Page } from "@/lib/setup";
import type { CopyKey } from "./copy";
import { Announcers, L, LogOut, SectionList, T, useOnline } from "./parts";
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
  status?: CopyKey | null;
  // The result's heading or message, focused after a read the owner asked for.
  headingRef?: RefObject<HTMLElement | null>;
};

export function Dashboard({ state, page, offline, onSetup, onRetry, status, headingRef }: Props) {
  const h2 = headingRef as RefObject<HTMLHeadingElement | null> | undefined;
  const message = headingRef as RefObject<HTMLParagraphElement | null> | undefined;
  const reason = offline ? "offline-reason" : undefined;
  const alert = state === "error" ? "common.readError" : state === "accessLost" ? "common.accessLost" : null;
  return (
    <div className={s.page}>
      <header className={s.topbar}>
        <h1 className={s.topbarText}>
          <T k="dashboard.overview" />
        </h1>
      </header>
      <main className={s.main}>
        <Announcers status={status} alert={alert} />
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
        {state === "done" && page && (
          <div className={s.dashboard}>
            <section className={`${s.surface} ${s.summary}`}>
              <h2 tabIndex={-1} ref={h2}>
                <bdi>{page.label_a}</bdi> &amp; <bdi>{page.label_b}</bdi>
              </h2>
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
          </div>
        )}
        <LogOut />
      </main>
    </div>
  );
}

export default function Owner() {
  const router = useRouter();
  const online = useOnline();
  const [state, setState] = useState<State>("loading");
  const [data, setData] = useState<{ page: Page | null; drafts: Drafts | null }>({ page: null, drafts: null });
  const [wizard, setWizard] = useState(false);
  const [status, setStatus] = useState<CopyKey | null>(null);
  // A Finish whose outcome is unknown keeps its retry through Leave and resume (owner UI O3 states).
  const [uncertain, setUncertain] = useState(false);
  const heading = useRef<HTMLElement>(null);
  const focusResult = useRef(false);
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
  }, [state, wizard]);

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
          read();
        }}
      />
    );
  }
  return (
    <Dashboard
      state={state}
      page={data.page}
      offline={!online}
      status={status}
      headingRef={heading}
      onSetup={() => {
        setStatus(null);
        setWizard(true);
      }}
      onRetry={() => {
        focusResult.current = true;
        read();
      }}
    />
  );
}
