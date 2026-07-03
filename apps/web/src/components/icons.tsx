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
