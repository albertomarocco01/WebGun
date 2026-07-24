/**
 * @convenzione docs/convenzioni/strutturaFile.md
 *
 * @descrizione
 * Marchio BUG BAY: silhouette in stile immagine satellitare — terraferma piena
 * (currentColor) con costa frastagliata low-poly che si apre in una baia il
 * cui spazio negativo ha vagamente la forma di un insetto: due insenature
 * sottili all'imboccatura (le antenne) e bacino sfaccettato (il corpo).
 * Eredita il colore dal contesto; l'acqua è lo sfondo (spazio negativo).
 *
 * @indice
 * - BugBayLogo → marchio SVG del modulo
 */

export function BugBayLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M10 3 H21.2
           L20.8 9.5
           L14.8 12.4 L17 14.4
           L15.6 18 L15 24 L17.6 30 L24 33.4
           L30.4 30 L33 24 L32.4 18 L31 14.4
           L33.2 12.4 L27.2 9.5
           L26.8 3
           H38 Q45 3 45 10 L45 38 Q45 45 38 45 L10 45 Q3 45 3 38 L3 10 Q3 3 10 3 Z
           M24 11.4 L26 12.6 L25.3 14.7 L22.7 14.7 L22 12.6 Z"
      />
    </svg>
  );
}
