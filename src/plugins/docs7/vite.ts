import { resolve } from 'node:path';
import type { Plugin } from 'vite';

export function docs7ConfigWatch(configPath = 'content/docs.json'): Plugin {
  const configFile = resolve(configPath);
  return {
    name: 'blog-2026:docs7-config-watch',
    configureServer(server) {
      server.watcher.add(configFile);
      const onChange = (file: string) => {
        if (resolve(file) === configFile) void server.restart();
      };
      server.watcher.on('change', onChange);
      server.httpServer?.once('close', () => server.watcher.off('change', onChange));
    },
  };
}
