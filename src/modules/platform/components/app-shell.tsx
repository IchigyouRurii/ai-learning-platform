import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/shared/ui/brand-logo";
import {
  ArrowLeftRight,
  FlaskConical,
  Sparkles,
  ShieldCheck,
  Search,
  Plus,
  ChevronDown,
} from "lucide-react";
import type { User } from "@/shared/contracts";
import { getAIProvider } from "@/shared/ai/client";
import { Navigation } from "./navigation";
import { switchDemoRole } from "../server/actions";
import { getAppMode } from "@/shared/config";
import { LogoutButton } from "../auth/logout-button";
import { WorkspaceSidebar } from "./workspace-sidebar";

export function AppShell({
  user,
  children,
}: {
  user: User;
  children: ReactNode;
}) {
  const demo = getAppMode() === "demo";
  const roleName =
    user.role === "teacher"
      ? "Teacher"
      : user.role === "admin"
        ? "Admin"
        : "Student";
  return (
    <div
      className={`app-shell${user.role === "teacher" ? " teacher-shell" : ""}`}
    >
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <WorkspaceSidebar>
        <div className="brand">
          <BrandLogo />
          <div>
            <strong>
              OpenLearnING<span className="brand-dot">.</span>
            </strong>
            <small>MINICOURSE</small>
          </div>
        </div>
        {user.role !== "teacher" && (
          <div className="workspace-label">
            {user.role === "admin" ? "Admin workspace" : "Learning workspace"}
          </div>
        )}
        <Navigation role={user.role} />
        {user.role !== "teacher" && (
          <div className="sidebar-bottom">
            <div className="sidebar-note">
              <Sparkles size={18} />
              <strong>Start with a question</strong>
              <p>Learn through practice and participation.</p>
            </div>
            <div className="sidebar-version">Education, made personal.</div>
          </div>
        )}
      </WorkspaceSidebar>
      <div className="main-shell">
        <header className="topbar">
          {user.role === "teacher" ? (
            <form className="catalog-search" action="/teacher" role="search">
              <Search size={18} aria-hidden="true" />
              <label className="sr-only" htmlFor="catalog-search">
                Search courses or authors
              </label>
              <input
                id="catalog-search"
                name="q"
                type="search"
                placeholder="Search courses or authors"
                maxLength={200}
              />
              <button type="submit" aria-label="Search courses">
                <Search size={15} />
              </button>
            </form>
          ) : (
            <div className="breadcrumb">
              Workspace <span>/</span> <strong>{roleName}</strong>
            </div>
          )}
          <div className="topbar-right">
            {user.role === "teacher" && (
              <Link
                href="/teacher/courses/new"
                className="button primary create-course-link"
              >
                <Plus size={17} />
                <span>Create Course</span>
              </Link>
            )}
            <details className="profile-menu">
              <summary aria-label="Open profile menu" title={user.name}>
                <span className="avatar">
                  {user.name
                    .trim()
                    .split(/\s+/)
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>
                <ChevronDown size={15} />
              </summary>
              <div className="profile-menu-panel">
                <strong>{user.name}</strong>
                <small>{roleName} workspace</small>
                <span className="demo-tag">
                  {demo ? (
                    <FlaskConical size={13} />
                  ) : (
                    <ShieldCheck size={13} />
                  )}
                  {demo ? "Local demo" : "Signed in"}
                </span>
                {demo ? (
                  <form action={switchDemoRole}>
                    <input
                      type="hidden"
                      name="role"
                      value={user.role === "teacher" ? "student" : "teacher"}
                    />
                    <button className="role-switch" type="submit">
                      <ArrowLeftRight size={14} />
                      <span>
                        Switch to{" "}
                        {user.role === "teacher" ? "Student" : "Teacher"}
                      </span>
                    </button>
                  </form>
                ) : (
                  <LogoutButton />
                )}
              </div>
            </details>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>OpenLearnING · Learn through participation</span>
          <span>
            {getAIProvider() === "mock"
              ? "AI: mock mode"
              : "AI: live provider selected"}{" "}
            ·{" "}
            {demo
              ? "Demo identity is not authentication"
              : "Learning records linked to your account"}
          </span>
        </footer>
      </div>
    </div>
  );
}

export function RoleGate({ expected }: { expected: "teacher" | "student" }) {
  if (getAppMode() !== "demo")
    return (
      <div className="empty-state">
        <h1>This page requires a {expected} account</h1>
        <p className="muted">
          Your account cannot access this page. Contact your project
          administrator to request access.
        </p>
        <Link href="/" className="button primary">
          Back to my workspace
        </Link>
      </div>
    );
  return (
    <div className="empty-state">
      <h1>Switch to the {expected} role</h1>
      <p className="muted">
        Local demo uses separate identities to check permissions and workflows.
      </p>
      <form action={switchDemoRole}>
        <input type="hidden" name="role" value={expected} />
        <button className="button primary" type="submit">
          Switch demo identity
        </button>
      </form>
    </div>
  );
}
