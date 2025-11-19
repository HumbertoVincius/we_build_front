import { ENV_KEYS } from "@/lib/env";

export function CredentialsWarning() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 rounded-lg border border-amber-500/40 bg-amber-500/5 px-8 py-12 text-center text-amber-200">
      <div className="text-2xl">⚠️</div>
      <div>
        <p className="text-lg font-semibold text-amber-100">
          Supabase não configurado
        </p>
        <p className="mt-2 text-sm text-amber-200/80">
          Preencha <code className="rounded bg-amber-500/10 px-1">{ENV_KEYS.SUPABASE_URL}</code> e{" "}
          <code className="rounded bg-amber-500/10 px-1">
            {ENV_KEYS.SUPABASE_ANON_KEY}
          </code>{" "}
          no arquivo <code>.env</code>, então recarregue a página.
        </p>
      </div>
    </div>
  );
}

