"use client";

import React, { useState, useEffect, useTransition, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { loginAction } from "@/actions/auth";
import { resendVerificationEmailAction } from "@/actions/register";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  ShieldCheck,
  ArrowRight,
  UserPlus,
  KeyRound,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const verifiedParam = searchParams?.get("verified");
  const resetParam = searchParams?.get("reset");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendPending, startResendTransition] = useTransition();
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("boostera_remember_email");
      const savedRemember = localStorage.getItem("boostera_remember_me");
      if (savedEmail) {
        setEmail(savedEmail);
      }
      if (savedRemember !== null) {
        setRememberMe(savedRemember === "true");
      }
    } catch {}
  }, []);

  const handleResendVerification = () => {
    if (!unverifiedEmail) return;
    startResendTransition(async () => {
      try {
        const res = await resendVerificationEmailAction(unverifiedEmail);
        if (!res?.error) {
          setResendSuccess(true);
          setTimeout(() => setResendSuccess(false), 5000);
        }
      } catch {}
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setUnverifiedEmail(null);

    try {
      if (rememberMe) {
        localStorage.setItem("boostera_remember_email", email.trim());
        localStorage.setItem("boostera_remember_me", "true");
      } else {
        localStorage.removeItem("boostera_remember_email");
        localStorage.setItem("boostera_remember_me", "false");
      }
    } catch {}

    const formData = new FormData();
    formData.append("email", email);
    formData.append("password", password);
    formData.append("rememberMe", String(rememberMe));

    try {
      const apiRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await apiRes.json();

      if (apiRes.ok && data.success) {
        window.location.href = data.redirectUrl || "/dashboard";
        return;
      }

      if (data.error) {
        setErrorMessage(data.error);
        if (data.status === "EMAIL_UNVERIFIED") {
          setUnverifiedEmail(data.email || email);
        }
        setLoading(false);
        return;
      }
    } catch {}

    // Fallback to Server Action
    try {
      const res = await loginAction(formData);
      if (res && "error" in res && res.error) {
        setErrorMessage(res.error);
        if (res.status === "EMAIL_UNVERIFIED") {
          setUnverifiedEmail(res.email || email);
        }
        setLoading(false);
      }
    } catch (err: any) {
      if (err?.message?.includes("NEXT_REDIRECT") || err?.digest?.includes("NEXT_REDIRECT")) {
        return;
      }
      setErrorMessage(err?.message || "Erreur lors de la connexion.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6 relative z-10">
      {/* Brand Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center p-2.5 rounded-3xl bg-white shadow-2xl shadow-blue-500/30 mb-1 border border-white/20 ring-4 ring-blue-500/10">
          <Image
            src="/logo.png"
            alt="BOOSTERA Logo"
            width={76}
            height={76}
            className="w-18 h-18 object-contain"
            priority
          />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
          BOOSTERA
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/35 font-bold shadow-xs shadow-blue-500/20">
            ERP v1.0
          </span>
        </h1>
        <p className="text-xs text-neutral-400">
          Plateforme unifiée de gestion : CRM, Opérations & Finance
        </p>
      </div>

      {/* Login Card */}
      <div className="bg-[#0c1222]/80 backdrop-blur-2xl border border-white/[0.1] rounded-3xl p-6 md:p-8 shadow-2xl [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.08),0_20px_50px_-10px_rgba(0,0,0,0.7)] space-y-5 relative overflow-hidden">
        {/* Top ambient highlight */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-24 bg-gradient-to-b from-blue-500/20 to-transparent blur-xl pointer-events-none" />
        {verifiedParam && (
          <div className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Votre e-mail a été vérifié. Vous pourrez vous connecter dès validation administrative.</span>
          </div>
        )}

        {resetParam === "success" && (
          <div className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Votre mot de passe a été réinitialisé. Connectez-vous avec vos nouveaux identifiants.</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl font-medium space-y-2 animate-in fade-in">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>

            {unverifiedEmail && (
              <div className="pt-2 border-t border-rose-500/20">
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendPending}
                  className="text-xs text-rose-300 underline hover:text-white font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${resendPending ? "animate-spin" : ""}`} />
                  <span>Renvoyer l'e-mail de confirmation</span>
                </button>
              </div>
            )}
          </div>
        )}

        {resendSuccess && (
          <div className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl font-medium flex items-center gap-1.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>E-mail de confirmation renvoyé ! Vérifiez votre boîte de réception.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Adresse Email professionnelle"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-neutral-300">
                Mot de passe
              </label>
              <Link
                href="/forgot-password"
                className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline font-medium"
              >
                Mot de passe oublié ?
              </Link>
            </div>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {/* Option Rester connecté */}
          <div className="flex items-center justify-between pt-0.5">
            <label className="inline-flex items-center gap-2 cursor-pointer group select-none">
              <input
                type="checkbox"
                name="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-neutral-700 bg-neutral-800 text-blue-600 focus:ring-blue-500/40 focus:ring-offset-0 cursor-pointer accent-blue-600 transition-colors"
              />
              <span className="text-xs text-neutral-300 group-hover:text-white font-medium transition-colors">
                Rester connecté
              </span>
            </label>
          </div>

          <Button
            type="submit"
            className="w-full h-11 text-sm font-semibold mt-2 cursor-pointer shadow-md shadow-blue-600/20"
            isLoading={loading}
          >
            <span>Accéder à la plateforme</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </form>

        {/* Demande d'inscription */}
        <div className="pt-2">
          <Link href="/register" className="block">
            <button
              type="button"
              className="w-full py-2.5 px-3 rounded-xl border border-neutral-700/80 bg-neutral-800/40 hover:bg-neutral-800 text-xs font-semibold text-neutral-200 hover:text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-blue-400" />
              <span>Nouveau collaborateur ? Créer une demande de compte</span>
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#070b13] flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Background glow accents */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-blue-600/[0.18] via-indigo-600/[0.08] to-transparent rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-[40%] -right-40 w-96 h-96 bg-purple-600/[0.08] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-600/[0.08] rounded-full blur-[120px] pointer-events-none" />

      <Suspense fallback={<div className="text-neutral-400 text-xs">Chargement...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
