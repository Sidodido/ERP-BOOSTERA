"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Sparkles,
  Mail,
  Copy,
  Check,
  Send,
  Building2,
  Phone,
  Target,
  ExternalLink,
  RefreshCw,
  Edit3,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { OfferType } from "@prisma/client";
import { logActivityAction } from "@/actions/activities";
import { updateProspectField } from "@/actions/prospects";

interface ProspectAiEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  prospect: {
    id: string;
    companyName: string;
    contactName?: string | null;
    phone: string;
    email?: string | null;
    sector: string;
    wilaya?: string | null;
    notes?: string | null;
  } | null;
}

const PACK_RECOMMENDATIONS: Record<
  string,
  {
    recommendedPack: OfferType;
    reason: string;
  }
> = {
  sante: {
    recommendedPack: "SILVER",
    reason: "Idéal pour rassurer les patients, valoriser le cabinet/praticien avec des Reels éducatifs et booster la prise de rendez-vous.",
  },
  medical: {
    recommendedPack: "SILVER",
    reason: "Valorisation de l'expertise médicale, témoignages et visibilité auprès d'une patientèle locale qualifiée.",
  },
  dentaire: {
    recommendedPack: "SILVER",
    reason: "Mise en avant des soins, des technologies du cabinet et acquisition continue de nouveaux patients.",
  },
  restauration: {
    recommendedPack: "SILVER",
    reason: "Parfait pour capter les gourmands avec des vidéos Reels de plats appétissants et dynamiser la fréquentation.",
  },
  immobilier: {
    recommendedPack: "GOLD",
    reason: "Présentation vidéo immersive des biens immobiliers, couverture maximale et ciblage d'acquéreurs sérieux.",
  },
  commerce: {
    recommendedPack: "SILVER",
    reason: "Mise en avant dynamique des produits, promotions hebdomadaires et campagnes sponsorisées convertissantes.",
  },
  auto: {
    recommendedPack: "SILVER",
    reason: "Présentation soignée des véhicules, ateliers et services avec vidéo promotionnelle percutante.",
  },
  b2b: {
    recommendedPack: "STARTER",
    reason: "Assure une présence digitale professionnelle et continue avec site web inclus et visuels soignés.",
  },
};

export function ProspectAiEmailModal({
  isOpen,
  onClose,
  prospect,
}: ProspectAiEmailModalProps) {
  if (!prospect) return null;

  // Determine smart recommendation based on sector
  const defaultRecommendation = useMemo(() => {
    const s = (prospect.sector || "").toLowerCase();
    for (const key of Object.keys(PACK_RECOMMENDATIONS)) {
      if (s.includes(key)) {
        return PACK_RECOMMENDATIONS[key];
      }
    }
    return {
      recommendedPack: "SILVER" as OfferType,
      reason: "La formule la plus équilibrée pour développer votre notoriété et convertir vos abonnés en clients fidèles.",
    };
  }, [prospect.sector]);

  const [selectedPack, setSelectedPack] = useState<OfferType>(defaultRecommendation.recommendedPack);
  const [recipientEmail, setRecipientEmail] = useState(prospect.email || "");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [copied, setCopied] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [emailSavedFeedback, setEmailSavedFeedback] = useState(false);

  // Sync recipient email when prospect changes
  useEffect(() => {
    if (prospect) {
      setRecipientEmail(prospect.email || "");
      setSelectedPack(defaultRecommendation.recommendedPack);
    }
  }, [prospect, defaultRecommendation]);

  // Generate Email Text when selected pack or prospect changes
  useEffect(() => {
    if (!prospect) return;

    const targetName = prospect.contactName?.trim() || prospect.companyName?.trim() || "Madame, Monsieur";
    const subject = `BOOSTERA Agency — Présentation de nos offres & Recommandation personnalisée pour ${prospect.companyName}`;

    let packHighlightText = "";
    if (selectedPack === "STARTER") {
      packHighlightText = `👉 LE PACK STARTER (1 publication par semaine — 9 000 DA/mois) :
• 2 Carrousels stratégiques + 2 Maquettes graphiques sur-mesure chaque mois
• Conception d'un Site Web professionnel inclus pour asseoir votre crédibilité
• Idéal pour structurer votre image de marque à un tarif très accessible`;
    } else if (selectedPack === "SILVER") {
      packHighlightText = `👉 LE PACK SILVER (2 publications par semaine — 26 000 DA/mois) [RECOMMANDÉ] :
• 3 Carrousels + 3 Maquettes graphiques professionnelles
• 2 Vidéos Reels / TikTok immersives avec voix-off professionnelle enregistrée en studio
• 3 Séances de tournage / shooting professionnel par an sur place dans vos locaux
• Accélération forte de vos vues et de votre engagement client`;
    } else if (selectedPack === "GOLD") {
      packHighlightText = `👉 LE PACK GOLD (3 publications par semaine — 42 000 DA/mois) [MAXIMUM IMPACT] :
• 4 Carrousels + 4 Maquettes graphiques haute définition
• 4 Vidéos Reels / TikTok captivantes avec voix-off professionnelle
• 5 Séances de tournage / shooting professionnel par an dans votre établissement
• La solution d'élite pour dominer votre secteur et acquérir un flux régulier de clients`;
    } else {
      packHighlightText = `👉 LE PACK SUR-MESURE :
• Stratégie personnalisée selon vos objectifs spécifiques de vente et d'expansion
• Volume flexible de vidéos, carrousels, sponsorisation publicitaire et site web`;
    }

    const body = `Bonjour ${targetName},

Suite à notre échange téléphonique, je vous transmets comme convenu la présentation des solutions digitales proposées par l'agence BOOSTERA pour dynamiser l'activité de ${prospect.companyName}.

Compte tenu de votre positionnement dans le secteur "${prospect.sector || "votre activité"}", nous vous recommandons tout particulièrement :

${packHighlightText}

--- NOS 3 FORMULES CLÉS EN MAIN ---
1. PACK STARTER : 9 000 DA/mois — 4 publications/mois + Site Web inclus
2. PACK SILVER : 26 000 DA/mois — 8 publications/mois dont 2 Reels pro + Voix-off + 3 tournages/an
3. PACK GOLD : 42 000 DA/mois — 12 publications/mois dont 4 Reels pro + Voix-off + 5 tournages/an

Tous nos forfaits comprennent la scénarisation, le copywriting persuasif, le tournage avec matériel cinéma sur site, le montage dynamique et le ciblage publicitaire Meta (Facebook & Instagram Ads).

Seriez-vous disponible pour un court rendez-vous de démonstration (dans vos locaux ou en visio) afin de vous présenter des réalisations similaires à succès ?

Restant à votre entière disposition,

Bien cordialement,

L'équipe commerciale BOOSTERA Agency
Tél : 0560 00 00 00 | contact@boostera.dz
Alger, Algérie`;

    setEmailSubject(subject);
    setEmailBody(body);
  }, [prospect, selectedPack]);

  // Handle Save Email to prospect profile
  const handleSaveEmail = async () => {
    if (!prospect || !recipientEmail.trim() || recipientEmail === prospect.email) return;
    setIsSavingEmail(true);
    try {
      await updateProspectField(prospect.id, "email", recipientEmail.trim());
      setEmailSavedFeedback(true);
      setTimeout(() => setEmailSavedFeedback(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingEmail(false);
    }
  };

  // Handle Copy
  const handleCopy = async () => {
    const fullText = `Objet: ${emailSubject}\n\n${emailBody}`;
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);

    // Track activity
    logActivityAction({
      action: "COPY_AI_EMAIL_PROPOSAL",
      module: "COMMUNICATION",
      entityId: prospect.id,
      details: {
        title: "Email de proposition commerciale copié",
        description: `Proposition IA générée (${selectedPack}) copiée pour ${prospect.companyName}`,
        prospectId: prospect.id,
        prospectName: prospect.companyName,
        pack: selectedPack,
      },
    }).catch(() => {});
  };

  // Handle Mailto Link
  const handleMailto = () => {
    const to = recipientEmail.trim();
    const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
      emailSubject
    )}&body=${encodeURIComponent(emailBody)}`;

    // Track activity
    logActivityAction({
      action: "SEND_AI_EMAIL_PROPOSAL",
      module: "COMMUNICATION",
      entityId: prospect.id,
      details: {
        title: "Email de proposition commerciale ouvert (mailto)",
        description: `Email envoyé à ${prospect.companyName} (${to || "sans email renseigné"}) pour le ${selectedPack}`,
        prospectId: prospect.id,
        prospectName: prospect.companyName,
        recipientEmail: to,
        pack: selectedPack,
      },
    }).catch(() => {});

    window.open(mailtoUrl, "_blank");
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Proposition Commerciale IA & Recommandation Pack"
    >
      <div className="space-y-4 text-xs">
        {/* Prospect Header Card */}
        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold shrink-0">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-neutral-100">
                  {prospect.companyName}
                </h3>
                {prospect.wilaya && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-400 border border-neutral-800">
                    📍 {prospect.wilaya}
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 mt-0.5 flex items-center gap-2">
                <span>Secteur : <strong className="text-neutral-200">{prospect.sector || "Non spécifié"}</strong></span>
                <span>•</span>
                <span>Tél : <strong className="text-emerald-400">{prospect.phone}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 text-[10px] font-bold border border-purple-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Généré par l'IA
            </span>
          </div>
        </div>

        {/* AI Recommendation Banner */}
        <div className="p-3 rounded-xl bg-gradient-to-r from-indigo-950/30 via-neutral-900 to-neutral-900 border border-indigo-500/25">
          <div className="flex items-start gap-2">
            <span className="text-base shrink-0">💡</span>
            <div>
              <div className="text-xs font-bold text-indigo-300 flex items-center gap-2">
                <span>Analyse sectorielle : Pack Recommandé</span>
                <span className="px-2 py-0.2 rounded-md bg-indigo-500/20 text-indigo-200 font-bold text-[11px] border border-indigo-500/30">
                  {selectedPack}
                </span>
              </div>
              <p className="text-[11px] text-neutral-300 mt-0.5 leading-snug">
                {defaultRecommendation.reason}
              </p>
            </div>
          </div>
        </div>

        {/* Pack Selector Switcher */}
        <div>
          <label className="block text-neutral-400 font-semibold mb-1.5 text-[11px]">
            Changer le Pack Recommandé dans l'Email :
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                { id: "STARTER", label: "Pack Starter", price: "9 000 DA" },
                { id: "SILVER", label: "Pack Silver", price: "26 000 DA" },
                { id: "GOLD", label: "Pack Gold", price: "42 000 DA" },
                { id: "CUSTOM", label: "Sur-Mesure", price: "Devis" },
              ] as const
            ).map((p) => {
              const isSelected = selectedPack === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPack(p.id)}
                  className={`p-2 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                      : "bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900"
                  }`}
                >
                  <span className="text-xs font-bold">{p.label}</span>
                  <span
                    className={`text-[10px] mt-0.5 font-medium ${
                      isSelected ? "text-indigo-100" : "text-neutral-400"
                    }`}
                  >
                    {p.price}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recipient Email Input */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-neutral-300 font-semibold">
              Adresse Email Destinataire
            </label>
            {recipientEmail && recipientEmail !== prospect.email && (
              <button
                type="button"
                onClick={handleSaveEmail}
                disabled={isSavingEmail}
                className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>{isSavingEmail ? "Enregistrement..." : "Enregistrer dans la fiche"}</span>
                {emailSavedFeedback && <span className="text-emerald-400 font-bold">✓ Enregistré</span>}
              </button>
            )}
          </div>
          <div className="relative">
            <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="ex: contact@entreprise.dz ou email personnel..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Email Subject */}
        <div>
          <label className="block text-neutral-300 font-semibold mb-1">
            Objet de l'Email
          </label>
          <input
            type="text"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        {/* Email Body */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-neutral-300 font-semibold">
              Corps du Message (modifiable à volonté)
            </label>
            <span className="text-[10px] text-neutral-500">
              Prêt pour envoi direct
            </span>
          </div>
          <textarea
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            rows={10}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-neutral-200 focus:outline-hidden focus:border-indigo-500 font-mono leading-relaxed resize-y"
          />
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-neutral-800">
          <div className="text-[11px] text-neutral-400">
            {copied ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Email complet copié dans le presse-papier !
              </span>
            ) : (
              <span>Vous pouvez copier le texte ou ouvrir directement votre boîte mail.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              className="gap-1.5 border-neutral-700 hover:border-neutral-600"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copié !" : "Copier le texte"}</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleMailto}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/25"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ouvrir dans Mail</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
