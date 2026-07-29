interface IconProps {
  className?: string;
}

function iconAttrs(className?: string): React.SVGProps<SVGSVGElement> {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
    'aria-hidden': true,
  };
}

export function MicIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...iconAttrs(className)}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

export function MicOffIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...iconAttrs(className)}>
      <path d="M9 5a3 3 0 0 1 6 0v5a3 3 0 0 1-.4 1.5" />
      <path d="M9 9v1a3 3 0 0 0 4.7 2.5" />
      <path d="M5 10a7 7 0 0 0 11.6 5.3M19 10a7 7 0 0 1-.8 3.2" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </svg>
  );
}

export function CameraIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...iconAttrs(className)}>
      <rect x="2" y="6" width="13" height="12" rx="2" />
      <path d="m15 10 5-3v10l-5-3" />
    </svg>
  );
}

export function CameraOffIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...iconAttrs(className)}>
      <path d="M15 10.5V8a2 2 0 0 0-2-2H8m-4 .5A2 2 0 0 0 2 8v8a2 2 0 0 0 2 2h9a2 2 0 0 0 1.7-1" />
      <path d="m15 10 5-3v10l-1.7-1" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </svg>
  );
}

export function NextIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...iconAttrs(className)}>
      <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" stroke="none" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </svg>
  );
}

export function StopIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...iconAttrs(className)}>
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </svg>
  );
}

export function SendIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...iconAttrs(className)}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export function FlagIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...iconAttrs(className)}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

export function UserIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...iconAttrs(className)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function SunIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...iconAttrs(className)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

export function MoonIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...iconAttrs(className)}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

export function SpinnerIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...iconAttrs(className)}>
      <path d="M21 12a9 9 0 1 1-6.2-8.56" />
    </svg>
  );
}

export function TrophyIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...iconAttrs(className)}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 6H4v1a4 4 0 0 0 3.4 4M17 6h3v1a4 4 0 0 1-3.4 4" />
      <path d="M12 14v3m-3 4h6l-.6-2.4a1.5 1.5 0 0 0-1.5-1.1h-1.8a1.5 1.5 0 0 0-1.5 1.1z" />
    </svg>
  );
}

export function GameIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...iconAttrs(className)}>
      <path d="M7 8h10a5 5 0 0 1 4.9 4l.7 3.6A2.9 2.9 0 0 1 19.8 19c-1 0-1.9-.5-2.4-1.4L16.5 16h-9l-.9 1.6A2.8 2.8 0 0 1 4.2 19a2.9 2.9 0 0 1-2.8-3.4L2.1 12A5 5 0 0 1 7 8Z" />
      <path d="M7 11v3m-1.5-1.5h3M16 12h.01M18 14h.01" />
    </svg>
  );
}

export function ShieldIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...iconAttrs(className)}>
      <path d="M12 2.5 20 5v6.2c0 4.9-3.3 8.6-8 10.3-4.7-1.7-8-5.4-8-10.3V5z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function ChatIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...iconAttrs(className)}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function BoltIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...iconAttrs(className)}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </svg>
  );
}

export function ArrowRightIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...iconAttrs(className)}>
      <line x1="4" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </svg>
  );
}

/*
 * Brand marks below are drawn with their own fills rather than `currentColor`,
 * so `iconAttrs` (which sets a stroke) does not apply to them.
 */

export function GoogleIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.5 5.5 0 0 1-2.39 3.62v3h3.86c2.26-2.08 3.58-5.15 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.92l-3.86-3c-1.08.72-2.45 1.15-4.08 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54V6.64H1.29a12 12 0 0 0 0 10.72l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.64l3.98 3.09C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

export function DiscordIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#5865F2"
        d="M20.32 4.57A19.8 19.8 0 0 0 15.44 3c-.21.38-.46.9-.63 1.31a18.3 18.3 0 0 0-5.49 0C9.14 3.9 8.88 3.38 8.67 3a19.7 19.7 0 0 0-4.89 1.57C.69 9.2-.15 13.7.27 18.15a19.9 19.9 0 0 0 6.05 3.08c.49-.67.92-1.38 1.3-2.13-.72-.27-1.4-.6-2.04-.99.17-.13.34-.26.5-.4a14.2 14.2 0 0 0 12.14 0c.16.14.33.28.5.4-.65.39-1.33.72-2.05.99.38.75.81 1.46 1.3 2.13a19.9 19.9 0 0 0 6.05-3.08c.5-5.16-.84-9.62-3.7-13.58ZM8.02 15.42c-1.18 0-2.16-1.09-2.16-2.43 0-1.34.95-2.44 2.16-2.44 1.22 0 2.19 1.1 2.17 2.44 0 1.34-.95 2.43-2.17 2.43Zm7.96 0c-1.19 0-2.16-1.09-2.16-2.43 0-1.34.95-2.44 2.16-2.44 1.21 0 2.19 1.1 2.17 2.44 0 1.34-.95 2.43-2.17 2.43Z"
      />
    </svg>
  );
}

export function PasskeyIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...iconAttrs(className)}>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21a7 7 0 0 1 9.5-6.54" />
      <circle cx="17.5" cy="14.5" r="2.5" />
      <path d="M17.5 17v4l1.5-1.2L17.5 21" />
    </svg>
  );
}
