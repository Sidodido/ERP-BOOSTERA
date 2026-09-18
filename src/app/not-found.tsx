import React from "react";
import Link from "next/link";
import { Compass, LayoutDashboard, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-neutral-900/90 border border-neutral-800 rounded-2xl p-8 shadow-2xl space-y-6 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
          <Compass className="w-8 h-8 animate-pulse" />
        </div>

        <div className="space-y-2">
          <span className="text-xs uppercase font-mono tracking-widest text-blue-400 font-semibold">
            Erreur 404
          </span>
          <h1 className="text-2xl font-bold text-neutral-100">
            Page Introuvable
          </h1>
          <p className="text-xs text-neutral-400 leading-relaxed">
            La ressource demandée n'existe pas ou a été déplacée vers un autre module du CRM.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Link href="/dashboard">
            <Button
              className="gap-2 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20"
              size="sm"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Tableau de bord</span>
            </Button>
          </Link>

          <Link href="/prospection">
            <Button
              variant="secondary"
              className="gap-2 border-neutral-800 hover:bg-neutral-800 text-neutral-300"
              size="sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Prospection</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
