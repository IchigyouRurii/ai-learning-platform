import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/shared/ui/brand-logo";
import {
  ArrowLeftRight,
  FlaskConical,
  ShieldCheck,
  Plus,
  ChevronDown,
} from "lucide-react";
import type { User } from "@/shared/contracts";
import { Navigation } from "./navigation";
import { switchDemoRole } from "../server/actions";
import { getAppMode } from "@/shared/config";
import { LogoutButton } from "../auth/logout-button";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { CatalogSearch } from "./catalog-search";
import { ProfileMenu } from "./profile-menu";

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
      className={`app-shell${user.role !== "admin" ? " teacher-shell" : ""}`}
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
        <Navigation role={user.role} />
      </WorkspaceSidebar>
      <div className="main-shell">
        <header className="topbar">
          {user.role !== "admin" ? (
            <CatalogSearch />
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
            <ProfileMenu>
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
            </ProfileMenu>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>OpenLearnING · Learn through participation</span>
          {demo && <span>Demo identity is not authentication</span>}
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
