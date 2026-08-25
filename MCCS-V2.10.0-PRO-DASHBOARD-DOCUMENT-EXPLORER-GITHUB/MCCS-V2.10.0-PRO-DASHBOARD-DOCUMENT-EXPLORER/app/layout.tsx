import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MCCS | Miran Commercial Control System",
  description: "Miran Commercial Control System for contracts, commitments, invoices, milestones and payments",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
