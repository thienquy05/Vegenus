# Design 1: NFC/QR guest token flow and access model

**Status:** DRAFT v0.1 for owner review (Phase 0 design deliverable "NFC flow"). No code.
**Date:** 2026-10-21
**Inputs:** PRD §4, §9.2, §12 (Q12, Q14, Q16, Q19, Q26, Q29, Q30); plan §1, §4, §5.
**Privacy:** placeholders only. `<host>` = the free `*.vercel.app` address (Q19). `<token>` is never a real value.
**Single-source rule:** decisions stay in PRD §12. New questions raised here are added there as Q34–Q35.

---

## 1. Goal and threat model

A guest who taps the tag or scans the QR sees the enabled, published sections and can leave one guestbook message for moderation, with no account. Everything else needs a login.

| Threat | Defence in this design |
|---|---|
| Guessing a token | 256-bit random token; rate limits on the exchange route; guessing is infeasible, not merely slow |
| Token in logs, referrers, analytics | Token travels only in the URL fragment and in a POST body; `Referrer-Policy: no-referrer`; analytics excluded from `/g` |
| Leaked link or screenshot | Accepted risk (PRD §4.3): grants guest read and post-to-queue until rotation. One-action rotation |
| Direct calls to the database API, bypassing our server | `guest_*` functions take the **token**, never a page ID, so the public API key alone opens nothing; post limits are enforced inside the database too |
| Cross-page access (tenant-ready) | The page is derived from the token inside the database; no route accepts a page ID from a guest |
| Drafts or pending entries leaking | Every guest function filters `published` / `approved` and enabled sections, including media URL minting (E28) |
| Cross-site form posts (CSRF) | `SameSite=Lax` cookie, `Origin` check, and a required custom header on guest POSTs |
| Stored XSS in guestbook text | Plain text only, escaped on render, length cap, no HTML or Markdown |

## 2. Actors and credentials

| Actor | Credential | Where checked | Can do |
|---|---|---|---|
| Owner | Supabase Auth session (Google or email/password, owner-provisioned, Q30) | RLS by `memberships` | Everything on their page |
| Co-editor | Same, account provisioned by the owner | RLS by `memberships`, role `co_editor` | Edit content, moderate guestbook (Q15) |
| Guest with token | Guest cookie holding the token (§4) | Inside `guest_*` functions | Read published content of enabled sections; post one message to the queue at a time |
| Visitor without token | None | — | Token-only page: the "tap the tag" screen only. Published page: read only, no posting (Q14) |

## 3. Token

- **Value:** 32 bytes from a CSPRNG, base64url without padding (43 characters).
- **URL:** `https://<host>/g#<token>`. The NDEF URI record shortens `https://` to a one-byte prefix code (NFC Forum URI record; **unverified** background knowledge, check against the tag writer). Total payload ≈ 50–70 bytes depending on `<host>`, which fits common small NTAG-class tags. The exact tag model is still open (Q16), so check capacity before buying. If a tag is too small, a 16-byte token (22 characters, 128 bits) is still safe against online guessing.
- **Storage:** `guest_tokens.token_hash = SHA-256(token)`. A fast hash is fine because the token is high-entropy random, not a password. The raw token is never stored (PRD §5). **Consequence:** the dashboard can show the link and QR **only once**, at creation or rotation. See Q34 for the alternative.
- **One active token per page.** Rotation inserts a new row with `version + 1` and sets the old one inactive in a single transaction.

## 4. Flow

```
Tag/QR ──> https://<host>/g#<token>
  1. Browser loads the /g shell (static, no data, noindex, no analytics).
  2. Script reads location.hash. Empty → screen G-E1 "Tap the tag or scan the QR".
  3. POST /api/guest/session  {token}   (header X-Anni-Guest: 1; Origin checked; rate limited per IP)
  4. Server calls guest_open(token) with the anon role:
       hash → active token? → page visibility ≠ private? → returns page summary, enabled sections, theme, default lang
       Otherwise it returns one generic "not available" result (no hint whether the token is wrong, rotated or the page is private)
  5. Server sets cookie  anni_g=<token>; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=<Q34>
  6. Client: history.replaceState removes the fragment, then routes to /g/home.
  7. Each later guest request: server reads the cookie → guest_*(token, …) → the same checks run again in the database.
```

**Change from plan §1.** The plan said a "signed cookie bound to the token version". If the server signed a cookie and then passed `page_id` + `version` to the database, the anon-callable functions would have to trust a page ID. Anyone holding the public API key could then call them with any page ID, and the database would no longer be a real second boundary. So the cookie carries the token itself (HttpOnly, so page scripts cannot read it), and the database checks it on every call. Rotation then takes effect on the very next request, without a session table. Plan §1 is updated to match.

**Cookies blocked** (some in-app browsers): the client keeps the token in memory and sends it in the request body for that visit. In this case **only**, it does not clear the fragment, so a reload or "Open in browser" still works. The guest sees a small notice that the visit will not be remembered (E30).

**Fragment dropped by an in-app browser:** step 2 sees an empty hash, so we cannot recover the token. Screen G-E2 explains how to open the link in Safari or Chrome from the app's menu, then tap again. The token is never moved to a query string or path (E30).

## 5. Guest database functions (contract, not code)

All are `SECURITY DEFINER`, take the token as the first argument, re-run the checks in §4 step 4, and return nothing for any failure.

| Function | Returns / does | Extra predicates |
|---|---|---|
| `guest_open(token)` | Page summary, enabled sections, theme, default language | — |
| `guest_list(token, section, cursor)` | Published items of an enabled section | `status = published`, section enabled |
| `guest_media_url(token, media_id)` | One signed URL, expiry 5 min (Q29) | Media belongs to a published item in an enabled section |
| `guest_guestbook_list(token, cursor)` | Approved entries | `status = approved` |
| `guest_guestbook_post(token, display_name, text, lang)` | Inserts a `pending` entry with `token_version` | Name 1–40 chars, text 1–500 chars (proposal, Q34); per-token and per-page rate limits enforced inside the function as well as at the server |

Published pages (Q14) also allow reading without a token through a separate `public_*` set with the same predicates. Posting always needs the token.

## 6. Revocation and state changes

| Owner action | New visits | Open guest sessions | Media URLs already issued | Pending guestbook entries |
|---|---|---|---|---|
| Rotate token | Old link: "not available" | Fail on next request | Expire within 5 min (vendor cannot revoke, plan §1) | Kept in the queue, marked with the old token version |
| Set page Private | "Not available" | Fail on next request | Expire within 5 min | Kept |
| Disable a section | Section absent from navigation; URL returns not found (E5) | Same on next request | Expire within 5 min | — |
| Unpublish an item | Item gone | Gone on next request | Expire within 5 min | — |

After a rotation, the dashboard shows the new link and QR once and reminds the owner to rewrite the tag (§3 consequence).

## 7. Owner and co-editor access (summary; decided in Q26/Q30)

Closed registration. The owner provisions both accounts. Google sign-in works only for a pre-created account whose verified Google email matches. How the co-editor gets a first credential without email is open: Q35.

## 8. Tests to write first (RED before GREEN)

Each row is written and **observed failing** before the code that makes it pass (plan §12). Level: DB = SQL tests against a local database; API = server route tests; E2E = Playwright on a phone viewport.

| Test | Level | PRD row |
|---|---|---|
| `guest_open` with unknown, rotated or inactive token returns the same empty result | DB | E3 |
| `guest_*` with a token of page A never returns rows or media of page B | DB + API | E6 |
| Draft items, pending entries and their media are never returned or signed | DB | E28 |
| Disabled section: absent from `guest_open`, not found by direct URL | DB + E2E | E5 |
| Private page: next request returns nothing, no URL minted | DB + API | E4 |
| Calling `guest_*` with only a page ID (no token) is impossible: no such signature exists | DB | E6 |
| Exchange route: token only in POST body; response sets HttpOnly cookie; no token in any log line | API | E27 |
| Fragment removed from the address bar after exchange | E2E | E27 |
| Empty fragment shows G-E1; cookies blocked keeps the visit working in memory | E2E | E30 |
| Guest POST without the custom header or with a foreign Origin is rejected | API | E11 |
| Guestbook: name required, length caps, HTML escaped, rate limit trips | DB + API + E2E | E11, E12 |
| `/g` responses carry `noindex`, `no-referrer`, `no-store` | API | E21 |
| Rotation: old cookie fails on the next request; new link works | API + E2E | E3 |
| Real tag on one iPhone and one Android; QR on both; one in-app browser | Manual, recorded | E1, E2 |
