import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import ts from 'typescript';
import { organizeGeneratedApi } from './organize-generated-api.mjs';

test('el generador elimina imports inútiles/supresiones y conserva tipos, valores y efectos', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'mapit-generated-imports-'));
  t.after(() => {
    const inside = relative(tmpdir(), root);
    assert.ok(inside && !inside.startsWith('..') && !isAbsolute(inside));
    rmSync(root, { recursive: true, force: true });
  });
  const output = join(root, 'generated');
  mkdirSync(output);
  const config = join(root, 'tsconfig.json');
  writeFileSync(
    config,
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        module: 'esnext',
        target: 'es2022',
        skipLibCheck: true,
      },
      include: ['generated/**/*.ts'],
    }),
  );
  writeFileSync(
    join(output, 'types.ts'),
    'export interface Used { id: string }\nexport interface Unused { other: string }\nexport const USED_VALUE = 1;\n',
  );
  writeFileSync(join(output, 'effect.ts'), 'export const sideEffect = 1;\n');
  const file = join(output, 'client.ts');
  writeFileSync(
    file,
    `// @ts-ignore
import { Used, Unused, USED_VALUE } from './types';
import './effect';
export const client: Used = { id: String(USED_VALUE) };
`,
  );
  assert.equal(organizeGeneratedApi(output, config), 3);
  const source = readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /Unused|@ts-ignore/);
  assert.match(source, /Used/);
  assert.match(source, /USED_VALUE/);
  assert.match(source, /import ['"]\.\/effect['"]/);
  const parsed = ts.parseJsonConfigFileContent(
    JSON.parse(readFileSync(config, 'utf8')),
    ts.sys,
    root,
  );
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  assert.deepEqual(
    ts
      .getPreEmitDiagnostics(program)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')),
    [],
  );
  organizeGeneratedApi(output, config);
  assert.equal(readFileSync(file, 'utf8'), source);
});
