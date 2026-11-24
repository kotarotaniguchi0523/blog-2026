import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DOCS7_IGNORE_FILE, planDocs7Ignore } from '../src/content/docs7-ignore.ts';

/**
 * Regenerates `content/.docs7ignore`, the list of pages Docs7 must not upload.
 *
 * `--check` writes nothing and exits non-zero when the committed file differs
 * from the generated one, so CI and reviewers can detect a stale ignore file.
 */

const CONTENT_DIR = fileURLToPath(new URL('../content', import.meta.url));
const CHECK_ONLY = process.argv.includes('--check');

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const plan = await planDocs7Ignore(CONTENT_DIR);

  if (plan.conflicts.length > 0) {
    console.error(
      'content/docs.json lists draft pages. Publish them or remove them from the navigation:',
    );
    for (const page of plan.conflicts) console.error(`  ${page}`);
    process.exitCode = 1;
    return;
  }

  const path = join(CONTENT_DIR, DOCS7_IGNORE_FILE);
  const current = await readIfExists(path);
  if (current === plan.ignore) {
    console.log(`Docs7 ignore: ${plan.drafts.length} draft page(s), up to date.`);
    return;
  }

  if (CHECK_ONLY) {
    printDrift(current, plan.ignore);
    process.exitCode = 1;
    return;
  }

  await writeFile(path, plan.ignore, 'utf8');
  console.log(`Docs7 ignore: ${plan.drafts.length} draft page(s) written to content/${DOCS7_IGNORE_FILE}.`);
  for (const draft of plan.drafts) console.log(`  ${draft}`);
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return null;
    throw error;
  }
}

function printDrift(current: string | null, expected: string): void {
  console.error(`content/${DOCS7_IGNORE_FILE} is out of date. Run \`pnpm docs7:ignore\`.`);
  if (current === null) {
    console.error(`  missing file; expected:\n${indent(expected)}`);
    return;
  }
  const actualLines = new Set(lines(current));
  const expectedLines = new Set(lines(expected));
  const missing = lines(expected).filter((line) => !actualLines.has(line));
  const unexpected = lines(current).filter((line) => !expectedLines.has(line));
  for (const line of missing) console.error(`  missing: ${line}`);
  for (const line of unexpected) console.error(`  unexpected: ${line}`);
}

function lines(value: string): string[] {
  return value.split('\n').filter((line) => line !== '');
}

function indent(value: string): string {
  return lines(value).map((line) => `    ${line}`).join('\n');
}
