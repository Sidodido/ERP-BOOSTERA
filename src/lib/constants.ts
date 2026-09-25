export const SECTORS = [
  "Cabinet médical",
  "Voyage",
  "Hôtel",
  "Restaurant",
  "Beauté",
  "Immobilier",
  "E-commerce",
  "Industrie",
  "Éducation / Formation",
  "Autre prestation",
] as const;

export const WILAYAS = [
  "Alger", "Oran", "Constantine", "Annaba", "Blida", "Batna", "Djelfa", "Sétif",
  "Sidi Bel Abbès", "Biskra", "Tébessa", "El Oued", "Skikda", "Tiaret", "Béjaïa",
  "Tlemcen", "Ouargla", "Béchar", "Mostaganem", "Bordj Bou Arréridj", "Chlef",
  "Souk Ahras", "Médéa", "El Eulma", "Touggourt", "Ghardaïa", "Saïda", "M'Sila",
  "Guelma", "Khenchela", "Tipaza", "Mascara", "Oum El Bouaghi", "Tizi Ouzou",
  "Bouira", "Boumerdès", "El Tarf", "Tindouf", "Tissemsilt", "Adrar", "Relizane",
  "Aïn Defla", "Aïn Témouchent", "Naâma", "Illizi", "Tamanrasset", "Mila"
] as const;

export const ROLES = {
  ADMIN: "Administrateur Général",
  SALES_DIRECTOR: "Directeur Commercial",
  SALES_REP: "Commercial",
  TECH_LEAD: "Chef de Projet Technique",
  DEVELOPER: "Développeur",
  DESIGNER: "Designer",
  VIDEO_EDITOR: "Monteur Vidéo",
  ACCOUNTANT: "Comptabilité / Finance",
  HR: "Ressources Humaines",
} as const;

export const OFFER_TYPES = {
  STARTER: "Pack Starter (9 000 DA)",
  SILVER: "Pack Silver (26 000 DA)",
  GOLD: "Pack Gold (36 000 DA)",
  CUSTOM: "Offre Personnalisée (Sur mesure)",
} as const;

export interface OfferDetail {
  id: "STARTER" | "SILVER" | "GOLD" | "CUSTOM";
  name: string;
  badgeName: string;
  tagline: string;
  monthlyPrice: number;
  views: string;
  hasWebsiteIncluded: boolean;
  canAddWebsiteOption: boolean;
  websiteOptionPrice: number;
  features: string[];
  theme: {
    border: string;
    badge: string;
    activeBg: string;
    text: string;
    accent: string;
  };
}

export const OFFER_DETAILS: Record<keyof typeof OFFER_TYPES, OfferDetail> = {
  STARTER: {
    id: "STARTER",
    name: "Pack Starter",
    badgeName: "Starter",
    tagline: "Idéal pour débuter",
    monthlyPrice: 9000,
    views: "50K vues",
    hasWebsiteIncluded: true,
    canAddWebsiteOption: false,
    websiteOptionPrice: 0,
    features: [
      "2 carrousels",
      "2 maquettes",
      "SEO de base",
      "Certification Google",
      "Site web professionnel inclus",
      "1 Shooting / an",
      "1 Vidéo Pro / an",
      "Sponsor de la vidéo pro",
      "50K vues garanties",
    ],
    theme: {
      border: "border-blue-500/40 hover:border-blue-500",
      badge: "bg-blue-500/15 text-blue-300 border-blue-500/30",
      activeBg: "bg-blue-950/40",
      text: "text-blue-400",
      accent: "#3B82F6",
    },
  },
  SILVER: {
    id: "SILVER",
    name: "Pack Silver",
    badgeName: "Silver",
    tagline: "Bonne visibilité",
    monthlyPrice: 26000,
    views: "600K vues",
    hasWebsiteIncluded: false,
    canAddWebsiteOption: true,
    websiteOptionPrice: 2000,
    features: [
      "3 carrousels",
      "3 maquettes",
      "2 vidéos Reels",
      "1 voix off",
      "SEO de base",
      "Certification Google",
      "3 Shootings / an",
      "3 vidéos Pro / an",
      "Sponsor des vidéos pro",
      "600K vues garanties",
      "Option Site Vitrine : +2 000 DA / mois",
    ],
    theme: {
      border: "border-amber-400/50 hover:border-amber-400",
      badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      activeBg: "bg-amber-950/40",
      text: "text-amber-400",
      accent: "#F59E0B",
    },
  },
  GOLD: {
    id: "GOLD",
    name: "Pack Gold",
    badgeName: "Gold",
    tagline: "Forte présence",
    monthlyPrice: 36000,
    views: "1M vues",
    hasWebsiteIncluded: false,
    canAddWebsiteOption: true,
    websiteOptionPrice: 2000,
    features: [
      "4 carrousels",
      "4 maquettes",
      "4 vidéos Reels",
      "2 voix off",
      "SEO de base",
      "Certification Google",
      "5 Shootings / an",
      "5 vidéos Pro / an",
      "Sponsor des vidéos pro",
      "1M vues garanties",
      "Option Site Vitrine : +2 000 DA / mois",
    ],
    theme: {
      border: "border-yellow-400/60 hover:border-yellow-400",
      badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
      activeBg: "bg-yellow-950/40",
      text: "text-yellow-400",
      accent: "#EAB308",
    },
  },
  CUSTOM: {
    id: "CUSTOM",
    name: "Offre Personnalisée",
    badgeName: "Sur Mesure",
    tagline: "Prestation personnalisée",
    monthlyPrice: 0,
    views: "Sur mesure",
    hasWebsiteIncluded: false,
    canAddWebsiteOption: false,
    websiteOptionPrice: 0,
    features: [
      "Prestations et volume à la carte",
      "Montant et mensualité négociés sur mesure",
      "Services et livrables personnalisés",
    ],
    theme: {
      border: "border-purple-500/40 hover:border-purple-500",
      badge: "bg-purple-500/15 text-purple-300 border-purple-500/30",
      activeBg: "bg-purple-950/40",
      text: "text-purple-400",
      accent: "#A855F7",
    },
  },
};

export const CUSTOM_OFFER_PRICING = {
  VIDEO_REEL: 3000,           // Montage Vidéo / Reel : 3 000 DA / unité
  GOOGLE_CERTIFICATION: 5000, // Certification Google : 5 000 DA (forfait)
  SITE_VITRINE_BASE: 30000,   // Site Vitrine 4 pages : 30 000 DA
  EXTRA_PAGE: 10000,          // + 1 page supplémentaire : +10 000 DA
  EXTRA_LANGUAGE: 10000,      // + 1 langue supplémentaire (Lange) : +10 000 DA
  MAQUETTE: 1000,             // Maquette : 1 000 DA / unité
  CARROUSEL: 1500,            // Carrousel : 1 500 DA / unité
  VOICE_OVER: 1500,           // Voix off : 1 500 DA / unité
  SITE_ECOMMERCE: 50000,      // Site E-Commerce : 50 000 DA
} as const;

export const CLIENT_STATUSES = {
  IN_PREPARATION: {
    label: "En préparation",
    color: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    dot: "bg-blue-400",
    accent: "#3B82F6",
  },
  ACTIVE: {
    label: "Actif",
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    dot: "bg-emerald-400",
    accent: "#10B981",
  },
  SUSPENDED: {
    label: "Suspendu",
    color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    dot: "bg-amber-400",
    accent: "#F59E0B",
  },
  CONTENTIOUS: {
    label: "Contentieux",
    color: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    dot: "bg-rose-400",
    accent: "#F43F5E",
  },
  NEW: {
    label: "Nouveau",
    color: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    dot: "bg-sky-400",
    accent: "#0EA5E9",
  },
  PENDING_PAYMENT: {
    label: "En attente paiement",
    color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    dot: "bg-amber-400",
    accent: "#F59E0B",
  },
  TERMINATED: {
    label: "Terminé",
    color: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20",
    dot: "bg-neutral-400",
    accent: "#737373",
  },
} as const;

export const CLIENT_MAIN_STATUSES = [
  {
    key: "IN_PREPARATION",
    label: "En préparation",
    dotClass: "bg-blue-400",
    activeClass: "bg-blue-500/20 text-blue-300 border-blue-500/50",
  },
  {
    key: "ACTIVE",
    label: "Actif",
    dotClass: "bg-emerald-400",
    activeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
  },
  {
    key: "SUSPENDED",
    label: "Suspendu",
    dotClass: "bg-amber-400",
    activeClass: "bg-amber-500/20 text-amber-300 border-amber-500/50",
  },
  {
    key: "CONTENTIOUS",
    label: "Contentieux",
    dotClass: "bg-rose-400",
    activeClass: "bg-rose-500/20 text-rose-300 border-rose-500/50",
  },
] as const;

export const PROSPECT_STATUSES = {
  NEW: { label: "Nouveau", color: "bg-sky-500/10 text-sky-500 border-sky-500/20" },
  CONTACTED: { label: "Contacté", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  INTERESTED: { label: "Intéressé", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  MEETING_SCHEDULED: { label: "RDV fixé", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  PROPOSAL_SENT: { label: "Offre envoyée", color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" },
  CONVERTED: { label: "Converti en client", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  NOT_INTERESTED: { label: "Pas intéressé", color: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20" },
  LOST: { label: "Perdu", color: "bg-rose-500/10 text-rose-500 border-rose-500/20" },
} as const;

export const CALL_RESULTS = {
  NO_ANSWER: { label: "Pas de réponse", color: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20" },
  UNREACHABLE: { label: "Injoignable", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  INTERESTED: { label: "Intéressé", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  NOT_INTERESTED: { label: "Pas intéressé", color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  CALLBACK_REQUESTED: { label: "À rappeler", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  APPOINTMENT_BOOKED: { label: "Rendez-vous pris", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
} as const;

export const APPOINTMENT_TYPES = {
  COMMERCIAL_VISIT: "Passage commercial",
  VIDEO: "Visio Google Meet / Zoom",
  PHONE: "Entretien Téléphonique",
  PRESENTATION: "Présentation Agence",
} as const;

export const APPOINTMENT_STATUSES = {
  SCHEDULED: { label: "Planifié", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  COMPLETED: { label: "Effectué", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  CANCELLED: { label: "Annulé", color: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20" },
  NO_SHOW: { label: "Absent (No show)", color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
} as const;

export const FOLLOWUP_STATUSES = {
  SCHEDULED: { label: "Programmée", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  COMPLETED: { label: "Effectuée", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  CONVERTED: { label: "Convertie", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  LOST: { label: "Perdue", color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
} as const;

export const PAYMENT_METHODS = {
  CASH: "Espèces (Cash)",
  BARIDIMOB: "BaridiMob / CCP",
  BANK_TRANSFER: "Virement Bancaire",
  CARD: "Carte CIB / Edahabia",
  OTHER: "Autre",
} as const;

export const AGENCY_DETAILS = {
  name: "BOOSTERA",
  legalName: "BOOSTERA DIGITAL SARL",
  activity: "Agence Digitale, Développement Web, Mobile & SaaS ERP",
  address: "Alger, Algérie",
  wilaya: "Alger, Algérie",
  phone: "+213 (0) 550 12 34 56",
  email: "contact@boostera.digital",
  website: "www.zidane-dev.dz",
  rc: "16/00-0987654B22",
  nif: "002216098765432",
  nis: "002216090012345",
  ai: "16012345678",
  rib: "004 00123 4567890123 45 (Banque Nationale d'Algérie - BNA)",
  ccp: "0012345678 Clé 22",
  capital: "1 000 000 DA",
};

// ----------------------------------------------------
// PHASE 2 : PROJETS, PRODUCTION & DOCUMENTS
// ----------------------------------------------------

export const PROJECT_STATUSES = {
  NEW_REQUEST: {
    label: "Nouvelle Demande",
    shortLabel: "Nouveau",
    color: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    dot: "bg-sky-400",
    step: 1,
  },
  PLANNING: {
    label: "Planification & Brief",
    shortLabel: "Planification",
    color: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
    dot: "bg-indigo-400",
    step: 2,
  },
  IN_PRODUCTION: {
    label: "En Production",
    shortLabel: "Production",
    color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    dot: "bg-amber-400",
    step: 3,
  },
  CLIENT_VALIDATION: {
    label: "Validation Client",
    shortLabel: "Validation",
    color: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    dot: "bg-purple-400",
    step: 4,
  },
  REVISION: {
    label: "Retouches / Révision",
    shortLabel: "Retouches",
    color: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    dot: "bg-orange-400",
    step: 5,
  },
  COMPLETED: {
    label: "Livré & Terminé",
    shortLabel: "Livré",
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    dot: "bg-emerald-400",
    step: 6,
  },
  CANCELLED: {
    label: "Annulé",
    shortLabel: "Annulé",
    color: "bg-neutral-500/15 text-neutral-400 border-neutral-500/30",
    dot: "bg-neutral-400",
    step: 0,
  },
} as const;

export const TASK_STATUSES = {
  TODO: {
    label: "À Faire",
    color: "bg-neutral-800 text-neutral-300 border-neutral-700",
    badge: "bg-neutral-800 text-neutral-300",
    headerBg: "bg-neutral-900/90",
  },
  IN_PROGRESS: {
    label: "En Cours",
    color: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    badge: "bg-blue-500/20 text-blue-300",
    headerBg: "bg-blue-950/40",
  },
  COMPLETED: {
    label: "Terminé / À Valider",
    color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    badge: "bg-amber-500/20 text-amber-300",
    headerBg: "bg-amber-950/40",
  },
  VALIDATED: {
    label: "Validé Client",
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    badge: "bg-emerald-500/20 text-emerald-300",
    headerBg: "bg-emerald-950/40",
  },
} as const;

export const TASK_PRIORITIES = {
  LOW: {
    label: "Basse",
    color: "bg-neutral-800 text-neutral-400 border-neutral-700",
    dot: "bg-neutral-500",
  },
  MEDIUM: {
    label: "Moyenne",
    color: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    dot: "bg-sky-400",
  },
  HIGH: {
    label: "Haute",
    color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    dot: "bg-amber-400",
  },
  URGENT: {
    label: "Urgente",
    color: "bg-rose-500/20 text-rose-400 border-rose-500/40",
    dot: "bg-rose-500",
  },
} as const;

export const DOCUMENT_CATEGORIES = {
  CONTRACT: { label: "Contrats & Accords", icon: "FileCheck" },
  BRIEF: { label: "Briefs & Cahiers des charges", icon: "FileText" },
  MEDIA: { label: "Livrables Médias (Photos, Vidéos)", icon: "Film" },
  INVOICE: { label: "Factures & Devis", icon: "Receipt" },
  HR: { label: "Ressources Humaines", icon: "UserCheck" },
  OTHER: { label: "Autres Documents", icon: "Folder" },
} as const;

export const TASK_PARTS = {
  PART_1: {
    id: "PART_1",
    label: "Phase 1 : Conception & Architecture UI/UX",
    shortLabel: "Phase 1 : Conception & UI/UX",
    badgeColor: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    accentColor: "text-blue-400",
    icon: "Layout",
    description: "Cahier des charges, Wireframes & Maquettes Figma (Web/Mobile), Architecture technique",
  },
  PART_2: {
    id: "PART_2",
    label: "Phase 2 : Développement Web, Mobile & Déploiement",
    shortLabel: "Phase 2 : Dév & Mise en Ligne",
    badgeColor: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    accentColor: "text-purple-400",
    icon: "Code2",
    description: "Développement Frontend & Mobile, Backend APIs, Tests QA, Serveur, Domaine & Stores",
  },
} as const;

export const STANDARD_TASK_TEMPLATES = [
  // PHASE 1 : CONCEPTION & ARCHITECTURE UI/UX
  {
    title: "Cahier des Charges & Spécifications Techniques",
    category: "TECH",
    part: "PART_1" as const,
    partLabel: "Phase 1 : Conception & UI/UX",
    role: "TECH_LEAD",
    defaultHours: 6,
    priority: "HIGH",
    description: "Définition des besoins, fonctionnalités clés, modélisation de données et user stories.",
  },
  {
    title: "Design Maquette UI/UX Figma (Desktop & Mobile)",
    category: "DESIGN",
    part: "PART_1" as const,
    partLabel: "Phase 1 : Conception & UI/UX",
    role: "DESIGNER",
    defaultHours: 12,
    priority: "HIGH",
    description: "Création de la charte graphique, composants UI, prototypes interactifs et parcours utilisateur.",
  },
  {
    title: "Architecture Base de Données & Modélisation",
    category: "TECH",
    part: "PART_1" as const,
    partLabel: "Phase 1 : Conception & UI/UX",
    role: "DEVELOPER",
    defaultHours: 5,
    priority: "MEDIUM",
    description: "Conception du schéma de base de données (PostgreSQL/Prisma), indexation et sécurité.",
  },

  // PHASE 2 : DÉVELOPPEMENT & DÉPLOIEMENT
  {
    title: "Développement Frontend Web Responsive (React / Next.js)",
    category: "WEB",
    part: "PART_2" as const,
    partLabel: "Phase 2 : Dév & Mise en Ligne",
    role: "DEVELOPER",
    defaultHours: 20,
    priority: "HIGH",
    description: "Intégration HTML/Tailwind, pages dynamiques, composants réutilisables et responsive mobile.",
  },
  {
    title: "Développement Application Mobile (iOS / Android)",
    category: "MOBILE",
    part: "PART_2" as const,
    partLabel: "Phase 2 : Dév & Mise en Ligne",
    role: "DEVELOPER",
    defaultHours: 25,
    priority: "HIGH",
    description: "Développement mobile multiplateforme, écrans natifs, notifications push et navigation.",
  },
  {
    title: "Développement Backend & API REST / Authentification",
    category: "BACKEND",
    part: "PART_2" as const,
    partLabel: "Phase 2 : Dév & Mise en Ligne",
    role: "DEVELOPER",
    defaultHours: 15,
    priority: "HIGH",
    description: "Routes API sécurisées, authentification JWT/OAuth, logique métier et rôles utilisateurs.",
  },
  {
    title: "Intégration Paiement Électronique & Passerelles (CIB / Edahabia)",
    category: "PAYMENT",
    part: "PART_2" as const,
    partLabel: "Phase 2 : Dév & Mise en Ligne",
    role: "DEVELOPER",
    defaultHours: 8,
    priority: "URGENT",
    description: "Connexion passerelle de paiement algérienne (Satim / BaridiMob / Stripe), webhooks et reçus.",
  },
  {
    title: "Recette, Tests Fonctionnels & Optimisation Performances",
    category: "QA",
    part: "PART_2" as const,
    partLabel: "Phase 2 : Dév & Mise en Ligne",
    role: "TECH_LEAD",
    defaultHours: 6,
    priority: "HIGH",
    description: "Validation des fonctionnalités sur différents navigateurs/appareils, audits Core Web Vitals.",
  },
  {
    title: "Déploiement Serveur, Domaine, SSL & Mise en Production",
    category: "DEVOPS",
    part: "PART_2" as const,
    partLabel: "Phase 2 : Dév & Mise en Ligne",
    role: "TECH_LEAD",
    defaultHours: 4,
    priority: "URGENT",
    description: "Configuration du serveur (VPS / Cloud), Nginx, certificat SSL HTTPS, DNS et release finale.",
  },
];

export function getTaskPart(task: { title: string; description?: string | null }): "PART_1" | "PART_2" {
  const content = `${task.title} ${task.description || ""}`.toLowerCase();
  
  // Phase 1 : Conception, UI/UX, Spécifications
  if (
    content.includes("maquette") ||
    content.includes("figma") ||
    content.includes("ux") ||
    content.includes("ui") ||
    content.includes("wireframe") ||
    content.includes("design") ||
    content.includes("cahier des charges") ||
    content.includes("brief") ||
    content.includes("spécification") ||
    content.includes("architecture") ||
    content.includes("prototype")
  ) {
    return "PART_1";
  }

  // Phase 2 : Développement, Code, Mobile, Web, APIs, Tests, Déploiement
  return "PART_2";
}


