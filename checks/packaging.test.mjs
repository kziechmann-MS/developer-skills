import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, access } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const skills = [
  'ui-state-debugging', 'analytics-event-debugging',
  'api-to-ui-feature-integration', 'generative-ui-development',
];

test('all four skills have discoverable frontmatter and matching rubrics', async () => {
  for (const name of skills) {
    const text = await readFile(join(root, name, 'SKILL.md'), 'utf8');
    const header = text.match(/^---\r?\nname: ([a-z0-9-]+)\r?\ndescription: ([^\r\n]+)\r?\n---/);
    assert.ok(header, name);
    assert.equal(header[1], name);
    assert.ok(header[2].length > 20 && header[2].length <= 1024, name);
    const rubric = JSON.parse(await readFile(join(root, name, 'evaluations.json'), 'utf8'));
    assert.equal(rubric.format, 'behavioral-acceptance-cases-v1');
    assert.equal(rubric.skill, name);
    assert.equal(rubric.synthetic, true);
    assert.ok(rubric.cases.length > 0);
    assert.equal(new Set(rubric.cases.map(item => item.id)).size, rubric.cases.length);
    for (const item of rubric.cases) {
      assert.equal(typeof item.input, 'string');
      assert.ok(item.required.length && item.reject.length, `${name}:${item.id}`);
    }
  }
});

test('new rubric fixture references name real tests without claiming agent execution', async () => {
  for (const [skill, testFile] of [
    ['api-to-ui-feature-integration', 'event-board.test.mjs'],
    ['generative-ui-development', 'event-planner.test.mjs'],
  ]) {
    const rubric = JSON.parse(await readFile(join(root, skill, 'evaluations.json'), 'utf8'));
    const source = await readFile(join(root, skill, 'examples', testFile), 'utf8');
    const names = new Set([...source.matchAll(/test\('([^']+)'/g)].map(match => match[1]));
    assert.match(rubric.execution, /not an agent evaluation run/);
    for (const item of rubric.cases) {
      for (const name of item.fixtureTests) assert.ok(names.has(name), `${item.id}: ${name}`);
    }
  }
});

test('relative Markdown links resolve inside this repository', async () => {
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.name.endsWith('.md')) {
        const text = await readFile(path, 'utf8');
        for (const [, target] of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
          if (/^https?:/.test(target) || target.startsWith('#')) continue;
          const resolved = resolve(dirname(path), target.split('#')[0]);
          const local = relative(root, resolved);
          assert.ok(!local.startsWith(`..${sep}`) && local !== '..', `${path}: ${target}`);
          await access(resolved);
        }
      }
    }
  }
  await visit(root);
});
