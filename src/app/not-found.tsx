import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty-state">
      <h1>没有找到这个页面</h1>
      <p className="muted">课程可能尚未发布，或链接已经变化。</p>
      <Link className="button primary" href="/">
        返回工作空间
      </Link>
    </div>
  );
}
