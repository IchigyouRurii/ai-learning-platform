"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import {
  ChartNoAxesCombined,
  FileText,
  LayoutGrid,
  Route,
  School,
  Sparkles,
  Users,
  BookOpen,
} from "lucide-react";
import type { Role } from "@/shared/contracts";

function NavigationPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span className="navigation-pending" role="status">
      <span className="navigation-pending-mark" aria-hidden="true" />
      <span className="sr-only">Loading page…</span>
    </span>
  );
}

/** Only fully prefetch a route after the user expresses intent, avoiding a burst of database reads. */
function NavigationLink(props: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearIntentTimer = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <Link
      {...props}
      prefetch={props["aria-current"] === "page" ? false : intent}
      onPointerEnter={() => {
        clearIntentTimer();
        timer.current = setTimeout(() => setIntent(true), 150);
      }}
      onPointerLeave={clearIntentTimer}
      onFocus={() => setIntent(true)}
    />
  );
}

export function Navigation({ role }: { role: Role }) {
  const pathname = usePathname();
  const links =
    role === "admin"
      ? [
          { href: "/admin", label: "Platform overview", icon: LayoutGrid },
          { href: "/admin/users", label: "Users & access", icon: Users },
          { href: "/admin/courses", label: "Teaching courses", icon: BookOpen },
        ]
      : role === "teacher"
        ? [
            { href: "/teacher", label: "Course Marketplace", icon: LayoutGrid },
            {
              href: "/teacher/creations",
              label: "My Creation",
              icon: FileText,
            },
            {
              href: "/teacher/students",
              label: "Teaching Management",
              icon: Users,
            },
            { href: "/teacher/classes", label: "Class", icon: School },
          ]
        : [
            {
              href: "/student",
              label: "Course Marketplace",
              icon: LayoutGrid,
            },
            {
              href: "/student/path",
              label: "Learning Path",
              icon: Route,
            },
            {
              href: "/student/progress",
              label: "My Learning",
              icon: ChartNoAxesCombined,
            },
            { href: "/student/classes", label: "My Class", icon: School },
            {
              href: "/student/studio",
              label: "AI Studio",
              icon: Sparkles,
            },
          ];
  return (
    <nav className="navigation" aria-label="Primary navigation">
      {links.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/teacher" || href === "/student" || href === "/admin"
            ? pathname === href
            : pathname.startsWith(href);
        return (
          <NavigationLink
            key={href}
            href={href}
            title={label}
            aria-label={label}
            className={active ? "nav-item active" : "nav-item"}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={18} />
            <span className="nav-label">{label}</span>
            {active && <span className="nav-dot" />}
            <NavigationPending />
          </NavigationLink>
        );
      })}
    </nav>
  );
}
