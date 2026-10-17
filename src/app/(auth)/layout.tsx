import { Layers3, Sparkles } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="brand">
          <span className="brand-mark">
            <Layers3 size={24} />
          </span>
          <div>
            <strong>
              小课<span className="brand-dot">.</span>
            </strong>
            <small>MINICOURSE</small>
          </div>
        </div>
        <div className="auth-story-copy">
          <span className="eyebrow">A LITTLE CURIOSITY GOES A LONG WAY</span>
          <h2>
            每一个好问题，
            <br />
            都是学习的开始。
          </h2>
          <p>
            在实践中探索，在反馈中成长。
            <br />
            让知识，成为你自己的能力。
          </p>
          <div className="auth-story-art" aria-hidden="true">
            ✳
          </div>
        </div>
        <p className="auth-story-footer">
          <Sparkles size={15} />
          Education, made personal.
        </p>
      </section>
      <section className="auth-form-section">
        <div className="auth-form-card">{children}</div>
        <p className="auth-footer">小课 · 把知识变成一次参与</p>
      </section>
    </main>
  );
}
