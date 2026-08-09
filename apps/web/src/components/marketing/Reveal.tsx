'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Which direction the content resolves from. The transition itself is defined
 * once in `globals.css`; a variant only re-points the custom properties that
 * transition reads, so every reveal on the page shares one curve and duration.
 */
type RevealVariant = 'up' | 'fade' | 'scale' | 'left' | 'right';

const VARIANTS: Record<RevealVariant, Record<string, string>> = {
  up: {},
  fade: { '--reveal-y': '0px', '--reveal-blur': '12px' },
  scale: { '--reveal-y': '0px', '--reveal-scale': '0.94' },
  left: { '--reveal-x': '-30px', '--reveal-y': '0px' },
  right: { '--reveal-x': '30px', '--reveal-y': '0px' },
};

/*
 * One observer for the entire page rather than one per element. A landing page
 * reveals a few dozen things; a few dozen observers all watching the same
 * scroll is measurable work for no benefit, and they cannot batch their
 * callbacks with each other the way a single observer's entry list does.
 */
let sharedObserver: IntersectionObserver | null = null;
const pending = new WeakMap<Element, () => void>();

/*
 * How far up from the bottom edge something must reach before it counts as
 * "in view", as a fraction of the viewport.
 *
 * Firing the instant a single pixel crosses the bottom edge means the animation
 * plays off-screen and the reader arrives after it is already over. It also
 * makes a section that happens to peek above the fold — the next heading,
 * showing its top few pixels at rest — reveal itself on load, so it is simply
 * *there* rather than arriving when it is scrolled to.
 *
 * One constant, used by both the observer's margin and the synchronous check
 * below, because the two disagreeing is exactly the bug above.
 */
const VIEW_INSET = 0.18;

function getObserver(): IntersectionObserver {
  sharedObserver ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        pending.get(entry.target)?.();
      }
    },
    {
      rootMargin: `0px 0px -${String(VIEW_INSET * 100)}% 0px`,
      threshold: 0.05,
    },
  );
  return sharedObserver;
}

interface RevealProps {
  children: React.ReactNode;
  /** Milliseconds of stagger. Pass `index * n` inside a mapped list. */
  delay?: number;
  variant?: RevealVariant;
  className?: string;
}

/**
 * Reveals its children the first time they scroll into view.
 *
 * The hidden state is server-rendered (`data-reveal="hidden"`) instead of being
 * applied in an effect, so nothing is ever painted visible and then snatched
 * back. It is also one-shot: the flag never returns to hidden, because content
 * that re-animates every time it scrolls past stops reading as an entrance and
 * starts reading as a page that will not settle.
 *
 * The wrapper owns the reveal transform and nothing else, which is what lets it
 * sit around a child that runs its own — the two transforms live on different
 * elements and never compete for the same property.
 */
export function Reveal({
  children,
  delay = 0,
  variant = 'up',
  className,
}: RevealProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (node === null || shown) return;

    /*
     * Anything already on screen is revealed here and now, from a synchronous
     * measurement, without involving the observer at all.
     *
     * This is a fail-visible rule, and it is not theoretical. Observer
     * callbacks are delivered as part of the rendering steps, so a browser that
     * has throttled or suspended rendering — a background tab, a restored
     * session, a battery saver — may not deliver them for a long time or at
     * all. Leaning on the observer for the top of the page means the entire
     * fold can stay at opacity zero: a blank marketing page, and no error
     * anywhere to explain it.
     *
     * The entrance still plays. The first paint is the hidden state, this runs
     * after it, and the class change transitions exactly as a scroll would.
     */
    const box = node.getBoundingClientRect();
    if (box.top < window.innerHeight * (1 - VIEW_INSET) && box.bottom > 0) {
      setShown(true);
      return;
    }

    const observer = getObserver();
    pending.set(node, () => setShown(true));
    observer.observe(node);

    return () => {
      observer.unobserve(node);
      pending.delete(node);
    };
  }, [shown]);

  const style = {
    ...VARIANTS[variant],
    '--reveal-delay': `${String(delay)}ms`,
  } as React.CSSProperties;

  return (
    <div ref={ref} data-reveal={shown ? 'shown' : 'hidden'} style={style} className={className}>
      {children}
    </div>
  );
}
