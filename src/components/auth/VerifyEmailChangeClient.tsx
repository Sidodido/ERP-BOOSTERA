"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { setPasswordAfterEmailVerificationAction } from "@/actions/register";

interface Props {
  userId?: string;
  newEmail: string;
}

export function VerifyEmailChangeClient({ userId, newEmail }: Props) {
  const [showPasswordSection, setShowPasswordSection] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setError("Identifiant utilisateur introuvable pour la mise à jour du mot de passe.");
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

    try {
      setLoading(true);
      setError(null);
      const res = await setPasswordAfterEmailVerificationAction({
        userId,
        newPassword: password,
      });

      if (res.error) {
        setError(res.error);
      } else {
        setSuccessMessage("Votre nouveau mot de passe a été enregistré avec succès !");
        setPassword("");
        setConfirmPassword("");
      }
    } catch {
      setError("Une erreur est survenue lors de l'enregistrement du mot de passe.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center p-4 select-none relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-md w-full bg-neutral-900/90 border border-neutral-800 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl relative z-10 backdrop-blur-md">
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

        <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-2xl p-4 text-center space-y-1.5 text-xs">
          <div className="text-neutral-400 font-medium text-[11px]">Nouvel identifiant de connexion :</div>
          <div className="font-mono text-sm text-emerald-400 font-bold break-all">
            {newEmail}
          </div>
        </div>

        {/* SECTION NOUVEAU MOT DE PASSE */}
        <div className="border border-neutral-800 bg-neutral-950/50 rounded-2xl p-4 text-left space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-200">
              <KeyRound className="w-4 h-4 text-indigo-400" />
              <span>Nouveau mot de passe</span>
            </div>
            <button
              type="button"
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 transition"
            >
              {showPasswordSection ? "Masquer" : "Modifier"}
            </button>
          </div>

          {showPasswordSection && (
            <>
              {successMessage ? (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{successMessage}</p>
                    <p className="text-[11px] text-emerald-400/80 mt-0.5">
                      Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSavePassword} className="space-y-3 pt-1">
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Souhaitez-vous définir un nouveau mot de passe pour ce compte ?
                  </p>

                  <div className="space-y-2">
                    <div className="relative">
                      <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Nouveau mot de passe (min. 6 caract.)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-9 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="relative">
                      <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Confirmer le nouveau mot de passe"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {error && (
                    <p className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={loading || !password || !confirmPassword}
                    className="w-full text-xs font-semibold h-9 bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                  >
                    {loading ? "Enregistrement..." : "Enregistrer le mot de passe"}
                  </Button>
                </form>
              )}
            </>
          )}
        </div>

        {/* BOUTON CONNEXION */}
        <div>
          <Link href={`/login?email=${encodeURIComponent(newEmail)}`}>
            <Button className="w-full text-xs font-semibold h-10 cursor-pointer bg-blue-600 hover:bg-blue-500 text-white">
              <span>Se connecter avec le nouvel e-mail</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
