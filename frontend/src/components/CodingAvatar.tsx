/**
 * A simple, original flat-vector avatar (bust portrait) in the theme's
 * gradient palette — not a photo or a copy of any existing artwork/reference.
 * Pure inline SVG so it stays crisp at any size and costs no image request.
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
        <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent-from)" />
          <stop offset="50%" stopColor="var(--accent-via)" />
          <stop offset="100%" stopColor="var(--accent-to)" />
        </linearGradient>
      </defs>

      <circle cx="100" cy="100" r="98" fill="url(#bgGrad)" />

      {/* shoulders / collar */}
      <path d="M36 188c0-40 29-60 64-60s64 20 64 60z" fill="#241640" />
      <path d="M84 132h32l6 14-22 10-22-10z" fill="#3a2a55" />

      {/* neck */}
      <rect x="88" y="108" width="24" height="26" rx="10" fill="#f0b98a" />

      {/* head */}
      <circle cx="100" cy="86" r="42" fill="#f6c69a" />

      {/* flat hairstyle */}
      <path
        d="M58 84a42 42 0 0 1 84 0c0-6-2-10-6-10 2-10-4-18-14-20 2-6-4-12-12-10-6-8-18-8-24 0-8-2-14 4-12 10-10 2-16 10-14 20-4 0-6 4-6 10z"
        fill="#241640"
      />

      {/* face */}
      <circle cx="86" cy="88" r="4" fill="#241640" />
      <circle cx="114" cy="88" r="4" fill="#241640" />
      <path
        d="M88 104c5 5 19 5 24 0"
        fill="none"
        stroke="#a85f3a"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
