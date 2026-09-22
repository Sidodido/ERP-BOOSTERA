"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/actions/register";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { KeyRound, ArrowLeft, Mail, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const res = await requestPasswordResetAction(email);
        if (res?.error) {
          setError(res.error);
        } else {
          setSubmitted(true);
        }
      } catch (err: any) {
        setError(err?.message || "Erreur lors de la demande.");
      }
    });
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center p-4 select-none relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        <div className="bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto shadow-md shadow-blue-500/10">
            <KeyRound className="w-7 h-7" />
          </div>

          <div className="text-center space-y-1.5">
            <h1 className="text-xl font-bold text-neutral-100">
              Mot de passe oublié ?
            </h1>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Saisissez l'adresse e-mail professionnelle associée à votre compte collaborateur BOOSTERA.
            </p>
          </div>

          {submitted ? (
            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 text-xs space-y-2 text-center">
                <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-400" />
                <p className="font-bold">E-mail envoyé avec succès !</p>
                <p className="text-neutral-300 text-[11px] leading-relaxed">
                  Si un compte actif correspond à <strong>{email}</strong>, un lien sécurisé valide 1 heure vient de vous être envoyé.
                </p>
              </div>

              <Link href="/login" className="block">
                <Button variant="secondary" className="w-full text-xs font-semibold cursor-pointer">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                  <span>Retour à la connexion</span>
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl font-medium">
                  {error}
                </div>
              )}

              <Input
                label="Adresse e-mail professionnelle"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre-nom@boostera.dz"
                required
              />

              <Button
                type="submit"
                className="w-full h-11 text-xs font-semibold mt-2 cursor-pointer shadow-md shadow-blue-600/20"
                isLoading={isPending}
              >
                <Mail className="w-3.5 h-3.5 mr-1.5" />
                <span>Envoyer le lien de réinitialisation</span>
              </Button>

              <div className="pt-3 border-t border-neutral-800 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Retour à la connexion</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
