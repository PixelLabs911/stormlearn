"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { PROVIDER_LABELS } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";

export function EngineBadge({ compact = false }: { compact?: boolean }) {
  const { settings, llmActive } = useStore();
  const label = llmActive ? PROVIDER_LABELS[settings.provider] : "Demo engine";

  return (
    <Link
      href="/settings"
      title={
        llmActive
          ? `Generating with ${label} (${settings.model || "default model"})`
          : "Built-in demo engine — runs offline with no API key. Add a provider in Settings for full LLM generation."
      }
      className={`group flex items-center gap-2 rounded-xl border px-2.5 py-2 transition ${
        llmActive
          ? "border-emerald-400/25 bg-emerald-500/8 hover:bg-emerald-500/14"
          : "border-white/8 bg-white/3 hover:bg-white/7"
      }`}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${
            llmActive ? "bg-emerald-400" : "bg-accent-400"
          }`}
        />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${llmActive ? "bg-emerald-400" : "bg-accent-400"}`} />
      </span>
      {!compact && (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-semibold text-slate-200">{label}</span>
          <span className="block truncate text-[10.5px] text-slate-500">
            {llmActive ? settings.model || "default model" : "no key · local generator"}
          </span>
        </span>
      )}
      {compact && (
        <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-slate-400 group-hover:text-slate-200">
          {label}
        </span>
      )}
      <Icon name="settings" size={13} className="shrink-0 text-slate-600 group-hover:text-slate-400" />
    </Link>
  );
}
