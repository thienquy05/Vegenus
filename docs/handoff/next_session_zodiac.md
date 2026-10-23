# Handoff prompt: Zodiac follow-ups (copy everything below the line into a new session)

---

You are continuing the `anni` project (repo root: this folder). Read `CLAUDE.md` first and follow it exactly: planning and design only (no application code), the network gate (rule 1: name the exact host and wait for my approval before any login, install, download or web read), no git writes unless I ask in that moment (rule 2), the privacy gate with placeholders only (rule 3), and the branch and PR flow where only I merge (rule 4). Standing rule: after each design or plan unit, run the Codex adversarial review yourself (`node <codex plugin>/scripts/codex-companion.mjs adversarial-review "<focus>"`), fix every valid finding without asking, repeat until Codex approves, then give me a summary of what, why and how. Keep `docs/anni_progress.md` current after every step.

Read before starting: `docs/design/anni_data_model.md` (design 3, especially §3.3, §3.10, §3.11, §9), `docs/anni_PRD.md` §12 (Q39, Q46-Q50), `docs/design/anni_screens.md` (Z1, Z2), `docs/anni_progress.md`.

Background you need (decided 2026-10-22, already in the docs):
- The Zodiac section is about the **couple**, not the guests. The owner enters each partner's birth date, birthplace (picked from a list shipped with the app) and optional birth time in the dashboard (Z1). They are stored encrypted in `partner_profiles.birth_data_enc`. Guests never enter a birthday.
- Two systems. **Western:** sun sign; Moon and rising sign with time and place. **Vietnamese 12 con giáp:** lunisolar calendar for UTC+7 with the year starting at Tết; year, month and day pillars, hour pillar with time, and mệnh by nạp âm. Signs are computed once at save and stored.
- Guests see a **published snapshot** only. Basic level by default (sun sign, element, year animal, mệnh). Details (Moon, rising, pillars, event line) need a per-partner opt-in with a warning. Near Tết the basic level can narrow the birthday below 14 days, so Publish shows the exact count and lets the owner consent or hide the animal.
- Readings are composed from our own EN/VI reference texts (`zodiac_ref_signs`, `zodiac_ref_relations`, `zodiac_ref_sources`), seeded from files in Git. No runtime AI, and no external service ever receives birth data.

Work items, in this order. Each one goes on its own branch off `master`:

1. **Fix PR #2 (`docs/zodiac-sign-assets`, 12 Western constellation SVGs).** Codex said not ready to merge. Ask me before fetching it from GitHub, and before any commit or push.
   - [high] Its doc edits (PRD Q39, screens Z2, progress, README) describe the superseded guest-birthday flow. Drop those doc edits; `master` already has the corrected docs. Rebase onto `master`.
   - [medium] The README says the artwork is "complete". Reword it as "Western set" and track the 12 Vietnamese animals (Tý Chuột, Sửu Trâu, Dần Hổ, Mão Mèo, Thìn Rồng, Tỵ Rắn, Ngọ Ngựa, Mùi Dê, Thân Khỉ, Dậu Gà, Tuất Chó, Hợi Lợn) as a separate, required item.
   - [medium] All 12 SVGs share the ids `title`, `desc`, `h`, `g`, `l`. Prefix the ids and their `url(#…)` / `aria-labelledby` references per sign, and update `manifest.json` checksums and sizes.
   - These SVGs are non-personal, so they can ship in Git as the built-in default art (design 3 §3.3 placeholder rule). Keep the `privacy-scan` exception in plan §12.2 limited to the files listed in the manifest. The folder name `zodic-sign` was my request; keep it unless I say otherwise.
2. **Ask me Q50** (event on the birthday): where suggestions come from, and whether guests may see the line. Default: I pick or write the line; suggestions come from an encyclopedia's "on this day" data read once and stored as reference data; hidden from guests unless I opt in.
3. **Zodiac research (design 3 §3.10-3.11).** First list the exact hosts and wait for my approval. Proposed hosts: `www.informatik.uni-leipzig.de` (Hồ Ngọc Đức's Vietnamese lunar calendar), `en.wikipedia.org`, `vi.wikipedia.org`; more as needed. Verify and record in plan §R:
   - The UTC+7 new-moon and solar-term method, and an independent Tết table for the supported range (proposal 1920-2030), including years where Vietnam and China differ.
   - Vietnam's historical UTC offsets and how the IANA time-zone database records them.
   - Western sun-sign boundary table and cusp handling; Moon and ascendant calculation.
   - An astronomy library that runs offline on our server with a licence that fits (avoid AGPL or commercial); its install needs rule-1 approval.
   - The source and licence for the birthplace list (latitude, longitude, IANA zone).
   - Nạp âm table (60 can chi → mệnh), branch relations (tam hợp, lục hợp, tứ hành xung, lục hại), element cycles (sinh, khắc).
   - Then write our own EN/VI reference texts (no copying), with sources in `zodiac_ref_sources`, labelled "for fun / theo quan niệm dân gian".
4. **Vietnamese animal artwork:** 12 square transparent SVGs in the same style, prefixed ids, the same safety checks (no scripts, no external references, no raster), and a manifest.
5. Then the next design deliverables: design 4 (theme system), then design 5 (3D approach), each with an owner gate.

Kept for Phase 2 (do not research now): the storage facts marked **unverified** in design 3 §3.4 (object size at insert, bucket size limits, maximum upload duration or cancel/drain) and the `anni_server` connection method in §3.9.
