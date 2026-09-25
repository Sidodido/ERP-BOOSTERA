import { OfferType } from "@prisma/client";
import {
  EditorialPlanResult,
  PublicationProposal,
  EditorialTheme,
  WEEKLY_QUOTAS_BY_OFFER,
  STRATEGIC_GOALS,
  generateAiEditorialPlan,
} from "./aiContentGenerator";
import { getResolvedOpenAiApiKey } from "./aiConfig";

export interface GenerateWithOpenAiParams {
  clientName: string;
  brandName?: string | null;
  sector: string;
  wilaya?: string | null;
  offerType: OfferType;
  facebook?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  goal?: string;
  monthName?: string;
  seed?: number;
  apiKey?: string;
  model?: string;
}

export interface OpenAiGenerationResult {
  success: boolean;
  source: "OPENAI_CHATGPT" | "LOCAL_ENGINE";
  modelUsed?: string;
  plan: EditorialPlanResult;
  notice?: string;
  error?: string;
}

/**
 * Moteur de génération IA propulsé par OpenAI (ChatGPT / GPT-4o-mini / GPT-4o)
 * avec fallback algorithmique si la clé est absente ou le service indisponible.
 */
export async function generateEditorialPlanWithOpenAi(
  params: GenerateWithOpenAiParams
): Promise<OpenAiGenerationResult> {
  const apiKey = getResolvedOpenAiApiKey(params.apiKey);

  // Si pas de clé OpenAI, fallback propre et immédiat
  if (!apiKey) {
    const fallbackPlan = generateAiEditorialPlan(params);
    return {
      success: true,
      source: "LOCAL_ENGINE",
      plan: fallbackPlan,
      notice:
        "Moteur Local actif. Pour activer l'intelligence en direct avec ChatGPT, configurez votre clé OPENAI_API_KEY.",
    };
  }

  const {
    clientName,
    brandName,
    sector,
    wilaya = "Alger",
    offerType = "STARTER",
    facebook,
    instagram,
    tiktok,
    phone,
    email,
    notes,
    goal = "ALL_ROUND",
    monthName = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
      new Date()
    ),
    seed = 0,
    model = "gpt-4o-mini",
  } = params;

  const displayName = brandName?.trim() || clientName.trim();
  const quota = WEEKLY_QUOTAS_BY_OFFER[offerType] || WEEKLY_QUOTAS_BY_OFFER.STARTER;
  const goalInfo = STRATEGIC_GOALS[goal] || STRATEGIC_GOALS.ALL_ROUND;

  const CANDIDATE_MODELS = [model, "gpt-4o-mini", "gpt-4o"];

  // Construction du prompt structuré
  const systemPrompt = `Tu es le Directeur de Création et Stratège Social Media Senior de l'agence digitale algérienne BOOSTERA.
Ta mission est de concevoir un calendrier de contenu éditorial mensuel ultra-performant, percutant et réaliste pour le marché algérien (${wilaya || "Algérie"}).

DONNÉES DU CLIENT & SES RÉSEAUX SOCIAUX (MÉDIAS DU CLIENT) :
- Entreprise / Marque : "${displayName}" (Raison sociale : "${clientName}")
- Secteur d'activité : "${sector}"
- Localisation / Wilaya : "${wilaya || "Algérie"}"
- Compte Instagram : ${instagram ? `"${instagram}"` : "Non spécifié (optimise pour Reels dynamiques, Stories interactives et Carrousels esthétiques)"}
- Page Facebook : ${facebook ? `"${facebook}"` : "Non spécifiée (optimise pour l'engagement communautaire, partages et questions)"}
- Compte TikTok : ${tiktok ? `"${tiktok}"` : "Non spécifié (optimise pour formats courts verticaux viraux)"}
- Contact WhatsApp / Tél : ${phone ? `"${phone}"` : "Numéro de contact de l'entreprise"}
- Email : ${email ? `"${email}"` : "Non spécifié"}
- Notes & Contexte spécifique : ${notes ? `"${notes}"` : "Aucun historique spécifique"}
- Pack souscrit : ${quota.label} (${quota.tagline})
- Objectif stratégique : ${goalInfo.label} (${goalInfo.description})
- Mois concerné : ${monthName}
- Numéro de lot (seed) : ${seed} (CRÉATIVITÉ MAXIMALE : produis des thèmes et idées 100% uniques et différents des précédents lots !)

CONSIGNE STRICTE D'ORIGINALITÉ (THÈMES ILLIMITÉS SANS TOURNER EN BOUCLE) :
L'utilisateur exige une créativité ILLIMITÉE. À chaque régénération (Lot seed: ${seed}), tu DOIS impérativement renouveler à 100% les angles d'attaque et les thématiques proposées.
Ne propose JAMAIS les mêmes thèmes répétitifs !
Propose entre 3 et 5 thèmes stratégiques variés, riches et originaux dans le tableau "themes".
Puis dans les publications, adapte le ton aux réseaux du client (${instagram || "Instagram"}, ${facebook || "Facebook"}, ${tiktok || "TikTok"}) :
- Storytelling fort de la marque "${displayName}" et valeur ajoutée
- Débunking d'idées reçues / Vrai ou Faux adapté à ${sector} en Algérie
- Tutos "Pas-à-pas" et guides pratiques ultra-sauvegardables (format carrousel)
- Coulisses inédites, anecdotes de l'équipe et fabrication
- Preuve sociale, avis clients, cas réels ou avant/après
- Offres irrésistibles, promotions et gamification (sondages, quiz, concours)
- Réalités locales de ${wilaya || "Alger"} (dîner en famille, pause midi, BaridiMob, livraison, etc.)

RÈGLES CONTRACTUELLES STRICTES SELON LE PACK (NE JAMAIS DÉVIER) :
${
  offerType === "STARTER"
    ? `- Pack STARTER : Exactement 4 publications au total (1 par semaine).
- FORMATS STRICTS : EXACTEMENT 2 Carrousels (slides 1 à 6) et 2 Maquettes graphiques (post statique). ZÉRO REELS VIDÉO.`
    : offerType === "SILVER"
    ? `- Pack SILVER : Exactement 8 publications au total (2 par semaine).
- FORMATS STRICTS : EXACTEMENT 3 Carrousels + 3 Maquettes graphiques + 2 Vidéos Reels 9:16 (dont 1 Reel avec Voix Off).`
    : offerType === "GOLD"
    ? `- Pack GOLD : Exactement 12 publications au total (3 par semaine).
- FORMATS STRICTS : EXACTEMENT 4 Carrousels + 4 Maquettes graphiques + 4 Vidéos Reels 9:16 (dont 2 Reels avec Voix Off).`
    : `- Pack SUR-MESURE : 8 publications réparties sur 4 semaines.`
}

STRUCTURE PAR SEMAINE OBLIGATOIRE :
${
  offerType === "STARTER"
    ? `Semaine 1: 1 Maquette Design (STATIC_POST)
Semaine 2: 1 Carrousel (CAROUSEL)
Semaine 3: 1 Maquette Design (STATIC_POST)
Semaine 4: 1 Carrousel (CAROUSEL)`
    : offerType === "SILVER"
    ? `Semaine 1: 1 Maquette (STATIC_POST) + 1 Carrousel (CAROUSEL)
Semaine 2: 1 Reel avec Voix Off (REEL_9_16) + 1 Maquette (STATIC_POST)
Semaine 3: 1 Carrousel (CAROUSEL) + 1 Maquette (STATIC_POST)
Semaine 4: 1 Reel (REEL_9_16) + 1 Carrousel (CAROUSEL)`
    : offerType === "GOLD"
    ? `Semaine 1: 1 Maquette (STATIC_POST) + 1 Carrousel (CAROUSEL) + 1 Reel avec Voix Off (REEL_9_16)
Semaine 2: 1 Maquette (STATIC_POST) + 1 Carrousel (CAROUSEL) + 1 Reel (REEL_9_16)
Semaine 3: 1 Maquette (STATIC_POST) + 1 Carrousel (CAROUSEL) + 1 Reel avec Voix Off (REEL_9_16)
Semaine 4: 1 Maquette (STATIC_POST) + 1 Carrousel (CAROUSEL) + 1 Reel (REEL_9_16)`
    : `4 semaines avec 2 publications par semaine`
}

TON ET STYLE POUR L'ALGÉRIE :
- Professionnel, moderne, accrocheur, adapté aux habitudes de consommation en Algérie.
- Mentionne les réalités locales de ${wilaya || "Alger"}, prix en DA si pertinent, commande via DM / WhatsApp au ${phone || "numéro affiché"}.
- Rédige en français soigné avec expressions ou touches algériennes valorisantes.
- Fournis des accroches (hooks) percutantes de 0 à 3 secondes ou pour le slide 1.

FORMAT DE RÉPONSE OBLIGATOIRE :
Tu DOIS impérativement répondre UNIQUEMENT avec un objet JSON valide avec cette structure exacte :

{
  "strategicSummary": "Court résumé de la stratégie",
  "themes": [
    {
      "id": "theme-1",
      "pillar": "Pilier stratégique (ex: Storytelling & Identité)",
      "title": "Titre accrocheur du thème",
      "description": "Description stratégique du thème",
      "color": "from-purple-600 to-indigo-600"
    }
  ],
  "publications": [
    {
      "week": 1,
      "weekLabel": "Semaine 1 (Semaine 1/4)",
      "daySuggestion": "Mardi (18h)",
      "theme": "Nom du thème correspondant",
      "title": "Titre percutant de la publication",
      "format": "STATIC_POST ou CAROUSEL ou REEL_9_16",
      "formatLabel": "Maquette Design Graphique ou Carrousel (5-7 slides) ou Reel 9:16",
      "hook": "Accroche percutante 0-3s ou titre Slide 1",
      "scriptOrSlides": [
        {
          "step": "Slide 1 ou 0s-4s",
          "description": "Ce qu'on montre ou ce qui est dit",
          "visualTip": "Conseil de design ou cadrage"
        }
      ],
      "caption": "Texte complet de la publication avec émoticônes",
      "cta": "Appel à l'action précis (DM, WhatsApp, commentaire)",
      "hashtags": ["motcle1", "motcle2"],
      "suggestedTaskTitle": "Préfixe + Titre pour la tâche",
      "hasVoiceOver": true ou false
    }
  ]
}
`;

  try {
    let response: Response | null = null;
    let successfulModel = "";
    let lastErrorMsg = "";

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: `Génère le calendrier éditorial complet du mois pour ${displayName} (${quota.label}) avec des thèmes uniques (seed: ${seed}). Réponds strictement en JSON.`,
              },
            ],
            response_format: { type: "json_object" },
            temperature: Math.min(1.0, 0.85 + (seed % 5) * 0.03),
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          response = res;
          successfulModel = modelName;
          break;
        } else {
          const errText = await res.text();
          if (
            res.status === 429 &&
            (errText.includes("credit_balance_exhausted") || errText.includes("insufficient_quota"))
          ) {
            lastErrorMsg =
              "Solde de crédits OpenAI épuisé (0$ restant). Rechargez vos crédits sur platform.openai.com/settings/organization/billing";
            console.warn("Échec OpenAI: solde de crédits épuisé (429 credit_balance_exhausted)");
            break; // Le compte a 0 crédit, inutile de retenter les autres modèles
          }
          lastErrorMsg = `Modèle ${modelName} code ${res.status}: ${errText.slice(0, 120)}`;
          console.warn(`Échec OpenAI avec ${modelName} (${res.status}), tentative suivante...`);
        }
      } catch (callErr: any) {
        lastErrorMsg = callErr.message || "Erreur réseau OpenAI";
      }
    }

    if (!response) {
      throw new Error(lastErrorMsg || "Aucun modèle OpenAI n'a répondu");
    }

    const data = await response.json();
    const candidateText = data?.choices?.[0]?.message?.content || "";

    if (!candidateText) {
      throw new Error("Réponse OpenAI vide");
    }

    let cleanText = candidateText.trim();
    if (cleanText.startsWith("```json")) cleanText = cleanText.substring(7);
    if (cleanText.startsWith("```")) cleanText = cleanText.substring(3);
    if (cleanText.endsWith("```")) cleanText = cleanText.substring(0, cleanText.length - 3);
    cleanText = cleanText.trim();

    const parsed = JSON.parse(cleanText);

    // Valider et normaliser la structure reçue
    const publications: PublicationProposal[] = (parsed.publications || []).map(
      (pub: any, idx: number) => {
        const pWeek = Number(pub.week) || Math.floor(idx / quota.weekly) + 1;
        const pFormat =
          pub.format === "REEL_9_16"
            ? "REEL_9_16"
            : pub.format === "CAROUSEL"
            ? "CAROUSEL"
            : "STATIC_POST";

        const finalFormat =
          offerType === "STARTER" && pFormat === "REEL_9_16" ? "CAROUSEL" : pFormat;

        return {
          id: `chatgpt-w${pWeek}-${idx + 1}-${seed}-${Date.now().toString(36)}`,
          week: pWeek,
          weekLabel: pub.weekLabel || `Semaine ${pWeek} (Semaine ${pWeek}/4)`,
          daySuggestion: pub.daySuggestion || "Mardi (18h)",
          theme: pub.theme || "Communication & Visibilité",
          title: pub.title || `Publication Semaine ${pWeek}`,
          format: finalFormat,
          formatLabel:
            pub.formatLabel ||
            (finalFormat === "CAROUSEL"
              ? "Carrousel (5-7 slides)"
              : finalFormat === "STATIC_POST"
              ? "Maquette Design Graphique"
              : "Reel 9:16 (30s dynamique)"),
          hook: pub.hook || "",
          scriptOrSlides: Array.isArray(pub.scriptOrSlides) ? pub.scriptOrSlides : [],
          caption: pub.caption || "",
          cta: pub.cta || "Contactez-nous en DM pour commander 📲",
          hashtags: Array.isArray(pub.hashtags)
            ? pub.hashtags.map((h: string) => h.replace(/^#/, ""))
            : ["algerie", "boostera"],
          suggestedTaskTitle:
            pub.suggestedTaskTitle ||
            `${
              finalFormat === "CAROUSEL"
                ? "Création Carrousel"
                : finalFormat === "STATIC_POST"
                ? "Maquette Design Social"
                : "Montage Reel"
            }: ${pub.title || "Post"}`,
          hasVoiceOver: Boolean(pub.hasVoiceOver),
          isCreatedAsTask: false,
        };
      }
    );

    const themes: EditorialTheme[] = (parsed.themes || []).map((t: any, idx: number) => ({
      id: t.id || `theme-${idx + 1}`,
      pillar: t.pillar || `Pilier ${idx + 1}`,
      title: t.title || "Thématique Stratégique",
      description: t.description || "",
      color: t.color || "from-purple-600 to-indigo-700",
    }));

    const fullPlan: EditorialPlanResult = {
      clientName,
      brandName,
      sector,
      wilaya,
      offerType,
      weeklyQuota: quota.weekly,
      monthlyTotal: quota.monthly,
      monthName,
      goal,
      goalLabel: goalInfo.label,
      strategicSummary:
        parsed.strategicSummary ||
        `Stratégie ChatGPT pour ${displayName} (${quota.label} : ${quota.details}).`,
      packSummary: quota.details,
      themes: themes.length > 0 ? themes : generateAiEditorialPlan(params).themes,
      publications:
        publications.length > 0 ? publications : generateAiEditorialPlan(params).publications,
    };

    return {
      success: true,
      source: "OPENAI_CHATGPT",
      modelUsed: successfulModel || "ChatGPT",
      plan: fullPlan,
      notice: `Généré en direct par OpenAI ChatGPT (${successfulModel || "GPT-4o"}) pour ${displayName} !`,
    };
  } catch (openAiError: any) {
    console.warn(
      "Échec de l'appel OpenAI API, basculement transparent vers le moteur local:",
      openAiError?.message
    );

    const fallbackPlan = generateAiEditorialPlan(params);
    return {
      success: true,
      source: "LOCAL_ENGINE",
      plan: fallbackPlan,
      notice: `Généré via la base sectorielle Boostera (Basculement automatique : ${
        openAiError?.message || "OpenAI indisponible"
      }).`,
      error: openAiError?.message,
    };
  }
}
