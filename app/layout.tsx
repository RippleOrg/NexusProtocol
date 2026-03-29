import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import AppProviders from "@/app/providers";
import RootShell from "@/components/app/root-shell";

const plexSans = localFont({
  src: "./fonts/SFNS.ttf",
  variable: "--font-sans",
  display: "swap",
});

const plexMono = localFont({
  src: "./fonts/SFNSMono.ttf",
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NEXUS Protocol",
  description:
    "Programmable trade settlement and institutional FX with compliance enforced at the protocol layer.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#091423" },
    { media: "(prefers-color-scheme: light)", color: "#f3f5f8" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${plexSans.variable} ${plexMono.variable} nexus-app-body min-h-screen antialiased`}
      >
        <AppProviders>
          <RootShell>{children}</RootShell>
        </AppProviders>
      </body>
    </html>
  );
}
