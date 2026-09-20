import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | { toString(): string } | null | undefined): string {
  if (amount === null || amount === undefined) return "0\u00A0DA";
  const num = typeof amount === "number" ? amount : Number(amount.toString());
  if (isNaN(num)) return "0\u00A0DA";
  return new Intl.NumberFormat("fr-DZ", {
    style: "decimal",
    maximumFractionDigits: 2,
  }).format(num).replace(/\s/g, "\u00A0") + "\u00A0DA";
}

export function toLocalDateString(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDate(date: Date | string | null | undefined, pattern = "dd/MM/yyyy"): string {
  if (!date) return "-";
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    const [y, m, day] = date.trim().split("-").map(Number);
    const localDate = new Date(y, m - 1, day);
    return format(localDate, pattern, { locale: fr });
  }
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  return format(d, pattern, { locale: fr });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  return formatDate(date, "dd/MM/yyyy HH:mm");
}

export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  return formatDistanceToNow(d, { addSuffix: true, locale: fr });
}

export function formatBytes(bytes: number | null | undefined, decimals = 1): string {
  if (!bytes || bytes === 0) return "0 Ko";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Octets", "Ko", "Mo", "Go"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatAlgerianWhatsAppNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  // Si plusieurs numéros séparés par un slash ou virgule, on prend le premier
  let firstPhone = phone.split(/[/,;]/)[0].trim();
  const cleaned = firstPhone.replace(/\D/g, "");
  if (!cleaned) return "";

  if (cleaned.startsWith("00213")) {
    return "213" + cleaned.slice(5);
  }
  if (cleaned.startsWith("213")) {
    return cleaned;
  }
  if (cleaned.startsWith("0")) {
    return "213" + cleaned.slice(1);
  }
  if (cleaned.length === 9) {
    return "213" + cleaned;
  }
  return cleaned;
}

export function buildWhatsAppUrl(
  phone: string | null | undefined,
  companyName?: string | null,
  contactName?: string | null
): string {
  const formattedPhone = formatAlgerianWhatsAppNumber(phone);
  if (!formattedPhone) return "#";

  const targetName = contactName?.trim() || companyName?.trim() || "Bonjour";
  const message = `Bonjour ${targetName},

Suite à notre échange téléphonique, je vous transmets comme convenu un récapitulatif de nos services chez BOOSTERA Agency.

Nous accompagnons les professionnels et entreprises dans le développement de leur visibilité et l'acquisition de nouveaux clients :
🎬 Production vidéo & Reels percutants (tournage pro sur site & montage dynamique)
🎨 Création graphique & identité visuelle (Carrousels, Maquettes et visuels réseaux)
📱 Gestion complète & Campagnes sponsorisées Meta (Facebook Ads / Instagram Ads)
💻 Conception de sites web professionnels & référencement Google

Nous proposons des formules complètes clé en main adaptées à vos besoins (Pack Starter, Silver, Gold ou Sur-mesure).

N'hésitez pas si vous avez des questions ou pour convenir d'un rendez-vous de présentation.

Bien cordialement,
L'équipe BOOSTERA Agency
contact@boostera.dz`;

  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
}

export interface ClientMediaLinks {
  driveUrl?: string;
  googleBusinessUrl?: string;
  facebook?: string;
  instagram?: string;
  tiktok?: string;
}

/**
 * Clé du mois en cours (ex: "2026_09")
 */
export function getMonthKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}_${m}`;
}

/**
 * Extrait la valeur d'une balise métadonnée [TAG_NAME:...] stockée dans le texte
 */
export function extractMetadataTag(notes: string | null | undefined, tagName: string): string | null {
  if (!notes) return null;
  const regex = new RegExp(`\\[${tagName}:([^\\]]+)\\]`);
  const match = notes.match(regex);
  return match ? match[1] : null;
}

/**
 * Injecte ou met à jour une balise métadonnée [TAG_NAME:value] dans les notes tout en préservant le reste
 */
export function setMetadataTag(notes: string | null | undefined, tagName: string, tagValue: string): string {
  const current = (notes || "").trim();
  const newTag = `[${tagName}:${tagValue}]`;
  const regex = new RegExp(`\\[${tagName}:[^\\]]+\\]\\s*`);

  if (regex.test(current)) {
    return current.replace(regex, `${newTag}\n`).trim();
  }
  return current ? `${newTag}\n${current}` : newTag;
}

/**
 * Extrait les liens média stockés dans les métadonnées notes du client
 */
export function parseClientMedia(
  notes?: string | null,
  client?: { facebook?: string | null; instagram?: string | null }
): {
  media: ClientMediaLinks;
  cleanNotes: string;
} {
  let media: ClientMediaLinks = {
    facebook: client?.facebook || "",
    instagram: client?.instagram || "",
    driveUrl: "",
    googleBusinessUrl: "",
    tiktok: "",
  };
  let cleanNotes = notes || "";

  if (notes) {
    const rawMedia = extractMetadataTag(notes, "CLIENT_MEDIA");
    if (rawMedia) {
      try {
        const parsed = JSON.parse(rawMedia);
        media = {
          driveUrl: parsed.driveUrl || "",
          googleBusinessUrl: parsed.googleBusinessUrl || "",
          tiktok: parsed.tiktok || "",
          facebook: parsed.facebook || client?.facebook || "",
          instagram: parsed.instagram || client?.instagram || "",
        };
      } catch {}
    }
    // Nettoyer toutes les balises métadonnées pour extraire les vraies notes
    cleanNotes = notes.replace(/\[[A-Z0-9_]+:[^\]]+\]\s*/g, "").trim();
  }

  return { media, cleanNotes };
}

/**
 * Sérialise les liens médias pour persistance dans les notes du client
 */
export function serializeClientMedia(media: ClientMediaLinks, existingNotes?: string | null): string {
  const metaStr = JSON.stringify(media);
  return setMetadataTag(existingNotes, "CLIENT_MEDIA", metaStr);
}

/**
 * Récupère le plan éditorial mensuel stocké dans les notes du client pour un mois donné
 */
export function getStoredEditorialPlan(notes?: string | null, monthKey?: string): any | null {
  const currentMonthKey = monthKey || getMonthKey();
  const raw = extractMetadataTag(notes, `EDITORIAL_PLAN_${currentMonthKey}`);
  if (!raw) return null;
  try {
    if (!raw.startsWith("{")) {
      const decoded = Buffer.from(raw, "base64").toString("utf-8");
      const parsed = JSON.parse(decoded);
      return parsed.plan || parsed;
    }
    const parsed = JSON.parse(raw);
    return parsed.plan || parsed;
  } catch {
    return null;
  }
}

/**
 * Enregistre ou met à jour le plan éditorial mensuel dans les notes du client
 */
export function saveEditorialPlanToNotes(
  existingNotes: string | null | undefined,
  plan: any,
  monthKey?: string
): string {
  const currentMonthKey = monthKey || getMonthKey();
  const payload = JSON.stringify({
    monthKey: currentMonthKey,
    savedAt: new Date().toISOString(),
    plan,
  });
  const encoded = Buffer.from(payload, "utf-8").toString("base64");
  return setMetadataTag(existingNotes, `EDITORIAL_PLAN_${currentMonthKey}`, encoded);
}

/**
 * Met à jour une publication précise dans le plan éditorial stocké
 */
export function updateStoredPublicationInNotes(
  existingNotes: string | null | undefined,
  publicationId: string,
  updatedFields: Record<string, any>,
  monthKey?: string
): { updatedNotes: string; updatedPlan: any | null } {
  const currentMonthKey = monthKey || getMonthKey();
  const plan = getStoredEditorialPlan(existingNotes, currentMonthKey);
  if (!plan || !Array.isArray(plan.publications)) {
    return { updatedNotes: existingNotes || "", updatedPlan: null };
  }

  const updatedPublications = plan.publications.map((p: any) => {
    if (p.id === publicationId) {
      return { ...p, ...updatedFields };
    }
    return p;
  });

  const newPlan = { ...plan, publications: updatedPublications };
  const updatedNotes = saveEditorialPlanToNotes(existingNotes, newPlan, currentMonthKey);
  return { updatedNotes, updatedPlan: newPlan };
}

export interface ClientBillingData {
  rc?: string;
  nif?: string;
  nis?: string;
  ai?: string;
  rib?: string;
}

export function parseClientBilling(notes?: string | null): {
  billing: ClientBillingData;
  cleanNotes: string;
} {
  let billing: ClientBillingData = { rc: "", nif: "", nis: "", ai: "", rib: "" };
  let cleanNotes = notes || "";
  if (notes) {
    const match = notes.match(/\[CLIENT_BILLING:(.*?)\]/);
    if (match) {
      try {
        billing = JSON.parse(match[1]);
        cleanNotes = notes.replace(match[0], "").trim();
      } catch {
        // ignore
      }
    }
  }
  return { billing, cleanNotes };
}

export function serializeClientBilling(billing: ClientBillingData, notes?: string | null): string {
  const metaStr = `[CLIENT_BILLING:${JSON.stringify(billing)}]`;
  const clean = (notes || "").replace(/\[CLIENT_BILLING:.*?\]/g, "").trim();
  return clean ? `${metaStr} ${clean}` : metaStr;
}

/**
 * Normalise les URLs pour ouverture externe avec protocole complet
 */
export function normalizeMediaUrl(
  url: string | null | undefined,
  platform?: "facebook" | "instagram" | "tiktok" | "drive" | "gmaps"
): string {
  if (!url || !url.trim()) return "#";
  const trimmed = url.trim();

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (platform === "instagram") {
    const handle = trimmed.replace(/^@/, "");
    return `https://instagram.com/${handle}`;
  }

  if (platform === "tiktok") {
    const handle = trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
    return `https://www.tiktok.com/${handle}`;
  }

  if (platform === "facebook") {
    return `https://facebook.com/${trimmed.replace(/^\//, "")}`;
  }

  return `https://${trimmed}`;
}

/**
 * Formate un lien ou identifiant de réseau social en libellé court et lisible (ex: @compte)
 */
export function formatSocialLabel(
  url: string | null | undefined,
  platform?: "facebook" | "instagram" | "tiktok"
): string {
  if (!url || !url.trim()) return "";
  let clean = url.trim().replace(/^https?:\/\/(www\.)?/i, "");
  if (platform === "instagram") {
    clean = clean.replace(/^instagram\.com\//i, "").replace(/\/.*$/, "").replace(/^@/, "");
    return clean ? `@${clean}` : url.trim();
  }
  if (platform === "tiktok") {
    clean = clean.replace(/^tiktok\.com\/@?/i, "").replace(/\/.*$/, "").replace(/^@/, "");
    return clean ? `@${clean}` : url.trim();
  }
  if (platform === "facebook") {
    clean = clean.replace(/^facebook\.com\//i, "").replace(/(\/|\?).*$/, "");
    return clean || url.trim();
  }
  return clean;
}


export function parseInvoiceNotes(notes: string | null | undefined): {
  memo: string;
  clientBilling: {
    companyName?: string;
    contactName?: string;
    address?: string;
    wilaya?: string;
    phone?: string;
    email?: string;
    rc?: string;
    nif?: string;
    nis?: string;
    ai?: string;
    paymentMethod?: string;
    taxMode?: "HT" | "TTC";
  } | null;
  paymentMethod: "BARIDIMOB" | "ESPECES" | "VIREMENT" | "CHEQUE" | "OTHER";
  taxMode: "HT" | "TTC";
} {
  let memo = "";
  let clientBilling: any = null;

  if (notes) {
    const match = notes.match(/^\[BILLING_META:(.*?)\]\s*([\s\S]*)$/);
    if (match) {
      try {
        clientBilling = JSON.parse(match[1]);
        memo = match[2].trim();
      } catch {
        memo = notes;
      }
    } else {
      memo = notes;
    }
  }

  // Detect paymentMethod
  let paymentMethod: "BARIDIMOB" | "ESPECES" | "VIREMENT" | "CHEQUE" | "OTHER" = "BARIDIMOB";
  if (clientBilling?.paymentMethod) {
    paymentMethod = clientBilling.paymentMethod;
  } else if (memo) {
    const lower = memo.toLowerCase();
    if (lower.includes("espece") || lower.includes("cash")) {
      paymentMethod = "ESPECES";
    } else if (lower.includes("virement") || lower.includes("bna")) {
      paymentMethod = "VIREMENT";
    } else if (lower.includes("cheque") || lower.includes("chèque")) {
      paymentMethod = "CHEQUE";
    } else if (lower.includes("baridi") || lower.includes("ccp")) {
      paymentMethod = "BARIDIMOB";
    }
  }

  // Detect taxMode
  let taxMode: "HT" | "TTC" = "HT";
  if (clientBilling?.taxMode) {
    taxMode = clientBilling.taxMode === "TTC" ? "TTC" : "HT";
  } else if (memo) {
    const lower = memo.toLowerCase();
    if (lower.includes("ttc") || lower.includes("avec tva")) {
      taxMode = "TTC";
    }
  }

  return { memo, clientBilling, paymentMethod, taxMode };
}

export function amountToFrenchWords(amount: number, taxMode?: "HT" | "TTC" | string): string {
  const units = [
    "", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
    "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept",
    "dix-huit", "dix-neuf"
  ];
  const tens = [
    "", "", "vingt", "trente", "quarante", "cinquante", "soixante",
    "soixante-dix", "quatre-vingts", "quatre-vingt-dix"
  ];

  function convertBelowThousand(n: number): string {
    if (n === 0) return "";
    if (n < 20) return units[n];
    if (n < 70) {
      const t = Math.floor(n / 10);
      const u = n % 10;
      if (u === 1) return tens[t] + " et un";
      if (u > 0) return tens[t] + "-" + units[u];
      return tens[t];
    }
    if (n < 80) {
      const u = n - 60;
      if (u === 11) return "soixante et onze";
      return "soixante-" + units[u];
    }
    if (n < 100) {
      const u = n - 80;
      if (u === 0) return "quatre-vingts";
      return "quatre-vingt-" + units[u];
    }
    const c = Math.floor(n / 100);
    const rem = n % 100;
    const cStr = c === 1 ? "cent" : units[c] + " cents";
    if (rem === 0) return cStr;
    return (c === 1 ? "cent" : units[c] + " cent") + " " + convertBelowThousand(rem);
  }

  const intPart = Math.floor(amount || 0);
  if (intPart === 0) return taxMode === "HT" ? "Zéro Dinar Hors Taxes (HT)" : taxMode === "TTC" ? "Zéro Dinar Toutes Taxes Comprises (TTC)" : "Zéro Dinar";

  let result = "";
  const millions = Math.floor(intPart / 1_000_000);
  const thousands = Math.floor((intPart % 1_000_000) / 1000);
  const remainder = intPart % 1000;

  if (millions > 0) {
    result += (millions === 1 ? "un million" : convertBelowThousand(millions) + " millions") + " ";
  }
  if (thousands > 0) {
    result += (thousands === 1 ? "mille" : convertBelowThousand(thousands) + " mille") + " ";
  }
  if (remainder > 0) {
    result += convertBelowThousand(remainder);
  }

  result = result.trim();
  result = result.charAt(0).toUpperCase() + result.slice(1);

  if (taxMode === "HT") {
    return `${result} Dinars Algériens Hors Taxes (HT)`;
  }
  if (taxMode === "TTC") {
    return `${result} Dinars Algériens Toutes Taxes Comprises (TTC)`;
  }
  return `${result} Dinars Algériens`;
}

import { CallResult } from "@prisma/client";

export function mapCallStatusToCallData(status?: string | null): {
  result: CallResult;
  answered: boolean;
  comment: string;
  durationSeconds: number;
} | null {
  if (!status || !status.trim()) return null;
  const s = status.trim().toUpperCase();

  // Virgin / uncalled status must not produce any call record
  if (
    s === "NON EFFECTUE" ||
    s === "NON EFFECTUÉ" ||
    s === "NON" ||
    s === "VIERGE" ||
    s === "NOUVEAU" ||
    s === "PAS ENCORE"
  ) {
    return null;
  }

  if (s.includes("PAS DE CONTACT") || s.includes("SANS CONTACT")) {
    return {
      result: CallResult.NO_ANSWER,
      answered: false,
      comment: "Tentative d'appel : Pas de contact",
      durationSeconds: 15,
    };
  }
  if (s === "EFFECTUE" || s.includes("EFFECTU")) {
    return {
      result: CallResult.INTERESTED,
      answered: true,
      comment: "Appel marqué comme EFFECTUÉ",
      durationSeconds: 120,
    };
  }
  if (s.includes("A RAPPELER") || s.includes("RAPPEL")) {
    return {
      result: CallResult.CALLBACK_REQUESTED,
      answered: true,
      comment: "Appel : À rappeler",
      durationSeconds: 60,
    };
  }
  if (s.includes("PAS DE REPONSE") || s.includes("NE REP") || s.includes("PAS DE REPONCE")) {
    return {
      result: CallResult.NO_ANSWER,
      answered: false,
      comment: "Tentative d'appel : Pas de réponse",
      durationSeconds: 30,
    };
  }
  if (s.includes("OCCUP")) {
    return {
      result: CallResult.UNREACHABLE,
      answered: false,
      comment: "Tentative d'appel : Numéro occupé",
      durationSeconds: 20,
    };
  }
  if (s.includes("INJOIGNABLE") || s.includes("FAUX")) {
    return {
      result: CallResult.UNREACHABLE,
      answered: false,
      comment: "Tentative d'appel : Numéro injoignable",
      durationSeconds: 20,
    };
  }

  return {
    result: CallResult.NO_ANSWER,
    answered: false,
    comment: `Tentative d'appel (${status})`,
    durationSeconds: 30,
  };
}

/**
 * Détermine si un prospect est encore dans la file de Prospection
 * (non encore transféré vers les appels et la base de données via le clic sur le bouton +)
 */
export function isVirginProspect(p: {
  status: string;
  callStatus?: string | null;
  rawState?: string | null;
  _count?: { calls?: number; appointments?: number };
  calls?: any[];
  appointments?: any[];
  response?: string | null;
  notes?: string | null;
}): boolean {
  // Condition stricte : seul le clic sur "+ Appel" déplace le prospect vers la section Appels
  if (
    p.rawState === "TRANSFERE_APPELS" ||
    p.callStatus === "TRANSFERE_APPELS"
  ) {
    return false;
  }

  // Déjà converti en client actif
  if (p.status === "CONVERTED") {
    return false;
  }

  return true;
}


