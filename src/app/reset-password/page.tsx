"use client";

import React, { useState, useTransition, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPasswordAction } from "@/actions/register";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Lock, ArrowRight, CheckCircle2, AlertTriangle, KeyRound } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") || "";

  const [tokenInput, setTokenInput] = useState(tokenFromUrl);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const effectiveToken = tokenFromUrl || tokenInput.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!effectiveToken) {
      setError("Veuillez renseigner le jeton ou code de réinitialisation reçu.");
      return;
    }

    if (password.length < 6) {
      setError("Le mot de passe doit comporter au moins 6 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await resetPasswordAction(effectiveToken, password);
        if (res?.error) {
          setError(res.error);
        } else {
          setSuccess(true);
        }
      } catch (err: any) {
        setError(err?.message || "Erreur lors de la réinitialisation.");
      }
    });
  };

  return (
    <div className="w-full max-w-md space-y-6 relative z-10">
      <div className="bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto shadow-md shadow-blue-500/10">
          <Lock className="w-7 h-7" />
        </div>

        <div className="text-center space-y-1.5">
          <h1 className="text-xl font-bold text-neutral-100">
            Nouveau mot de passe
          </h1>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Définissez un nouveau mot de passe sécurisé pour votre compte collaborateur BOOSTERA ERP.
          </p>
        </div>

        {success ? (
          <div className="space-y-4 pt-2 text-center">
            <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 text-xs space-y-1">
              <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-400" />
              <p className="font-bold">Mot de passe modifié avec succès !</p>
              <p className="text-neutral-300 text-[11px]">
                Vous pouvez dès à présent vous connecter avec vos nouveaux identifiants.
              </p>
            </div>

            <Link href="/login" className="block">
              <Button className="w-full text-xs font-semibold cursor-pointer">
                <span>Se connecter</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {!tokenFromUrl && (
              <Input
                label="Jeton de réinitialisation"
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Collez ici le jeton reçu par e-mail ou par l'administrateur"
                required
              />
            )}

            <Input
              label="Nouveau mot de passe"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Au moins 6 caractères"
              required
            />

            <Input
              label="Confirmer le nouveau mot de passe"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Répétez le mot de passe"
              required
            />

            <Button
              type="submit"
              className="w-full h-11 text-xs font-semibold mt-2 cursor-pointer shadow-md shadow-blue-600/20"
              isLoading={isPending}
            >
              <span>Mettre à jour mon mot de passe</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>

            <div className="pt-3 border-t border-neutral-800 text-center">
              <Link
                href="/login"
                className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                Retour à la page de connexion
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center p-4 select-none relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <Suspense
        fallback={
          <div className="w-full max-w-md p-8 bg-neutral-900/80 border border-neutral-800 rounded-3xl text-center text-neutral-400 text-sm">
            Chargement...
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
