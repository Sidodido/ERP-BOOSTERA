import React from "react";
import Link from "next/link";
import { verifyEmailChangeTokenAction } from "@/actions/register";
import { CheckCircle2, AlertTriangle, ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { VerifyEmailChangeClient } from "@/components/auth/VerifyEmailChangeClient";

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
    <VerifyEmailChangeClient
      userId={result.userId}
      newEmail={result.newEmail || ""}
    />
  );
}
