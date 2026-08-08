'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MatchControls } from '@/components/MatchControls';
import { VideoPanel } from '@/components/VideoPanel';
import { CameraOffIcon, UserIcon } from '@/components/icons';

/** Stable identity, so the controls' preference effect does not re-fire. */
const noop = (): void => undefined;

/** How long the zoom runs before handing off to `href`. Mirrored in the JS
 *  navigation timer so the two never fall out of sync with each other. */
const ZOOM_MS = 700;

/** The properties actually animated on the clone — never `transition: all`,
 *  which makes the browser diff every animatable property on the element
 *  each frame instead of just the four this component ever changes. */
const ZOOM_TRANSITION = 'top,left,width,height,border-radius';

interface StageRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface LiveStageProps {
  /** Where the flow hands off to once the zoom settles — the real call for a
   *  signed-in visitor, sign-up for everyone else. */
  href: string;
}

/**
 * The whole call screen, held in one connected frame — empty panels showing
 * the product structure without photographs of people. Pressing any control
 * is the one interactive path through it.
 *
 * Layout mirrors the real app: panels stack vertically on a phone, sit side
 * by side from `sm:` up. The aspect ratio matches what `h-dvh` produces on a
 * typical screen.
 */
export function LiveStage({ href }: LiveStageProps): React.ReactElement {
  const t = useTranslations('call');
  const tApp = useTranslations('app');
  const router = useRouter();

  const boxRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<StageRect | null>(null);
  const [expanded, setExpanded] = useState(false);
  const zooming = rect !== null;

  useEffect(() => {
    if (!zooming) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /*
     * Two frames, not one: the first paints the clone pinned exactly over the
     * resting box (nothing has moved yet), the second flips it to full-screen
     * so the browser has a "from" state to transition out of. Collapsing this
     * to a single rAF sometimes lands before that first paint commits, and the
     * clone just appears full-screen with no transition to watch.
     */
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setExpanded(true));
    });
    /*
     * `intro=1` tells the destination to hold its sign-up card back for a
     * couple of seconds rather than fading it straight in. The backdrop
     * behind it renders instantly instead of replaying its own fade — this
     * clone already left it on screen in the exact state that backdrop opens
     * on, so fading it in again would read as a flash rather than a handoff.
     */
    const target = `${href}${href.includes('?') ? '&' : '?'}intro=1`;
    const navigate = setTimeout(() => router.push(target), reduced ? 0 : ZOOM_MS);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(navigate);
    };
  }, [zooming, href, router]);

  const handleStart = (): void => {
    if (zooming || boxRef.current === null) return;
    const box = boxRef.current.getBoundingClientRect();
    setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
  };

  /**
   * `fill` swaps the boxed hero shot's aspect-ratio for the same edge-to-edge
   * proportions the real call screen (and the sign-up backdrop behind it)
   * render at, so the frame the zoom lands on already matches the frame the
   * next page opens on.
   *
   * `interactive` covers the whole control bar with one transparent button
   * rather than wiring each of Start/Skip/Country/Gender separately — none of
   * them can do anything real without an account, so every press means the
   * same thing. The real controls underneath go `inert`, so a keyboard or
   * screen-reader visitor lands on that one button too, instead of reaching
   * individual controls the mouse can no longer trigger.
   */
  const renderStage = (
    onStart: () => void,
    fill: boolean,
    interactive: boolean,
  ): React.ReactElement => (
    <div
      className={`grid grid-rows-[1fr_auto] sm:grid-rows-[70fr_30fr] ${
        fill ? 'h-full' : 'aspect-[9/16] sm:aspect-[16/10]'
      }`}
    >
      <div className="flex min-h-0 flex-col gap-2 overflow-hidden p-2 sm:flex-row sm:gap-2.5 sm:p-2.5">
        <VideoPanel label={t('you')}>
          <div className="flex h-full w-full flex-col items-center justify-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-200/80 sm:h-20 sm:w-20 dark:bg-neutral-800/80">
              <UserIcon className="h-8 w-8 text-neutral-400 sm:h-10 sm:w-10 dark:text-neutral-500" />
            </div>
            <span className="text-sm font-medium text-neutral-400 dark:text-neutral-500">
              {t('cameraOffNote')}
            </span>
          </div>
          <span className="pointer-events-none absolute left-4 top-4 font-display text-xl uppercase text-neutral-400/50 select-none sm:text-2xl">
            {tApp('name')}
          </span>
        </VideoPanel>

        <VideoPanel label={t('stranger')} live>
          <div className="flex h-full w-full flex-col items-center justify-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-200/80 sm:h-20 sm:w-20 dark:bg-neutral-800/80">
              <CameraOffIcon className="h-8 w-8 text-neutral-400 sm:h-10 sm:w-10 dark:text-neutral-500" />
            </div>
            <span className="text-sm font-medium text-neutral-400 dark:text-neutral-500">
              {t('remoteCameraOff')}
            </span>
          </div>
        </VideoPanel>
      </div>

      <div className="relative overflow-hidden border-t border-neutral-200/60 dark:border-neutral-800">
        <div inert={interactive ? true : undefined}>
          <MatchControls
            status="idle"
            onStart={noop}
            onSkip={noop}
            onStop={noop}
            onPreferencesChange={noop}
          />
        </div>
        {interactive && (
          <button
            type="button"
            aria-label={t('start')}
            onClick={onStart}
            className="absolute inset-0 h-full w-full cursor-pointer"
          />
        )}
      </div>
    </div>
  );

  return (
    <>
      {/*
       * The resting preview. It keeps rendering — merely turned invisible —
       * once the zoom starts, rather than unmounting, so the hero grid it
       * sits in never reflows: the space it holds stays exactly as tall as
       * this box, whether or not the box is the thing currently on screen.
       */}
      <div
        ref={boxRef}
        className={`mx-auto w-full max-w-[760px] overflow-hidden rounded-2xl bg-neutral-100 shadow-[0_20px_50px_-25px_rgba(15,23,42,0.35)] sm:max-w-[900px] sm:shadow-[0_30px_70px_-35px_rgba(15,23,42,0.45)] lg:max-w-[1040px] lg:shadow-[0_40px_90px_-40px_rgba(15,23,42,0.5)] dark:bg-neutral-900 dark:shadow-[0_20px_50px_-25px_rgba(0,0,0,0.7)] sm:dark:shadow-[0_40px_90px_-40px_rgba(0,0,0,0.9)] ${
          zooming ? 'invisible' : ''
        }`}
      >
        {renderStage(handleStart, false, true)}
      </div>

      {/*
       * The zoom clone, portaled to `<body>` rather than nested here. The hero
       * wraps this component in a tilted, `overflow-hidden` frame (the 3D
       * product-shot lean) — a `position: fixed` element left inside it would
       * be clipped by that overflow and contained by that transform instead
       * of escaping to the viewport, since a transformed ancestor becomes the
       * containing block for its fixed descendants. Rendering to `<body>`
       * sidesteps both.
       */}
      {rect !== null &&
        createPortal(
          <div
            inert
            aria-hidden
            style={{
              willChange: ZOOM_TRANSITION,
              transitionProperty: ZOOM_TRANSITION,
              ...(expanded
                ? { top: 0, left: 0, width: '100vw', height: '100dvh' }
                : { top: rect.top, left: rect.left, width: rect.width, height: rect.height }),
            }}
            className={`fixed z-50 overflow-hidden bg-neutral-100 duration-700 ease-out dark:bg-neutral-950 ${
              expanded ? 'rounded-none' : 'rounded-2xl'
            }`}
          >
            {renderStage(noop, expanded, false)}
            {/* Scrim, matching the one behind the sign-up card this hands off to. */}
            <div
              className={`absolute inset-0 bg-neutral-900/20 transition-opacity duration-700 ease-out dark:bg-neutral-950/50 ${
                expanded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
