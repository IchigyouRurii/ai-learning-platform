"use client";

import { useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

/** Only presentation state lives here; role and session stay on the server. */
export function WorkspaceSidebar({ children }: { children: ReactNode }) {
  const [pinned, setPinned] = useState(false);
  return (
    <aside className={`sidebar${pinned ? " sidebar-expanded" : ""}`}>
      {children}
      <button
        type="button"
        className="sidebar-toggle"
        aria-expanded={pinned}
        aria-label={
          pinned ? "Collapse navigation" : "Expand and pin navigation"
        }
        title={pinned ? "Collapse navigation" : "Expand and pin navigation"}
        onClick={() => setPinned(!pinned)}
      >
        {pinned ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
      </button>
    </aside>
  );
}
