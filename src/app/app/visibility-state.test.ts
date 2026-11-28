import { expect, test } from "vitest";
import type { Page } from "@/lib/setup";
import { dialogParts, initial, transition, type Event, type State } from "./visibility-state";

// O9 state (owner UI "O9 Published address and the O2 Visibility row for T3.1p"; `.design/published/CHECKS.md`), ported
// from the approved board's reducer. Placeholder data only.
const PAGE: Page = {
  version: 2, theme: "a_dreamy", default_lang: "en", label_a: "[PARTNER_A]", label_b: "[PARTNER_B]", timezone: "UTC",
  visibility: "token_only", vanity_name: null, setup_completed: true, sections: ["home", "memories"],
  storage_used_bytes: 0, storage_budget_bytes: 1, link: { version: 1, created_at: "2026-01-01T00:00:00.000Z", shown_at: null },
};
const page = (fields: Partial<Page> = {}): Page => ({ ...PAGE, ...fields });
const BASE = { visibility: "token_only", vanity_name: null, has_link: true };
const run = (s: State, ...events: Event[]) => events.reduce(transition, s);
const read = (s: State, p: Page | null, area: "visibility" | "sections" | null = null) =>
  transition(s, { type: "read-result", area, readId: s.readId, reply: { status: 200, body: { page: p, drafts: null } } });
const loaded = (p: Page = PAGE) => read(transition(initial(), { type: "read-request", area: null }), p);
const reply = (status: number, body: unknown = null) => ({ status, body });
const result = (area: "visibility" | "sections", status: number, body: unknown = null): Event => ({ type: "result", area, reply: reply(status, body) });
const publish = (name: string, s = loaded()) =>
  run(s, { type: "visibility", value: "published" }, { type: "address", value: name }, { type: "save-visibility", id: "id-1" });

test("a read draws both drafts from the snapshot; no page or setup unfinished is the setup prompt; a bad page is a read error", () => {
  const s = loaded(page({ visibility: "published", vanity_name: "our-page" }));
  expect(s).toMatchObject({ screen: "ready", draftVis: "published", draftName: "our-page", draftSections: ["home", "memories"] });
  expect(read(initial(), null).screen).toBe("setup");
  expect(read(initial(), page({ setup_completed: false })).screen).toBe("setup");
  expect(read(initial(), { ...PAGE, vanity_name: undefined } as unknown as Page).screen).toBe("read-error");
  expect(transition(initial(), { type: "read-result", area: null, readId: 0, reply: reply(401) }).screen).toBe("401");
  expect(transition(initial(), { type: "read-result", area: null, readId: 0, reply: reply(403) }).screen).toBe("403");
  expect(transition(initial(), { type: "read-result", area: null, readId: 0, reply: reply(0) }).screen).toBe("read-error");
});

test("Published needs a valid address: an invalid one shows its error on Save, a valid one asks to make the page public", () => {
  expect(publish("ab")).toMatchObject({ dialog: null, addressError: "visibility.addressShort" });
  expect(publish("https://[HOST]/p/x")).toMatchObject({ dialog: null, addressError: "visibility.addressPart" });
  expect(publish("a".repeat(41)).addressError).toBe("visibility.addressLong");
  const s = publish("  Our-Page ");
  expect(s).toMatchObject({ dialog: "public", addressError: null });
  const saving = transition(s, { type: "confirm", id: "id-2" });
  expect(saving.dialog).toBeNull();
  expect(saving.panels.visibility).toMatchObject({
    phase: "saving", payload: { request_id: "id-2", visibility: "published", vanity_name: "our-page", confirm: true, base: BASE },
  });
});

test("a published page asks before renaming; Token-only saves at once without an address; Private asks first", () => {
  const live = loaded(page({ visibility: "published", vanity_name: "our-page" }));
  expect(run(live, { type: "address", value: "new-page" }, { type: "save-visibility", id: "x" }).dialog).toBe("rename");
  const token = run(live, { type: "visibility", value: "token_only" }, { type: "save-visibility", id: "id-3" });
  expect(token.panels.visibility.payload).toEqual({
    request_id: "id-3", visibility: "token_only", base: { visibility: "published", vanity_name: "our-page", has_link: true },
  });
  expect(run(live, { type: "visibility", value: "private" }, { type: "save-visibility", id: "x" }).dialog).toBe("private");
});

test("the confirm text follows the saved state, the link and a kept or new address", () => {
  const keys = (s: State) => dialogParts(s).map((part) => part.key);
  expect(keys(publish("our-page"))).toEqual(["visibility.publicBody", "visibility.linkKeepsWorking"]);
  expect(keys(publish("our-page", loaded(page({ visibility: "private" }))))).toEqual(["visibility.publicBody", "visibility.linkWorksAgain"]);
  expect(keys(publish("our-page", loaded(page({ vanity_name: "our-page", link: null }))))).toEqual(["visibility.publicBody", "visibility.addressWorksAgain"]);
  expect(keys(publish("new-page", loaded(page({ vanity_name: "our-page", link: null }))))).toEqual([
    "visibility.publicBody", "visibility.addressMayWorkAgain", "visibility.previousAddressReserved",
  ]);
  const live = loaded(page({ visibility: "published", vanity_name: "our-page" }));
  expect(keys(run(live, { type: "address", value: "new-page" }, { type: "save-visibility", id: "x" }))).toEqual([
    "visibility.currentAddress", "visibility.renameBody", "visibility.newAddress", "visibility.addressMayWorkAgain", "visibility.searchResults",
  ]);
  expect(keys(run(live, { type: "visibility", value: "private" }, { type: "save-visibility", id: "x" }))).toEqual([
    "visibility.privateBody", "visibility.searchResults", "visibility.unpublish",
  ]);
});

test("a saved reply that matches says Saved; one changed again elsewhere says superseded and adopts it", () => {
  const saving = transition(publish("our-page"), { type: "confirm", id: "id-1" });
  const saved = page({ visibility: "published", vanity_name: "our-page" });
  expect(transition(saving, result("visibility", 200, { page: saved }))).toMatchObject({
    snap: saved, draftVis: "published", draftName: "our-page", panels: { visibility: { phase: "ready", note: "visibility.saved" } },
  });
  const other = page({ visibility: "published", vanity_name: "next-page" });
  expect(transition(saving, result("visibility", 200, { page: other }))).toMatchObject({
    draftName: "next-page", panels: { visibility: { phase: "ready", note: "visibility.saveSuperseded" } },
  });
});

test("a taken or refused address stays with its slug through radio changes and clears for a different slug", () => {
  const saving = transition(publish("taken-page"), { type: "confirm", id: "id-1" });
  const taken = transition(saving, result("visibility", 409, { error: "name_taken" }));
  expect(taken).toMatchObject({ rejectedName: "taken-page", addressError: "visibility.addressTaken", panels: { visibility: { phase: "ready" } } });
  const away = run(taken, { type: "visibility", value: "token_only" });
  expect(away.addressError).toBeNull();
  expect(run(away, { type: "visibility", value: "published" }).addressError).toBe("visibility.addressTaken");
  expect(run(taken, { type: "address", value: " TAKEN-page" }).addressError).toBe("visibility.addressTaken");
  expect(run(taken, { type: "address", value: "free-page" })).toMatchObject({ addressError: null, rejectedName: null });
  const long = transition(transition(publish("our-page"), { type: "confirm", id: "x" }), result("visibility", 400, { error: "invalid_name", reason: "length" }));
  expect(long.addressError).toBe("visibility.addressLong");
  const unknown = transition(transition(publish("our-page"), { type: "confirm", id: "x" }), result("visibility", 400, { error: "invalid_name" }));
  expect(unknown.addressError).toBe("visibility.addressSummary");
});

test("a pasted line break shows the format error at once", () => {
  const s = run(loaded(), { type: "visibility", value: "published" }, { type: "address", value: "our page", paste: true });
  expect(s.addressError).toBe("visibility.addressPart");
});

test("a 2xx without a valid page counts as committed and waits for the shared read", () => {
  const saving = transition(publish("our-page"), { type: "confirm", id: "id-1" });
  const committed = transition(saving, result("visibility", 200, { page: { visibility: "published" } }));
  expect(committed.panels.visibility).toMatchObject({ phase: "reloading", payload: { request_id: "id-1" } });
  const settled = read(committed, page({ visibility: "published", vanity_name: "our-page" }), "visibility");
  expect(settled.panels.visibility).toMatchObject({ phase: "ready", note: "visibility.saved" });
});

test("a lost answer is Unconfirmed and Try again repeats the same request; after a 401 the retry belongs to sign-in recovery", () => {
  const saving = transition(publish("our-page"), { type: "confirm", id: "id-1" });
  for (const status of [0, 503]) expect(transition(saving, result("visibility", status)).panels.visibility.phase).toBe("unconfirmed");
  const retry = run(saving, result("visibility", 0), { type: "retry-write" });
  expect(retry.panels.visibility).toMatchObject({ phase: "saving", retry: true, payload: { request_id: "id-1" } });
  const auth = transition(retry, result("visibility", 401));
  expect(auth).toMatchObject({ screen: "401", authArea: "visibility", panels: { visibility: { phase: "unconfirmed" } } });
  const back = transition(auth, { type: "signed-in" });
  expect(back.screen).toBe("ready");
  // Check saved settings: the read decides. A different read keeps the draft and says the save was not confirmed.
  const checking = transition(back, { type: "retry-read" });
  expect(checking.panels.visibility).toMatchObject({ phase: "reloading", payload: { request_id: "id-1" } });
  const unconfirmed = read(checking, PAGE, "visibility");
  expect(unconfirmed).toMatchObject({
    draftVis: "published", draftName: "our-page", panels: { visibility: { phase: "ready", note: "visibility.saveNotConfirmed" } },
  });
  expect(read(checking, page({ visibility: "published", vanity_name: "our-page" }), "visibility").panels.visibility.note).toBe("visibility.saved");
});

test("an ordinary save that meets 401 keeps the draft and revalidates after sign-in", () => {
  const auth = transition(transition(publish("our-page"), { type: "confirm", id: "id-1" }), result("visibility", 401));
  expect(auth).toMatchObject({ screen: "401", authArea: null, draftName: "our-page", panels: { visibility: { phase: "ready" } } });
  expect(transition(auth, { type: "retry-read" }).screen).toBe("loading");
});

test("a conflict offers Reload; the read replaces that panel's draft only", () => {
  const s = run(loaded(), { type: "section", value: "together" }, { type: "visibility", value: "private" }, { type: "save-visibility", id: "x" }, { type: "confirm", id: "id-1" });
  const conflict = transition(s, result("visibility", 409, { error: "conflict" }));
  expect(conflict.panels.visibility.phase).toBe("conflict");
  const reloading = transition(conflict, { type: "reload", area: "visibility" });
  expect(reloading.panels.visibility).toMatchObject({ phase: "reloading", payload: null });
  // Visibility edits wait for the conflict Reload.
  expect(transition(reloading, { type: "visibility", value: "token_only" })).toBe(reloading);
  const after = read(reloading, page({ visibility: "private" }), "visibility");
  expect(after).toMatchObject({ draftVis: "private", draftSections: ["home", "memories", "together"], panels: { visibility: { phase: "ready" } } });
});

// Carried from the final design review (owner UI O9, "Carried to the T3.1p build"): the read after a conflict Reload
// fails or needs sign-in, then the retried read settles the panel (the component moves focus from the heading to Save).
test("Conflict, Reload, the read fails or answers 401, and the retried read settles the panel", () => {
  for (const status of [0, 401]) {
    const conflict = transition(transition(publish("our-page"), { type: "confirm", id: "id-1" }), result("visibility", 409, { error: "conflict" }));
    const reloading = transition(conflict, { type: "reload", area: "visibility" });
    const failed = transition(reloading, { type: "read-result", area: "visibility", readId: reloading.readId, reply: reply(status) });
    expect(failed.screen, String(status)).toBe(status === 401 ? "401" : "read-error");
    expect(failed.panels.visibility.phase).toBe("reloading");
    const loading = transition(failed, { type: "retry-read" });
    expect(loading.screen).toBe("loading");
    const settled = read(transition(loading, { type: "read-request", area: "visibility" }), PAGE, "visibility");
    expect(settled).toMatchObject({ screen: "ready", draftVis: "token_only", panels: { visibility: { phase: "ready" } } });
  }
});

test("edits made during a save are judged against the reply: satisfied, rebased, or Conflict", () => {
  const saving = run(loaded(), { type: "visibility", value: "private" }, { type: "save-visibility", id: "x" }, { type: "confirm", id: "id-1" });
  const later = transition(saving, { type: "visibility", value: "published" });
  const rebased = transition(later, result("visibility", 200, { page: page({ visibility: "private" }) }));
  expect(rebased).toMatchObject({ draftVis: "published", panels: { visibility: { phase: "ready", note: "visibility.saved" } } });
  const conflict = transition(later, result("visibility", 200, { page: page({ visibility: "token_only", vanity_name: null }) }));
  expect(conflict.panels.visibility).toMatchObject({ phase: "conflict", note: "visibility.saveSuperseded" });
});

test("a read during a save waits; a newer snapshot that changes the draft's base closes an open confirm as a conflict", () => {
  const saving = run(loaded(), { type: "section", value: "together" }, { type: "save-sections", id: "id-1" });
  expect(transition(saving, { type: "read-request", area: null }).refreshPending).toBe(true);
  const asking = publish("our-page");
  const changed = read(transition(asking, { type: "read-request", area: null }), page({ visibility: "private" }));
  expect(changed).toMatchObject({ dialog: null, panels: { visibility: { phase: "conflict" } } });
});

test("one save at a time, offline blocks sending, and a save in flight when the connection drops is Unconfirmed", () => {
  const saving = run(loaded(), { type: "section", value: "together" }, { type: "save-sections", id: "id-1" });
  expect(run(saving, { type: "visibility", value: "private" }, { type: "save-visibility", id: "x" }).dialog).toBeNull();
  const offline = transition(saving, { type: "connection", offline: true });
  expect(offline.panels.sections.phase).toBe("unconfirmed");
  const idle = run(loaded(), { type: "connection", offline: true }, { type: "visibility", value: "private" });
  expect(idle.draftVis).toBe("private");
  expect(transition(idle, { type: "save-visibility", id: "x" })).toBe(idle);
});

test("Back with unsaved changes asks to discard; Discard leaves", () => {
  const dirty = run(loaded(), { type: "visibility", value: "private" }, { type: "back" });
  expect(dirty).toMatchObject({ dialog: "discard", exit: "back", go: null });
  expect(transition(dirty, { type: "discard" })).toMatchObject({ dialog: null, go: "back" });
  expect(transition(loaded(), { type: "create-link" }).go).toBe("share");
});

// Review fixes (T3.1pb): the select fallback, the rest of the 401 rule (CHECKS line 112) and read staleness.
test("the Select fallback note clears on the owner's next action but survives reads and results", () => {
  const live = loaded(page({ visibility: "published", vanity_name: "our-page" }));
  const refused = transition(live, { type: "copy-refused" });
  expect(refused.copyNote).toBe("share.select");
  expect(read(transition(refused, { type: "read-request", area: null }), page({ visibility: "published", vanity_name: "our-page" })).copyNote).toBe("share.select");
  expect(transition(refused, { type: "section", value: "together" }).copyNote).toBeNull();
});

test("after a sign-in read that does not confirm the save, a later draft that differs from both enters Conflict", () => {
  const saving = transition(publish("our-page"), { type: "confirm", id: "id-1" });
  const lost = transition(saving, result("visibility", 0));
  const later = run(lost, { type: "visibility", value: "token_only" }, { type: "retry-write" });
  const checking = run(later, result("visibility", 401), { type: "signed-in" }, { type: "retry-read" });
  const settled = read(checking, page({ visibility: "private" }), "visibility");
  expect(settled.panels.visibility).toMatchObject({ phase: "conflict", note: "visibility.saveNotConfirmed" });
  expect(settled.draftVis).toBe("token_only");
});

test("a field rejection survives sign-in recovery and returns with Published", () => {
  const taken = transition(transition(publish("taken-page"), { type: "confirm", id: "id-1" }), result("visibility", 409, { error: "name_taken" }));
  const saving = run(taken, { type: "visibility", value: "private" }, { type: "save-visibility", id: "x" }, { type: "confirm", id: "id-2" });
  const checking = run(saving, result("visibility", 0), { type: "retry-write" }, result("visibility", 401), { type: "signed-in" }, { type: "retry-read" });
  const settled = read(checking, page({ visibility: "private" }), "visibility");
  expect(settled.panels.visibility.note).toBe("visibility.saved");
  expect(settled.rejectedName).toBe("taken-page");
  expect(transition(settled, { type: "visibility", value: "published" }).addressError).toBe("visibility.addressTaken");
});

test("a read answered after a save started is stale and changes nothing", () => {
  const asked = transition(loaded(), { type: "read-request", area: null });
  const saving = run(asked, { type: "section", value: "together" }, { type: "save-sections", id: "id-1" });
  const late = transition(saving, { type: "read-result", area: null, readId: asked.readId, reply: { status: 200, body: { page: page({ visibility: "private" }), drafts: null } } });
  expect(late).toBe(saving);
});
