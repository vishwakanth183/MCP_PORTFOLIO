/**
 * Avatar illustration — Pablo Stanley's "Avataaars" open-source avatar
 * library (free for personal and commercial use: https://avataaars.com/),
 * served via the DiceBear API (https://www.dicebear.com/styles/avataaars/).
 * Using a real, professionally-designed avatar set instead of hand-coded
 * SVG shapes, since building convincing character illustration by hand
 * wasn't landing well. Options are fixed (not random) so the avatar stays
 * stable across reloads/deploys — see AVATAR_URL below to change the look.
 */
const AVATAR_URL =
  "https://api.dicebear.com/9.x/avataaars/svg" +
  "?seed=vishwakanth-dev" +
  "&top=theCaesarAndSidePart" +
  "&hairColor=2c1b18" +
  "&accessories=prescription02" +
  "&accessoriesProbability=100" +
  "&clothing=hoodie" +
  "&clothesColor=262e33" +
  "&facialHairProbability=0" +
  "&eyes=default" +
  "&eyebrows=defaultNatural" +
  "&mouth=smile" +
  "&skinColor=edb98a" +
  "&backgroundType=gradientLinear" +
  "&backgroundColor=a855f7,ec4899";

export default function CodingAvatar({ className }: { className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-full shadow-lg shadow-[var(--accent-via)]/30 ${className ?? ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- external SVG, no next/image domain config needed for a single decorative avatar */}
      <img
        src={AVATAR_URL}
        alt="Avatar illustration"
        className="h-full w-full object-cover"
      />
    </div>
  );
}
