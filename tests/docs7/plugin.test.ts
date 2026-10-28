import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AppContext } from 'fumapress';
import { createDocs7PageTree, docs7ThemeCss, parseDocs7Config, readDocs7Config } from '../../src/plugins/docs7/config.ts';
import { docs7Plugin } from '../../src/plugins/docs7/plugin.ts';
import { docs7Components } from '../../src/plugins/docs7/components.ts';

const config = readDocs7Config();
const pages = [
  { path: 'index.mdx', url: '/', data: { title: 'Home' } },
  { path: 'compatibility.mdx', url: '/compatibility', data: { title: 'Compatibility' } },
];

describe('Docs7 configuration and Fumapress plugin', () => {
  it('maps configured order and nested groups to actual source URLs', () => {
    const parsed = parseDocs7Config({ ...config, navigation: {
      groups: [{ group: 'Guide', pages: ['compatibility', { group: 'Nested', pages: ['index'] }] }],
    } });
    const tree = createDocs7PageTree(parsed, pages);
    const folder = tree.children[0];
    assert.equal(folder?.type, 'folder');
    if (folder?.type !== 'folder') throw new Error('Expected folder');
    assert.equal(folder.children[0]?.type, 'page');
    assert.deepEqual(folder.children[0], {
      type: 'page', $id: 'docs7:compatibility', $ref: 'compatibility.mdx', name: 'Compatibility', url: '/compatibility',
    });
    const nested = folder.children[1];
    assert.equal(nested?.type, 'folder');
    if (nested?.type !== 'folder') throw new Error('Expected nested folder');
    assert.equal(nested.children[0]?.type === 'page' && nested.children[0].url, '/');
  });

  it('fails for unsupported settings, escaping paths, and missing or duplicate pages', () => {
    assert.throws(() => parseDocs7Config({ ...config, integrations: { ga4: {} } }), /unsupported/);
    assert.throws(() => parseDocs7Config({ ...config, navigation: { tabs: [] } }), /unsupported/);
    for (const path of ['../secret', '/absolute', 'index.mdx', 'a\\b', 'https://example.com']) {
      assert.throws(() => parseDocs7Config({ ...config, navigation: { groups: [{ group: 'Test', pages: [path] }] } }));
    }
    assert.throws(() => createDocs7PageTree(config, pages.slice(0, 1)), /not found/);
    assert.throws(() => createDocs7PageTree(parseDocs7Config({ ...config, navigation: {
      groups: [{ group: 'Test', pages: ['index', 'index'] }],
    } }), pages), /Duplicate/);
    assert.throws(() => parseDocs7Config({ ...config, colors: { primary: 'red;}</style>' } }));
  });

  it('applies site title, color metadata, provider appearance, and sidebar through real hooks', async () => {
    const context = {
      siteConfig: { name: 'Before' }, data: {},
      getLoader: () => ({ getPages: () => pages }),
      defaultLayoutProps: async () => ({ nav: { title: 'Before' }, links: [{ text: 'Keep me', url: '/keep' }] }),
      interceptRootMeta: (hook: { (env: { next: () => null }): unknown }) => {
        const markup = renderToStaticMarkup(hook({ next: () => null }) as ReturnType<typeof createElement>);
        assert.match(markup, /data-docs7-theme/);
        assert.ok(markup.includes(docs7ThemeCss(config)));
      },
    } as unknown as AppContext;
    const plugin = docs7Plugin();
    await plugin.init?.call(context);
    await plugin.configure?.call(context);
    assert.equal(context.siteConfig.name, config.name);
    const layout = await context.defaultLayoutProps({ lang: undefined });
    assert.equal(layout.nav?.title, config.name);
    assert.equal(layout.links?.length, 1);
    const provider = context.data['core:provider']?.transformers?.[0];
    assert.equal((await provider?.({}))?.theme?.defaultTheme, 'system');
    const transform = context.data['core:docs-layout']?.transformers?.[0];
    assert.ok(transform);
    const data = { body: null, layoutProps: { tree: { name: 'Old', children: [] } }, pageProps: {} };
    const output = await transform({ data, page: { ...pages[0]!, type: 'page', slugs: [], locale: undefined } });
    assert.deepEqual(output.layoutProps.tree, createDocs7PageTree(config, pages));
  });
});

describe('Docs7 MDX component adapters', () => {
  it('rejects unsupported component props instead of silently losing their meaning', () => {
    assert.throws(() => renderToStaticMarkup(createElement(docs7Components.Card,
      { title: 'Card', icon: 'rocket' } as unknown as Parameters<typeof docs7Components.Card>[0],
    )), /Unsupported Card props: icon/);
    assert.throws(() => renderToStaticMarkup(createElement(docs7Components.Columns, { cols: 5 })), /1 to 4/);
  });
  it('renders named callouts, default-open details, and step titles without losing content', () => {
    const { Note, Accordion, Step } = docs7Components;
    const html = renderToStaticMarkup(createElement('div', null,
      createElement(Note, null, 'Keep this note'),
      createElement(Accordion, { title: 'Question', defaultOpen: true }, 'Answer'),
      createElement(Step, { title: 'Install' }, 'Instructions'),
    ));
    assert.match(html, /Keep this note/);
    assert.match(html, /<details[^>]*open/);
    assert.match(html, /<summary>Question<\/summary>/);
    assert.match(html, /<h3>Install<\/h3>/);
    assert.match(html, /Instructions/);
  });

  it('maps Mintlify/Docs7 tab titles to Fumadocs tab triggers', () => {
    const { Tabs, Tab } = docs7Components;
    const html = renderToStaticMarkup(createElement(Tabs, null,
      createElement(Tab, { title: 'First' }, 'First body'),
      createElement(Tab, { title: 'Second' }, 'Second body'),
    ));
    assert.match(html, /role="tablist"/);
    assert.match(html, /First/);
    assert.match(html, /Second/);
    assert.match(html, /First body/);
    assert.throws(() => renderToStaticMarkup(createElement(Tabs, null,
      createElement(Tab, { title: 'Same' }), createElement(Tab, { title: 'Same' }),
    )), /distinct/);
  });

  it('keeps titles distinct when Fumadocs simple mode would normalize them equally', () => {
    const { Tabs, Tab } = docs7Components;
    const html = renderToStaticMarkup(createElement(Tabs, null,
      createElement(Tab, { title: 'Node JS' }, 'First panel content'),
      createElement(Tab, { title: 'node-js' }, 'Second panel content'),
      createElement(Tab, { title: 'NODE JS' }, 'Third panel content'),
    ));
    assert.equal([...html.matchAll(/aria-selected="true"/g)].length, 1);
    assert.equal([...html.matchAll(/aria-selected="false"/g)].length, 2);
    assert.match(html, /Node JS/);
    assert.match(html, /node-js/);
    assert.match(html, /NODE JS/);
    assert.match(html, /First panel content/);
    assert.doesNotMatch(html, /Second panel content|Third panel content/);
  });
});
