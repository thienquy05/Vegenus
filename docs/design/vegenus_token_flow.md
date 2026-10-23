# Design 1: NFC/QR guest token flow and access model

**Status:** v0.2, **approved by the owner 2026-10-23** (v0.2, 2026-10-22: token lifecycle and rotation §3.1, show-once discussion §3.2, deny-by-default §9, guest accounts §10, email and Zodiac data rules §11) (Phase 0 design deliverable "NFC flow"). No code.
**Date:** 2026-10-21
**Inputs:** PRD §4, §9.2, §12 (Q12, Q14, Q16, Q19, Q26, Q29, Q30); plan §1, §4, §5.
**Privacy:** placeholders only. `<host>` = the free `*.vercel.app` address (Q19). `<token>` is never a real value.
**Single-source rule:** decisions stay in PRD §12. New questions raised here are added there as Q34–Q41.

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
| Visitor without token | None | `public_*` functions: Published pages only | Token-only or Private page: the "tap the tag" screen only. Published page: read published sections, read-only, posting actions hidden (Q14, Q36 confirmed) |
| Guest account (optional, Q38) | Email-verified login bound to one page | `account_*` functions: validated identity + an active `guest_accounts` row for that page (§5.1) | Same reads as a token holder; post with a prefilled name; keep email preferences |

## 3. Token

- **Value:** 32 bytes from a CSPRNG, base64url without padding (43 characters).
- **URL:** `https://<host>/g#<token>`. The NDEF URI record shortens `https://` to a one-byte prefix code (NFC Forum URI record; **unverified** background knowledge, check against the tag writer). Total payload ≈ 50–70 bytes depending on `<host>`, which fits common small NTAG-class tags. The exact tag model is still open (Q16), so check capacity before buying. If a tag is too small, a 16-byte token (22 characters, 128 bits) is still safe against online guessing.
- **Storage:** `guest_tokens.token_hash = SHA-256(token)`. A fast hash is fine because the token is high-entropy random, not a password. The raw token is never stored (PRD §5). **Consequence:** the dashboard can show the link and QR **only once**, at creation or rotation. See Q34 for the alternative.
- **One active token per page.** Rotation inserts a new row with `version + 1` and sets the old one inactive in a single transaction.

### 3.1 How a token is assigned (lifecycle)

A token is assigned to the **page**, not to a person. Everyone who taps the same tag carries the same token. Individual identity only exists if a guest makes an account (§10).

1. **Create.** In screen O8 the owner presses "Create guest link". The **server** (never the browser) draws 32 random bytes with a CSPRNG, stores `SHA-256(token)` in `guest_tokens` (`version`, `active`), and returns the link once in that response. The QR is drawn in the browser from the same string, with no outside QR service (rule 1).
2. **Write to the tag.** The owner copies the link into an NFC writer app and writes one NDEF URL record. Which app and which tag model are still open (Q16, rule 1 for any install). Do not lock the tag, or rotation becomes impossible.
3. **Use.** A tap or scan opens the link; §4 exchanges the fragment for a guest cookie (30 days, Q34).
4. **The tag is the secret.** The URL sits in readable form on the tag, so anyone who can hold a phone to the tag can read it. Place it accordingly.

**Rotation** (O8 "Rotate", with a confirm):
- In one transaction the server creates a new token (`version + 1`) and marks the old one inactive. There is no overlap by default.
- Effects: the old link and every cookie holding it fail on the **next request** (the database re-checks); the new link is shown once; pending guestbook entries stay in the queue marked with the old version (§6).
- The old tag is dead the moment you rotate, so rotate when you are ready to rewrite the tag: rotate, rewrite, test one tap on each phone type.
- Registered guest accounts (§10) are **not** removed by rotation (Q38 default); rotation stops new sign-ups through the old link. Removing a guest account is a separate owner action.
- Optional later: a grace window where the old token still works for N hours. Not in the first version (a leaked token is the reason people rotate).

### 3.2 Show once or show again (Q34a: decided 2026-10-22 by Claude and Codex, owner delegated)

**Decision: A, show once, hash only.** Codex agreed and corrected my reasoning: a stolen owner session can already rotate to a token the attacker knows, so "stolen session" is not a real advantage of A; recoverable encryption adds key custody, a credential-reveal endpoint and rotation of the key; and a printed QR sheet is itself another readable credential.

| | A. Show once (default) | B. Store encrypted, show again |
|---|---|---|
| Stored | Hash only | Hash for checks, plus the token encrypted with a key in an environment variable |
| Lost link | Rotate, rewrite the tag (about 5 minutes) | Open the dashboard and copy it |
| If the database leaks | Nothing usable | Still safe unless the key leaks as well |
| If the owner's session is stolen | Attacker can rotate, not read the link | Attacker can read the live link |
| Extra work | Printable QR sheet at creation | Encryption code, key handling, key rotation, more tests |

Recovery rules that make A safe:
- **Printing is optional.** The creation screen offers a QR download, with a warning that a printed or saved QR is a live credential: store it privately and destroy copies after rotation.
- **Reading the tag back** with an NFC reader app is a recovery path while the tag still works (rotation time is an estimate, not a measured figure; many distributed QR copies or an unreachable tag make it longer).
- **Response lost after create or rotate:** the dashboard shows "link not shown yet" (`token_shown_at` is empty) and offers "Rotate again". Rotation is idempotent per request id, so a double click or a retry creates one new token, and two concurrent rotations resolve to one active token (unique partial index on `active`).
- If the owner later chooses B: require a recent re-login, authenticated encryption with a key id, and change PRD §5's hash-only rule first.

## 4. Flow

```
Tag/QR ──> https://<host>/g#<token>
  1. Browser loads the /g shell (static, no data, noindex, no analytics).
  2. Script reads location.hash. Empty → screen G-E1 "Tap the tag or scan the QR".
  3. POST /api/guest/session  {token}   (header X-vegenus-Guest: 1; Origin checked; rate limited per IP)
  4. Server calls guest_open(token) with the anon role:
       hash → active token? → page visibility ≠ private? → returns page summary, enabled sections, theme, default lang
       Otherwise it returns one generic "not available" result (no hint whether the token is wrong, rotated or the page is private)
  5. Server sets cookie  vegenus_g=<token>; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=<Q34>
  6. Client: history.replaceState removes the fragment, then routes to /g/home.
  7. Each later guest request: server reads the cookie → guest_*(token, …) → the same checks run again in the database.
```

**Change from plan §1.** The plan said a "signed cookie bound to the token version". If the server signed a cookie and then passed `page_id` + `version` to the database, the anon-callable functions would have to trust a page ID. Anyone holding the public API key could then call them with any page ID, and the database would no longer be a real second boundary. So the cookie carries the token itself (HttpOnly, so page scripts cannot read it), and the database checks it on every call. Rotation then takes effect on the very next request, without a session table. Plan §1 is updated to match.

**Cookies blocked** (some in-app browsers): the client keeps the token in memory and sends it in the request body for that visit. In this case **only**, it does not clear the fragment, so a reload or "Open in browser" still works. The guest sees a small notice that the visit will not be remembered (E30).

**Fragment dropped by an in-app browser:** step 2 sees an empty hash, so we cannot recover the token. Screen G-E2 explains how to open the link in Safari or Chrome from the app's menu, then tap again. The token is never moved to a query string or path (E30).

## 5. Guest database functions (contract, not code)

All are `SECURITY DEFINER`, take the token as the first argument, re-run the checks in §4 step 4, and return nothing for any failure. The read functions are callable by `anon`; `guest_guestbook_post` and `guest_register` are callable only by our server's `vegenus_server` role, so the per-device and per-IP limits cannot be skipped by calling the database directly (design 3 §3.9).

| Function | Returns / does | Extra predicates |
|---|---|---|
| `guest_open(token)` | Page summary, enabled sections, theme, default language | — |
| `guest_list(token, section, cursor)` | Published items of an enabled section | `status = published`, section enabled |
| `guest_media_url(token, media_id)` | One signed URL, expiry 5 min (Q29) | Media belongs to a published item in an enabled section |
| `guest_guestbook_list(token, cursor)` | Approved entries | `status = approved` |
| `guest_guestbook_post(token, display_name, text, lang)` | Inserts a `pending` entry with `token_version` | Name 1–40 chars, text 1–500 chars (proposal, Q34); per-token and per-page rate limits enforced inside the function as well as at the server |

### 5.1 Three explicit contracts (Codex finding 1 and 2)

| Contract | Caller | Authorization checked on every call | Allowed |
|---|---|---|---|
| `public_*` (`public_open`, `public_list`, `public_guestbook_list`, `public_media_url`) | Anyone, no credential | Page `visibility = published`; section enabled; item `published` / entry `approved`; media belongs to such an item | Read only. No posting. Media URLs 5 min (Q29) |
| `guest_*` (above) | Holder of the current token | Active token, current version, page visibility ≠ private, plus the same publication predicates | Read; post to the queue |
| `account_*` (`account_open`, `account_list`, `account_guestbook_list`, `account_media_url`, `account_guestbook_post`, `account_profile_get/set`; `account_guestbook_list` and `account_media_url` added 2026-10-23, found missing while specifying a G1 draft) | Signed-in guest account | Validated identity (`auth.uid()`), an **active** `guest_accounts` row bound to one page, page visibility ≠ private, plus the publication predicates | Read; post to the queue under the account's attribution; read/write own profile and email preferences only |

`public_open` and `account_open` return the same page summary as `guest_open`: enabled sections, theme, default language (design 4 §9, 2026-10-23).

Rules for accounts: they do not depend on the token or its version. Removal of the `guest_accounts` row or setting the page Private stops access on the next call. Guests have no insert or update rights on `memberships`, `guest_accounts` role or page fields (accounts are created only by the verification function in §10, never from client-submitted metadata or an email match). Account-authored guestbook entries store `account_id` and show the account's display name; they are still `pending` until approved. Private pages return nothing on all three contracts.

## 6. Revocation and state changes

| Owner action | New visits | Open guest sessions | Media URLs already issued | Pending guestbook entries |
|---|---|---|---|---|
| Rotate token | Old link: "not available" | Fail on next request | Expire within 5 min (vendor cannot revoke, plan §1) | Kept in the queue, marked with the old token version |
| Set page Private | "Not available" | Fail on next request | Expire within 5 min | Kept |
| Disable a section | Section absent from navigation; URL returns not found (E5) | Same on next request | Expire within 5 min | — |
| Unpublish an item | Item gone | Gone on next request | Expire within 5 min | — |

After a rotation, the dashboard shows the new link and QR once and reminds the owner to rewrite the tag (§3 consequence).

## 7. Owner and co-editor access (summary; decided in Q26/Q30)

Closed registration (Q30). Per Q35 (confirmed 2026-10-22) the two partners use **one shared owner account**. The owner provisions it. Google sign-in works only for a pre-created account whose verified Google email matches. The `co_editor` role stays in the data model but has no screen and no provisioning flow until a second account is wanted.

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
| Unauthenticated request to every route in the route table gets the allowed result only | API (crawler) | E31 |
| A route or server action without a table entry fails the build | CI | E32 |
| Guest account or co-editor on an owner-only action, or another page's ID, refused | API + DB | E33 |
| After log out, back button shows no private content; authed responses `no-store` | E2E | E34 |
| Login `next=https://other.site` is ignored | API | E35 |
| As the anon database role: `select` on every table returns nothing or is denied; only `guest_*` execute | DB | E36 |
| Guessed paths (`/home`, `/admin`, `/dashboard`) are not-found or login redirect and reveal nothing | E2E | E37 |
| Guest sign-up: needs a token session, verified email, rate limits, per-page cap; rotation closes the door | DB + API | E38 |
| `public_*` returns nothing for Token-only/Private pages, drafts, pending entries; media minting requires published; no posting path from `public_*` | DB + API | E31, E36, E28 |
| `account_*`: removed account, Private page, other page's ID all return nothing; guest cannot write `memberships`/`guest_accounts` | DB | E33 |
| Pending registration: expiry purge, atomic cap under concurrent verify, generic response for all outcomes, rotation invalidates pending | DB + API | E38 |
| Partner birth date (Zodiac): invalid date rejected; stored value is ciphertext; guest functions never return it; no log line contains it (design 3 §9) | API + DB | E40 |

## 9. Deny by default: no unauthenticated bypass

Owner requirement (2026-10-22): nobody may open an owner page such as `/home` or `/app` without authentication. Principle: **everything is closed unless a rule opens it**, enforced in four independent layers.

| Layer | Rule | Why a single layer is not enough |
|---|---|---|
| 1. Route table | One file lists every route and server action with a class: `public` (landing, `/g` shell, login, health check, static, and the read-only Published-page routes that call `public_*` only), `guest` (token or account), `member` (the owner account). An unlisted route is not-found, and CI fails if the build contains a route that is not in the table | Stops "forgot to protect the new page" |
| 2. Handler check | Every page, route handler and server action starts with `requireMember()` or `requireGuest()`. It asks the auth service to validate the session (not just "a cookie exists"). Server actions are public POST endpoints, so they get the same check | Middleware-only protection has failed in this ecosystem before (a middleware bypass in Next.js was disclosed in 2025; **unverified, from background knowledge**, check when the framework is approved), so middleware is a convenience, never the only gate |
| 3. Database | Row-level security on every table with no anon access. Guests reach data only through `guest_*` functions that take a token. Member rows are filtered by `memberships` | A bug in the web server still cannot hand out another page's rows |
| 4. Storage | Private buckets; signed URLs minted only after the same checks; 5-minute expiry (Q29) | Direct bucket links do not exist |

Behaviour for the owner's example:
- `/home` or any unknown path: not-found, same page for everyone.
- `/app` or `/app/...` with no session: redirect to login, with no page data in the response. After login the user returns to a **relative** path only (E35).
- Authenticated pages are `Cache-Control: no-store`; log out clears the cookie, so the back button shows nothing private (E34).
- A guest session or guest account on `/app/...`: same login redirect, no hint that the area exists beyond the login page.
- Errors for "wrong token", "rotated token" and "private page" are one identical response (already §4).
- IDs in URLs are always resolved through the caller's rights (no direct object access); the page is never taken from the URL for a guest.

## 10. Guest accounts (optional; owner asked 2026-10-22; Q38)

Possible: yes. A guest who already holds a valid token session can press "Save my place".

```
G1 (token session) → "Save my place" → email (+ optional display name)
  → server checks: token session valid, rate limits (per IP, per address), page cap (default 50)
  → verification email through Resend (needs Q37 Phase B) with a one-time link
  → link opens the site, creates the account, role = guest, bound to this page
  → later visits: tag tap still works; or sign in with the emailed link / password
```

- The account gives identity (prefilled name, "my wishes") and email preferences. It does **not** give edit rights; the role is checked in the database (§5.1).
- **Registration hardening (Codex finding 3):**
  - A `pending_registrations` row (address hash, page, token version at request time, expiry 30 min) is created per request; unverified rows expire and are purged. The verification link is single-use and bound to that page and row.
  - **Atomic cap:** account creation counts and inserts in one transaction; concurrent verifications cannot exceed the cap (default 50).
  - **Send budgets:** per token, per page and global per day, plus a per-address cooldown, shared by registration, sign-in link and reset mail. Over budget: no mail sent, same generic response.
  - **No enumeration:** the response to "send me a link" is identical whether the address is new, existing, blocked or rate-limited.
  - **Recheck at consumption:** the page must not be Private, the cap not full, and the registration not expired. A link requested before a rotation but used after it still works only if the owner has not rotated since the request (rotation invalidates pending registrations), so a leaked link cannot be turned into durable access afterwards.
  - Membership is never derived from submitted metadata or from an email match.
  - O8 explains that rotation keeps existing guest accounts, and O15 offers "Remove all guest accounts" as the separate revocation.
- Because the link comes from a token session, a person with no token cannot register. A leaked link can, so: caps, rate limits, an owner list with "remove", and rotation closing the door (E38).
- If email to guests is not available (no domain yet), guest accounts wait. A no-email variant (name + passcode) would have no recovery and no reminders, so it is not proposed.
- The owner and the partner use the member login (email/password stored in our database by Supabase Auth, Google as an optional fallback, Q35). Google needs an OAuth client set up with its provider, which is why it is the fallback, not the first path.

## 11. Email and Zodiac data rules (summary; full rows in PRD §4.3, E39-E42)

- **Sending:** server only. The vendor API key lives in an environment variable and is never in Git, CI or the browser. A dedupe key per message prevents double sends; a daily cap guards the free quota; a bounce disables the address.
- **Content rules:** emails never contain a guest token, a guest-cookie link, private memory text or media. They link to the login page. Non-account mail carries a one-click opt-out.
- **Which mail:** welcome (after verification), anniversary reminder to the owner (N days before, from the page's anniversaries), new-wish digest to the owner (once a day, not one mail per wish), wish-approved thank-you to a guest account that posted, verify and reset mail.
- **Idempotency:** the vendor supports an `Idempotency-Key` header kept for 24 hours (plan §R), so a retry in that window cannot double-send; our own `email_log` dedupe key covers longer gaps.
- **Scheduling:** reuse the daily keep-alive job to dispatch reminders (the host's cron limits on the free plan are **unverified**).
- **Zodiac (corrected by the owner 2026-10-22):** the section is about the **couple**. Guests never enter a birthday. The owner enters the partners' birth dates in the dashboard; the server computes the signs and stores the dates encrypted (design 3 §3.10, Q46-Q49). Before that table exists, the design must specify: AES-256-GCM with a unique random nonce per value, key id and user id as associated data, key backup and rotation, behaviour when the key is missing, server-side validation, consent withdrawal, and removal from queues and backups under a stated retention. An environment variable is where the key lives, not a key-management plan. Analytics, error reports and session recordings must not capture the date field.

