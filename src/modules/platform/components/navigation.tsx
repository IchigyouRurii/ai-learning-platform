"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ChartNoAxesCombined,
  GraduationCap,
  Plus,
  Users,
} from "lucide-react";
import type { Role } from "@/shared/contracts";

export function Navigation({ role }: { role: Role }) {
  const pathname = usePathname();
  const links =
    role === "admin"
      ? [{ href: "/admin", label: "管理概览", icon: Users }]
      : role === "teacher"
        ? [
            { href: "/teacher", label: "我的课程", icon: BookOpen },
            { href: "/teacher/courses/new", label: "创建课程", icon: Plus },
            { href: "/teacher/students", label: "学生与反馈", icon: Users },
          ]
        : [
            { href: "/student", label: "发现课程", icon: GraduationCap },
            {
              href: "/student/progress",
              label: "我的学习",
              icon: ChartNoAxesCombined,
            },
          ];
  return (
    <nav className="navigation" aria-label="主导航">
      {links.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/teacher" || href === "/student"
            ? pathname === href
            : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={active ? "nav-item active" : "nav-item"}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={18} />
            <span>{label}</span>
            {active && <span className="nav-dot" />}
          </Link>
        );
      })}
    </nav>
  );
}
