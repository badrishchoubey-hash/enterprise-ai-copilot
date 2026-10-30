"use client";

import React from "react";

/**
 * Simple reusable shimmer / skeleton component.
 * `variant` determines which layout is rendered.
 * Adjust Tailwind classes to match the UI design.
 */
export default function Shimmer({
  variant = "default",
}: {
  /**
   * "header" – placeholder for the Header welcome text and avatar.
   * "profile" – grid of cards used on the profile page.
   * "default" – a generic line placeholder.
   */
  variant?: "header" | "profile" | "default";
}) {
  const base = "animate-pulse bg-gray-200 rounded";

  if (variant === "header") {
    return (
      <div className="flex items-center gap-3">
        {/* Avatar circle */}
        <div className={`${base} w-9 h-9`} />
        {/* Text lines */}
        <div className="flex flex-col space-y-1">
          <div className={`${base} h-4 w-32`} />
          <div className={`${base} h-5 w-48`} />
        </div>
      </div>
    );
  }

  if (variant === "profile") {
    // Render a 2‑column grid of skeleton cards similar to the real UI.
    const cards = Array.from({ length: 6 });
    return (
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {cards.map((_, i) => (
          <div key={i} className={`${base} h-24 w-full`} />
        ))}
      </div>
    );
  }

  // Fallback – single line
  return <div className={`${base} h-4 w-full`} />;
}

