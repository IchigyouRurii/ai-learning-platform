"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state">
      <h1>暂时无法加载</h1>
      <p className="muted">
        请稍后重试。如果刚修改了配置，请检查服务端终端中的提示。
      </p>
      <button className="button primary" onClick={reset}>
        重新加载
      </button>
    </div>
  );
}
