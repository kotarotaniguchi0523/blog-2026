import type { AstroIntegration } from 'astro';

/** Restarts the dev server when docs.json changes: press.config.tsx reads it once at startup. */
export function docs7ConfigWatch(configPath = 'content/docs.json'): AstroIntegration {
  return {
    name: 'blog-2026:docs7-config-watch',
    hooks: {
      'astro:config:setup'({ config, addWatchFile }) {
        addWatchFile(new URL(configPath, config.root));
      },
    },
  };
}
