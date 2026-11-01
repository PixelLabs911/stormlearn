"use client";

import { Sidebar } from "@/components/Sidebar";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 pb-16 pt-5 sm:px-6 lg:px-9 lg:pt-8">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[1.6rem] font-extrabold leading-tight tracking-tight text-white sm:text-[1.9rem]">
          {title}
        </h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">{subtitle}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </header>
  );
}
