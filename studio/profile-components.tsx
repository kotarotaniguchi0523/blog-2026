import { createElement } from "react";
import type { ComponentRenderProps, UiComponentSpec } from "@fumadocs-editor/ui";

// Only Studio uses these renderers. The published MDX keeps its original HTML.
const containers = ["div", "section", "nav"];
const textBlocks = ["p", "h2", "h3"];

function renderer(tag: string) {
  return function ProfileElement({ props, children }: ComponentRenderProps) {
    return createElement(tag, { className: props.className, "data-profile-tag": tag }, children);
  };
}

export const profileComponents: UiComponentSpec[] = [
  ...containers.map((name): UiComponentSpec => ({
    name,
    childrenRegion: { region: "body" },
    render: renderer("div"),
  })),
  ...textBlocks.map((name): UiComponentSpec => ({
    name,
    contentRegion: { region: "text", placeholder: "ここに入力…" },
    render: renderer("div"),
  })),
];
