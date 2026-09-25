"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { registerCollaboratorAction } from "@/actions/register";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  UserPlus,
  ArrowRight,
  ShieldCheck,
  Building,
  Briefcase,
  Phone,
  Mail,
  Lock,
  ArrowLeft,
} from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("COMMERCIAL");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const departments = [
    { value: "COMMERCIAL", label: "Commercial & Ventes" },
    { value: "DEVELOPMENT", label: "Développement Web & IT" },
    { value: "DESIGN", label: "Design UI/UX & Graphisme" },
    { value: "VIDEO", label: "Production & Montage Vidéo" },
    { value: "MARKETING", label: "Marketing & Publicité Ads" },
    { value: "FINANCE", label: "Comptabilité & Finance" },
    { value: "HR", label: "Ressources Humaines" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.append("firstName", firstName);
    formData.append("lastName", lastName);
    formData.append("email", email);
    formData.append("phone", phone);
    formData.append("position", position);
    formData.append("department", department);
    formData.append("password", password);
    formData.append("confirmPassword", confirmPassword);

    startTransition(async () => {
      try {
        const res = await registerCollaboratorAction(formData);
        if (res?.error) {
          setError(res.error);
        } else if (res?.success) {
          router.push(`/register/pending?email=${encodeURIComponent(res.email)}`);
        }
      } catch (err: any) {
        setError(err?.message || "Erreur lors de la création de votre demande.");
      }
    });
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Background accents */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-2.5 rounded-3xl bg-white shadow-2xl shadow-blue-500/25 mb-1 border border-neutral-800">
            <Image
              src="/logo.png"
              alt="BOOSTERA Logo"
              width={70}
              height={70}
              className="w-16 h-16 object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center justify-center gap-2">
            Demande d'Accès Collaborateur
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              ERP
            </span>
          </h1>
          <p className="text-xs text-neutral-400 max-w-md mx-auto">
            Créez votre demande pour rejoindre la plateforme BOOSTERA. Un e-mail de confirmation vous sera transmis avant validation par la direction.
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          {error && (
            <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl font-medium animate-in fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Prénom & Nom */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Prénom"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ex: Yacine"
                required
              />
              <Input
                label="Nom"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Ex: Benali"
                required
              />
            </div>

            {/* Email & Téléphone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="E-mail professionnel"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yacine@boostera.dz"
                required
              />
              <Input
                label="Numéro de téléphone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0550 12 34 56"
              />
            </div>

            {/* Poste & Département */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Poste / Fonction souhaitée"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="Ex: Commercial B2B, Designer UI..."
                required
              />

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">
                  Département d'affectation
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs focus:outline-none focus:border-blue-500 transition-colors"
                >
                  {departments.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Mots de passe */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <Input
                label="Mot de passe"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Au moins 6 caractères"
                required
              />
              <Input
                label="Confirmer le mot de passe"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Répétez le mot de passe"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-sm font-semibold mt-4 shadow-md shadow-blue-600/20 cursor-pointer"
              isLoading={isPending}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              <span>Transmettre ma demande d'accès</span>
            </Button>
          </form>

          {/* Footer link */}
          <div className="pt-4 border-t border-neutral-800/80 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Vous avez déjà un compte ? Se connecter</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
