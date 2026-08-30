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
    <span key={index} className="gradient-text role-rotator-enter inline-block">
      {roles[index]}
    </span>
  );
}
