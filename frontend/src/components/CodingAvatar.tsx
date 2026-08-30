import Image from "next/image";

/**
 * The candidate's own avatar image (public/avatar.png), supplied directly
 * rather than generated — see docs/MCP.md history for the earlier
 * hand-coded/library-based attempts this replaced.
 */
export default function CodingAvatar({ className }: { className?: string }) {
  return (
    <div className={`overflow-hidden rounded-full ${className ?? ""}`}>
      <Image
        src="/avatar.png"
        alt="Portrait avatar"
        width={320}
        height={320}
        priority
        className="h-full w-full object-cover"
      />
    </div>
  );
}
