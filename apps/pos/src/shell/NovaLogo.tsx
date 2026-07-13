// Nova mark — an original 3D "supernova": a glowing burst star with a spherical
// core, built from SVG radial gradients + a specular highlight for depth.
export function NovaLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" role="img" aria-label="Nova">
      <defs>
        <linearGradient id="nv-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a1e7e" />
          <stop offset="1" stopColor="#0d0930" />
        </linearGradient>
        <radialGradient id="nv-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#9a7bff" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="#6b3df5" stopOpacity="0.35" />
          <stop offset="1" stopColor="#6b3df5" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nv-core" cx="0.4" cy="0.34" r="0.72">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.34" stopColor="#cfc4ff" />
          <stop offset="0.72" stopColor="#5b46f5" />
          <stop offset="1" stopColor="#2c1e9a" />
        </radialGradient>
        <linearGradient id="nv-ray" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.42" stopColor="#a08cff" />
          <stop offset="1" stopColor="#d24bf0" stopOpacity="0.16" />
        </linearGradient>
        <filter id="nv-soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.7" />
        </filter>
      </defs>

      <rect x="1.5" y="1.5" width="45" height="45" rx="11" fill="url(#nv-bg)" />
      <circle cx="24" cy="24" r="17" fill="url(#nv-glow)" filter="url(#nv-soft)" />

      {/* 8-point burst: a 4-point sparkle + a smaller one rotated 45° */}
      <g fill="url(#nv-ray)">
        <path d="M24 4 C25.3 18 30 22.7 44 24 C30 25.3 25.3 30 24 44 C22.7 30 18 25.3 4 24 C18 22.7 22.7 18 24 4 Z" />
        <path d="M24 9.5 C24.8 20 28 23.2 38.5 24 C28 24.8 24.8 28 24 38.5 C23.2 28 20 24.8 9.5 24 C20 23.2 23.2 20 24 9.5 Z" transform="rotate(45 24 24)" opacity="0.5" />
      </g>

      {/* spherical core + specular highlight for the 3D read */}
      <circle cx="24" cy="24" r="7.6" fill="url(#nv-core)" />
      <ellipse cx="21.4" cy="21" rx="2.4" ry="1.5" fill="#ffffff" opacity="0.85" />
    </svg>
  );
}
