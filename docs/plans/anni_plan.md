# Plan: anni (working name)

**Status:** v0.2, revised after the Codex adversarial challenge (harness step 5). Derived from `docs/anni_PRD.md` v0.4. Awaiting the owner gate. No code is written.
**Date:** 2026-10-21
**Privacy:** placeholders only.
**Single-source rule:** decisions and open questions live only in PRD §12; this plan links to them and never restates them. Research facts live only in §R of this plan.
**Labels:** **Verified** = read on the vendor's own page on 2026-10-21 (source in §R). **Unverified** = background knowledge or a secondary source; check before relying on it.

---

## 1. Architecture (proposal)

One content model, three presentations (World / Page / Static), server-side access control, $0 hosting.

```
Phone ──tap/scan──> https://<project>.vercel.app/g#<token>      (token in the URL fragment)
   │ page shell loads; client script reads the fragment, POSTs it to /api/guest/session,
   │ then clears the fragment from the address bar (history.replaceState)
   ▼
Next.js server route ── rate limit ── calls guest database functions with the ANON role
   │                                   (token → page, visibility, token version checked inside)
   ▼
Supabase Postgres: guest_* SECURITY DEFINER functions return only PUBLISHED rows of ENABLED sections
Owner / co-editor ── login ──> same app, editor routes, RLS by membership (user JWT)
Media: private bucket; short-lived signed URLs minted only after the same checks
```

Decisions that came out of the challenge (Codex finding → fix; see §11):

- **No service role on guest paths.** Guest reads and the guestbook write go through a small set of `guest_*` Postgres functions callable by the anon role, which derive the page from the validated token inside the database and apply page, visibility, token-version, section-enabled and publication predicates there. The service-role key (which bypasses RLS: verified) stays server-only and is used only for admin jobs such as account provisioning. This makes RLS and function checks a real second boundary.
- **Publication boundary.** Every content row has `status` (`draft` | `published`); guestbook rows have `pending` | `approved` | `rejected`. Guest predicates require `published`/`approved` and the section flag; media signing requires the media to belong to a published item.
- **Media and revocation.** Signed URLs are valid until their expiry and cannot be revoked by us (verified; Supabase says to contact support). So revocation of media is "no new URLs after the change, issued URLs die within the expiry". Proposed expiry: 5 minutes, responses `Cache-Control: private, no-store` for the minting endpoint. The alternative, proxying every media request through our server, gives instant revocation but spends Vercel transfer and CPU, and video streaming through functions is a poor fit for the Hobby limits. Owner decision: PRD Q29.
- **Token handling.** The token lives in the URL **fragment** (`#…`), which browsers do not send to servers, referrers or log lines; the page exchanges it for a signed, `HttpOnly`, `SameSite=Lax` guest session cookie bound to the token version, then clears the fragment. Fragment survival in Zalo/Facebook/Messenger browsers is **unverified** and must be tested on real devices. If cookies are blocked, the session lives in memory for that visit and the guest re-taps to return; the token is never put in a query string or path. A copied link or screenshot of the full URL **does** grant read and post access until the token is rotated; rotation means rewriting the tag and reprinting the QR, so the tag is never locked (Q16 open). Set `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex` on guest routes, and keep tokens out of analytics.
- **Accounts and the co-editor.** See PRD Q26 and Q30. Constraint from the vendor (verified): linking identities by an unverified email invites pre-account takeover, and the free built-in auth email only reaches project team members. Proposal: **closed registration**. Public sign-up is off; the owner creates or invites accounts. Google sign-in works for a pre-created account only when Google's verified email matches. A sign-up page is added only when the platform opens to other couples.
- **Storage behind an interface** so media can move to Cloudflare R2 (10 GB free, no egress fee: verified) when the egress trigger in §3 fires.
- **Keep-alive is best effort.** See §3.

## 2. Stack comparison and recommendation

Decision is the owner's; nothing below is installed.

| Layer | Recommendation | Alternatives | Notes |
|---|---|---|---|
| Framework | Next.js (App Router) + TypeScript on React 19 | SvelteKit, Astro + islands | Next.js is **unverified** here (its host is not on the approved list); chosen because Vercel hosts it natively and R3F is React |
| 3D | three.js (MIT) via React Three Fiber v9 (MIT; v9↔React 19) + drei | Babylon.js (engine with built-in editor and inspector, WebGPU; license not stated on its homepage); PlayCanvas (MIT engine; hosted editor, free tier lists "unlimited public projects") | Avoid PlayCanvas for private memories: assets would sit in a hosted editor |
| Database / auth / media | Supabase Free (owner's choice) | Neon + own auth + R2 | §3 |
| Hosting | Vercel Hobby | Cloudflare | Hobby is personal, non-commercial only (verified): fine now, must change if the site ever earns money |
| i18n | A Next.js i18n library (e.g. next-intl) | hand-rolled | **Unverified**; pick in foundations |
| Tests | Vitest + Playwright | Jest | A local Supabase needs Docker and the Supabase CLI: install needs owner approval (CLAUDE.md rule 1) |

## 3. Cost, limits and capacity (Supabase Free + Vercel Hobby = $0)

| Item | Verified fact | Consequence |
|---|---|---|
| Database | 500 MB | Text only; media never in the DB |
| File storage | 1 GB total; 50 MB max per file | ≈150 compressed photos (~300 KB) ≈ 45 MB; the rest for video: about 30–40 clips of ~25 MB. Client-side compression is mandatory |
| Egress | 5 GB, plus 5 GB cached egress | **Corrected arithmetic:** a 10 MB visit gives ~100 visits per GB, so ~500 such visits use the whole 5 GB. Design budget: a first visit loads ≤ 3 MB (thumbnails, lazy loading); full-resolution photos on tap; video click-to-play with a poster. That is roughly 1,600 first visits in 5 GB. Model event traffic (guests × views × video plays) before the event |
| Egress triggers | — | Warn at 60% and 80% of the 5 GB (owner dashboard + alert); at 80% switch videos to a lower bitrate and turn off autoplay; if the trigger repeats, move media to R2 |
| Inactivity | Supabase "may pause" Free projects with low activity over 7 days; only Pro guarantees no pause | A rarely tapped page can pause. Keep-alive below is best effort, not a guarantee |
| Image transformation | Pro and above only | Generate thumbnails/variants in the browser at upload |
| Auth email | Built-in: 2 messages/hour, team members only, best effort | Invites and password resets by email do not work for the co-editor |
| Auth users | 50,000 MAU | Not a constraint |
| Over-quota | Free plan: after a grace period, service restrictions (possible pause, read-only DB, HTTP 402) | Failure mode is downtime, not a charge |
| Vercel Hobby | 100 GB fast data transfer; 1M invocations; 4 h active CPU; cron at most once per day (±59 min); cannot buy extra | Keep-alive cron is allowed; precision is loose |
| Cloudflare R2 (optional) | 10 GB-month, 1M Class A, 10M Class B ops, no egress fee; beyond: $0.015/GB-month | Escape hatch; whether a payment method is required is **unverified** |
| Domain | Owner chose the free `*.vercel.app` address (PRD Q19). Cloudflare Registrar sells at cost but its page shows no .com price | The tag and QR URL are tied to that address |

**Availability plan (replaces "keep-alive prevents pausing"):** (1) a daily cron makes a trivial database read; (2) the cron run and the read are logged, and a missed run raises an alert; (3) an external uptime check on the guest URL (needs a monitoring vendor and host approval: not researched); (4) a tested restore procedure for a paused project, written in the runbook; (5) an event-day readiness check 48 hours before any gathering: open the guest URL cold, verify media loads; (6) the only guaranteed fix is a paid Supabase plan (from $25/month): owner decision PRD Q31.

## 4. Data model (sketch; refined in the design deliverable)

`users` (Supabase Auth) · `pages` (id, theme, default_lang, visibility ∈ {private, token_only, published}, enabled_sections, vanity_name?) · `memberships` (page_id, user_id, role ∈ {owner, co_editor}; one co-editor per page) · `invites` (page_id, email, token_hash, expires_at, consumed_at; consumed atomically) · `guest_tokens` (page_id, token_hash, version, active, rotated_at) · `memories`, `milestones`, `anniversaries`, later `places` (each: page_id, `status` draft|published, text in `lang` plus optional `text_alt`, `lang_alt`) · `guestbook_entries` (page_id, display_name required, text, status pending|approved|rejected, token_version, created_at) · `media` (page_id, owner_item_id, kind, bytes, variants, storage_key, alt_text, status inherited from its item).

Every table carries `page_id`. Guests never receive table access; they reach data only through the `guest_*` functions in §1.

## 5. NFC and QR flow (design deliverable outline)

1. Tag stores one NDEF **URL record**: `https://<project>.vercel.app/g#<token>` (short, so small tags fit; capacity of the bought tag is unverified).
2. **Android:** the OS reads the tag and opens the URL in the browser; no web code is needed. **iPhone XS and later:** background tag reading offers to open a Safari link for NDEF URL tags (Apple WWDC20 material via search summary; the Apple documentation body could not be read). Older iPhones and NFC-off phones use the QR code. Web NFC is not needed to open a link and has limited browser availability (MDN).
3. The page shell exchanges the fragment for a guest session (§1), then shows the page in the guest's language (header detection + toggle).
4. The QR code encodes the same URL and is printable from the owner dashboard.
5. Owner guidance: write once, test on one iPhone and one Android, do not lock the tag. Rotation = rewrite tag + reprint QR.

## 6. Theme system

Design tokens (CSS variables): colour roles, type scale with Vietnamese-capable fonts, spacing, radius, motion curves/durations, 3D parameters (palette, fog/ambient, particle style). A theme = token file + scene preset. Components and scenes read tokens only. Adding a theme = two files and a preview. Contrast checks run per theme.

## 7. 3D approach and performance budgets (proposals; set from a prototype on real phones)

- **Order (owner confirmed):** Static → Page → World. World is the preferred final experience, built after Page mode is evaluated; the deadline is flexible, so no feature is cut for time unless the owner says so.
- **Assets:** glTF/GLB only; compress geometry (Draco or Meshopt) and textures (KTX2). All three can coexist on one loader; decoders should be self-hosted and the KTX2 loader set before loading (three.js forum threads, secondary source, **unverified**; the official manual URLs returned 404). Optimise with glTF-Transform (named in the same threads).
- **Runtime:** lazy-load the 3D chunk after first content; cap device pixel ratio; render on demand where possible; instance repeated objects; limit draw calls; avoid synchronous GL queries (MDN, verified); handle `webglcontextlost`/`restored`; dispose resources when leaving sections.
- **Starting budgets:** first content ≤ 3 s on a mid-range phone over 4G; steady ≥ 30 fps in World mode on the test phones; automatic downgrade when sustained frame time exceeds budget.
- **Reach:** WebGL 2 on 97.13% of browsers, iOS Safari from 15 (verified); older goes to Static.
- **Accessibility:** every 3D section has a DOM equivalent reachable by keyboard and screen reader.

## 8. Tools, MCP servers and orchestration

### 8.1 Roles (proposal; approval is PRD Q32)

| Concern | Tool | Rule |
|---|---|---|
| Governance gate per unit of work (spec → failing test → code → review; risk approvals) | **harness-os** | Enabled after PRD and plan are approved; `harness init` commits, so ask first |
| Orchestration: split a phase into tasks, parallel agents, routing, local memory | **ruflo** | Limited scope, below |
| Independent challenge and review | **Codex** | `/codex:adversarial-review` at each plan gate; `/codex:review` before finalizing a phase |
| Browser verification and budgets | Playwright MCP, Chrome DevTools MCP (Lighthouse, traces) | Already configured |
| Library docs | Context7 MCP | Already configured |
| Deploy / inspect | Vercel MCP | Already connected; do not use before the owner approves hosting |

Claude Code stays the **single writer** of files and the only actor on git and network; ruflo agents and Codex return findings or patches for Claude to apply. All CLAUDE.md rules apply to every agent ruflo starts.

### 8.2 Ruflo in this repo: what was found and the proposed scope

Found (verified by reading the plugin and running it in a throw-away copy offline):

- Installed as plugins ruflo-core 0.2.11, ruflo-console 0.44.7, ruflo-mods 0.6.2. Hooks run on every Bash and Edit/Write and write runtime data to `.claude-flow/`, `.swarm/` and `agentdb.rvf*` in the repo root (all git-ignored; the Codex review did not include them).
- At 21:01–21:02 on 2026-10-21 a hook ran `npx ruflo@latest`, downloading 267 packages into `~/.npm/_npx`. It was not started by Claude and was not approved under rule 1. The hook falls back to `npx --prefer-offline`, so more downloads are possible whenever the cache misses. The package's npm page returned 403 to my fetch, so the npm publisher is **not verified**; the GitHub repo `ruvnet/ruflo` states it is the renamed Claude Flow (the README says mods "are not sandboxed", and its quick start pipes a script to bash).
- `ruflo init` is not safe to run as-is here: in a scratch copy, `--dry-run` still wrote 101 files; it adds pre-approved permissions for `npx @claude-flow*` and `mcp__claude-flow__*` (which would skip rule 1 prompts), an MCP entry that runs `npx -y ruflo@latest` on every launch, a plugin marketplace cloned from GitHub, and eight hook types that overlap harness-os's hooks. It left the existing `CLAUDE.md` unchanged.
- The ruflo MCP server failed to connect this session; its launcher honours `RUFLO_MCP_SKIP_NPX=1` to forbid the unpinned `npx` fallback.

Proposed scope until the owner says otherwise:

1. Use ruflo's agents (`ruflo-core:coder`, `researcher`, `reviewer`, `witness-curator`) and local memory as orchestration helpers; do not run `ruflo init`.
2. Add `RUFLO_MCP_SKIP_NPX=1` to the git-ignored `.claude/settings.local.json` so the MCP launcher cannot download. The owner reviews that exact change before I make it.
3. Do not start the ruflo MCP server, connect to `ruos.cognitum.one`, or install more ruflo plugins until the owner approves the host.
4. Keep ruflo's data directories out of Git and out of anything sent to Codex.
5. If the owner later wants full setup: preview in a scratch copy again, then hand-merge only the pieces that do not weaken rules 1–3 and do not collide with harness-os.

### 8.3 Other MCP and tool research

| Tool | Status | Use | Risk / gate |
|---|---|---|---|
| Supabase official MCP (`https://mcp.supabase.com/mcp`) | Not connected | Migrations, SQL, advisors, types | Browser OAuth sign-in needs owner approval (rule 1). Vendor: "carries security risks", use `read_only`, `project_ref`, feature groups; disable account management tools; use a development project, not real memories |
| Blender MCP (community, `ahujasid/blender-mcp`) | Not installed | Author 3D assets from Claude | Third-party; `execute_blender_code` runs arbitrary Python; socket has no authentication or encryption; safe mode off by default; default usage telemetry may be used to train AI; needs Blender and `uv`. Not recommended |
| Official MCP reference servers | Reviewed | — | The steering-group list has no 3D or Blender server |
| 3D asset or chibi generators, glTF-Transform, Next.js, next-intl, NFC tag datasheets, uptime-monitor vendors | **Not researched** | — | Hosts not approved; generators would also receive owner content (privacy gate) |

## 9. Delivery plan (target 14 Feb 2027, flexible; weeks from 2026-10-21)

| Phase | Weeks | Tasks | Tests first (PRD §9.2) | Gate |
|---|---|---|---|---|
| 0 Design | 1–2 | Design docs: sections, NFC flow, data model, theme system, 3D approach | — | Owner review of each |
| 1 Foundations | 3–4 | Skeleton, CI, Supabase project, RLS + `guest_*` functions, auth (closed registration, Google), pages/memberships/tokens/invites, visibility, publication status, privacy scan | E4–E6, E21, E22, E27–E30 | Before harness-os / spend |
| 2 Owner tools | 5–7 | Setup wizard, CRUD with draft/publish, media pipeline, usage meter and triggers, keep-alive + alerts | E7–E10, E15, E16, E23–E25 | Owner review |
| 3 Guest (Static + Page shell) | 8–10 | Token exchange, guest views, EN/VI, guestbook queue, QR/NFC, mode selector | E1, E2, E11–E14, E17, E26 | Owner review |
| 4 Themes + Page 3D | 10–13 | Four token sets, scene presets, per-section scenes, fallbacks | E18, E19 | Per theme |
| 5 World mode | 13–15 | Navigable whole-site scene, capability checks, switch | E17, E26 + budgets | Owner decides after seeing Page mode |
| 6 Hardening | 15–16 | Rate limits, monitoring, restore drill, real tag/QR test, event-day check | all rows | Go/no-go |
| After / last | — | Places map + chibi; legal + export/delete | E20 | — |

**Verification loop per step:** write the test or script → implement → run → compare → debug → update `docs/anni_progress.md`. Frontend steps use Playwright MCP on a phone viewport and Lighthouse/performance traces.

## 10. Open decisions

See PRD §12 (single source). Q29–Q32 are answered (5-minute media window, closed registration, best-effort availability at $0, limited ruflo scope). Still open: Q16 (tag model, left open by the owner) and Q20 (chibi art tool, after core).

## 11. Changes after the Codex challenge (2026-10-21)

All seven findings were checked against the vendor's own pages and held.

| Finding | Severity | Resolution |
|---|---|---|
| Signed media URLs outlive revocation | high | Accepted as a vendor limit (no revocation). Short expiry + minting only after checks; acceptance wording changed (PRD E4); owner picks the window or proxying (Q29) |
| RLS is no second defence when guest routes use the service role | high | Guest paths use anon-callable `guest_*` functions that enforce page/visibility/token version; service role admin-only; cross-tenant tests through real guest routes |
| Guest projection ignores draft/publication | high | `status` on all content; predicates require published/approved; applies to media signing; test for drafts in enabled sections (PRD E28) |
| One-time invite leaves pre-registered accounts unresolved | high | Proposal changed to closed registration with owner-provisioned accounts; Google only for pre-created accounts with matching verified email; test E29; owner confirms (Q30) |
| URL fallback keeps a reusable read-and-post credential exposed | high | Token moved to the URL fragment, exchanged for a session cookie and cleared; no query-string token; headers and log rules; PRD wording corrected to say leakage grants read access; fragment survival in in-app browsers to be tested (E30) |
| Egress estimate overstated fivefold | medium | My arithmetic error. Corrected to ~100 visits per GB; added first-visit budget and warn/degrade/migrate triggers |
| Daily cron treated as proof against pausing | medium | Reframed as best effort (Supabase "may pause"; only Pro guarantees); added alerts, uptime check, restore drill, event-day check; paid plan is Q31 |

---

## R. Research sources (read 2026-10-21; official pages unless stated)

- Supabase pricing https://supabase.com/pricing (Free: 500 MB DB, 1 GB storage, 50 MB per file, 5 GB egress + 5 GB cached, 50k MAU, pause after 1 week, 2 active projects; Pro from $25/mo)
- Supabase file limits https://supabase.com/docs/guides/storage/uploads/file-limits · image transformations https://supabase.com/docs/guides/storage/serving/image-transformations (Pro and above) · auth email https://supabase.com/docs/guides/auth/auth-smtp (2/hour, team members only)
- Supabase billing FAQ https://supabase.com/docs/guides/platform/billing-faq (restrictions when over quota) · going to production https://supabase.com/docs/guides/deployment/going-into-prod ("may pause" Free projects with low activity over 7 days; Pro guarantees no pause)
- Supabase signed URLs https://supabase.com/docs/guides/storage/serving/downloads (expiry fixed at creation; revocation only via support) · RLS https://supabase.com/docs/guides/database/postgres/row-level-security (service role bypasses RLS, server-only) · identity linking https://supabase.com/docs/guides/auth/auth-identity-linking (unverified-email linking risks pre-account takeover)
- Supabase MCP https://supabase.com/docs/guides/getting-started/mcp
- Vercel pricing https://vercel.com/pricing · fair use https://vercel.com/docs/limits/fair-use-guidelines (Hobby: non-commercial; limits) · cron https://vercel.com/docs/cron-jobs/usage-and-pricing (Hobby once per day, ±59 min). Both docs pages contained an `npx plugins add vercel/vercel-plugin` line; ignored.
- Cloudflare R2 pricing https://developers.cloudflare.com/r2/pricing/ (a subdomain of the approved cloudflare.com) · https://www.cloudflare.com/developer-platform/products/r2/ · Registrar https://www.cloudflare.com/products/registrar/
- three.js https://github.com/mrdoob/three.js (MIT; WebGL and WebGPU renderers) · React Three Fiber https://github.com/pmndrs/react-three-fiber (MIT; v8↔React 18, v9↔React 19; docs.pmnd.rs redirected to pmndrs.github.io, a host not approved, so not followed) · Babylon.js https://www.babylonjs.com/ · PlayCanvas https://playcanvas.com/
- MCP reference servers https://github.com/modelcontextprotocol/servers · Blender MCP https://github.com/ahujasid/blender-mcp · ruflo https://github.com/ruvnet/ruflo (npm page returned 403)
- WebGL 2 https://caniuse.com/webgl2 · WebGL best practices https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices · Web NFC https://developer.mozilla.org/en-US/docs/Web/API/Web_NFC_API
- iPhone background tag reading: Apple WWDC20 session 10209 via search summary https://developer.apple.com/videos/play/wwdc2020/10209/ (the documentation body could not be read: **unverified in detail**)
- Compression guidance: three.js forum threads, e.g. https://discourse.threejs.org/t/how-to-add-both-ktx2loader-and-dracoloader-for-compressed-glb/46726 (secondary)
- Local inspection (this machine): ruflo-core plugin scripts and manifest under `~/.claude/plugins/cache/ruflo/`; the npx cache `~/.npm/_npx/2ed56890c96f58f7`; a scratch-directory run of `ruflo init`.
