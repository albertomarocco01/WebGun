/**
 * Rilevamento dell'ambiente del repo target: package manager, framework e layout
 * (dove sta `src`, quale convenzione di routing). Tutto euristico e best-effort —
 * ciò che non si deduce diventa un default sovrascrivibile in bugbay.config.json.
 */
import path from 'node:path';
import { readJson, fileExists, dirExists } from './util.mjs';

/** Rileva il package manager dal lockfile (poi dal campo packageManager). */
export function detectPackageManager(root) {
  if (fileExists(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fileExists(path.join(root, 'yarn.lock'))) return 'yarn';
  if (fileExists(path.join(root, 'bun.lockb')) || fileExists(path.join(root, 'bun.lock'))) return 'bun';
  if (fileExists(path.join(root, 'package-lock.json'))) return 'npm';
  const pkg = readJson(path.join(root, 'package.json'));
  const pm = pkg?.packageManager;
  if (typeof pm === 'string') {
    if (pm.startsWith('pnpm')) return 'pnpm';
    if (pm.startsWith('yarn')) return 'yarn';
    if (pm.startsWith('bun')) return 'bun';
  }
  return 'npm';
}

/** Rileva il framework dalle dipendenze dichiarate nel package.json. */
export function detectFramework(pkg) {
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
  if (deps.next) return 'next';
  if (deps['@remix-run/react'] || deps['@remix-run/node']) return 'remix';
  if (deps['@sveltejs/kit']) return 'sveltekit';
  if (deps.astro) return 'astro';
  if (deps.nuxt) return 'nuxt';
  if (deps.vite) return 'vite';
  if (deps.react) return 'react';
  if (deps.vue) return 'vue';
  return 'unknown';
}

/**
 * Deduce srcDir e convenzione di routing ispezionando le cartelle reali.
 * routes: 'app-router' | 'pages-router' | 'file-based' | 'none'
 */
export function detectLayout(root, framework) {
  const has = (rel) => dirExists(path.join(root, rel));

  if (framework === 'next') {
    if (has('src/app')) return { srcDir: 'src', routes: 'app-router' };
    if (has('app')) return { srcDir: '.', routes: 'app-router' };
    if (has('src/pages')) return { srcDir: 'src', routes: 'pages-router' };
    if (has('pages')) return { srcDir: '.', routes: 'pages-router' };
  }
  if (framework === 'remix') return { srcDir: has('app') ? 'app' : 'src', routes: 'file-based' };
  if (framework === 'sveltekit' || framework === 'nuxt' || framework === 'astro') {
    return { srcDir: has('src') ? 'src' : '.', routes: 'file-based' };
  }
  // Vite / React / Vue / sconosciuto: SPA senza convenzione di routing nota.
  return { srcDir: has('src') ? 'src' : '.', routes: 'none' };
}

/** Analisi completa del repo target. */
export function inspectProject(root) {
  const pkg = readJson(path.join(root, 'package.json'));
  if (!pkg) return null;
  const framework = detectFramework(pkg);
  return {
    pkgName: pkg.name || path.basename(root),
    packageManager: detectPackageManager(root),
    framework,
    layout: detectLayout(root, framework),
  };
}
