"use client";

interface ApolloKeyProps {
  className?: string;
}

export function ApolloKeySvg({ className = "" }: ApolloKeyProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 280"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="apolloKeyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f0f0f4" />
          <stop offset="30%" stopColor="#c8c8d0" />
          <stop offset="60%" stopColor="#e4e4e8" />
          <stop offset="100%" stopColor="#a0a0a8" />
        </linearGradient>
        <linearGradient id="apolloKeyShimmer" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter id="apolloKeyGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <radialGradient id="apolloBowInner" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1a1a22" />
          <stop offset="70%" stopColor="#0d0d14" />
          <stop offset="100%" stopColor="#080810" />
        </radialGradient>
      </defs>

      <circle cx="60" cy="52" r="44" fill="url(#apolloKeyGrad)" filter="url(#apolloKeyGlow)" />
      <circle cx="60" cy="52" r="44" fill="url(#apolloKeyShimmer)" />
      <circle cx="60" cy="52" r="30" fill="url(#apolloBowInner)" />
      <circle cx="60" cy="52" r="20" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
      <circle cx="60" cy="52" r="12" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
      <line x1="60" y1="32" x2="60" y2="72" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
      <line x1="40" y1="52" x2="80" y2="52" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />

      <rect x="52" y="92" width="16" height="160" rx="3" fill="url(#apolloKeyGrad)" />
      <rect x="52" y="92" width="16" height="160" rx="3" fill="url(#apolloKeyShimmer)" />
      <rect x="48" y="88" width="24" height="12" rx="2" fill="url(#apolloKeyGrad)" />

      <rect x="68" y="180" width="18" height="8" rx="2" fill="url(#apolloKeyGrad)" />
      <rect x="68" y="204" width="14" height="8" rx="2" fill="url(#apolloKeyGrad)" />
      <rect x="68" y="226" width="20" height="8" rx="2" fill="url(#apolloKeyGrad)" />

      <rect x="52" y="92" width="2" height="160" rx="1" fill="rgba(255,255,255,0.3)" />
      <path
        d="M60 8 C60 8 62 20 60 28"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="1"
        fill="none"
      />
    </svg>
  );
}

interface ApolloLockProps {
  shackleOffset?: number;
  shackleOpacity?: number;
  className?: string;
}

export function ApolloLockSvg({
  shackleOffset = 0,
  shackleOpacity = 1,
  className = "",
}: ApolloLockProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="apolloLockGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d0d0d8" />
          <stop offset="50%" stopColor="#a8a8b0" />
          <stop offset="100%" stopColor="#c4c4cc" />
        </linearGradient>
      </defs>

      <rect x="10" y="36" width="60" height="38" rx="6" fill="url(#apolloLockGrad)" />
      <g
        style={{
          transform: `translateY(${shackleOffset}px)`,
          opacity: shackleOpacity,
        }}
      >
        <path
          d="M24 36 L24 22 Q24 10 40 10 Q56 10 56 22 L56 36"
          stroke="url(#apolloLockGrad)"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
        />
      </g>
      <circle cx="40" cy="54" r="6" fill="rgba(0,0,0,0.5)" />
      <rect x="37" y="54" width="6" height="10" rx="1" fill="rgba(0,0,0,0.5)" />
      <rect x="10" y="36" width="60" height="3" rx="2" fill="rgba(255,255,255,0.2)" />
    </svg>
  );
}
