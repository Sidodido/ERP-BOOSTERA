"use client";

import React, { useState } from "react";
import { loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ShieldCheck, ArrowRight, UserCheck, Briefcase, CreditCard, Wrench } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Boostera2026!");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleQuickFill = (presetEmail: string) => {
    setEmail(presetEmail);
    setPassword("Boostera2026!");
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("email", email);
    formData.append("password", password);

    try {
      const res = await loginAction(formData);
      if (res?.error) {
        setErrorMessage(res.error);
        setLoading(false);
      }
    } catch {
      // Redirect throws an error in Next.js which is expected behavior
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background glow accents */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-xl shadow-blue-500/25 mb-2">
            <span className="text-white font-black text-xl">B</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center justify-center gap-2">
            BOOSTERA
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              ERP v1.0
            </span>
          </h1>
          <p className="text-xs text-neutral-400">
            Plateforme unifiée de gestion d'agence : CRM, Production & Finance
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-neutral-900/80 backdrop-blur-md border border-neutral-800/80 rounded-3xl p-6 md:p-8 shadow-2xl space-y-5">
          {errorMessage && (
            <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl font-medium">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Adresse Email professionnelle"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ex: admin@boostera.dz"
              required
            />

            <Input
              label="Mot de passe"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            <Button
              type="submit"
              className="w-full h-11 text-sm font-semibold mt-2"
              isLoading={loading}
            >
              <span>Accéder à la plateforme</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          {/* Quick Demo Logins */}
          <div className="pt-4 border-t border-neutral-800 space-y-3">
            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider text-center">
              Comptes de démonstration (Accès rapide)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill("admin@boostera.dz")}
                className="p-2 text-left bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/60 rounded-xl transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200 group-hover:text-blue-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate">Direction</span>
                </div>
                <p className="text-[10px] text-neutral-500 truncate mt-0.5">Accès Total</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill("wiam@boostera.dz")}
                className="p-2 text-left bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/60 rounded-xl transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200 group-hover:text-emerald-400">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Wiam</span>
                </div>
                <p className="text-[10px] text-neutral-500 truncate mt-0.5">Commerciale</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill("meroua@boostera.dz")}
                className="p-2 text-left bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/60 rounded-xl transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200 group-hover:text-pink-400">
                  <UserCheck className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                  <span className="truncate">Meroua</span>
                </div>
                <p className="text-[10px] text-neutral-500 truncate mt-0.5">Commerciale</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill("toufik@boostera.dz")}
                className="p-2 text-left bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/60 rounded-xl transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200 group-hover:text-cyan-400">
                  <UserCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">Toufik</span>
                </div>
                <p className="text-[10px] text-neutral-500 truncate mt-0.5">Commercial</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill("mehdi.tech@boostera.dz")}
                className="p-2 text-left bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/60 rounded-xl transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200 group-hover:text-purple-400">
                  <Briefcase className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="truncate">Chef Projet</span>
                </div>
                <p className="text-[10px] text-neutral-500 truncate mt-0.5">Production</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill("leila.finance@boostera.dz")}
                className="p-2 text-left bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/60 rounded-xl transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200 group-hover:text-amber-400">
                  <CreditCard className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">Finance</span>
                </div>
                <p className="text-[10px] text-neutral-500 truncate mt-0.5">Comptabilité</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill("sidahmed@boostera.dz")}
                className="p-2 text-left bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/60 rounded-xl transition-all cursor-pointer group col-span-2 sm:col-span-1"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200 group-hover:text-indigo-400">
                  <Wrench className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">Sidahmed</span>
                </div>
                <p className="text-[10px] text-neutral-500 truncate mt-0.5">Technicien</p>
              </button>
            </div>
            <p className="text-[10px] text-center text-neutral-500">
              Mot de passe par défaut : <code className="text-neutral-300">Boostera2026!</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
