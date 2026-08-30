/**
 * An original flat-vector "tech avatar" bust portrait — glasses, voluminous
 * swept-up hair, dark zip jacket with an accent badge, glowing circuit-ring
 * background — inspired by the common 3D-rendered AI-avatar genre, but
 * hand-built as flat SVG (no image generation tool available here, so this
 * approximates the composition rather than true 3D shading/lighting).
 */
export default function CodingAvatar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label="Avatar illustration"
    >
      <defs>
        <radialGradient id="bgGlow" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#241a44" />
          <stop offset="100%" stopColor="#0d0818" />
        </radialGradient>
        <linearGradient id="jacketGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a2f57" />
          <stop offset="100%" stopColor="#1c1533" />
        </linearGradient>
        <linearGradient id="badgeGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ff7a59" />
          <stop offset="50%" stopColor="var(--accent-via)" />
          <stop offset="100%" stopColor="#4fd1ff" />
        </linearGradient>
        <linearGradient id="hairGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2b2444" />
          <stop offset="100%" stopColor="#171226" />
        </linearGradient>
      </defs>

      <circle cx="100" cy="100" r="98" fill="url(#bgGlow)" />

      {/* decorative tech rings + panel lines, echoing the reference's HUD backdrop */}
      <circle cx="152" cy="66" r="32" fill="none" stroke="var(--accent-via)" strokeWidth="1.2" opacity="0.35" />
      <circle cx="152" cy="66" r="23" fill="none" stroke="var(--accent-from)" strokeWidth="1" opacity="0.25" />
      <circle cx="44" cy="122" r="2.5" fill="var(--accent-via)" opacity="0.6" />
      <circle cx="162" cy="132" r="2" fill="var(--accent-to)" opacity="0.6" />
      <rect x="30" y="56" width="20" height="4" rx="1" fill="var(--accent-via)" opacity="0.3" />
      <rect x="30" y="64" width="13" height="4" rx="1" fill="var(--accent-via)" opacity="0.2" />
      <rect x="150" y="150" width="18" height="4" rx="1" fill="var(--accent-to)" opacity="0.25" />

      {/* shoulders / zip jacket */}
      <path d="M32 190c0-42 31-62 68-62s68 20 68 62z" fill="url(#jacketGrad)" />
      <path d="M92 130h16v58h-16z" fill="#141026" opacity="0.6" />
      <rect x="86" y="172" width="28" height="12" rx="6" fill="url(#badgeGrad)" />

      {/* neck */}
      <rect x="88" y="104" width="24" height="28" rx="10" fill="#dba97c" />

      {/* ears */}
      <path d="M62 86c-6 0-8 8-4 14s10 4 10-2z" fill="#dba97c" />
      <path d="M138 86c6 0 8 8 4 14s-10 4-10-2z" fill="#dba97c" />

      {/* head */}
      <circle cx="100" cy="82" r="42" fill="#e8b98a" />

      {/* voluminous hair: convex ellipses only (no zigzag outlines), so
          there's no way for the scalp to peek through as a "bald" gap */}
      <ellipse cx="100" cy="45" rx="46" ry="30" fill="url(#hairGrad)" />
      <ellipse cx="127" cy="50" rx="22" ry="27" fill="url(#hairGrad)" />
      <ellipse cx="64" cy="72" rx="14" ry="22" fill="url(#hairGrad)" />
      <ellipse cx="138" cy="74" rx="12" ry="20" fill="url(#hairGrad)" />

      {/* swept side-fringe flap, sitting well above the eyebrows */}
      <path
        d="M85,50 C95,42 112,40 123,48 C110,44 96,47 88,58 C86,55 85,52 85,50 Z"
        fill="#332a52"
        opacity="0.6"
      />

      {/* thin strand highlights for texture */}
      <path d="M78,30 C90,24 104,24 116,30" stroke="#463a6e" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6" />
      <path d="M70,40 C84,32 100,30 114,34" stroke="#463a6e" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5" />

      {/* glasses */}
      <g stroke="#161225" strokeWidth="3.2" fill="none">
        <rect x="69" y="82" width="27" height="21" rx="8" />
        <rect x="104" y="82" width="27" height="21" rx="8" />
        <path d="M96 91h8" />
        <path d="M69 87 56 82" strokeLinecap="round" />
        <path d="M131 87 144 82" strokeLinecap="round" />
      </g>
      <rect x="73" y="86" width="19" height="13" rx="5" fill="#fff" opacity="0.06" />
      <rect x="108" y="86" width="19" height="13" rx="5" fill="#fff" opacity="0.06" />

      {/* eyebrows, eyes + smile */}
      <path d="M75 78c4-2 9-2 12 0" stroke="#3a2a1c" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M113 78c3-2 8-2 12 0" stroke="#3a2a1c" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="83" cy="92" r="2.6" fill="#241640" />
      <circle cx="117" cy="92" r="2.6" fill="#241640" />
      <path
        d="M88 108c5 5 19 5 24 0"
        fill="none"
        stroke="#9c5f3a"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
