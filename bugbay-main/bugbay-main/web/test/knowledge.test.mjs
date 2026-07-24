/**
 * @descrizione
 * Test del gate segreti dei bullet ACE (containsSecret). INVARIANTE DI SICUREZZA
 * (P1): un bullet il cui contenuto contiene una chiave/credenziale non deve mai
 * essere scritto → non c'è nulla da committare in git. Copre i formati-chiave
 * reali (incl. Gemini/DeepSeek, i due già committati una volta su questo progetto)
 * e verifica l'assenza di falsi positivi sulla prosa tecnica normale.
 * File `.mjs`: import TS via type-stripping nativo (Node ≥ 22.13).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { containsSecret } from '../src/modules/bugbay/agent-fix/secret-scan.ts';

test('flagga i formati-chiave reali', () => {
  for (const s of [
    'chiave: sk-ant-api03-AbCdEf012345678901234567890xyz',
    'gemini AIzaSyA1234567890abcdefghijklmnopqrstuvw',           // Google/Gemini
    'deepseek sk-0123456789abcdef0123456789abcdef',              // sk- generico
    'aws AKIAIOSFODNN7EXAMPLE',
    'gh token ghp_0123456789012345678901234567890123456',
    'DATABASE_URL=postgres://user:secretpass@host:5432/db',
    '-----BEGIN RSA PRIVATE KEY-----',
    'api_key = "abcd1234efgh5678ijkl9012"',
  ]) {
    assert.equal(containsSecret(s), true, `deve flaggare: ${s.slice(0, 30)}…`);
  }
});

test('NON flagga la prosa tecnica normale (no falsi positivi)', () => {
  for (const s of [
    'Il controllo del token di scadenza usava < invece di <=.',
    'Aggiunto validazione input al boundary di autenticazione.',
    'Il fix corregge il parsing della risposta API senza toccare le chiavi.',
    'password field ora è mascherato nel form di login',
  ]) {
    assert.equal(containsSecret(s), false, `falso positivo su: ${s}`);
  }
});
