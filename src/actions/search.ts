"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export interface GlobalSearchClientItem {
  id: string;
  companyName: string;
  contactName: string | null;
  phone: string;
  sector: string;
  wilaya: string | null;
  status: string;
  offerType: string;
}

export interface GlobalSearchProspectItem {
  id: string;
  companyName: string;
  contactName: string | null;
  phone: string;
  sector: string;
  wilaya: string | null;
  status: string;
}

export interface GlobalSearchAppointmentItem {
  id: string;
  title: string;
  startTime: Date;
  location: string | null;
  status: string;
  targetName: string;
}

export interface GlobalSearchProjectItem {
  id: string;
  name: string;
  code: string;
  status: string;
  clientName: string;
}

export interface GlobalSearchUserItem {
  id: string;
  name: string;
  role: string;
  email: string;
}

export interface GlobalSearchPageItem {
  title: string;
  description: string;
  link: string;
  category: string;
}

export interface GlobalSearchResults {
  clients: GlobalSearchClientItem[];
  prospects: GlobalSearchProspectItem[];
  appointments: GlobalSearchAppointmentItem[];
  projects: GlobalSearchProjectItem[];
  collaborators: GlobalSearchUserItem[];
  pages: GlobalSearchPageItem[];
  totalMatches: number;
}

const ERP_PAGES = [
  { title: "Tableau de Bord", description: "Vue d'ensemble, KPIs & chiffres clés", link: "/dashboard", category: "Navigation", keywords: ["dashboard", "accueil", "kpi", "stats", "chiffres"] },
  { title: "Chat Équipe", description: "Messagerie d'équipe en direct & salons", link: "/chat", category: "Communication", keywords: ["chat", "discussion", "equipe", "messages", "general", "commercial"] },
  { title: "Base Prospects", description: "Annuaire complet de tous les prospects", link: "/base-prospects", category: "Commercial", keywords: ["base", "prospects", "annuaire", "leads", "adresses"] },
  { title: "Prospection", description: "Gestion des prospects vierges et qualification", link: "/prospection", category: "Commercial", keywords: ["prospection", "appels", "vierges", "leads", "ventes"] },
  { title: "Journal des Appels", description: "Historique et qualification des appels", link: "/appels", category: "Commercial", keywords: ["appels", "telephonique", "qualification", "historique"] },
  { title: "Rendez-vous", description: "Calendrier et planning des rendez-vous", link: "/rendez-vous", category: "Commercial", keywords: ["rendez-vous", "rdv", "calendrier", "agenda", "visites"] },
  { title: "Relances", description: "Planning des relances et étapes de suivi", link: "/relances", category: "Commercial", keywords: ["relances", "suivi", "followup", "etapes"] },
  { title: "Clients", description: "Portefeuille clients, contrats et abonnements", link: "/clients", category: "Commercial", keywords: ["clients", "abonnements", "packs", "contrats", "portefeuille"] },
  { title: "Projets Web & Mobile", description: "Production technique, sites et applications", link: "/projets", category: "Production", keywords: ["projets", "web", "mobile", "applications", "sites", "dev"] },
  { title: "Abonnements", description: "Packs Starter, Silver, Gold et sur-mesure", link: "/abonnements", category: "Production", keywords: ["abonnements", "packs", "starter", "silver", "gold", "forfaits"] },
  { title: "Production & Kanban", description: "Gestion des tâches et flux de travail", link: "/production", category: "Production", keywords: ["production", "kanban", "taches", "workflow"] },
  { title: "Finance & Encaissements", description: "Suivi des paiements, BaridiMob et caisse", link: "/finance", category: "Finance", keywords: ["finance", "paiements", "encaissements", "baridimob", "caisse"] },
  { title: "Facturation", description: "Devis, factures proforma et règlements", link: "/facturation", category: "Finance", keywords: ["facturation", "factures", "devis", "proforma", "reglements"] },
  { title: "Rentabilité", description: "Analyse des coûts, marges et rentabilité", link: "/rentabilite", category: "Finance", keywords: ["rentabilite", "marges", "couts", "benefices"] },
  { title: "RH & Paie", description: "Employés, pointage, présences et salaires", link: "/rh", category: "Ressources Humaines", keywords: ["rh", "ressources humaines", "pointage", "paie", "salaires", "conges"] },
  { title: "Fournisseurs & Achats", description: "Fournisseurs, commandes et matériel", link: "/fournisseurs", category: "Achats", keywords: ["fournisseurs", "achats", "materiel", "commandes"] },
  { title: "Paramètres Système", description: "Configuration, sauvegardes et mises à jour", link: "/parametres", category: "Système", keywords: ["parametres", "configuration", "mises a jour", "sauvegardes", "systeme"] },
];

/**
 * Recherche globale unifiée sur tout l'ERP
 */
export async function globalSearchAction(query: string): Promise<GlobalSearchResults> {
  await requireAuth();

  const cleanQuery = (query || "").trim();
  if (cleanQuery.length < 1) {
    return {
      clients: [],
      prospects: [],
      appointments: [],
      projects: [],
      collaborators: [],
      pages: ERP_PAGES.slice(0, 6),
      totalMatches: 0,
    };
  }

  const lowerQuery = cleanQuery.toLowerCase();

  // 1. Filtrer les pages / raccourcis système
  const matchedPages: GlobalSearchPageItem[] = ERP_PAGES.filter((p) => {
    return (
      p.title.toLowerCase().includes(lowerQuery) ||
      p.description.toLowerCase().includes(lowerQuery) ||
      p.keywords.some((k) => k.includes(lowerQuery) || lowerQuery.includes(k))
    );
  }).slice(0, 4);

  // 2. Requêtes parallèles en base de données avec Prisma
  const [clients, prospects, appointments, projects, users] = await Promise.all([
    // Clients
    prisma.client.findMany({
      where: {
        OR: [
          { companyName: { contains: cleanQuery, mode: "insensitive" } },
          { brandName: { contains: cleanQuery, mode: "insensitive" } },
          { contactName: { contains: cleanQuery, mode: "insensitive" } },
          { phone: { contains: cleanQuery } },
          { email: { contains: cleanQuery, mode: "insensitive" } },
          { sector: { contains: cleanQuery, mode: "insensitive" } },
          { wilaya: { contains: cleanQuery, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        companyName: true,
        contactName: true,
        phone: true,
        sector: true,
        wilaya: true,
        status: true,
        offerType: true,
      },
      take: 6,
      orderBy: { createdAt: "desc" },
    }),

    // Prospects
    prisma.prospect.findMany({
      where: {
        OR: [
          { companyName: { contains: cleanQuery, mode: "insensitive" } },
          { contactName: { contains: cleanQuery, mode: "insensitive" } },
          { phone: { contains: cleanQuery } },
          { email: { contains: cleanQuery, mode: "insensitive" } },
          { sector: { contains: cleanQuery, mode: "insensitive" } },
          { wilaya: { contains: cleanQuery, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        companyName: true,
        contactName: true,
        phone: true,
        sector: true,
        wilaya: true,
        status: true,
      },
      take: 6,
      orderBy: { createdAt: "desc" },
    }),

    // Rendez-vous
    prisma.appointment.findMany({
      where: {
        OR: [
          { title: { contains: cleanQuery, mode: "insensitive" } },
          { location: { contains: cleanQuery, mode: "insensitive" } },
          { notes: { contains: cleanQuery, mode: "insensitive" } },
          { prospect: { companyName: { contains: cleanQuery, mode: "insensitive" } } },
          { client: { companyName: { contains: cleanQuery, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        location: true,
        status: true,
        prospect: { select: { companyName: true } },
        client: { select: { companyName: true } },
      },
      take: 5,
      orderBy: { startTime: "desc" },
    }),

    // Projets
    prisma.project.findMany({
      where: {
        OR: [
          { name: { contains: cleanQuery, mode: "insensitive" } },
          { code: { contains: cleanQuery, mode: "insensitive" } },
          { description: { contains: cleanQuery, mode: "insensitive" } },
          { client: { companyName: { contains: cleanQuery, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        client: { select: { companyName: true } },
      },
      take: 5,
      orderBy: { createdAt: "desc" },
    }),

    // Collaborateurs
    prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: cleanQuery, mode: "insensitive" } },
          { email: { contains: cleanQuery, mode: "insensitive" } },
          { phone: { contains: cleanQuery } },
        ],
      },
      select: {
        id: true,
        name: true,
        role: true,
        email: true,
      },
      take: 4,
      orderBy: { name: "asc" },
    }),
  ]);

  const formattedAppointments: GlobalSearchAppointmentItem[] = appointments.map((a) => ({
    id: a.id,
    title: a.title,
    startTime: a.startTime,
    location: a.location,
    status: a.status,
    targetName: a.client?.companyName || a.prospect?.companyName || "Non spécifié",
  }));

  const formattedProjects: GlobalSearchProjectItem[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    status: p.status,
    clientName: p.client?.companyName || "Client inconnu",
  }));

  const totalMatches =
    clients.length +
    prospects.length +
    formattedAppointments.length +
    formattedProjects.length +
    users.length +
    matchedPages.length;

  return {
    clients: clients.map((c) => ({ ...c, status: String(c.status), offerType: String(c.offerType) })),
    prospects: prospects.map((p) => ({ ...p, status: String(p.status) })),
    appointments: formattedAppointments,
    projects: formattedProjects,
    collaborators: users.map((u) => ({ ...u, role: String(u.role) })),
    pages: matchedPages,
    totalMatches,
  };
}
