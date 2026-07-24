/**
 * @descrizione
 * Test del perimetro di scrittura del Fixer (isPathAllowed / default sensibili).
 * INVARIANTE DI SICUREZZA (P1): i path che eseguono codice al commit/install/CI
 * (.git/hooks, package.json postinstall, .github/workflows, Dockerfile, *.sh)
 * sono negati a PRESCINDERE da writeScope — anche con lo scope più largo ('**').
 * Un Edit lì sarebbe RCE quando il daemon committa o l'utente installa.
 * File `.mjs`: import TS via type-stripping nativo (Node ≥ 22.13).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPathAllowed, guardsFromEnv } from '../src/modules/bugbay/agent-fix/scope-match.ts';

// Scope più largo possibile: solo la sensitive-list deve fermare i path pericolosi.
const WIDE = ['**'];
const { sensitiveFiles: SENS } = guardsFromEnv(); // default (nessuna env impostata)

test('exec-on-commit paths negati anche con writeScope ** (difesa-in-profondità RCE)', () => {
  for (const p of [
    '.git/hooks/pre-commit',
    'package.json',
    'web/package.json',
    'package-lock.json',
    '.github/workflows/ci.yml',
    'Dockerfile',
    'scripts/deploy.sh',
    '.npmrc',
  ]) {
    assert.equal(isPathAllowed(p, WIDE, SENS), false, `deve negare: ${p}`);
  }
});

test('segreti/config storici restano negati', () => {
  for (const p of ['.env', '.env.local', 'src/auth/token.ts', 'src/middleware.ts', 'next.config.mjs']) {
    assert.equal(isPathAllowed(p, WIDE, SENS), false, `deve negare: ${p}`);
  }
});

test('file di codice legittimi restano consentiti', () => {
  for (const p of ['src/app/page.tsx', 'src/modules/foo/bar.ts', 'README.md']) {
    assert.equal(isPathAllowed(p, WIDE, SENS), true, `deve consentire: ${p}`);
  }
});
