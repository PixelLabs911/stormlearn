"use client";

import { use } from "react";
import Link from "next/link";
import { Shell } from "@/components/ui/Shell";
import { Icon } from "@/components/ui/Icon";
import { useStore } from "@/lib/store";
import { SetWorkspace } from "@/components/set/SetWorkspace";

export default function SetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { sets, ready } = useStore();
  const set = sets.find((s) => s.id === id);

  if (!ready) {
    return (
      <Shell>
        <div className="panel h-72 animate-pulse bg-white/3" />
      </Shell>
    );
  }

  if (!set) {
    return (
      <Shell>
        <div className="panel grid place-items-center px-6 py-20 text-center">
          <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white/5 text-slate-500">
            <Icon name="search" size={24} />
          </span>
          <h1 className="text-xl font-extrabold text-white">That study set doesn't exist</h1>
          <p className="mt-2 max-w-md text-sm text-slate-400">
            It may have been deleted, or this browser's local library doesn't have it. Study sets are stored on this
            device only.
          </p>
          <Link href="/" className="btn btn-primary mt-6">
            <Icon name="arrowLeft" size={16} /> Back to library
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <SetWorkspace set={set} />
    </Shell>
  );
}
