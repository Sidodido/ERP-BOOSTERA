"use client";

import React, { useState, useTransition, use } from "react";
import Link from "next/link";
import { resendVerificationEmailAction } from "@/actions/register";
import { Button } from "@/components/ui/Button";
import { Mail, ArrowLeft, RefreshCw, CheckCircle2 } from "lucide-react";

export default function RegisterPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const resolvedParams = use(searchParams);
  const email = resolvedParams?.email || "";
  const [isPending, startTransition] = useTransition();
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResend = () => {
    if (!email) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await resendVerificationEmailAction(email);
        if (res?.error) {
          setError(res.error);
        } else {
          setResendSuccess(true);
          setTimeout(() => setResendSuccess(false), 5000);
        }
      } catch (err: any) {
        setError(err?.message || "Erreur lors du renvoi.");
      }
    });
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        <div className="bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto shadow-md shadow-blue-500/10">
            <Mail className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-neutral-100">
              Votre demande a été envoyée !
            </h1>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Un e-mail de confirmation vient d'être envoyé à l'adresse suivante :
            </p>
            {email && (
              <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs font-mono text-blue-400 font-bold truncate">
                {email}
              </div>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800 text-left text-xs space-y-2">
            <div className="flex items-start gap-2 text-neutral-300">
              <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <span>Ouvrez l'e-mail et cliquez sur <strong>"Vérifier mon adresse e-mail"</strong>.</span>
            </div>
            <div className="flex items-start gap-2 text-neutral-300">
              <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <span>Votre demande passera ensuite en <strong>attente de validation administrative</strong>.</span>
            </div>
            <div className="flex items-start gap-2 text-neutral-300">
              <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                3
              </span>
              <span>Vous recevrez une confirmation dès que votre accès sera activé par la direction.</span>
            </div>
          </div>

          {resendSuccess && (
            <div className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl font-medium flex items-center justify-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>E-mail renvoyé avec succès !</span>
            </div>
          )}

          {error && (
            <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl font-medium animate-in fade-in">
              {error}
            </div>
          )}

          <div className="space-y-2 pt-2">
            {email && (
              <Button
                variant="outline"
                onClick={handleResend}
                isLoading={isPending}
                className="w-full text-xs font-semibold cursor-pointer border-neutral-700 hover:bg-neutral-800"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                <span>Renvoyer l'e-mail de confirmation</span>
              </Button>
            )}

            <Link href="/login" className="block">
              <Button
                variant="secondary"
                className="w-full text-xs font-semibold cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                <span>Retour à la page de connexion</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
