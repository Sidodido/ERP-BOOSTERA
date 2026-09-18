"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getResolvedGeminiApiKey, getResolvedOpenAiApiKey } from "@/lib/aiConfig";
import { ProspectStatus, CallResult, AppointmentStatus, FollowUpStatus, OfferType } from "@prisma/client";

export interface CommercialAiStats {
  virginProspectsCount: number;
  totalAssignedProspects: number;
  interestedProspectsCount: number;
  todayCallsCount: number;
  todayInterestedCalls: number;
  upcomingAppointmentsCount: number;
  pendingFollowUpsCount: number;
  activeClientsCount: number;
}

export interface CommercialAiContext {
  userName: string;
  userRole: string;
  stats: CommercialAiStats;
  topVirginProspects: Array<{
    id: string;
    companyName: string;
    sector: string;
    wilaya: string;
    phone: string;
  }>;
  topInterestedProspects: Array<{
    id: string;
    companyName: string;
    sector: string;
    wilaya: string;
    phone: string;
    response?: string | null;
    notes?: string | null;
  }>;
  recentCalls: Array<{
    id: string;
    targetName: string;
    result: string;
    duration: number;
    calledAt: string;
    comment?: string | null;
  }>;
  upcomingAppointments: Array<{
    id: string;
    title: string;
    targetName: string;
    startTime: string;
    type: string;
    location?: string | null;
    notes?: string | null;
    phone?: string | null;
  }>;
  pendingFollowUps: Array<{
    id: string;
    prospectId: string;
    prospectName: string;
    phone: string;
    scheduledAt: string;
    stepNumber: number;
    notes?: string | null;
    isOverdue: boolean;
  }>;
  activeClients: Array<{
    id: string;
    companyName: string;
    offerType: string;
    phone: string;
    sector: string;
  }>;
  sectorsList: string[];
  wilayasList: string[];
  aiConnected: {
    gemini: boolean;
    openai: boolean;
  };
}

/**
 * Récupère l'ensemble des données réelles du commercial connecté
 */
export async function getCommercialAiContextAction(overrideUserId?: string): Promise<CommercialAiContext> {
  let user: { id: string; name: string; role: string };
  if (overrideUserId) {
    const found = await prisma.user.findUnique({ where: { id: overrideUserId } });
    if (found) {
      user = { id: found.id, name: found.name, role: found.role };
    } else {
      user = await requireAuth();
    }
  } else {
    user = await requireAuth();
  }

  const isPrivileged = ["ADMIN", "SALES_DIRECTOR"].includes(user.role);

  const prospectScope = isPrivileged ? {} : { assignedToId: user.id };
  const userScope = isPrivileged ? {} : { userId: user.id };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // 1. Statistiques globales
  const [
    totalAssignedProspects,
    virginProspectsCount,
    interestedProspectsCount,
    todayCallsCount,
    todayInterestedCalls,
    upcomingAppointmentsCount,
    pendingFollowUpsCount,
    activeClientsCount,
  ] = await Promise.all([
    prisma.prospect.count({ where: prospectScope }),
    prisma.prospect.count({
      where: {
        ...prospectScope,
        status: ProspectStatus.NEW,
        OR: [
          { callStatus: null },
          { callStatus: "" },
          { callStatus: "NON EFFECTUE" },
          { callStatus: "PAS DE CONTACT" },
        ],
      },
    }),
    prisma.prospect.count({
      where: {
        ...prospectScope,
        status: ProspectStatus.INTERESTED,
      },
    }),
    prisma.call.count({
      where: {
        ...userScope,
        calledAt: { gte: todayStart },
      },
    }),
    prisma.call.count({
      where: {
        ...userScope,
        calledAt: { gte: todayStart },
        result: CallResult.INTERESTED,
      },
    }),
    prisma.appointment.count({
      where: {
        ...userScope,
        startTime: { gte: new Date() },
        status: AppointmentStatus.SCHEDULED,
      },
    }),
    prisma.followUp.count({
      where: {
        ...userScope,
        status: FollowUpStatus.SCHEDULED,
      },
    }),
    prisma.client.count({
      where: isPrivileged ? {} : { assignedToId: user.id },
    }),
  ]);

  // 2. Échantillon de prospects vierges pour qualification & pitch
  const rawVirgin = await prisma.prospect.findMany({
    where: {
      ...prospectScope,
      status: ProspectStatus.NEW,
      OR: [
        { callStatus: null },
        { callStatus: "" },
        { callStatus: "NON EFFECTUE" },
        { callStatus: "PAS DE CONTACT" },
      ],
    },
    take: 12,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      companyName: true,
      sector: true,
      wilaya: true,
      phone: true,
    },
  });

  // 3. Prospects intéressés
  const rawInterested = await prisma.prospect.findMany({
    where: {
      ...prospectScope,
      status: ProspectStatus.INTERESTED,
    },
    take: 10,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      companyName: true,
      sector: true,
      wilaya: true,
      phone: true,
      response: true,
      notes: true,
    },
  });

  // 4. Derniers appels
  const rawCalls = await prisma.call.findMany({
    where: userScope,
    take: 8,
    orderBy: { calledAt: "desc" },
    select: {
      id: true,
      calledAt: true,
      result: true,
      durationSeconds: true,
      comment: true,
      prospect: { select: { companyName: true } },
      client: { select: { companyName: true } },
    },
  });

  // 5. Prochains Rendez-vous
  const rawAppointments = await prisma.appointment.findMany({
    where: {
      ...userScope,
      startTime: { gte: new Date() },
      status: AppointmentStatus.SCHEDULED,
    },
    take: 6,
    orderBy: { startTime: "asc" },
    select: {
      id: true,
      title: true,
      startTime: true,
      type: true,
      location: true,
      notes: true,
      prospect: { select: { companyName: true, phone: true } },
      client: { select: { companyName: true, phone: true } },
    },
  });

  // 6. Relances en attente
  const now = new Date();
  const rawFollowUps = await prisma.followUp.findMany({
    where: {
      ...userScope,
      status: FollowUpStatus.SCHEDULED,
    },
    take: 8,
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true,
      prospectId: true,
      stepNumber: true,
      scheduledAt: true,
      notes: true,
      prospect: {
        select: { companyName: true, phone: true },
      },
    },
  });

  // 7. Clients actifs
  const rawClients = await prisma.client.findMany({
    where: isPrivileged ? {} : { assignedToId: user.id },
    take: 8,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      companyName: true,
      offerType: true,
      phone: true,
      sector: true,
    },
  });

  // 8. Extraction des secteurs et wilayas distincts
  const sectorsResult = await prisma.prospect.findMany({
    where: prospectScope,
    select: { sector: true },
    distinct: ["sector"],
    take: 20,
  });
  const wilayasResult = await prisma.prospect.findMany({
    where: prospectScope,
    select: { wilaya: true },
    distinct: ["wilaya"],
    take: 20,
  });

  const geminiKey = getResolvedGeminiApiKey();
  const openAiKey = getResolvedOpenAiApiKey();

  return {
    userName: user.name,
    userRole: user.role,
    stats: {
      totalAssignedProspects,
      virginProspectsCount,
      interestedProspectsCount,
      todayCallsCount,
      todayInterestedCalls,
      upcomingAppointmentsCount,
      pendingFollowUpsCount,
      activeClientsCount,
    },
    topVirginProspects: rawVirgin,
    topInterestedProspects: rawInterested,
    recentCalls: rawCalls.map((c) => ({
      id: c.id,
      targetName: c.prospect?.companyName || c.client?.companyName || "Contact direct",
      result: c.result,
      duration: c.durationSeconds || 0,
      calledAt: c.calledAt.toISOString(),
      comment: c.comment,
    })),
    upcomingAppointments: rawAppointments.map((a) => ({
      id: a.id,
      title: a.title,
      targetName: a.prospect?.companyName || a.client?.companyName || "Prospect",
      startTime: a.startTime.toISOString(),
      type: a.type,
      location: a.location,
      notes: a.notes,
      phone: a.prospect?.phone || a.client?.phone || null,
    })),
    pendingFollowUps: rawFollowUps.map((f) => ({
      id: f.id,
      prospectId: f.prospectId,
      prospectName: f.prospect.companyName,
      phone: f.prospect.phone,
      scheduledAt: f.scheduledAt.toISOString(),
      stepNumber: f.stepNumber,
      notes: f.notes,
      isOverdue: f.scheduledAt < now,
    })),
    activeClients: rawClients.map((cl) => ({
      id: cl.id,
      companyName: cl.companyName,
      offerType: cl.offerType,
      phone: cl.phone,
      sector: cl.sector,
    })),
    sectorsList: sectorsResult.map((s) => s.sector).filter(Boolean),
    wilayasList: wilayasResult.map((w) => w.wilaya).filter(Boolean),
    aiConnected: {
      gemini: Boolean(geminiKey && geminiKey.length > 5),
      openai: Boolean(openAiKey && openAiKey.length > 5),
    },
  };
}

/**
 * Moteur unifié d'inférence IA avec cascade : Gemini -> OpenAI -> Algorithmique local
 */
async function callAiEngine(systemPrompt: string, userPrompt: string): Promise<{
  reply: string;
  source: "GEMINI_AI" | "OPENAI_CHATGPT" | "LOCAL_AI";
  modelUsed: string;
}> {
  const geminiKey = getResolvedGeminiApiKey();
  const openAiKey = getResolvedOpenAiApiKey();

  // 1. Essai avec Google Gemini
  if (geminiKey) {
    const CANDIDATE_MODELS = [
      "gemini-flash-lite-latest",
      "gemini-flash-latest",
      "gemini-pro-latest",
      "gemini-2.5-flash",
    ];

    for (const model of CANDIDATE_MODELS) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 16000);

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: `${systemPrompt}\n\nREQUÊTE DU COMMERCIAL :\n${userPrompt}` }],
              },
            ],
            generationConfig: {
              temperature: 0.75,
              maxOutputTokens: 2500,
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && text.trim().length > 0) {
            return {
              reply: text.trim(),
              source: "GEMINI_AI",
              modelUsed: `Gemini (${model})`,
            };
          }
        }
      } catch (err) {
        console.warn(`Tentative Gemini ${model} échouée, passage au suivant...`);
      }
    }
  }

  // 2. Essai avec OpenAI ChatGPT
  if (openAiKey) {
    const CANDIDATE_MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"];
    for (const model of CANDIDATE_MODELS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 16000);

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openAiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.75,
            max_tokens: 2500,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const text = data?.choices?.[0]?.message?.content;
          if (text && text.trim().length > 0) {
            return {
              reply: text.trim(),
              source: "OPENAI_CHATGPT",
              modelUsed: `ChatGPT (${model})`,
            };
          }
        }
      } catch (err) {
        console.warn(`Tentative OpenAI ${model} échouée...`);
      }
    }
  }

  // 3. Fallback Algorithmique Local Intelligent
  return {
    reply: generateLocalCommercialAdvice(userPrompt),
    source: "LOCAL_AI",
    modelUsed: "Moteur Expert Local BOOSTERA",
  };
}

/**
 * Générateur local de secours si aucune API n'est disponible
 */
function generateLocalCommercialAdvice(prompt: string): string {
  const p = prompt.toLowerCase();

  if (p.includes("trop cher") || p.includes("prix") || p.includes("tarif")) {
    return `### 💡 Comment désamorcer l'objection "C'est trop cher" :

1. **Recadrer sur le Retour sur Investissement (ROI)** :
   « *Je comprends tout à fait Monsieur/Madame. Mais laissez-moi vous poser une question : combien vous rapporte en moyenne un nouveau client dans votre activité ? Si notre pack à 35 000 DA vous apporte seulement 2 à 3 nouveaux clients par mois, votre investissement est déjà plus que rentabilisé.* »

2. **Décomposer le coût journalier** :
   « *Le pack Starter revient à environ 1 100 DA par jour. C'est moins que le coût d'un café et d'un déjeuner, pour une présence professionnelle complète avec shooting, carrousels et gestion sur les réseaux sociaux.* »

3. **Question de relance** :
   « *Par rapport à quoi trouvez-vous cela élevé ? Avez-vous déjà testé des campagnes sponsorisées ou une agence par le passé ?* »`;
  }

  if (p.includes("devis") || p.includes("whatsapp")) {
    return `### 📲 Réponse à : "Envoyez-moi un devis sur WhatsApp" :

*Piège à éviter : Envoyer un PDF sec sans engagement, le prospect ne répondra plus jamais.*

**Script recommandé au téléphone :**
« *Avec grand plaisir ! Je vous envoie notre présentation détaillée sur WhatsApp dès la fin de notre échange. Cependant, chaque secteur est unique : afin que je vous envoie la formule la plus adaptée avec des exemples réels de réussites similaires à la vôtre, dites-moi en 30 secondes : quel est votre canal principal aujourd'hui (Instagram ou Facebook) ?* »

Puis conclure par un créneau de calage :
« *Je vous laisse consulter les 3 pages, et je vous rappelle demain à 11h ou 15h pour recueillir vos premières impressions, quel horaire vous arrange le mieux ?* »`;
  }

  if (p.includes("déjà") || p.includes("agence") || p.includes("communauté")) {
    return `### 🥊 Réponse à : "On travaille déjà avec une agence / un community manager" :

« *C'est excellent ! Cela prouve que vous avez compris toute l'importance du digital pour votre entreprise.*

*Notre but n'est absolument pas de perturber ce qui fonctionne bien chez vous. En revanche, beaucoup de nos clients actuels avaient déjà un community manager, mais constataient un manque cruel de régularité, pas de vidéos Reels qualitatives, ou aucun suivi concret sur les ventes.*

*Est-ce que vous seriez ouvert à un audit comparatif gratuit de 10 minutes pour voir ce qui pourrait être amélioré sur votre visibilité ?* »`;
  }

  return `### 🎯 Recommandation Commerciale BOOSTERA :

Pour maximiser votre taux de conversion aujourd'hui :
- **Priorité 1** : Traiter en premier vos relances en attente (+3 jours et +7 jours).
- **Priorité 2** : Appeler les prospects qualifiés "Intéressé" pour verrouiller un rendez-vous (visio ou sur place).
- **Règle d'or BOOSTERA** : Ne vendez jamais un "pack" mais une **solution business** (acquisition de nouveaux clients réguliers, notoriété locale, professionnalisme de la marque).

*Besoin d'un script spécifique ou d'une relance WhatsApp ? Posez votre question précise !*`;
}

/**
 * Chat conversationnel commercial connecté au CRM
 */
export async function askCommercialAiAction(params: {
  prompt: string;
  section?: string;
  overrideUserId?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  const context = await getCommercialAiContextAction(params.overrideUserId);

  const systemPrompt = `Tu es l'Assistant IA Commercial Senior de l'agence digitale algérienne BOOSTERA.
Tu accompagnes le commercial connecté : ${context.userName} (Rôle : ${context.userRole}).

DONNÉES EN TEMPS RÉEL DU COMMERCIAL :
- Prospects vierges à prospecter : ${context.stats.virginProspectsCount}
- Total prospects assignés : ${context.stats.totalAssignedProspects}
- Prospects actuellement qualifiés "INTÉRESSÉ" : ${context.stats.interestedProspectsCount}
- Appels passés aujourd'hui : ${context.stats.todayCallsCount} (dont ${context.stats.todayInterestedCalls} intéressés)
- Rendez-vous à venir : ${context.stats.upcomingAppointmentsCount}
- Relances en attente : ${context.stats.pendingFollowUpsCount}
- Clients actifs sous contrat : ${context.stats.activeClientsCount}

PROCHAINES ÉCHÉANCES RÉELLES DU COMMERCIAL :
- Prochains RDVs : ${
    context.upcomingAppointments.length > 0
      ? context.upcomingAppointments
          .map((a) => `• ${a.title} avec ${a.targetName} (${new Date(a.startTime).toLocaleDateString("fr-FR")} à ${new Date(a.startTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })})`)
          .join("\n")
      : "Aucun RDV immédiat programmé"
  }
- Relances urgentes : ${
    context.pendingFollowUps.length > 0
      ? context.pendingFollowUps
          .map((f) => `• Relance Étape ${f.stepNumber} pour ${f.prospectName} (${f.phone}) - Échéance : ${new Date(f.scheduledAt).toLocaleDateString("fr-FR")}${f.isOverdue ? " [EN RETARD !]" : ""}`)
          .join("\n")
      : "Aucune relance en retard"
  }
- Exemples de prospects qualifiés intéressés : ${
    context.topInterestedProspects.length > 0
      ? context.topInterestedProspects.map((p) => `• ${p.companyName} (${p.sector}, ${p.wilaya}) - Tél: ${p.phone}`).join("\n")
      : "Aucun"
  }

GRILLE TARIFAIRE BOOSTERA (MARCHÉ ALGÉRIEN) :
1. **Pack STARTER** (35 000 DA/mois) : 4 publications/mois (2 Carrousels + 2 Maquettes graphiques). Idéal pour débuter et poser les bases de la marque.
2. **Pack SILVER** (65 000 DA/mois) : 8 publications/mois (3 Carrousels + 3 Maquettes + 2 Reels 9:16 dont 1 avec Voix Off). Formule la plus populaire.
3. **Pack GOLD** (95 000 DA/mois) : 12 publications/mois (4 Carrousels + 4 Maquettes + 4 Reels 9:16 dont 2 Voix Off). Croissance maximale et omniprésence.

CONSIGNES DE RÉPONSE :
- Réponds toujours en français professionnel, percutant et adapté au marché des PME, cliniques et commerces en Algérie.
- Fournis des scripts prêts à l'emploi (mot-à-mot), des messages WhatsApp faciles à copier-coller avec emojis, et des conseils stratégiques concrets.
- Si le commercial demande des suggestions sur ses vraies données, cite précisément ses prospects, ses rendez-vous ou ses relances mentionnés ci-dessus.`;

  return await callAiEngine(systemPrompt, params.prompt);
}

/**
 * 1. Générateur de Script d'Appel à Froid (Cold Calling) par Secteur & Wilaya
 */
export async function generateColdPitchAction(params: {
  sector: string;
  wilaya?: string;
  prospectName?: string;
  prospectPhone?: string;
}) {
  const { sector, wilaya = "Alger", prospectName, prospectPhone } = params;

  const systemPrompt = `Tu es l'expert n°1 du Cold Calling en Algérie pour l'agence digitale BOOSTERA.
Ta mission est de fournir 3 scripts d'appel téléphonique percutants pour démarcher une entreprise du secteur : "${sector}" à "${wilaya}".
Nom de l'entreprise ciblée : ${prospectName || "Entreprise ciblée"}.
Numéro : ${prospectPhone || "Numéro professionnel"}.

Les 3 scripts doivent être très différents :
1. **Accroche Problème / Visibilité** : Met en avant le manque de publications récentes ou l'absence de vidéos Reels courtes.
2. **Accroche Concurrence / Opportunité Locale** : Souligne que les concurrents de la même wilaya captent les clients sur Instagram/TikTok.
3. **Accroche Directe & Chiffrée** : Propose un test ou un audit rapide sans engagement.

Format de réponse clair avec titres en gras, phrases mot-à-mot à prononcer, et questions de qualification. Mentionne l'agence BOOSTERA.`;

  return await callAiEngine(
    systemPrompt,
    `Rédige 3 scripts de prospection téléphonique pour ${prospectName || "un prospect"} dans le secteur ${sector} (${wilaya}).`
  );
}

/**
 * 2. Désamorceur d'Objections en Direct
 */
export async function generateObjectionResponseAction(params: {
  objectionKey: string;
  customObjection?: string;
  sector?: string;
}) {
  const { objectionKey, customObjection, sector } = params;

  const systemPrompt = `Tu es le Directeur Commercial de l'agence BOOSTERA.
Ta mission est d'armer le commercial avec une réponse chirurgicale et imparable à une objection client fréquente sur le marché algérien.

Secteur du client : ${sector || "Entreprise / Commerce en Algérie"}.
Objection rencontrée : "${customObjection || objectionKey}".

STRUCTURE OBLIGATOIRE DE TA RÉPONSE :
1. **Principe psychologique** : Pourquoi le prospect dit cela (peur, habitude, manque de budget perçu).
2. **Ce qu'il ne faut SURTOUT PAS dire** : L'erreur typique des commerciaux juniors.
3. **Le Script Mot-à-Mot (Méthode BOOSTERA)** : La réponse exacte à prononcer avec ton assuré.
4. **La Question de Rebond immédiate** : Pour reprendre la main et closer le rendez-vous.`;

  return await callAiEngine(
    systemPrompt,
    `Donne-moi la parade complète contre l'objection : "${customObjection || objectionKey}".`
  );
}

/**
 * 3. Générateur de Message de Relance Personnalisé (WhatsApp / SMS / Email)
 */
export async function generateFollowUpMessageAction(params: {
  prospectId?: string;
  companyName: string;
  contactName?: string;
  phone?: string;
  stepNumber: number;
  channel: "WHATSAPP" | "SMS" | "EMAIL";
  lastNotes?: string;
}) {
  const { companyName, contactName, phone, stepNumber, channel, lastNotes } = params;

  const systemPrompt = `Tu es le copywriter commercial senior de l'agence BOOSTERA.
Rédige un message de relance ultra-professionnel et engageant pour le canal : ${channel}.

DESTINATAIRE :
- Entreprise : "${companyName}"
- Interlocuteur : "${contactName || "Monsieur/Madame"}"
- Téléphone : "${phone || "Non spécifié"}"
- Étape de relance : Étape ${stepNumber} (${stepNumber === 1 ? "3 jours après premier contact" : stepNumber === 2 ? "7 jours après" : "15 jours - Dernière relance"})
- Contexte / Dernières notes : "${lastNotes || "Prospect intéressé par notre offre mais n'a pas confirmé"}"

CONSIGNES :
${
  channel === "WHATSAPP"
    ? "- Format WhatsApp : texte aéré, émoticônes professionnels, mise en gras des points forts (*texte*), appel à l'action direct (ex: Répondez OUI ou fixons un appel de 5 min)."
    : channel === "SMS"
    ? "- Format SMS : court, percutant, moins de 160 caractères, lien vers l'agence ou proposition d'horaire d'appel."
    : "- Format Email : Objet accrocheur avec taux d'ouverture élevé, corps structuré avec bullet points et formule de politesse."
}
Rédige le message final prêt à être envoyé.`;

  return await callAiEngine(
    systemPrompt,
    `Rédige le message de relance ${channel} étape ${stepNumber} pour ${companyName}.`
  );
}

/**
 * 4. Fiche de Préparation de Rendez-vous Client (Closing Sheet)
 */
export async function generateMeetingPrepAction(params: {
  appointmentId?: string;
  companyName: string;
  sector: string;
  meetingType: string;
  notes?: string;
}) {
  const { companyName, sector, meetingType, notes } = params;

  const systemPrompt = `Tu es le Directeur Commercial de l'agence BOOSTERA.
Rédige une FICHE STRATÉGIQUE DE FERMETURE (Closing Sheet) pour le commercial qui s'apprête à animer un rendez-vous :
- Client / Prospect : "${companyName}"
- Secteur : "${sector}"
- Type de rendez-vous : "${meetingType}"
- Notes préalables : "${notes || "Premier rendez-vous commercial pour présentation des offres"}"

STRUCTURE DE LA FICHE :
1. **Profil & Enjeux Stratégiques du secteur ${sector}** : Quels sont les besoins vitaux de ce type d'entreprise en Algérie.
2. **Les 3 Questions de Découverte Clés** : Questions puissantes pour révéler la douleur du prospect et ses objectifs.
3. **L'Offre Idéale Recommandée** : Choisis entre Starter (35 000 DA), Silver (65 000 DA) ou Gold (95 000 DA) avec les arguments précis qui justifient ce tarif.
4. **Anticipation de la Décision** : Comment verrouiller la signature à la fin de la réunion (modalités de paiement BaridiMob / Virement, date de lancement du shooting).`;

  return await callAiEngine(
    systemPrompt,
    `Génère la fiche de préparation au closing pour le rendez-vous avec ${companyName} (${sector}).`
  );
}

/**
 * 5. Recommandation d'Upsell / Renouvellement Client
 */
export async function generateClientUpsellAction(params: {
  clientName: string;
  currentOffer: OfferType;
  sector: string;
}) {
  const { clientName, currentOffer, sector } = params;

  const nextOffer =
    currentOffer === "STARTER" ? "SILVER (65 000 DA/mois)" : currentOffer === "SILVER" ? "GOLD (95 000 DA/mois)" : "Pack SUR-MESURE & Campagnes Meta Ads";

  const systemPrompt = `Tu es le Directeur de Clientèle de l'agence BOOSTERA.
Un client actuel sous pack "${currentOffer}" (${clientName}, secteur ${sector}) est satisfait de nos prestations.
Rédige une proposition d'évolution naturelle (Upsell) vers le pack supérieur : "${nextOffer}".

INCLUS DANS LA PROPOSITION :
1. Bilan valorisant : Féliciter le client pour les premiers résultats obtenus.
2. Pourquoi franchir le palier supérieur maintenant (ex: passage à la vidéo Reel, voix-off professionnelle, fréquence accrue).
3. Le pitch de présentation mot-à-mot à tenir au téléphone ou en réunion bilan.
4. Un message WhatsApp récapitulatif doux et engageant.`;

  return await callAiEngine(
    systemPrompt,
    `Rédige la stratégie d'upsell pour faire passer ${clientName} du pack ${currentOffer} au pack ${nextOffer}.`
  );
}
