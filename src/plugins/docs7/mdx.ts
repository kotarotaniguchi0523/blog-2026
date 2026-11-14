import defaultComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { docs7Components } from './components.ts';

// The MDX components of content pages, passed to `press({ components })` in vite.config.ts.
// Fumapress resolves relative links before `a` receives them.
export default {
  ...defaultComponents,
  ...docs7Components,
} satisfies MDXComponents;
