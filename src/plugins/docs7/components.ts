import { Children, createElement, Fragment, isValidElement, type ReactNode } from 'react';
import { Callout as FumaCallout, type CalloutType } from 'fumadocs-ui/components/callout';
import { Card as FumaCard, Cards } from 'fumadocs-ui/components/card';
import { Tabs as FumaTabs, TabsContent, TabsList, TabsTrigger } from 'fumadocs-ui/components/tabs';
import { Step as FumaStep, Steps } from 'fumadocs-ui/components/steps';

interface ChildrenProps { children?: ReactNode }
function assertNoExtraProps(name: string, props: object): void {
  const keys = Object.keys(props);
  if (keys.length) throw new Error(`[Docs7 plugin] Unsupported ${name} props: ${keys.join(', ')}`);
}
function callout(type: CalloutType) {
  return ({ children, ...extra }: ChildrenProps) => {
    assertNoExtraProps('callout', extra);
    return createElement(FumaCallout, { type }, children);
  };
}

interface TabProps extends ChildrenProps { title: string }
function Tab({ children, title, ...extra }: TabProps) {
  assertNoExtraProps('Tab', extra);
  return createElement(Fragment, null, children);
}
function Tabs({ children, ...extra }: ChildrenProps) {
  assertNoExtraProps('Tabs', extra);
  const tabs = Children.toArray(children).filter(isValidElement<TabProps>);
  const titles = tabs.map((tab) => tab.props.title);
  if (!titles.length || titles.some((title) => typeof title !== 'string' || !title.trim()) || new Set(titles).size !== titles.length) {
    throw new Error('[Docs7 plugin] Tabs requires Tab children with distinct non-empty titles.');
  }
  // Simple-mode items normalize titles, which can collapse distinct labels.
  // Advanced mode keeps display labels separate from stable, local values.
  return createElement(FumaTabs, { defaultValue: 'tab-0' },
    createElement(TabsList, null, titles.map((title, index) =>
      createElement(TabsTrigger, { key: index, value: `tab-${index}` }, title),
    )),
    tabs.map((tab, index) =>
      createElement(TabsContent, { key: index, value: `tab-${index}` }, tab),
    ),
  );
}

interface AccordionProps extends ChildrenProps { title: string; description?: string; defaultOpen?: boolean }
function Accordion({ title, description, defaultOpen, children, ...extra }: AccordionProps) {
  assertNoExtraProps('Accordion', extra);
  return createElement('details', { open: defaultOpen, className: 'docs7-accordion' },
    createElement('summary', null, title),
    description ? createElement('p', null, description) : null,
    children,
  );
}

function Step({ title, children, ...extra }: ChildrenProps & { title: string }) {
  assertNoExtraProps('Step', extra);
  return createElement(FumaStep, null, createElement('h3', null, title), children);
}

function Card({ title, href, children, ...extra }: ChildrenProps & { title: string; href?: string }) {
  assertNoExtraProps('Card', extra);
  return createElement(FumaCard, { title, href }, children);
}

function Columns({ cols = 2, children, ...extra }: ChildrenProps & { cols?: number }) {
  assertNoExtraProps('Columns', extra);
  if (!Number.isInteger(cols) || cols < 1 || cols > 4) {
    throw new Error('[Docs7 plugin] Columns.cols must be an integer from 1 to 4.');
  }
  return createElement(Cards, { className: `docs7-columns docs7-columns-${cols}` }, children);
}

export const docs7Components = {
  Callout: callout('info'),
  Note: callout('info'), Info: callout('info'), Tip: callout('idea'),
  Warning: callout('warn'), Check: callout('success'), Success: callout('success'), Danger: callout('error'),
  Tabs, Tab, Accordion,
  AccordionGroup: ({ children, ...extra }: ChildrenProps) => {
    assertNoExtraProps('AccordionGroup', extra);
    return createElement('div', { className: 'docs7-accordions' }, children);
  },
  Card, Columns, CardGroup: Columns,
  Column: ({ children, ...extra }: ChildrenProps) => {
    assertNoExtraProps('Column', extra);
    return createElement('div', null, children);
  },
  Steps: ({ children, ...extra }: ChildrenProps) => {
    assertNoExtraProps('Steps', extra);
    return createElement(Steps, null, children);
  },
  Step,
};
