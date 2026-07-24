/**
 * @descrizione  Test della logica pura del generatore d'albero (tree.mjs): costruzione
 *               dell'albero annidato e render ASCII deterministico. Nessun git, nessun I/O.
 *               Lancia con:  node --test scripts/tree.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, renderTree } from './tree.mjs';

test('buildTree: annida i path, file → null, cartelle → oggetto', () => {
  const t = buildTree(['src/a.ts', 'src/ui/Button.tsx', 'README.md']);
  assert.deepEqual(t, {
    src: { 'a.ts': null, ui: { 'Button.tsx': null } },
    'README.md': null,
  });
});

test('renderTree: cartelle prima, poi alfabetico; rami ASCII corretti', () => {
  const out = renderTree(buildTree(['src/a.ts', 'src/b.ts', 'README.md']));
  assert.equal(out, [
    '├── src/',
    '│   ├── a.ts',
    '│   └── b.ts',
    '└── README.md',
  ].join('\n'));
});

test('renderTree: maxDepth taglia l\'espansione (cartella mostrata, non aperta)', () => {
  const out = renderTree(buildTree(['src/deep/x.ts', 'top.ts']), '', 1);
  assert.equal(out, ['├── src/', '└── top.ts'].join('\n'));
});

test('renderTree: albero vuoto → stringa vuota', () => {
  assert.equal(renderTree(buildTree([])), '');
});
