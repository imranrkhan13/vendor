import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Vendor Risk Assessment Agent",
  description: "Hackathon demo for agentic vendor risk assessment"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
