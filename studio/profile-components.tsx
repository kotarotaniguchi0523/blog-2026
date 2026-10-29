import { createElement } from "react";
import type { ComponentRenderProps, UiComponentSpec } from "@fumadocs-editor/ui";

// Only Studio uses these renderers. The published MDX keeps its original HTML.
const containers = ["div", "section", "nav", "li"];
const textBlocks = ["p", "h2", "h3"];

function renderer(tag: string) {
  return function ProfileElement({ props, children }: ComponentRenderProps) {
    return createElement(tag, { className: props.className, "data-profile-tag": tag }, children);
  };
}

function List() {
  return function ProfileList({ props, children }: ComponentRenderProps) {
    return createElement("ul", { className: props.className, "data-profile-tag": "ul" }, children);
  };
}

const imageProps: UiComponentSpec["props"] = [
  { name: "src", type: "string", placeholder: "https://cdn.simpleicons.org/nextdotjs" },
  { name: "alt", type: "string", default: "" },
  { name: "width", type: "number", default: 28 },
  { name: "height", type: "number", default: 28 },
];

export const profileComponents: UiComponentSpec[] = [
  // Stack items: one `li` per technology, edited as a list (`Enter` adds a sibling).
  {
    name: "ul",
    childComponent: "li",
    listLike: true,
    render: List(),
  },
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
  {
    name: "img",
    props: imageProps,
    render: ({ props }: ComponentRenderProps) => createElement("img", {
      src: props.src, alt: props.alt, width: props.width, height: props.height,
    }),
  },
];
