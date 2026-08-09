/**
 * Grain tile, inlined as a data URI.
 *
 * `feTurbulence` is the only way to get real per-pixel noise without shipping a
 * texture, and a texture is exactly what this must not be: a PNG large enough
 * not to visibly repeat costs more than the rest of the page. 140px tiles at
 * this frequency read as continuous noise once they are at 3% opacity.
 */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\")";

interface AuroraFieldProps {
  /** Positioning and clipping are the caller's business; this fills its box. */
  className?: string;
  /** Adds the darkened edge. Wanted behind the hero, not inside a card. */
  vignette?: boolean;
}

/**
 * The ambient field the marketing page is lit by.
 *
 * Four layers, in order: three colour bodies drifting on unsynchronised loops,
 * an engineered dot grid masked to fade toward the edges, film grain, and an
 * optional vignette. None of it is on a canvas — every layer here is a
 * compositor-only transform or a static paint, so the whole thing costs the
 * main thread nothing and leaves the page's single rAF budget for the one
 * component that genuinely needs it.
 *
 * The grain is what does the disproportionate work. Flat gradients are the
 * tell of a generated page; a few percent of noise over them is most of the
 * difference between "CSS blobs" and something that looks photographed.
 */
export function AuroraField({ className, vignette = false }: AuroraFieldProps): React.ReactElement {
  return (
    <div aria-hidden className={`pointer-events-none overflow-hidden ${className ?? ''}`}>
      {/*
       * Blurred far past their own size so no layer has a visible edge — what
       * moves is the colour, not a shape. `will-change` is deliberate here and
       * nowhere else on the page: these three are the only elements animating
       * continuously for the whole visit.
       */}
      {/*
       * Much weaker in the light theme. Saturated colour behind black text on
       * white reads as a stock gradient template; the same bodies at a third of
       * the strength read as light in a room. Dark mode can take far more,
       * because there the glow is the only thing lighting the page at all.
       */}
      <div className="absolute inset-0 opacity-40 blur-[120px] dark:opacity-70">
        <div className="absolute -left-[10%] -top-[25%] h-[70%] w-[65%] rounded-full bg-brand/25 will-change-transform motion-safe:animate-drift-a dark:bg-brand/60" />
        <div className="absolute -top-[15%] right-[-8%] h-[65%] w-[55%] rounded-full bg-brand-accent/20 will-change-transform motion-safe:animate-drift-b dark:bg-brand-accent/45" />
        <div className="absolute left-[20%] top-[10%] h-[60%] w-[60%] rounded-full bg-indigo-500/20 will-change-transform motion-safe:animate-drift-c dark:bg-indigo-500/40" />
      </div>

      {/*
       * The grid is the counterweight. Without something ruled and regular on
       * top, three soft gradients read as a lava lamp; with it they read as
       * atmosphere behind an instrument. Masked radially so it never reaches
       * an edge and turns into a visible rectangle.
       */}
      <div className="absolute inset-0 opacity-[0.16] [background-image:radial-gradient(circle,var(--color-neutral-900)_1px,transparent_1px)] [background-size:34px_34px] [mask-image:radial-gradient(ellipse_75%_60%_at_50%_35%,black,transparent)] dark:opacity-[0.20] dark:[background-image:radial-gradient(circle,var(--color-neutral-100)_1px,transparent_1px)]" />

      {/*
       * Bled 8% past every edge because the jitter keyframe translates it by up
       * to 4% — without the overhang the noise would pull away from the sides
       * and expose a clean border six times a second.
       */}
      <div
        className="absolute -inset-[8%] opacity-[0.035] mix-blend-overlay motion-safe:animate-grain dark:opacity-[0.05]"
        style={{ backgroundImage: GRAIN }}
      />

      {vignette && (
        <div className="absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_45%,rgba(15,23,42,0.10)_100%)] dark:[background:radial-gradient(ellipse_at_center,transparent_40%,rgba(2,6,23,0.55)_100%)]" />
      )}
    </div>
  );
}
