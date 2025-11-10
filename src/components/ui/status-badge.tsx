import clsx from "clsx";

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  running: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  failed: "bg-rose-500/15 text-rose-300 border-rose-500/40"
};

export function StatusBadge({ status }: { status: string }) {
  const normalized = status?.toLowerCase() ?? "unknown";
  const color = STATUS_COLORS[normalized] ?? "bg-slate-600/30 text-slate-200 border-slate-600";

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        color
      )}
    >
      {normalized}
    </span>
  );
}

