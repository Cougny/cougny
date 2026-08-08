'use client';

import { useRef } from 'react';

/**
 * Wraps a call-to-action so it drifts slightly toward the cursor on hover.
 *
 * The padded hit area (`p-3 -m-3`) is deliberate, not a hitbox mistake: it
 * gives the pointer room to be "near" the button before the button starts
 * moving, so the effect reads as the button noticing the cursor rather than
 * chasing it the instant the pointer crosses its edge. Callers cancel the
 * padding with a matching negative margin of their own so it never shifts
 * surrounding layout.
 *
 * Plain style mutation, not state — a magnetic pull firing on every
 * `mousemove` has no business going through a re-render.
 */
export function MagneticCta({ children }: { children: React.ReactNode }): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>): void => {
    const node = ref.current;
    if (node === null) return;
    const rect = node.getBoundingClientRect();
    const x = event.clientX - (rect.left + rect.width / 2);
    const y = event.clientY - (rect.top + rect.height / 2);
    node.style.setProperty('--magnet-x', `${(x * 0.25).toFixed(2)}px`);
    node.style.setProperty('--magnet-y', `${(y * 0.25).toFixed(2)}px`);
  };

  const handleMouseLeave = (): void => {
    const node = ref.current;
    if (node === null) return;
    node.style.setProperty('--magnet-x', '0px');
    node.style.setProperty('--magnet-y', '0px');
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="inline-block -m-3 p-3 motion-safe:[transition:transform_500ms_var(--ease-out-back)] motion-safe:[transform:translate(var(--magnet-x,0px),var(--magnet-y,0px))]"
    >
      {children}
    </div>
  );
}
