/**
 * A small original, hand-drawn-style chibi/anime-inspired illustration of a
 * developer at a laptop — not a photo or a copy of any existing artwork.
 * Pure inline SVG so it stays crisp at any size and costs no image request.
 */
export default function CodingAvatar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label="Illustration of a developer coding at a laptop"
    >
      <defs>
        <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent-from)" />
          <stop offset="50%" stopColor="var(--accent-via)" />
          <stop offset="100%" stopColor="var(--accent-to)" />
        </linearGradient>
        <linearGradient id="hoodieGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3d2a5c" />
          <stop offset="100%" stopColor="#241640" />
        </linearGradient>
      </defs>

      <circle cx="100" cy="100" r="98" fill="url(#bgGrad)" />

      {/* hoodie / shoulders */}
      <path
        d="M40 190c0-38 27-58 60-58s60 20 60 58z"
        fill="url(#hoodieGrad)"
      />
      <path
        d="M62 150c-4 6-6 16-6 28h10c0-14 2-24 6-30zM138 150c4 6 6 16 6 28h-10c0-14-2-24-6-30z"
        fill="#2f1e4d"
      />
      <circle cx="100" cy="152" r="5" fill="#a685ff" opacity="0.8" />

      {/* neck */}
      <rect x="90" y="112" width="20" height="22" rx="8" fill="#f0b98a" />

      {/* head */}
      <circle cx="100" cy="92" r="38" fill="#f6c69a" />

      {/* hair: spiky anime-style silhouette */}
      <path
        d="M58 88c-4-26 14-46 42-46s46 20 42 46c-6-8-10-18-10-18s-4 14-14 18c2-10-2-16-2-16s-6 12-16 14c0-8-4-14-4-14s-6 10-16 12c-2-8-6-12-6-12s-4 10-16 16z"
        fill="#1c1230"
      />
      <path d="M60 82c6-4 10-2 12 2-8 0-12 4-14 8-2-4-1-8 2-10z" fill="#1c1230" />
      <path d="M140 82c-6-4-10-2-12 2 8 0 12 4 14 8 2-4 1-8-2-10z" fill="#1c1230" />

      {/* headphones */}
      <path
        d="M62 88a38 38 0 0 1 76 0"
        fill="none"
        stroke="#1c1230"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <rect x="54" y="84" width="12" height="22" rx="6" fill="#7f22fe" />
      <rect x="134" y="84" width="12" height="22" rx="6" fill="#7f22fe" />

      {/* face */}
      <circle cx="88" cy="94" r="3.2" fill="#241640" />
      <circle cx="112" cy="94" r="3.2" fill="#241640" />
      <path
        d="M91 108c4 4 14 4 18 0"
        fill="none"
        stroke="#a85f3a"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="80" cy="102" r="5" fill="#ff9a9a" opacity="0.5" />
      <circle cx="120" cy="102" r="5" fill="#ff9a9a" opacity="0.5" />

      {/* laptop */}
      <g transform="translate(58 150)">
        <rect x="0" y="14" width="84" height="8" rx="2" fill="#3a2a55" />
        <path d="M6 14 12 -22H72L78 14Z" fill="#2a1c42" />
        <path d="M12 -18H68L72 10H8Z" fill="#150c26" />
        <rect x="16" y="-12" width="44" height="3" rx="1.5" fill="url(#bgGrad)" />
        <rect x="16" y="-5" width="30" height="3" rx="1.5" fill="url(#bgGrad)" opacity="0.7" />
        <rect x="16" y="2" width="38" height="3" rx="1.5" fill="url(#bgGrad)" opacity="0.5" />
      </g>
    </svg>
  );
}
