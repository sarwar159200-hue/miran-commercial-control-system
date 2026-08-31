import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MCCS | Miran Commercial Control System",
  description: "Miran Commercial Control System for contracts, commitments, invoices, milestones and payments",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pzxslfhezmubslqqirao.supabase.co";
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href={supabaseUrl} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={supabaseUrl} />
      </head>
      <body>{children}</body>
    </html>
  );
}
