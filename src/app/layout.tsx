import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { Toaster } from "@/components/ui/Toaster";

export const metadata: Metadata = {
  title: "StormLearn — the fastest way to learn anything",
  description:
    "Turn lectures, PDFs, YouTube videos and recordings into structured notes, flashcards, quizzes, study podcasts and an AI tutor.",
  applicationName: "StormLearn",
};

export const viewport: Viewport = {
  themeColor: "#05070f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-[0.55]" />
          <div className="absolute -top-40 -left-32 h-[34rem] w-[34rem] rounded-full bg-brand-600/22 blur-[130px]" />
          <div className="absolute top-1/3 -right-40 h-[30rem] w-[30rem] rounded-full bg-punch-500/16 blur-[130px]" />
          <div className="absolute bottom-0 left-1/3 h-[26rem] w-[26rem] rounded-full bg-accent-500/10 blur-[140px]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_35%,rgba(5,7,15,0.85)_100%)]" />
        </div>
        <StoreProvider>
          {children}
          <Toaster />
        </StoreProvider>
      </body>
    </html>
  );
}
