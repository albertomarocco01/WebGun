/**
 * Genera le istruzioni di aggancio del widget per ogni framework. Il modello è
 * universale: il daemon centrale (`bugbay dev`) serve il widget come modulo, quindi
 * agganciarlo = un singolo <script type="module"> verso localhost. Il parametro
 * `?p=<projectId>` dice al daemon a QUALE app appartiene la segnalazione (un solo
 * daemon hub può servire più progetti). Funziona in qualunque app (anche backend
 * non-JS), e in dev resta inerte in produzione.
 */

/** URL del widget servito dal daemon, taggato col progetto. */
export function widgetUrl(port, projectId) {
  return `http://localhost:${port}/bugbay-widget.js${projectId ? `?p=${projectId}` : ''}`;
}

/** Tag universale, valido come fallback per qualsiasi stack. */
export function universalScript(port, projectId) {
  return `<script type="module" src="${widgetUrl(port, projectId)}"></script>`;
}

/**
 * Ritorna { file, code, note }: dove e cosa incollare per il framework rilevato.
 * `file` è un suggerimento del punto d'aggancio tipico di quel framework.
 */
export function wiringInstructions(framework, layout, port, projectId) {
  const script = universalScript(port, projectId);
  const url = widgetUrl(port, projectId);
  const src = layout?.srcDir && layout.srcDir !== '.' ? `${layout.srcDir}/` : '';

  switch (framework) {
    case 'next':
      return {
        file: `${src}app/layout.tsx`,
        code:
          `{process.env.NODE_ENV === 'development' && (\n` +
          `  <script type="module" src="${url}" async />\n` +
          `)}`,
        note: 'Incolla dentro <body>, in coda. In produzione non viene renderizzato.',
      };
    case 'remix':
      return {
        file: 'app/root.tsx',
        code: script,
        note: 'Incolla dentro <body>, prima di <Scripts />.',
      };
    case 'sveltekit':
      return {
        file: 'src/app.html',
        code: script,
        note: 'Incolla prima di </body> (dopo %sveltekit.body%).',
      };
    case 'astro':
      return {
        file: 'src/layouts/*.astro',
        code: script,
        note: 'Incolla nel layout di base, prima di </body>.',
      };
    case 'nuxt':
      return {
        file: 'nuxt.config.ts',
        code:
          `app: {\n  head: {\n    script: [{ src: '${url}', type: 'module' }]\n  }\n}`,
        note: 'Aggiungi alla sezione app.head (solo in sviluppo).',
      };
    case 'vite':
    case 'react':
    case 'vue':
      return {
        file: 'index.html',
        code: script,
        note: 'Incolla prima di </body>.',
      };
    default:
      return {
        file: 'il tuo template HTML principale',
        code: script,
        note: 'Incolla prima di </body>. Vale per qualsiasi app, anche backend non-JS.',
      };
  }
}
