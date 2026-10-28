"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartNoAxesCombined,
  GraduationCap,
  FileText,
  LayoutGrid,
  Route,
  Sparkles,
  Users,
  BookOpen,
} from "lucide-react";
import type { Role } from "@/shared/contracts";

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
              label: "My Creations",
              icon: FileText,
            },
            {
              href: "/teacher/students",
              label: "Teaching Management",
              icon: Users,
            },
          ]
        : [
            {
              href: "/student",
              label: "Course Marketplace",
              icon: GraduationCap,
            },
            {
              href: "/student/studio",
              label: "AI Studio",
              icon: Sparkles,
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
          ];
  return (
    <nav className="navigation" aria-label="Primary navigation">
      {links.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/teacher" || href === "/student" || href === "/admin"
            ? pathname === href
            : pathname.startsWith(href);
        return (
          <Link
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
          </Link>
        );
      })}
    </nav>
  );
}
