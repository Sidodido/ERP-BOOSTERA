"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  Calculator,
  Plus,
  Check,
  X,
} from "lucide-react";
import { CUSTOM_OFFER_PRICING } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

export interface CustomOfferCalculationResult {
  monthlyRecurring: number;
  oneTimeTotal: number;
  durationMonths: number;
  totalContractValue: number;
  recommendedMonthlyFee: number;
  hasWebsite: boolean;
  deliverablesList: string[];
  summaryText: string;
}

export interface DeliverableDef {
  id: string;
  name: string;
  price: number;
  period: "MONTHLY" | "ONE_TIME" | "INCLUDED";
  priceTag: string;
  group?: "carrousel" | "video" | "website";
}

export interface CategoryDef {
  category: string;
  items: DeliverableDef[];
}

export const SUGGESTIONS_CATEGORIES: CategoryDef[] = [
  {
    category: "📱 Réseaux Sociaux & Contenu",
    items: [
      {
        id: "carrousel_2",
        name: "2 carrousels / mois",
        price: 2 * CUSTOM_OFFER_PRICING.CARROUSEL, // 3000 DA
        period: "MONTHLY",
        priceTag: "+3 000 DA/m",
        group: "carrousel",
      },
      {
        id: "carrousel_4",
        name: "4 carrousels / mois",
        price: 4 * CUSTOM_OFFER_PRICING.CARROUSEL, // 6000 DA
        period: "MONTHLY",
        priceTag: "+6 000 DA/m",
        group: "carrousel",
      },
      {
        id: "carrousel_6",
        name: "6 carrousels / mois",
        price: 6 * CUSTOM_OFFER_PRICING.CARROUSEL, // 9000 DA
        period: "MONTHLY",
        priceTag: "+9 000 DA/m",
        group: "carrousel",
      },
      {
        id: "carrousel_8",
        name: "8 carrousels / mois",
        price: 8 * CUSTOM_OFFER_PRICING.CARROUSEL, // 12000 DA
        period: "MONTHLY",
        priceTag: "+12 000 DA/m",
        group: "carrousel",
      },
      {
        id: "video_2",
        name: "2 vidéos Reels / mois",
        price: 2 * CUSTOM_OFFER_PRICING.VIDEO_REEL, // 6000 DA
        period: "MONTHLY",
        priceTag: "+6 000 DA/m",
        group: "video",
      },
      {
        id: "video_4",
        name: "4 vidéos Reels / mois",
        price: 4 * CUSTOM_OFFER_PRICING.VIDEO_REEL, // 12000 DA
        period: "MONTHLY",
        priceTag: "+12 000 DA/m",
        group: "video",
      },
      {
        id: "video_8",
        name: "8 vidéos Reels / mois",
        price: 8 * CUSTOM_OFFER_PRICING.VIDEO_REEL, // 24000 DA
        period: "MONTHLY",
        priceTag: "+24 000 DA/m",
        group: "video",
      },
      {
        id: "video_12",
        name: "12 vidéos Reels / mois",
        price: 12 * CUSTOM_OFFER_PRICING.VIDEO_REEL, // 36000 DA
        period: "MONTHLY",
        priceTag: "+36 000 DA/m",
        group: "video",
      },
      {
        id: "maquettes",
        name: "Maquettes réseaux sociaux",
        price: CUSTOM_OFFER_PRICING.MAQUETTE, // 1000 DA
        period: "MONTHLY",
        priceTag: "+1 000 DA/m",
      },
      {
        id: "voix_off",
        name: "Voix off professionnelle",
        price: CUSTOM_OFFER_PRICING.VOICE_OVER, // 1500 DA
        period: "MONTHLY",
        priceTag: "+1 500 DA/m",
      },
      {
        id: "motion_design",
        name: "Animation motion design",
        price: 0,
        period: "INCLUDED",
        priceTag: "Sur devis",
      },
      {
        id: "editorial_cal",
        name: "Calendrier éditorial & publication",
        price: 0,
        period: "INCLUDED",
        priceTag: "Inclus",
      },
    ],
  },
  {
    category: "🌐 Web & Référencement Google",
    items: [
      {
        id: "vitrine_base",
        name: "Site Web Vitrine Professionnel (4 pages)",
        price: CUSTOM_OFFER_PRICING.SITE_VITRINE_BASE, // 30 000 DA
        period: "ONE_TIME",
        priceTag: "30 000 DA",
        group: "website",
      },
      {
        id: "page_supp",
        name: "+1 Page supplémentaire vitrine",
        price: CUSTOM_OFFER_PRICING.EXTRA_PAGE, // 10 000 DA
        period: "ONE_TIME",
        priceTag: "+10 000 DA",
      },
      {
        id: "langue_supp",
        name: "+1 Langue supplémentaire vitrine",
        price: CUSTOM_OFFER_PRICING.EXTRA_LANGUAGE, // 10 000 DA
        period: "ONE_TIME",
        priceTag: "+10 000 DA",
      },
      {
        id: "site_ecommerce",
        name: "Site Web E-Commerce",
        price: CUSTOM_OFFER_PRICING.SITE_ECOMMERCE, // 50 000 DA
        period: "ONE_TIME",
        priceTag: "50 000 DA",
        group: "website",
      },
      {
        id: "google_certif",
        name: "Certification Google My Business",
        price: CUSTOM_OFFER_PRICING.GOOGLE_CERTIFICATION, // 5 000 DA
        period: "ONE_TIME",
        priceTag: "5 000 DA",
      },
      {
        id: "google_seo",
        name: "Optimisation SEO & Google Maps",
        price: 0,
        period: "INCLUDED",
        priceTag: "Inclus",
      },
      {
        id: "nom_domaine",
        name: "Nom de domaine & hébergement",
        price: 0,
        period: "INCLUDED",
        priceTag: "Inclus 1 an",
      },
    ],
  },
  {
    category: "🎥 Tournages & Vidéos Pro",
    items: [
      { id: "shoot_1", name: "1 Shooting photo / an", price: 0, period: "INCLUDED", priceTag: "Inclus pack" },
      { id: "shoot_3", name: "3 Shootings photo / an", price: 0, period: "INCLUDED", priceTag: "Inclus pack" },
      { id: "shoot_5", name: "5 Shootings photo / an", price: 0, period: "INCLUDED", priceTag: "Inclus pack" },
      { id: "vid_pro_1", name: "1 Vidéo Pro d'entreprise / an", price: 0, period: "INCLUDED", priceTag: "Inclus pack" },
      { id: "vid_pro_3", name: "3 Vidéos Pro d'entreprise / an", price: 0, period: "INCLUDED", priceTag: "Inclus pack" },
      { id: "drone_4k", name: "Prise de vue Drone 4K", price: 0, period: "INCLUDED", priceTag: "Sur devis" },
      { id: "event_cover", name: "Couverture d'événement / Inauguration", price: 0, period: "INCLUDED", priceTag: "Sur devis" },
      { id: "interview_testi", name: "Interviews & témoignages clients", price: 0, period: "INCLUDED", priceTag: "Inclus" },
    ],
  },
  {
    category: "🚀 Publicité & Acquisition (Ads)",
    items: [
      { id: "meta_ads", name: "Campagne Meta Ads (Facebook & Instagram)", price: 0, period: "INCLUDED", priceTag: "Gestion" },
      { id: "tiktok_ads", name: "Campagne TikTok Ads dédiée", price: 0, period: "INCLUDED", priceTag: "Gestion" },
      { id: "boost_cible", name: "Sponsoring & Boost ciblé", price: 0, period: "INCLUDED", priceTag: "Inclus" },
      { id: "vues_50k", name: "50K vues garanties", price: 0, period: "INCLUDED", priceTag: "Objectif" },
      { id: "vues_100k", name: "100K vues garanties", price: 0, period: "INCLUDED", priceTag: "Objectif" },
      { id: "vues_500k", name: "500K vues garanties", price: 0, period: "INCLUDED", priceTag: "Objectif" },
      { id: "vues_1m", name: "1M de vues garanties", price: 0, period: "INCLUDED", priceTag: "Objectif" },
      { id: "weekly_rep", name: "Rapport hebdomadaire des conversions", price: 0, period: "INCLUDED", priceTag: "Inclus" },
    ],
  },
  {
    category: "🎨 Branding & Supports Print",
    items: [
      { id: "logo_design", name: "Création ou refonte de logo", price: 0, period: "INCLUDED", priceTag: "Design" },
      { id: "charte_graphique", name: "Charte graphique complète", price: 0, period: "INCLUDED", priceTag: "Design" },
      { id: "supports_print", name: "Supports print (Flyers / Menus / Cartes)", price: 0, period: "INCLUDED", priceTag: "Inclus" },
      { id: "canva_templates", name: "Templates Canva personnalisés", price: 0, period: "INCLUDED", priceTag: "Inclus" },
    ],
  },
];

export function findDeliverableDef(name: string): DeliverableDef | undefined {
  for (const cat of SUGGESTIONS_CATEGORIES) {
    const found = cat.items.find((i) => i.name === name);
    if (found) return found;
  }
  return undefined;
}

export function mergeRemarkWithSummary(existingNotes: string, newSummary: string): string {
  const marker = "📋 Devis & Livrables Pack Sur Mesure :";
  if (!existingNotes) return newSummary;
  if (!existingNotes.includes(marker)) {
    return newSummary ? `${existingNotes.trim()}\n\n${newSummary}` : existingNotes;
  }
  const userPart = existingNotes.split(marker)[0].trim();
  if (!newSummary) return userPart;
  return userPart ? `${userPart}\n\n${newSummary}` : newSummary;
}

interface CustomItem {
  id: string;
  name: string;
  price: number;
  period: "MONTHLY" | "ONE_TIME" | "INCLUDED";
  priceTag: string;
}

interface Props {
  durationMonths: number;
  onCalculationChange: (result: CustomOfferCalculationResult) => void;
  initialDeliverables?: string[];
}

export function CustomOfferConfigurator({
  durationMonths,
  onCalculationChange,
  initialDeliverables = [
    "4 carrousels / mois",
    "4 vidéos Reels / mois",
    "Certification Google My Business",
  ],
}: Props) {
  const [selectedItems, setSelectedItems] = useState<string[]>(initialDeliverables);
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);
  const [newDeliverableInput, setNewDeliverableInput] = useState("");

  const toggleDeliverable = (item: DeliverableDef) => {
    setSelectedItems((prev) => {
      if (item.group) {
        const groupItemNames = SUGGESTIONS_CATEGORIES.flatMap((c) => c.items)
          .filter((i) => i.group === item.group)
          .map((i) => i.name);

        const isCurrentlySelected = prev.includes(item.name);
        const withoutGroup = prev.filter((name) => !groupItemNames.includes(name));

        if (isCurrentlySelected) {
          return withoutGroup;
        } else {
          return [...withoutGroup, item.name];
        }
      }

      if (prev.includes(item.name)) {
        return prev.filter((name) => name !== item.name);
      } else {
        return [...prev, item.name];
      }
    });
  };

  const handleAddCustomDeliverable = () => {
    const trimmed = newDeliverableInput.trim();
    if (!trimmed) return;
    if (selectedItems.includes(trimmed)) {
      setNewDeliverableInput("");
      return;
    }

    const matched = findDeliverableDef(trimmed);
    if (matched) {
      toggleDeliverable(matched);
    } else {
      setSelectedItems((prev) => [...prev, trimmed]);
      setCustomItems((prev) => [
        ...prev,
        {
          id: `custom_${Date.now()}`,
          name: trimmed,
          price: 0,
          period: "INCLUDED",
          priceTag: "Sur mesure",
        },
      ]);
    }
    setNewDeliverableInput("");
  };

  const handleRemoveItem = (name: string) => {
    setSelectedItems((prev) => prev.filter((n) => n !== name));
    setCustomItems((prev) => prev.filter((c) => c.name !== name));
  };

  const handleClearAll = () => {
    setSelectedItems([]);
    setCustomItems([]);
  };

  const {
    monthlyRecurring,
    oneTimeTotal,
    hasWebsite,
    deliverablesBreakdown,
  } = useMemo(() => {
    let monthly = 0;
    let oneTime = 0;
    let web = false;
    const breakdown: { name: string; priceFormatted: string }[] = [];

    for (const name of selectedItems) {
      const def = findDeliverableDef(name);
      if (def) {
        if (def.period === "MONTHLY") {
          monthly += def.price;
          breakdown.push({
            name: def.name,
            priceFormatted: `${formatCurrency(def.price)} / mois`,
          });
        } else if (def.period === "ONE_TIME") {
          oneTime += def.price;
          breakdown.push({
            name: def.name,
            priceFormatted: `${formatCurrency(def.price)} unique`,
          });
          if (def.group === "website" || name.toLowerCase().includes("site")) {
            web = true;
          }
        } else {
          breakdown.push({
            name: def.name,
            priceFormatted: "Inclus",
          });
        }
      } else {
        const custom = customItems.find((c) => c.name === name);
        if (custom && custom.price > 0) {
          if (custom.period === "MONTHLY") monthly += custom.price;
          else oneTime += custom.price;
        }
        breakdown.push({
          name,
          priceFormatted: "Sur mesure",
        });
      }
    }

    return {
      monthlyRecurring: monthly,
      oneTimeTotal: oneTime,
      hasWebsite: web,
      deliverablesBreakdown: breakdown,
    };
  }, [selectedItems, customItems]);

  const validMonths = Math.max(1, durationMonths || 6);
  const totalContractValue = monthlyRecurring * validMonths + oneTimeTotal;
  const recommendedMonthlyFee =
    monthlyRecurring + (oneTimeTotal > 0 ? Math.round(oneTimeTotal / validMonths) : 0);

  const summaryText = useMemo(() => {
    if (selectedItems.length === 0) return "";

    const lines: string[] = [
      "📋 Devis & Livrables Pack Sur Mesure :",
      ...deliverablesBreakdown.map((d) => `• ${d.name} (${d.priceFormatted})`),
      `💰 Forfait Mensuel : ${formatCurrency(monthlyRecurring)} / mois ${oneTimeTotal > 0 ? `(+ ${formatCurrency(oneTimeTotal)} frais ponctuels Web/Google)` : ""}`,
      `💳 Valeur Totale Contrat : ${formatCurrency(totalContractValue)} (sur ${validMonths} mois)`,
    ];
    return lines.join("\n");
  }, [selectedItems, deliverablesBreakdown, monthlyRecurring, oneTimeTotal, totalContractValue, validMonths]);

  useEffect(() => {
    onCalculationChange({
      monthlyRecurring,
      oneTimeTotal,
      durationMonths: validMonths,
      totalContractValue,
      recommendedMonthlyFee: monthlyRecurring > 0 ? monthlyRecurring : recommendedMonthlyFee,
      hasWebsite,
      deliverablesList: selectedItems,
      summaryText,
    });
  }, [
    monthlyRecurring,
    oneTimeTotal,
    validMonths,
    totalContractValue,
    recommendedMonthlyFee,
    hasWebsite,
    selectedItems,
    summaryText,
  ]);

  return (
    <div className="p-4 bg-purple-950/20 border border-purple-500/40 rounded-2xl space-y-3.5 animate-in fade-in duration-200">
      {/* En-tête avec compteur et icône */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
          <span className="text-xs font-bold text-neutral-200">
            Livrables inclus dans le Pack Sur Mesure
          </span>
        </div>
        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
          {selectedItems.length} sélectionné{selectedItems.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Livrables actuellement retenus pour ce client */}
      <div className="p-3 bg-neutral-900/90 border border-neutral-800 rounded-xl space-y-2">
        <div className="text-[11px] font-semibold text-neutral-400 flex items-center justify-between">
          <span>Livrables retenus pour ce client :</span>
          {selectedItems.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[10px] text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
            >
              Tout désélectionner
            </button>
          )}
        </div>

        {selectedItems.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
            {selectedItems.map((item, idx) => {
              const def = findDeliverableDef(item);
              return (
                <span
                  key={idx}
                  className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-900/40 border border-purple-500/40 text-[11px] text-purple-200 font-medium hover:border-rose-500/50 hover:bg-rose-950/30 transition-all shadow-2xs"
                >
                  <span>{item}</span>
                  {def?.priceTag && def.price > 0 && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/30 text-purple-200 font-mono font-bold">
                      {def.priceTag}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item)}
                    className="text-purple-400 hover:text-rose-400 p-0.5 rounded transition-colors cursor-pointer"
                    title="Supprimer ce livrable"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-neutral-500 italic py-1">
            Aucun livrable sélectionné. Cliquez sur les suggestions ci-dessous pour composer l'offre.
          </p>
        )}
      </div>

      {/* Champ d'ajout rapide personnalisé */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newDeliverableInput}
          onChange={(e) => setNewDeliverableInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddCustomDeliverable();
            }
          }}
          placeholder="Ex: 8 posts mensuels, 1 shooting vidéo 4K, Campagne TikTok..."
          className="flex-1 h-9 px-3 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-purple-500 transition-colors"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddCustomDeliverable}
          className="shrink-0 h-9 border-purple-500/30 text-purple-300 hover:bg-purple-950/40 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Ajouter
        </Button>
      </div>

      {/* Suggestions catégorisées prêtes à l'emploi (Clic pour ajouter / retirer) */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block">
            SUGGESTIONS PRÊTES À L'EMPLOI (CLIQUEZ POUR AJOUTER / RETIRER) :
          </span>
          <span className="text-[10px] text-purple-400 font-semibold">
            Tarifs officiels calculés
          </span>
        </div>

        <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
          {SUGGESTIONS_CATEGORIES.map((cat, catIdx) => (
            <div key={catIdx} className="space-y-1.5">
              <span className="text-[10px] font-bold text-neutral-400 block">
                {cat.category}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {cat.items.map((item, itemIdx) => {
                  const isSelected = selectedItems.includes(item.name);
                  return (
                    <button
                      key={itemIdx}
                      type="button"
                      onClick={() => toggleDeliverable(item)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1.5 border text-left cursor-pointer ${
                        isSelected
                          ? "bg-purple-500/25 border-purple-500/60 text-purple-200 shadow-xs font-semibold ring-1 ring-purple-500/40"
                          : "bg-neutral-900/80 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-700"
                      }`}
                    >
                      {isSelected ? (
                        <Check className="w-3 h-3 text-purple-300 shrink-0 stroke-[2.5]" />
                      ) : (
                        <Plus className="w-3 h-3 text-neutral-500 shrink-0" />
                      )}
                      <span>{item.name}</span>
                      {item.priceTag && item.price > 0 && (
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                            isSelected
                              ? "bg-purple-600 text-white"
                              : "bg-neutral-800 text-neutral-400"
                          }`}
                        >
                          {item.priceTag}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SYNTHÈSE DU CALCUL FINANCIER EN DIRECT */}
      <div className="p-3 bg-neutral-950/80 border border-purple-500/30 rounded-xl space-y-2">
        <div className="text-[11px] font-bold text-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Calculator className="w-3.5 h-3.5 text-purple-400" />
            <span>Calcul Financier Automatique de l'Offre :</span>
          </div>
          <span className="text-purple-300 font-mono text-xs font-bold">
            Durée : {validMonths} mois
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-neutral-900/90 border border-neutral-800">
            <span className="text-[10px] text-neutral-400 block">Forfait Mensuel Récurrent</span>
            <span className="font-bold text-emerald-400 font-mono text-sm block">
              {formatCurrency(monthlyRecurring)}
            </span>
            <span className="text-[9px] text-neutral-400 block">/ mois</span>
          </div>

          <div className="p-2 rounded-lg bg-neutral-900/90 border border-neutral-800">
            <span className="text-[10px] text-neutral-400 block">Frais Ponctuels (Web / Google)</span>
            <span className="font-bold text-blue-400 font-mono text-sm block">
              {formatCurrency(oneTimeTotal)}
            </span>
            <span className="text-[9px] text-neutral-400 block">Facturés à la livraison</span>
          </div>

          <div className="p-2 rounded-lg bg-purple-950/40 border border-purple-500/40 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-purple-300 block font-semibold">Valeur Totale Contrat</span>
            <span className="font-black text-white font-mono text-sm block">
              {formatCurrency(totalContractValue)}
            </span>
            <span className="text-[9px] text-purple-300 block">Global sur {validMonths} mois</span>
          </div>
        </div>
      </div>
    </div>
  );
}
