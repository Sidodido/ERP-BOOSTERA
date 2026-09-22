import React from "react";
import Link from "next/link";
import { verifyEmailChangeTokenAction } from "@/actions/register";
import { CheckCircle2, AlertTriangle, ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default async function VerifyEmailChangePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const resolvedParams = await searchParams;
  const token = resolvedParams?.token || "";

  if (!token) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center p-4 select-none">
        <div className="max-w-md w-full bg-neutral-900/80 border border-neutral-800 rounded-3xl p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-bold text-neutral-100">Jeton manquant</h1>
          <p className="text-xs text-neutral-400">
            Aucun jeton de validation de changement d'e-mail n'a été fourni.
          </p>
          <Link href="/login">
            <Button variant="secondary" className="w-full text-xs font-semibold mt-2">
              Aller à la connexion
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const result = await verifyEmailChangeTokenAction(token);

  if (result.error) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center p-4 select-none">
        <div className="max-w-md w-full bg-neutral-900/80 border border-neutral-800 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-bold text-neutral-100">Lien invalide ou expiré</h1>
          <p className="text-xs text-neutral-400 leading-relaxed">
            {result.error}
          </p>
          <Link href="/login" className="block">
            <Button variant="secondary" className="w-full text-xs font-semibold">
              Retour à la connexion
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center p-4 select-none relative overflow-hidden">
      <div className="max-w-md w-full bg-neutral-900/90 border border-neutral-800 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl relative z-10">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/15">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
            E-MAIL MODIFIÉ & VÉRIFIÉ
          </span>
          <h1 className="text-xl font-extrabold text-neutral-100 mt-2">
            Votre nouvelle adresse est active !
          </h1>
          <p className="text-xs text-neutral-400 leading-relaxed">
            La modification d'adresse e-mail a été confirmée avec succès. Vous pouvez désormais vous connecter avec votre nouvelle adresse :
          </p>
        </div>

        <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-2xl p-4 text-center space-y-2 text-xs">
          <div className="text-neutral-400 font-medium text-[11px]">Nouvel identifiant de connexion :</div>
          <div className="font-mono text-sm text-emerald-400 font-bold break-all">
            {result.newEmail}
          </div>
        </div>

        <div>
          <Link href="/login">
            <Button className="w-full text-xs font-semibold h-10 cursor-pointer">
              <span>Se connecter avec le nouvel e-mail</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
