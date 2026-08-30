"use client";

import { useEffect, useState } from "react";

export default function RoleRotator({ roles }: { roles: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (roles.length < 2) return;
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % roles.length);
    }, 2600);
    return () => clearInterval(id);
  }, [roles.length]);

  if (roles.length === 0) return null;

  return (
    // All role sentences are stacked in the same grid cell (rather than only
    // rendering the active one) so the grid row auto-sizes to the tallest
    // wrapped variant. That reserves stable space up front — swapping the
    // active role never changes this element's height, which previously
    // caused everything below the hero to reflow on every rotation.
    <span className="grid w-full">
      {roles.map((role, i) => (
        <span
          key={role}
          aria-hidden={i !== index}
          className={`col-start-1 row-start-1 ${
            i === index ? "role-rotator-enter" : "invisible"
          }`}
        >
          A <span className="gradient-text">{role}</span> by trade
        </span>
      ))}
    </span>
  );
}
