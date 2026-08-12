export function ChatlyLogo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`drop-shadow-lg ${className}`}
    >
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0e1726" />
          <stop offset="50%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>

        <linearGradient id="bubble3D" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>

        <linearGradient id="shineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        <filter id="dropShadow3D" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="18" stdDeviation="14" floodColor="#06b6d4" floodOpacity="0.5" />
        </filter>
      </defs>

      {/* Background Base */}
      <rect width="512" height="512" rx="128" fill="url(#bgGrad)" />
      <rect width="504" height="504" x="4" y="4" rx="124" fill="none" stroke="#1e293b" strokeWidth="4" />

      {/* Animated Floating 3D Glassmorphism Chat Bubble */}
      <g filter="url(#dropShadow3D)">
        {/* Outer 3D Base */}
        <path
          d="M140 130 h232 c44 0 80 36 80 80 v70 c0 44 -36 80 -80 80 h-70 l-60 50 c-8 7 -22 1 -22 -10 v-40 h-80 c-44 0 -80 -36 -80 -80 v-70 c0 -44 36 -80 80 -80 z"
          fill="url(#bubble3D)"
        />

        {/* 3D Highlight */}
        <path
          d="M140 130 h232 c44 0 80 36 80 80 v20 c0 -44 -36 -75 -80 -75 h-232 c-44 0 -80 31 -80 75 v-20 c0 -44 36 -80 80 -80 z"
          fill="url(#shineGrad)"
        />

        {/* 3D Dots */}
        <circle cx="200" cy="250" r="22" fill="#ffffff" />
        <circle cx="256" cy="250" r="22" fill="#ffffff" opacity="0.9" />
        <circle cx="312" cy="250" r="22" fill="#ffffff" opacity="0.85" />
      </g>
    </svg>
  );
}
