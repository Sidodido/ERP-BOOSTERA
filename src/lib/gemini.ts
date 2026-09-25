import { OfferType } from "@prisma/client";
import {
  EditorialPlanResult,
  PublicationProposal,
  EditorialTheme,
  WEEKLY_QUOTAS_BY_OFFER,
  STRATEGIC_GOALS,
  generateAiEditorialPlan,
} from "./aiContentGenerator";
import { getResolvedGeminiApiKey } from "./aiConfig";

export interface GenerateWithGeminiParams {
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
}

export interface GeminiGenerationResult {
  success: boolean;
  source: "GEMINI_AI" | "LOCAL_ENGINE";
  modelUsed?: string;
  plan: EditorialPlanResult;
  notice?: string;
  error?: string;
}

/**
 * Moteur de génération IA propulsé par Google Gemini
 * avec basculement automatique sur les modèles flash-lite / flash récents
 * et fallback algorithmique si la clé est absente ou le service indisponible.
 */
export async function generateEditorialPlanWithGemini(
  params: GenerateWithGeminiParams
): Promise<GeminiGenerationResult> {
  const apiKey = getResolvedGeminiApiKey(params.apiKey);

  // Si pas de clé Gemini, fallback propre et immédiat
  if (!apiKey) {
    const fallbackPlan = generateAiEditorialPlan(params);
    return {
      success: true,
      source: "LOCAL_ENGINE",
      plan: fallbackPlan,
      notice:
        "Moteur Local actif. Pour activer l'intelligence en direct avec Google Gemini, configurez votre clé GEMINI_API_KEY.",
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
  } = params;

  const displayName = brandName?.trim() || clientName.trim();
  const quota = WEEKLY_QUOTAS_BY_OFFER[offerType] || WEEKLY_QUOTAS_BY_OFFER.STARTER;
  const goalInfo = STRATEGIC_GOALS[goal] || STRATEGIC_GOALS.ALL_ROUND;

  // Liste des modèles Gemini supportés dans l'ordre de priorité
  const CANDIDATE_MODELS = [
    "gemini-flash-lite-latest",
    "gemini-flash-latest",
    "gemini-pro-latest",
    "gemini-2.5-flash",
  ];

  // Construction du prompt structuré respectant à 100% les quotas contractuels de l'agence
  const systemPrompt = `Tu es le Directeur de Création et Stratège Social Media Senior de l'agence HDZ SECURITY.
Ta mission est de concevoir un calendrier de contenu éditorial mensuel ultra-performant, percutant et réaliste pour le marché algérien (${wilaya || "Algérie"}).

DONNÉES DU CLIENT & SES RÉSEAUX SOCIAUX (MÉDIAS DU CLIENT) :
- Entreprise / Marque : "${displayName}" (Raison sociale : "${clientName}")
- Secteur d'activité : "${sector}"
- Localisation / Wilaya : "${wilaya || "Algérie"}"
- Compte Instagram : ${instagram ? `"${instagram}"` : "Non spécifié (optimise pour Reels dynamiques, Stories interactives et Carrousels esthétiques)"}
- Page Facebook : ${facebook ? `"${facebook}"` : "Non spécifiée (optimise pour l'engagement communautaire, partages et questions)"}
- Compte TikTok : ${tiktok ? `"${tiktok}"` : "Non spécifié (optimise pour formats verticaux courts et viraux)"}
- Contact WhatsApp / Tél : ${phone ? `"${phone}"` : "Numéro de contact de l'entreprise"}
- Email : ${email ? `"${email}"` : "Non spécifié"}
- Notes & Contexte spécifique : ${notes ? `"${notes}"` : "Aucun historique spécifique"}
- Pack souscrit : ${quota.label} (${quota.tagline})
- Objectif stratégique : ${goalInfo.label} (${goalInfo.description})
- Mois concerné : ${monthName}
- Numéro de lot (seed) : ${seed} (CRÉATIVITÉ MAXIMALE : produis des thèmes et idées 100% uniques et différents des précédents lots !)

CONSIGNE STRICTE D'ORIGINALITÉ (THÈMES ILLIMITÉS SANS TOURNER EN BOUCLE) :
L'utilisateur exige une créativité ILLIMITÉE. À chaque régénération (Lot seed: ${seed}), tu DOIS impérativement renouveler à 100% les angles d'attaque et les thématiques proposées.
Ne propose JAMAIS les mêmes 2 thèmes répétitifs !
Propose entre 3 et 5 thèmes stratégiques variés, riches et originaux dans le tableau "themes".
Puis dans les publications, adapte le ton aux réseaux du client (${instagram || "Instagram"}, ${facebook || "Facebook"}) :
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
Tu DOIS impérativement répondre UNIQUEMENT avec un objet JSON valide (sans texte avant ou après, sans backticks markdown) avec cette structure exacte :

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
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 18000);

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: systemPrompt }],
              },
            ],
            generationConfig: {
              temperature: Math.min(0.95, 0.85 + (seed % 5) * 0.03),
              topP: 0.95,
              maxOutputTokens: 8192,
              responseMimeType: "application/json",
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          response = res;
          successfulModel = modelName;
          break;
        } else {
          const errBody = await res.text();
          lastErrorMsg = `Modèle ${modelName} code ${res.status}: ${errBody.slice(0, 120)}`;
          console.warn(`Échec avec le modèle ${modelName} (${res.status}), essai du suivant...`);
        }
      } catch (callErr: any) {
        lastErrorMsg = callErr.message || "Erreur réseau";
        console.warn(`Erreur réseau avec ${modelName}:`, callErr.message);
      }
    }

    if (!response) {
      throw new Error(`Aucun modèle Gemini disponible (${lastErrorMsg})`);
    }

    const json = await response.json();
    const candidateText =
      json?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!candidateText) {
      throw new Error("Réponse Gemini vide");
    }

    // Nettoyage éventuel si markdown
    let cleanText = candidateText.trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.substring(7);
    }
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.substring(3);
    }
    if (cleanText.endsWith("```")) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
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

        // Pour STARTER: s'assurer qu'aucun REEL n'est retourné
        const finalFormat =
          offerType === "STARTER" && pFormat === "REEL_9_16"
            ? "CAROUSEL"
            : pFormat;

        return {
          id: `gemini-w${pWeek}-${idx + 1}-${seed}-${Date.now().toString(36)}`,
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
          scriptOrSlides: Array.isArray(pub.scriptOrSlides)
            ? pub.scriptOrSlides
            : [],
          caption: pub.caption || "",
          cta: pub.cta || "Contactez-nous en DM pour commander 📲",
          hashtags: Array.isArray(pub.hashtags)
            ? pub.hashtags.map((h: string) => h.replace(/^#/, ""))
            : ["algerie", "hdz-security"],
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

    const themes: EditorialTheme[] = (parsed.themes || []).map(
      (t: any, idx: number) => ({
        id: t.id || `theme-${idx + 1}`,
        pillar: t.pillar || `Pilier ${idx + 1}`,
        title: t.title || "Thématique Stratégique",
        description: t.description || "",
        color: t.color || "from-blue-600 to-indigo-700",
      })
    );

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
        `Stratégie Gemini AI pour ${displayName} (${quota.label} : ${quota.details}).`,
      packSummary: quota.details,
      themes: themes.length > 0 ? themes : generateAiEditorialPlan(params).themes,
      publications:
        publications.length > 0
          ? publications
          : generateAiEditorialPlan(params).publications,
    };

    return {
      success: true,
      source: "GEMINI_AI",
      modelUsed: successfulModel || "Gemini Flash",
      plan: fullPlan,
      notice: `Généré en direct par Google Gemini (${successfulModel || "Flash"}) pour ${displayName} !`,
    };
  } catch (geminiError: any) {
    console.warn(
      "Échec de l'appel Gemini API, basculement transparent vers le moteur local:",
      geminiError?.message
    );

    const fallbackPlan = generateAiEditorialPlan(params);
    return {
      success: true,
      source: "LOCAL_ENGINE",
      plan: fallbackPlan,
      notice: `Généré via la base sectorielle HDZ SECURITY (Basculement automatique : ${
        geminiError?.message || "Gemini indisponible"
      }).`,
      error: geminiError?.message,
    };
  }
}
