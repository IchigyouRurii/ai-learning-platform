import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  FlaskConical,
  Layers3,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import type { User } from "@/shared/contracts";
import { getAIProvider } from "@/shared/ai/client";
import { Navigation } from "./navigation";
import { switchDemoRole } from "../server/actions";
import { getAppMode } from "@/shared/config";
import { LogoutButton } from "../auth/logout-button";

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
      ? "教师端"
      : user.role === "admin"
        ? "管理端"
        : "学生端";
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Layers3 size={22} />
          </span>
          <div>
            <strong>
              小课<span className="brand-dot">.</span>
            </strong>
            <small>MINICOURSE</small>
          </div>
        </div>
        <div className="workspace-label">
          {user.role === "teacher"
            ? "教学工作空间"
            : user.role === "admin"
              ? "管理工作空间"
              : "学习工作空间"}
        </div>
        <Navigation role={user.role} />
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Sparkles size={18} />
            <strong>从一个问题开始</strong>
            <p>让每一次学习，都多一点参与。</p>
          </div>
          <div className="sidebar-version">Education, made personal.</div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            工作空间 <span>/</span> <strong>{roleName}</strong>
          </div>
          <div className="topbar-right">
            <span className="demo-tag">
              {demo ? <FlaskConical size={13} /> : <ShieldCheck size={13} />}
              {demo ? "本地演示" : "已登录"}
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
                  <span>切换到{user.role === "teacher" ? "学生" : "教师"}</span>
                </button>
              </form>
            ) : (
              <LogoutButton />
            )}
            <span className="avatar" title={user.name}>
              {user.name.slice(0, 1)}
            </span>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>小课 · 把知识变成一次参与</span>
          <span>
            {getAIProvider() === "mock" ? "AI：模拟模式" : "AI：已选择真实服务"}{" "}
            · {demo ? "演示身份不是真实登录" : "账号与学习记录已关联"}
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
        <h1>此页面需要{expected === "teacher" ? "教师" : "学生"}身份</h1>
        <p className="muted">
          当前账号没有访问权限。如需调整身份，请联系项目负责人。
        </p>
        <Link href="/" className="button primary">
          返回我的工作空间
        </Link>
      </div>
    );
  return (
    <div className="empty-state">
      <h1>请切换到{expected === "teacher" ? "教师" : "学生"}身份</h1>
      <p className="muted">
        本地演示使用两种独立身份，便于检查权限与完整流程。
      </p>
      <form action={switchDemoRole}>
        <input type="hidden" name="role" value={expected} />
        <button className="button primary" type="submit">
          切换演示身份
        </button>
      </form>
    </div>
  );
}
