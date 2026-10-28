import type { AppShape } from 'fumapress';
import { fumadocsMdx } from 'fumapress/adapters/mdx';
import defaultComponents, { createRelativeLink } from 'fumadocs-ui/mdx';
import { docs7Components } from './components.ts';

export function docs7Mdx<C extends AppShape = AppShape>() {
  return fumadocsMdx<C>({
    async getMdxComponents(page) {
      return {
        ...defaultComponents,
        ...docs7Components,
        a: createRelativeLink(await this.getLoader(), page),
      };
    },
  });
}
