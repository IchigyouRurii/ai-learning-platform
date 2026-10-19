import { Sparkles } from "lucide-react";
import { BrandLogo } from "@/shared/ui/brand-logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="brand">
          <BrandLogo />
          <div>
            <strong>
              OpenLearnING<span className="brand-dot">.</span>
            </strong>
            <small>MINICOURSE</small>
          </div>
        </div>
        <div className="auth-story-copy">
          <span className="eyebrow">A LITTLE CURIOSITY GOES A LONG WAY</span>
          <h2>
            Every good question
            <br />
            starts a learning journey.
          </h2>
          <p>
            Explore through practice. Grow through feedback.
            <br />
            Turn knowledge into skills of your own.
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
        <p className="auth-footer">
          OpenLearnING · Learn through participation
        </p>
      </section>
    </main>
  );
}
