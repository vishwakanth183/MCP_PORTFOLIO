/**
 * An original flat-vector "tech avatar" bust portrait — glasses, side-swept
 * hair, dark zip jacket, glowing circuit-ring background — inspired by the
 * common 3D-rendered AI-avatar genre, but hand-built as flat SVG (no image
 * generation tool available here, so this approximates the composition
 * rather than true 3D shading/lighting).
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
          <stop offset="0%" stopColor="var(--accent-from)" />
          <stop offset="100%" stopColor="var(--accent-to)" />
        </linearGradient>
      </defs>

      <circle cx="100" cy="100" r="98" fill="url(#bgGlow)" />

      {/* decorative tech rings, like the HUD circles in the reference */}
      <circle
        cx="150"
        cy="70"
        r="30"
        fill="none"
        stroke="var(--accent-via)"
        strokeWidth="1.2"
        opacity="0.35"
      />
      <circle
        cx="150"
        cy="70"
        r="22"
        fill="none"
        stroke="var(--accent-from)"
        strokeWidth="1"
        opacity="0.25"
      />
      <circle cx="46" cy="120" r="2.5" fill="var(--accent-via)" opacity="0.6" />
      <circle cx="160" cy="130" r="2" fill="var(--accent-to)" opacity="0.6" />
      <rect
        x="34"
        y="60"
        width="18"
        height="4"
        rx="1"
        fill="var(--accent-via)"
        opacity="0.3"
      />
      <rect
        x="34"
        y="68"
        width="12"
        height="4"
        rx="1"
        fill="var(--accent-via)"
        opacity="0.2"
      />

      {/* shoulders / zip jacket */}
      <path d="M34 190c0-42 30-62 66-62s66 20 66 62z" fill="url(#jacketGrad)" />
      <path d="M92 132h16v56h-16z" fill="#141026" opacity="0.6" />
      <circle cx="100" cy="176" r="7" fill="url(#badgeGrad)" />

      {/* neck */}
      <rect x="88" y="106" width="24" height="28" rx="10" fill="#dba97c" />

      {/* head */}
      <circle cx="100" cy="84" r="42" fill="#e8b98a" />
      <path d="M65 90c-2 14 4 26 14 26-8-8-10-18-8-28z" fill="#dba97c" />
      <path d="M135 90c2 14-4 26-14 26 8-8 10-18 8-28z" fill="#dba97c" />

      {/* side-swept hair */}
      <path
        d="M56 78c-2-28 20-48 44-48s46 20 44 48c-4-6-10-8-12-6 2-10-6-18-16-16 0-8-10-12-18-8-10-4-20 2-22 12-10-2-18 6-20 18z"
        fill="#1e1a2e"
      />
      <path
        d="M60 74c10-6 20-4 26 2-10 2-18 8-22 16-4-6-6-12-4-18z"
        fill="#1e1a2e"
      />

      {/* glasses */}
      <g stroke="#161225" strokeWidth="3" fill="none">
        <rect x="70" y="82" width="26" height="20" rx="8" />
        <rect x="104" y="82" width="26" height="20" rx="8" />
        <path d="M96 90h8" />
        <path d="M70 88 58 84" strokeLinecap="round" />
        <path d="M130 88 142 84" strokeLinecap="round" />
      </g>
      <rect x="74" y="86" width="18" height="12" rx="5" fill="#fff" opacity="0.06" />
      <rect x="108" y="86" width="18" height="12" rx="5" fill="#fff" opacity="0.06" />

      {/* eyes + smile */}
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
