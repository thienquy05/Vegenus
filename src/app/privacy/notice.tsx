"use client";
import type { MouseEvent } from "react";
import { NOTICE, PRIVACY, type Pair } from "@/lib/privacy";
import s from "./privacy.module.css";

export type NoticeLang = "en" | "vi";

// P1 Privacy & cookies (T3.2c; privacy design §3): the fixed text in one language, no switch on the page (Q67). The
// same body as a sheet in the page's theme (level 2, under the sheet's own row) and standalone at /privacy (level 1).
export function PrivacyNotice({ lang, level }: { lang: NoticeLang; level: 1 | 2 }) {
  const say = (pair: Pair) => pair[lang === "en" ? 0 : 1];
  const Title = level === 1 ? "h1" : "h2";
  const Heading = level === 1 ? "h2" : "h3";
  // Focus moves to the heading without touching the address: a guest link may sit in its fragment (token flow §4).
  const jump = (event: MouseEvent, n: number) => {
    event.preventDefault();
    const heading = document.getElementById(`privacy-${n}`);
    heading?.scrollIntoView({ block: "start" });
    heading?.focus({ preventScroll: true });
  };
  const { caption, head, rows } = NOTICE.table;
  return (
    <div className={s.notice} lang={lang}>
      <div className={s.top}>
        <Title id="privacy-title" tabIndex={-1}>
          {say(NOTICE.title)}
        </Title>
        <p className={s.muted}>{say(NOTICE.updated).replace("{date}", PRIVACY.updated)}</p>
      </div>
      <nav className={s.contents} aria-labelledby="privacy-contents">
        <Heading id="privacy-contents">{say(NOTICE.contents)}</Heading>
        <ol>
          {NOTICE.sections.map((section, n) => (
            <li key={n}>
              <a href={`#privacy-${n + 1}`} onClick={(event) => jump(event, n + 1)}>
                {say(section.heading)}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className={s.text}>
        {NOTICE.sections.map((section, n) => (
          <section key={n} aria-labelledby={`privacy-${n + 1}`}>
            <Heading id={`privacy-${n + 1}`} tabIndex={-1}>
              {n + 1}. {say(section.heading)}
            </Heading>
            {section.table && (
              <table className={s.table}>
                <caption>{say(caption)}</caption>
                <thead>
                  <tr>
                    {head.map((cell, k) => (
                      <th key={k} scope="col">
                        {say(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([name, ...cells], r) => (
                    <tr key={r}>
                      <th scope="row">{say(name)}</th>
                      {cells.map((cell, k) => (
                        // data-label names each value when the table becomes records on a phone
                        <td key={k} data-label={say(head[k + 1])}>
                          {say(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {section.blocks.map((block, k) => (
              <p key={k}>{say(block)}</p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
