import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { LucideIcon, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface PlaceholderModuleProps {
  title: string;
  description: string;
  phase: number;
  icon: LucideIcon;
  features: string[];
}

export function PlaceholderModule({
  title,
  description,
  phase,
  icon: Icon,
  features,
}: PlaceholderModuleProps) {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto py-12 text-center space-y-6">
        <div className="inline-flex p-4 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-2">
          <Icon className="w-8 h-8" />
        </div>

        <div>
          <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold">
            Module Prévu en Phase {phase}
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-100 mt-3">{title}</h1>
          <p className="text-sm text-neutral-400 max-w-lg mx-auto mt-2">{description}</p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6 text-left space-y-3">
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            Fonctionnalités au programme de cette phase :
          </h3>
          <ul className="space-y-2">
            {features.map((feat, idx) => (
              <li key={idx} className="flex items-center gap-2.5 text-xs text-neutral-200">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="pt-4 flex justify-center gap-3">
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              Retour au Dashboard
            </Button>
          </Link>
          <Link href="/prospection">
            <Button size="sm">
              <span>Aller à la Prospection</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
