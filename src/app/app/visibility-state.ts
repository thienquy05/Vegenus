import { validPage, type Page } from "@/lib/setup";
import { normalizeVanity, vanityReason } from "@/lib/vanity";
import type { CopyKey } from "./copy";

// O9 state (owner UI "O9 Published address and the O2 Visibility row for T3.1p"; PRD Q146, Q155-Q157;
// `.design/published/CHECKS.md`), ported from the approved board's reducer and kept free of the browser so it can be
// unit tested. Two panels, one save at a time; every save names a request id (Try again repeats it) and, for
// Visibility, the saved values its draft was based on. One recovery path settles both panels.

export type Area = "visibility" | "sections";
export type Base = { visibility: string; vanity_name: string | null; has_link: boolean };
export type VisibilityPayload = { request_id: string; visibility: string; base: Base; confirm?: true; vanity_name?: string };
export type SectionsPayload = { request_id: string; base_sections: readonly string[]; sections: string[] };
export type Payload = VisibilityPayload | SectionsPayload;
export type Panel = { phase: "ready" | "saving" | "conflict" | "reloading" | "unconfirmed"; note: CopyKey | null; payload: Payload | null; retry?: boolean };
export type Screen = "loading" | "ready" | "read-error" | "401" | "403" | "setup";
export type Exit = "back" | "share";
export type State = {
  screen: Screen;
  snap: Page | null;
  offline: boolean;
  draftVis: string;
  draftName: string; // as typed
  baseVis: Base | null; // captured at the first edit, kept through confirms and retries
  rejectedName: string | null; // the normalized slug the server refused, and why
  rejectedError: CopyKey | null;
  addressError: CopyKey | null;
  copyNote: CopyKey | null;
  draftSections: string[];
  baseSections: readonly string[];
  panels: Record<Area, Panel>;
  area: Area | null; // the panel that last changed phase
  authArea: Area | null; // an Unconfirmed retry that met 401 belongs to sign-in recovery
  readId: number; // the latest read; a save or a newer read makes older answers stale
  refreshPending: boolean; // a read asked for during a save, run when it settles
  dialog: "private" | "public" | "rename" | "discard" | null;
  exit: Exit | null;
  go: Exit | null;
};
export type Reply = { status: number; body: unknown };
export type Event =
  | { type: "connection"; offline: boolean }
  | { type: "read-request"; area: Area | null }
  | { type: "read-result"; area: Area | null; readId: number; reply: Reply }
  | { type: "result"; area: Area; reply: Reply }
  | { type: "back" | "create-link" | "discard" | "dismiss" | "signed-in" | "retry-read" | "retry-write" }
  | { type: "reload"; area: Area }
  | { type: "copied" | "copy-refused" | "clear-copy" }
  | { type: "visibility"; value: string }
  | { type: "address"; value: string; paste?: boolean }
  | { type: "section"; value: string }
  | { type: "save-visibility" | "save-sections" | "confirm"; id: string };

const AREAS: Area[] = ["visibility", "sections"];
const READY: Panel = { phase: "ready", note: null, payload: null };
const EDITABLE = ["memories", "together", "guestbook"];
export const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));
export const editable = (sections: readonly string[]) => sections.filter((x) => x !== "zodiac");
export const baseOf = (page: Page): Base => ({ visibility: page.visibility, vanity_name: page.vanity_name ?? null, has_link: !!page.link });
const sameVis = (page: Page, base: Base | null) => !!base && page.visibility === base.visibility && (page.vanity_name ?? null) === base.vanity_name;
const sameBase = (page: Page, base: Base | null) => sameVis(page, base) && !!page.link === base!.has_link;
const isVis = (payload: Payload | null): payload is VisibilityPayload => !!payload && "visibility" in payload;

const REASON: Record<string, CopyKey> = {
  empty: "visibility.addressEmpty", format: "visibility.addressPart", characters: "visibility.addressCharacters", hyphens: "visibility.addressHyphens",
};
const lengthError = (name: string): CopyKey => (name.length < 3 ? "visibility.addressShort" : "visibility.addressLong");
export function addressError(input: string): CopyKey | null {
  const reason = vanityReason(input);
  return !reason ? null : reason === "length" ? lengthError(normalizeVanity(input)) : REASON[reason];
}

export const dirtyVisibility = (s: State) =>
  !!s.snap && (s.draftVis !== s.snap.visibility || (s.draftVis === "published" && normalizeVanity(s.draftName) !== (s.snap.vanity_name ?? "")));
export const dirtySections = (s: State) => !!s.snap && !same(editable(s.snap.sections), s.draftSections);
export const activeSave = (s: State) => AREAS.find((a) => ["saving", "unconfirmed", "reloading"].includes(s.panels[a].phase));
// A conflict Reload of Visibility holds its radios and address until the read.
export const conflictReload = (s: State) => s.panels.visibility.phase === "reloading" && !s.panels.visibility.payload;

export const initial = (offline = false): State => ({
  screen: "loading", snap: null, offline, draftVis: "token_only", draftName: "", baseVis: null, rejectedName: null, rejectedError: null,
  addressError: null, copyNote: null, draftSections: [], baseSections: [], panels: { visibility: READY, sections: READY }, area: null,
  authArea: null, readId: 0, refreshPending: false, dialog: null, exit: null, go: null,
});

function fromSnapshot(s: State, page: Page | null): State {
  return {
    ...s, snap: page, screen: page?.setup_completed ? "ready" : "setup", draftVis: page?.visibility ?? "token_only",
    draftName: page?.vanity_name ?? "", baseVis: null, rejectedName: null, rejectedError: null, addressError: null, copyNote: null,
    draftSections: page ? editable(page.sections) : [], baseSections: page?.sections ?? [],
  };
}
function updatePanel(s: State, area: Area, phase: Panel["phase"], note: CopyKey | null = null, payload: Payload | null = null, retry = false): State {
  const authArea = s.authArea === area && (!payload || payload.request_id !== s.panels[area].payload?.request_id) ? null : s.authArea;
  return {
    ...s, area, authArea, panels: { ...s.panels, [area]: { phase, note, payload, ...(retry ? { retry } : {}) } },
    ...(phase === "saving" ? { readId: s.readId + 1 } : {}),
  };
}
const accessLost = (s: State): State => ({
  ...fromSnapshot(s, s.snap), screen: "403", dialog: null, exit: null, authArea: null, panels: { visibility: READY, sections: READY },
});

// A newer snapshot replaces the saved values and keeps each panel's draft that is edited or busy.
function mergeDrafts(s: State, page: Page, area: Area | null, keepDraft: boolean): State {
  const next = fromSnapshot(s, page);
  const editedAddress = s.draftVis === "published" && s.draftName !== (s.snap?.vanity_name ?? "");
  if (area === "visibility" ? keepDraft : dirtyVisibility(s) || editedAddress || !!s.rejectedName || s.panels.visibility.phase !== "ready") {
    Object.assign(next, { draftVis: s.draftVis, draftName: s.draftName, addressError: s.addressError, baseVis: s.baseVis });
  }
  if (area === "sections" ? keepDraft : dirtySections(s) || s.panels.sections.phase !== "ready") {
    Object.assign(next, { draftSections: s.draftSections, baseSections: s.baseSections });
  }
  return next;
}
function applyRead(s: State, page: Page, area: Area | null, keepDraft = false, resolvedName: string | null = null): State {
  let next = mergeDrafts({ ...s, authArea: null }, page, area, keepDraft);
  if (s.snap && sameVis(page, baseOf(s.snap))) next.copyNote = s.copyNote;
  // A server rejection stays with its slug until the slug changes or a newer answer resolves it.
  if (s.rejectedName && s.rejectedName === normalizeVanity(next.draftName) && s.rejectedName !== resolvedName) {
    Object.assign(next, { rejectedName: s.rejectedName, rejectedError: s.rejectedError });
    if (next.draftVis === "published") next.addressError = s.rejectedError;
  } else if (area !== "visibility" && next.draftVis === "published" && s.addressError) {
    next.addressError = addressError(next.draftName);
  }
  if (area !== "visibility" && ((next.baseVis && !sameBase(page, next.baseVis))
    || (["private", "public", "rename"].includes(s.dialog ?? "") && !!s.snap?.link !== !!page.link))) {
    next = updatePanel({ ...next, dialog: null }, "visibility", "conflict", "visibility.conflict");
  }
  if (area === "visibility" && dirtySections(s) && !same(page.sections, next.baseSections)) {
    next = updatePanel(next, "sections", "conflict", "visibility.conflict");
  }
  return next;
}

type Draft = { visibility?: string; vanity_name?: string | null; sections?: readonly string[] };
const matchesSave = (page: Draft, area: Area, payload: Payload) =>
  area === "visibility" && isVis(payload)
    ? page.visibility === payload.visibility && (page.vanity_name ?? null) === (payload.vanity_name ?? payload.base.vanity_name)
    : same(editable(page.sections ?? []), (payload as SectionsPayload).sections);

// The shared recovery path: whether the server confirmed the commit decides the request's message; edits made after
// Save are judged on their own (satisfied, rebased, or Conflict).
function recoverSave(s: State, page: Page, area: Area, confirmed: boolean): State {
  const payload = s.panels[area].payload!;
  const visibility = area === "visibility";
  const draft: Draft = visibility
    ? { visibility: s.draftVis, vanity_name: s.draftVis === "published" ? normalizeVanity(s.draftName) : (s.snap?.vanity_name ?? null) }
    : { sections: s.draftSections };
  const submitted = matchesSave(page, area, payload);
  const draftMatches = visibility
    ? page.visibility === draft.visibility && (draft.visibility !== "published" || page.vanity_name === draft.vanity_name)
    : same(editable(page.sections), draft.sections!);
  const laterDraft = !matchesSave(draft, area, payload);
  const unconfirmed = !confirmed && !submitted;
  const conflict = laterDraft && !submitted && !draftMatches;
  const resolvedName = visibility && submitted && isVis(payload) ? (payload.vanity_name ?? null) : null;
  const hiddenRejection = visibility && draft.visibility !== "published" && s.rejectedName === normalizeVanity(s.draftName) && s.rejectedName !== resolvedName;
  const keepDraft = (!draftMatches && (unconfirmed || laterDraft)) || (hiddenRejection && (submitted || unconfirmed) && !(laterDraft && draftMatches));
  const next = applyRead(s, page, area, keepDraft, resolvedName);
  if (!conflict || unconfirmed) {
    if (!visibility) next.baseSections = page.sections;
    else next.baseVis = unconfirmed || dirtyVisibility(next) ? baseOf(page) : null;
  }
  const note: CopyKey = unconfirmed ? "visibility.saveNotConfirmed" : !submitted ? "visibility.saveSuperseded" : visibility ? "visibility.saved" : "visibility.sectionsSaved";
  return updatePanel(next, area, conflict ? "conflict" : "ready", note);
}

type Parsed = { kind: "saved"; page: Page } | { kind: "committed" | "unconfirmed" | "401" | "403" | "conflict" | "setup" | "refused" } | { kind: "field"; taken: boolean; reason?: string };
function parseSave({ status, body }: Reply): Parsed {
  const b = body as { page?: unknown; error?: string; reason?: string } | null;
  if (status === 0 || status >= 500) return { kind: "unconfirmed" };
  if (status >= 200 && status < 300) return validPage(b?.page) ? { kind: "saved", page: b.page } : { kind: "committed" };
  if (status === 401 || status === 403) return { kind: status === 401 ? "401" : "403" };
  if (status === 400 && b?.error === "invalid_name") return { kind: "field", taken: false, reason: b.reason };
  if (status === 409 && b?.error === "name_taken") return { kind: "field", taken: true };
  if (status === 409 && b?.error === "conflict") return { kind: "conflict" };
  if (status === 409 && ["setup_not_finished", "wording_not_published"].includes(b?.error ?? "")) return { kind: "setup" };
  return { kind: "refused" };
}

// The Select fallback note lasts until the owner's next action; reads and save results keep it (the board's rule).
export function transition(s: State, e: Event): State {
  const next = step(s, e);
  return s.copyNote === "share.select" && !["copied", "copy-refused", "read-request", "read-result", "result"].includes(e.type)
    ? { ...next, copyNote: null }
    : next;
}

function step(s: State, e: Event): State {
  const active = activeSave(s);
  if (e.type === "connection") {
    const next = { ...s, offline: e.offline };
    return e.offline && active && s.panels[active].phase === "saving"
      ? updatePanel(next, active, "unconfirmed", "visibility.unconfirmed", s.panels[active].payload)
      : next;
  }
  if (e.type === "read-request") {
    if (active && (s.panels[active].phase !== "reloading" || e.area !== active)) return s.refreshPending ? s : { ...s, refreshPending: true };
    return { ...s, readId: s.readId + 1, refreshPending: active ? s.refreshPending : false };
  }
  if (e.type === "read-result") {
    if (e.readId !== s.readId) return s;
    if (active && (s.panels[active].phase !== "reloading" || e.area !== active)) return s;
    const { status, body } = e.reply;
    if (status === 403) return accessLost(s);
    if (status === 401) return { ...s, screen: "401", dialog: null, exit: null };
    const page = status === 200 ? (body as { page?: unknown } | null)?.page : undefined;
    if (page === undefined || (page !== null && !validPage(page))) return { ...s, screen: "read-error", dialog: null, exit: null };
    if (!page?.setup_completed) {
      return { ...fromSnapshot(s, page), dialog: null, exit: null, authArea: null, refreshPending: false, panels: { visibility: READY, sections: READY } };
    }
    if (e.area && s.panels[e.area].phase === "reloading") {
      if (s.panels[e.area].payload) return recoverSave(s, page, e.area, s.authArea !== e.area);
      return updatePanel(applyRead(s, page, e.area), e.area, "ready");
    }
    return applyRead(s, page, null);
  }
  if (e.type === "dismiss") return { ...s, dialog: null, exit: null };
  if (e.type === "back" || e.type === "create-link" || (e.type === "discard" && s.dialog === "discard")) {
    if (e.type !== "discard" && (dirtyVisibility(s) || dirtySections(s) || active)) {
      return { ...s, dialog: "discard", exit: e.type === "back" ? "back" : "share" };
    }
    return { ...s, dialog: null, go: e.type === "discard" ? s.exit : e.type === "back" ? "back" : "share" };
  }
  if (e.type === "signed-in" && s.screen === "401" && active && s.panels[active].phase === "unconfirmed") return { ...s, screen: "ready" };
  if (s.offline && !["visibility", "section", "address", "copied", "copy-refused"].includes(e.type)) return s;
  if (e.type === "retry-read" && active && s.authArea === active && s.panels[active].phase === "unconfirmed") {
    return updatePanel({ ...s, screen: "ready" }, active, "reloading", null, s.panels[active].payload);
  }
  if (e.type === "retry-read") return { ...s, screen: "loading" };
  if (e.type === "reload") return !active && s.panels[e.area].phase === "conflict" ? updatePanel(s, e.area, "reloading") : s;
  if (e.type === "retry-write") {
    return s.screen === "ready" && active && s.panels[active].phase === "unconfirmed"
      ? updatePanel(s, active, "saving", null, s.panels[active].payload, true)
      : s;
  }
  if (e.type === "result") {
    const panel = s.panels[e.area];
    if (panel.phase !== "saving") return s;
    const parsed = parseSave(e.reply);
    if (parsed.kind === "conflict") return updatePanel(s, e.area, "conflict", "visibility.conflict");
    if (parsed.kind === "401") {
      const auth: State = { ...s, screen: "401", dialog: null, exit: null, authArea: panel.retry ? e.area : null };
      return panel.retry ? updatePanel(auth, e.area, "unconfirmed", "visibility.unconfirmed", panel.payload) : updatePanel(auth, e.area, "ready");
    }
    if (parsed.kind === "403") return accessLost(s);
    if (parsed.kind === "setup") return updatePanel({ ...s, screen: "setup" }, e.area, "ready");
    if (parsed.kind === "field" && isVis(panel.payload)) {
      const name = panel.payload.vanity_name ?? "";
      const sameName = normalizeVanity(s.draftName) === name;
      const attempted = s.draftVis === "published" && sameName;
      const rejectedError: CopyKey = parsed.taken ? "visibility.addressTaken"
        : parsed.reason === "length" ? lengthError(name) : (REASON[parsed.reason ?? ""] ?? "visibility.addressSummary");
      const next = sameName ? { ...s, rejectedName: name, rejectedError, addressError: attempted ? rejectedError : null } : s;
      return updatePanel(next, e.area, "ready", attempted ? null : "state.write");
    }
    if (parsed.kind === "unconfirmed") return updatePanel(s, e.area, "unconfirmed", "visibility.unconfirmed", panel.payload);
    if (parsed.kind === "committed") return updatePanel({ ...s, authArea: null }, e.area, "reloading", null, panel.payload);
    if (parsed.kind !== "saved") return updatePanel(s, e.area, "ready", "state.write");
    return recoverSave(s, parsed.page, e.area, true);
  }
  if (s.screen !== "ready" || !s.snap) return s;
  if (e.type === "copied" || e.type === "copy-refused") return { ...s, copyNote: e.type === "copied" ? "visibility.addressCopied" : "share.select" };
  if (e.type === "clear-copy") return { ...s, copyNote: null };
  const editName = e.type === "address" && s.draftVis === "published";
  const editVis = e.type === "visibility" && ["private", "token_only", "published"].includes(e.value);
  if ((editName || editVis) && !conflictReload(s)) {
    const panel = s.panels.visibility;
    const draftName = e.type === "address" ? e.value : s.draftName;
    const draftVis = e.type === "visibility" ? e.value : s.draftVis;
    const edited = draftVis !== s.snap.visibility || draftName !== (s.snap.vanity_name ?? "");
    const baseVis = edited || panel.phase !== "ready" ? (s.baseVis ?? baseOf(s.snap)) : null;
    const rejectedName = normalizeVanity(draftName) === s.rejectedName ? s.rejectedName : null;
    const rejectedError = rejectedName ? s.rejectedError : null;
    const pasted = e.type === "address" && e.paste ? "visibility.addressPart" : null;
    return {
      ...(editVis && panel.phase === "ready" ? updatePanel(s, "visibility", "ready") : s),
      draftName, draftVis, baseVis, rejectedName, rejectedError, addressError: draftVis === "published" ? (rejectedError ?? pasted) : null,
    };
  }
  if (e.type === "section" && s.panels.sections.phase !== "reloading" && EDITABLE.includes(e.value)) {
    const panel = s.panels.sections;
    return {
      ...(panel.phase === "ready" ? updatePanel(s, "sections", "ready") : s),
      baseSections: panel.phase === "ready" && !dirtySections(s) ? s.snap.sections : s.baseSections,
      draftSections: s.draftSections.includes(e.value) ? s.draftSections.filter((x) => x !== e.value) : [...s.draftSections, e.value],
    };
  }
  if (e.type === "save-visibility" && !active && s.panels.visibility.phase === "ready" && dirtyVisibility(s) && !s.dialog) {
    if (s.draftVis === "published") {
      const error = addressError(s.draftName);
      if (error) return updatePanel({ ...s, addressError: s.rejectedError ?? error }, "visibility", "ready");
      return { ...s, dialog: s.snap.visibility === "published" ? "rename" : "public" };
    }
    if (s.draftVis === "private") return { ...s, dialog: "private" };
  }
  if ((e.type === "save-visibility" && !active && s.panels.visibility.phase === "ready" && dirtyVisibility(s) && !s.dialog)
    || (e.type === "confirm" && ["private", "public", "rename"].includes(s.dialog ?? ""))) {
    const payload: VisibilityPayload = { request_id: e.id, visibility: s.draftVis, base: s.baseVis ?? baseOf(s.snap) };
    if (s.dialog) payload.confirm = true;
    if (payload.visibility === "published") payload.vanity_name = normalizeVanity(s.draftName);
    return updatePanel({ ...s, dialog: null, addressError: payload.visibility === "published" ? s.rejectedError : null }, "visibility", "saving", null, payload);
  }
  if (e.type === "save-sections" && !active && s.panels.sections.phase === "ready" && dirtySections(s)) {
    return updatePanel(s, "sections", "saving", null, { request_id: e.id, base_sections: s.baseSections, sections: s.draftSections });
  }
  return s;
}

// The parts of an open confirm's description, in order; `address` fills {address} or {name}.
export type Part = { key: CopyKey; address?: string };
export function dialogParts(s: State): Part[] {
  if (!s.snap || !s.dialog) return [];
  if (s.dialog === "discard") return Object.values(s.panels).some((p) => ["saving", "unconfirmed"].includes(p.phase)) ? [{ key: "visibility.sentMaySave" }] : [];
  const { visibility, vanity_name: name, link } = s.snap;
  const proposed = normalizeVanity(s.draftName);
  const parts: Part[] =
    s.dialog === "private" ? [{ key: "visibility.privateBody" }]
    : s.dialog === "public" ? [{ key: "visibility.publicBody", address: proposed }]
    : [{ key: "visibility.currentAddress" }, { key: "visibility.renameBody", address: name! }, { key: "visibility.newAddress", address: proposed }];
  if (s.dialog !== "private") {
    if (name && proposed !== name) {
      parts.push({ key: "visibility.addressMayWorkAgain", address: proposed });
      if (s.dialog === "public") parts.push({ key: "visibility.previousAddressReserved", address: name });
    } else if (s.dialog === "public" && proposed === name) parts.push({ key: "visibility.addressWorksAgain" });
  }
  if (s.dialog === "public" && link && visibility !== "published") {
    parts.push({ key: visibility === "private" ? "visibility.linkWorksAgain" : "visibility.linkKeepsWorking" });
  }
  if (s.dialog === "rename" || (s.dialog === "private" && visibility === "published")) parts.push({ key: "visibility.searchResults" });
  if (s.dialog === "private" && visibility === "published") parts.push({ key: "visibility.unpublish", address: name! });
  return parts;
}
