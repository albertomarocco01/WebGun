/**
 * @descrizione
 * Test della spina SQLite: busy_timeout impostato (contesa multi-processo
 * daemon+Next) e semantica di `transact` (BEGIN IMMEDIATE + COMMIT/ROLLBACK).
 * Regola se busy_timeout torna a 0 o se transact non annulla su errore.
 * File `.mjs`: import TS via type-stripping nativo (Node ≥ 22.13).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openWalDatabase, transact } from '../src/modules/bugbay/agent-fix/sqlite.ts';

test('busy_timeout impostato (>0) all apertura', () => {
  const db = openWalDatabase(':memory:');
  const row = db.prepare('PRAGMA busy_timeout').get();
  // node:sqlite ritorna { timeout: N } o { busy_timeout: N } a seconda della build.
  const val = row.timeout ?? row.busy_timeout ?? Object.values(row)[0];
  assert.equal(Number(val), 5000);
  db.close();
});

test('transact committa il lavoro riuscito', () => {
  const db = openWalDatabase(':memory:');
  db.exec('CREATE TABLE t (n INTEGER)');
  transact(db, () => db.prepare('INSERT INTO t (n) VALUES (1)').run());
  assert.equal(db.prepare('SELECT COUNT(*) c FROM t').get().c, 1);
  db.close();
});

test('transact annulla (ROLLBACK) e ri-lancia su errore non-lock', () => {
  const db = openWalDatabase(':memory:');
  db.exec('CREATE TABLE t (n INTEGER)');
  assert.throws(() =>
    transact(db, () => {
      db.prepare('INSERT INTO t (n) VALUES (2)').run();
      throw new Error('boom');
    }),
  );
  assert.equal(db.prepare('SELECT COUNT(*) c FROM t').get().c, 0); // insert annullato
  db.close();
});
