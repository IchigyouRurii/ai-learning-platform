import type { Metadata } from "next";
import "@/shared/ui/styles.css";

export const metadata: Metadata = {
  title: {
    default: "OpenLearnING · AI Learning",
    template: "%s · OpenLearnING",
  },
  description:
    "An AI-powered micro-course workspace for teachers and learners.",
};
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
