"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected errors for client monitoring
    console.error("Application Runtime Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-neutral-900/90 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-6 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-neutral-100">
            Une erreur inattendue est survenue
          </h1>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Le système a intercepté une anomalie technique. Aucune donnée n'a été corrompue.
          </p>
          {error?.message && (
            <div className="mt-3 p-2.5 rounded-lg bg-neutral-950/80 border border-neutral-800/80 text-neutral-400 font-mono text-[11px] text-left break-all max-h-24 overflow-y-auto">
              {error.message}
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            onClick={() => reset()}
            className="gap-2 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20"
            size="sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Réessayer</span>
          </Button>

          <Button
            variant="secondary"
            onClick={() => (window.location.href = "/dashboard")}
            className="gap-2 border-neutral-800 hover:bg-neutral-800 text-neutral-300"
            size="sm"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Tableau de bord</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
