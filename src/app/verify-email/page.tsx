import React from "react";
import Link from "next/link";
import { verifyEmailTokenAction } from "@/actions/register";
import { CheckCircle2, AlertTriangle, Clock, ArrowRight, ShieldCheck, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default async function VerifyEmailPage({
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
            Aucun jeton de vérification n'a été fourni dans le lien.
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

  const result = await verifyEmailTokenAction(token);

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
          {result.email && (
            <Link href={`/register/pending?email=${encodeURIComponent(result.email)}`}>
              <Button className="w-full text-xs font-semibold mt-2">
                Demander un nouvel e-mail
              </Button>
            </Link>
          )}
          <Link href="/login" className="block">
            <Button variant="secondary" className="w-full text-xs font-semibold">
              Retour à la connexion
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const user = result.user;
  const formattedDate = user?.submittedAt
    ? new Date(user.submittedAt).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Récemment";

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center p-4 select-none relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-neutral-900/90 border border-neutral-800 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl relative z-10">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/15">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
            E-MAIL VÉRIFIÉ
          </span>
          <h1 className="text-xl font-extrabold text-neutral-100 mt-2">
            Votre adresse e-mail a été vérifiée !
          </h1>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Votre demande d'accès est maintenant officiellement transmise et enregistrée en attente de validation par un administrateur.
          </p>
        </div>

        {/* Détails Récapitulatifs */}
        <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-2xl p-4 text-left space-y-3 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
            <span className="text-neutral-400 font-medium">Collaborateur</span>
            <span className="font-bold text-neutral-200">{user?.name}</span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
            <span className="text-neutral-400 font-medium">Adresse E-mail</span>
            <span className="font-mono text-blue-400 font-semibold">{user?.email}</span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
            <span className="text-neutral-400 font-medium">Statut de la demande</span>
            <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold text-[10px] flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>En attente de validation</span>
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-neutral-400 font-medium">Date de demande</span>
            <span className="text-neutral-300">{formattedDate}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 text-left leading-relaxed">
          <strong>Information :</strong> Dès que l'administrateur aura validé votre compte, vous recevrez un e-mail confirmant l'activation de votre accès pour vous connecter.
        </div>

        <div>
          <Link href="/login">
            <Button className="w-full text-xs font-semibold h-10 cursor-pointer">
              <span>Aller à la page de connexion</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
