import { defineConfig } from "@playwright/test";

import { caricaEnvE2E } from "./e2e/helpers/env";

caricaEnvE2E();

/**
 * Batteria End-to-End di Bottega Nord.
 *
 * `retries: 1` e' fisso e vale una riga di spiegazione: zero retry rende rosso
 * l'ambiente instabile, e un rosso strutturale insegna a ignorare il rosso; piu'
 * di uno rende invisibile il test che passa una volta su tre. Il secondo
 * tentativo si dichiara comunque, anche quando il totale e' verde.
 *
 * NIENTE `webServer`: l'app la si accende a mano e la si tiene accesa. Un
 * server avviato dalla configurazione nasconde in quale stato girava l'app —
 * e su questa macchina nasconderebbe anche su quale porta e' finita davvero.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  forbidOnly: true,
  retries: 1,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
});
