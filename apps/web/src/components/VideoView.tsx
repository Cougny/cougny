'use client';

import { useEffect, useRef } from 'react';

interface VideoViewProps {
  stream: MediaStream | null;
  muted?: boolean;
  mirrored?: boolean;
  className?: string;
}

/** Binds a MediaStream to a <video> element and keeps it in sync. */
export function VideoView({
  stream,
  muted = false,
  mirrored = false,
  className,
}: VideoViewProps): React.ReactElement {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && el.srcObject !== stream) {
      el.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={className}
      style={mirrored ? { transform: 'scaleX(-1)' } : undefined}
    />
  );
}
