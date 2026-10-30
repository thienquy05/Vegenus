import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { MIN_TARGET_PX } from "@/lib/ui";
import OwnerError from "./error";

// Codex, audit-fix review: an Auth outage (requireOwner throws) must leave the owner on the read-failure
// state of the common contract (design: owner UI §3, guest UI §6), with a Retry that asks the server again.
test("an owner page failure shows the read-failure state with a Retry that re-fetches", () => {
  const retry = vi.fn();
  const html = renderToStaticMarkup(createElement(OwnerError, { error: new Error("x"), reset: vi.fn(), retry }));
  expect(html).toContain('role="alert"');
  expect(html).toContain("Couldn’t load this. Try again. / Chưa tải được. Thử lại.");
  expect(html).toContain(`min-height:${MIN_TARGET_PX}px;min-width:${MIN_TARGET_PX}px`);

  const button = (OwnerError({ error: new Error("x"), reset: vi.fn(), retry }).props.children as ReactElement[]).find(
    (child) => child?.type === "button",
  ) as ReactElement<{ onClick: () => void }>;
  button.props.onClick();
  expect(retry).toHaveBeenCalledOnce();
});
