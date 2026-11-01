"use client";

import { useState, type ReactNode } from "react";

/** Hover survives route changes because the shared workspace layout stays mounted. */
export function WorkspaceSidebar({ children }: { children: ReactNode }) {
  const [hovered, setHovered] = useState(false);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  return (
    <aside
      className={`sidebar${hovered || keyboardFocused ? " sidebar-expanded" : ""}`}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        setHovered(false);
        setKeyboardFocused(false);
      }}
      onFocusCapture={(event) => {
        if (event.target.matches(":focus-visible")) setKeyboardFocused(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setKeyboardFocused(false);
      }}
    >
      {children}
    </aside>
  );
}
