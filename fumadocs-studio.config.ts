import { defineConfig } from "@fumadocs-editor/studio";
import { fumadocsUiComponents } from "@fumadocs-editor/ui";
import { profileComponents } from "./studio/profile-components";

// A separate local editing server. Never imported by the site or Docs7.
export default defineConfig({
  root: "content",
  host: "127.0.0.1",
  port: 5180,
  open: false,
  media: false,
  components: [...fumadocsUiComponents, ...profileComponents],
  styles: ["./content/style.css", "./studio/style.css"],
});
