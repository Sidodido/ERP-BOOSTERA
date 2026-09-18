import { OfferType } from "@prisma/client";

export interface PublicationProposal {
  id: string;
  week: number; // 1, 2, 3, 4
  weekLabel: string;
  daySuggestion: string;
  theme: string;
  title: string;
  format: "REEL_9_16" | "CAROUSEL" | "STATIC_POST" | "STORY_INTERACTIVE";
  formatLabel: string;
  hook: string; // 0-3s hook or slide 1 headline
  scriptOrSlides: {
    step: string;
    description: string;
    visualTip?: string;
  }[];
  caption: string;
  cta: string;
  hashtags: string[];
  suggestedTaskTitle: string;
  hasVoiceOver?: boolean;
  isCreatedAsTask?: boolean;
}

export interface EditorialTheme {
  id: string;
  pillar: string;
  title: string;
  description: string;
  color: string;
}

export interface EditorialPlanResult {
  clientName: string;
  brandName?: string | null;
  sector: string;
  wilaya?: string | null;
  offerType: OfferType;
  weeklyQuota: number;
  monthlyTotal: number;
  monthName: string;
  goal: string;
  goalLabel: string;
  strategicSummary: string;
  packSummary: string;
  themes: EditorialTheme[];
  publications: PublicationProposal[];
}

export interface PackDeliverables {
  carousels: number;
  maquettes: number;
  reels: number;
  voiceOver: number;
}

export interface PackFeatures {
  tagline: string;
  viewsTarget: string;
  shootingsPerYear: number;
  videoProPerYear: number;
  sponsorVideoPro: boolean;
  seoBase: boolean;
  googleCertification: boolean;
  proWebsite: boolean;
}

export const WEEKLY_QUOTAS_BY_OFFER: Record<
  OfferType,
  {
    weekly: number;
    monthly: number;
    label: string;
    tagline: string;
    badgeColor: string;
    details: string;
    deliverables: PackDeliverables;
    features: PackFeatures;
  }
> = {
  STARTER: {
    weekly: 1,
    monthly: 4,
    label: "Pack Starter (1 pub / sem)",
    tagline: "Idéal pour débuter",
    badgeColor: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    details: "2 Carrousels + 2 Maquettes (SANS REELS)",
    deliverables: { carousels: 2, maquettes: 2, reels: 0, voiceOver: 0 },
    features: {
      tagline: "Idéal pour débuter",
      viewsTarget: "50K vues",
      shootingsPerYear: 1,
      videoProPerYear: 1,
      sponsorVideoPro: true,
      seoBase: true,
      googleCertification: true,
      proWebsite: true,
    },
  },
  SILVER: {
    weekly: 2,
    monthly: 8,
    label: "Pack Silver (2 pubs / sem)",
    tagline: "Bonne visibilité",
    badgeColor: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    details: "3 Carrousels + 3 Maquettes + 2 Reels (1 Voix off)",
    deliverables: { carousels: 3, maquettes: 3, reels: 2, voiceOver: 1 },
    features: {
      tagline: "Bonne visibilité",
      viewsTarget: "600K vues",
      shootingsPerYear: 3,
      videoProPerYear: 3,
      sponsorVideoPro: true,
      seoBase: true,
      googleCertification: true,
      proWebsite: false,
    },
  },
  GOLD: {
    weekly: 3,
    monthly: 12,
    label: "Pack Gold (3 pubs / sem)",
    tagline: "Forte présence",
    badgeColor: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
    details: "4 Carrousels + 4 Maquettes + 4 Reels (2 Voix off)",
    deliverables: { carousels: 4, maquettes: 4, reels: 4, voiceOver: 2 },
    features: {
      tagline: "Forte présence",
      viewsTarget: "1M vues",
      shootingsPerYear: 5,
      videoProPerYear: 5,
      sponsorVideoPro: true,
      seoBase: true,
      googleCertification: true,
      proWebsite: false,
    },
  },
  CUSTOM: {
    weekly: 2,
    monthly: 8,
    label: "Pack Sur-Mesure",
    tagline: "Personnalisé",
    badgeColor: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    details: "Composition personnalisée (Carrousels & Maquettes)",
    deliverables: { carousels: 4, maquettes: 4, reels: 0, voiceOver: 0 },
    features: {
      tagline: "Personnalisé",
      viewsTarget: "Sur mesure",
      shootingsPerYear: 2,
      videoProPerYear: 2,
      sponsorVideoPro: true,
      seoBase: true,
      googleCertification: true,
      proWebsite: false,
    },
  },
};

export const STRATEGIC_GOALS: Record<string, { label: string; description: string }> = {
  ALL_ROUND: {
    label: "Stratégie Complète (Notoriété & Ventes)",
    description: "Équilibre entre éducation, visibilité de marque, preuve sociale et conversion directe.",
  },
  AWARENESS: {
    label: "Notoriété & Branding",
    description: "Maximiser la portée, valoriser l'identité de marque et attirer de nouveaux abonnés.",
  },
  CONVERSION: {
    label: "Ventes, Offres & Conversions",
    description: "Mettre en avant les offres phares, le rapport qualité/prix et générer des contacts directs (DM / WhatsApp).",
  },
  EDUCATION: {
    label: "Conseils d'Expert & Éducation",
    description: "Carrousels informatifs et astuces pour installer l'autorité et la crédibilité auprès de l'audience.",
  },
  SOCIAL_PROOF: {
    label: "Preuve Sociale & Avis Clients",
    description: "Témoignages, réalisations concrètes, retours d'expérience et confiance.",
  },
  BEHIND_THE_SCENES: {
    label: "Coulisses & Équipe",
    description: "Présentation des coulisses, de l'équipe, fabrication et ambiance authentique.",
  },
};

interface ContentBlueprint {
  theme: string;
  title: string;
  format: "CAROUSEL" | "STATIC_POST" | "REEL_9_16";
  hook: string;
  scriptOrSlides: { step: string; description: string; visualTip?: string }[];
  captionTemplate: string;
  cta: string;
  hashtags: string[];
  taskPrefix: string;
}

interface SectorKnowledge {
  defaultThemes: { pillar: string; title: string; description: string; color: string }[];
  carousels: ContentBlueprint[];
  maquettes: ContentBlueprint[];
  reels: ContentBlueprint[];
}

const SECTOR_KNOWLEDGE_BASE: Record<string, SectorKnowledge> = {
  "Restaurant": {
    defaultThemes: [
      { pillar: "Qualité & Goût", title: "Les Secrets du Chef & Ingrédients Frais", description: "Mettre en valeur le goût authentique, la fraîcheur des produits et la maîtrise culinaire.", color: "from-amber-500 to-orange-600" },
      { pillar: "Expérience Client", title: "Ambiance & Accueil Chaleureux", description: "Plonger les abonnés dans l'atmosphère conviviale, le cadre et le service du restaurant.", color: "from-rose-500 to-red-600" },
      { pillar: "Offres & Spécialités", title: "Les Plats Signatures & Formules du Moment", description: "Zoom sur le best-seller ou un nouveau menu irrésistible qui donne envie de réserver.", color: "from-emerald-500 to-teal-600" },
      { pillar: "Coulisses en Cuisine", title: "Le Coup de Feu & Préparation en Direct", description: "Format dynamique montrant la passion et la propreté en cuisine.", color: "from-blue-500 to-indigo-600" },
    ],
    maquettes: [
      {
        theme: "Offres & Spécialités",
        title: "Affiche Visuelle : Menu Spécial & Plat Signature du Chef",
        format: "STATIC_POST",
        hook: "« Vous ne savez pas quoi manger ce midi ? Notre chef vous a préparé une surprise gourmande... » 🍽️",
        scriptOrSlides: [
          { step: "Visuel Principal", description: "Photo haute définition du plat signature fumant, éclairage chaud et appétissant.", visualTip: "Composition soignée avec fond sobre et touches dorées" },
          { step: "Titre & Accroche", description: "Titre impactant : 'La Sélection du Chef : Saveurs & Générosité à {wilaya}'.", visualTip: "Typographie élégante et lisible" },
          { step: "Détails & Tarifs", description: "Mention claire des accompagnements offerts, boissons fraîches et sauces maison.", visualTip: "Badges arrondis avec prix en Dinars" },
          { step: "Bandeau Contact", description: "Adresse exacte à {wilaya}, logo {brand} et icône WhatsApp pour réserver.", visualTip: "Pied de page épuré" },
        ],
        captionTemplate: "Laissez-vous tenter par notre spécialité du jour chez {brand} ! Préparée chaque matin avec des ingrédients frais du terroir. Vous venez seul ou accompagné ce midi ?",
        cta: "Réservez votre table directement par WhatsApp ou DM au numéro en bio 📲",
        hashtags: ["restaurant_algerie", "fooddz", "platsignature", "restaurant", "bonplanalgerie", "algerianfood"],
        taskPrefix: "Maquette Design Social",
      },
      {
        theme: "Offres & Spécialités",
        title: "Visuel Promotion : Formule Déjeuner & Avantage Groupe",
        format: "STATIC_POST",
        hook: "« Pause déjeuner entre collègues ou en famille ? Profitez de notre formule complète à prix doux ! » ✨",
        scriptOrSlides: [
          { step: "Visuel Principal", description: "Table généreusement dressée avec 3 formules complètes présentées harmonieusement.", visualTip: "Prise de vue plongeante lumineuse" },
          { step: "Titre & Offre", description: "Encadré promotionnel : 'Formule Midi Express : Entrée + Plat + Boisson'.", visualTip: "Couleurs chaleureuses rouge/ambré" },
          { step: "Avantage Spécial", description: "Pour 4 formules commandées, le dessert maison est offert à la table.", visualTip: "Pastille 'Dessert Offert'" },
          { step: "Horaires & Réservation", description: "Valable du Dimanche au Jeudi de 12h à 15h chez {brand}.", visualTip: "Mention claire des horaires" },
        ],
        captionTemplate: "Faites de votre pause de midi un vrai moment de plaisir gourmand chez {brand} ! Une formule rapide, savoureuse et généreuse à {wilaya}.",
        cta: "Taguez vos collègues de bureau et venez vous régaler aujourd'hui ! 📍",
        hashtags: ["dejeunerdz", "formulemidi", "restaurantedz", "foodalgerie", "pausegourmande"],
        taskPrefix: "Maquette Design Social",
      },
      {
        theme: "Expérience Client",
        title: "Affiche Soirée : Dîner Convivial & Ambiance Tamisée ce Weekend",
        format: "STATIC_POST",
        hook: "« Le weekend commence ici : bonne musique, plats mijotés et ambiance chaleureuse garantie. » 🕯️🎶",
        scriptOrSlides: [
          { step: "Visuel Principal", description: "Photo d'ambiance de la salle de restaurant éclairée aux bougies avec vue sur les tables soignées.", visualTip: "Lumières tamisées et atmosphère cosy" },
          { step: "Titre d'ambiance", description: "Titre élégant : 'Vos Soirées Inoubliables chez {brand}'.", visualTip: "Typographie premium dorée" },
          { step: "Points Forts", description: "Espace familial privatisable, parking surveillé, service aux petits soins.", visualTip: "Icônes épurées en bas de page" },
          { step: "Appel à Réserver", description: "Places limitées pour les soirs de weekend. Réservation recommandée.", visualTip: "Bouton graphique 'Réserver ma table'" },
        ],
        captionTemplate: "Envie de couper du stress de la semaine ? Venez partager un dîner d'exception dans le cadre chaleureux de {brand}. Notre équipe vous attend avec le sourire !",
        cta: "Les réservations du weekend sont ouvertes ! Contactez-nous en DM 📩",
        hashtags: ["sortir_algerie", "dinerdz", "ambiancecosy", "restaurant_famille", "weekenddz"],
        taskPrefix: "Maquette Design Social",
      },
      {
        theme: "Qualité & Goût",
        title: "Maquette Focus Produit : Des Produits Frais Sélectionnés Chaque Matin",
        format: "STATIC_POST",
        hook: "« La qualité ne ment jamais : découvrez nos arrivages de produits frais du jour ! » 🥩🥗",
        scriptOrSlides: [
          { step: "Visuel Principal", description: "Gros plan sur les ingrédients nobles : légumes frais croquants, viandes braisées d'exception et épices sélectionnées.", visualTip: "Focus macro avec profondeur de champ" },
          { step: "Label Qualité", description: "Badge '100% Frais & Fait Maison chaque jour chez {brand}'.", visualTip: "Badge vert/doré de garantie" },
          { step: "Engagement", description: "Notre promesse : zéro compromis sur la fraîcheur et l'hygiène irréprochable.", visualTip: "Texte court et impactant" },
          { step: "Signature", description: "Signé par la brigade de cuisine {brand}.", visualTip: "Signature du chef avec logo" },
        ],
        captionTemplate: "Derrière chaque plat réussi, il y a le choix d'ingrédients d'une fraîcheur absolue. Venez découvrir la différence dans votre assiette chez {brand} !",
        cta: "Envoyez 'MENU' par message privé pour recevoir notre carte complète 📲",
        hashtags: ["qualitedz", "faitmaison", "produitsfrais", "cuisineauthentique", "dzfood"],
        taskPrefix: "Maquette Design Social",
      },
    ],
    carousels: [
      {
        theme: "Expérience Client",
        title: "5 raisons pour lesquelles vos soirées entre amis sont inoubliables ici",
        format: "CAROUSEL",
        hook: "« Vous cherchez l'endroit parfait pour dîner ce week-end ? Swipez pour découvrir ! » 🍽️",
        scriptOrSlides: [
          { step: "Slide 1 (Couverture)", description: "Titre percutant sur fond de la salle illuminée : « L'adresse qui réunit tout le monde à {wilaya} »" },
          { step: "Slide 2 (Raison 1)", description: "Un cadre cosy et soigné conçu pour se détendre après une longue semaine." },
          { step: "Slide 3 (Raison 2)", description: "Une carte variée qui met d'accord tous les goûts (viandes braisées, spécialités, desserts maison)." },
          { step: "Slide 4 (Raison 3)", description: "Un service rapide avec le sourire de notre équipe dévouée." },
          { step: "Slide 5 (Raison 4)", description: "Des portions généreuses pour les vrais gourmands." },
          { step: "Slide 6 (Call to Action)", description: "Horaires d'ouverture, localisation exacte et invitation à réserver." },
        ],
        captionTemplate: "Envie d'une pause gourmande inoubliable ? Notre équipe {brand} vous accueille 7j/7 avec le sourire et les meilleures saveurs de {wilaya}. Enregistrez ce post pour votre prochaine sortie !",
        cta: "Enregistrez ce post et écrivez-nous en DM pour réserver votre table 📲",
        hashtags: ["sortir_alger", "restaurantdz", "guidefood", "algerie", "ambiancefood", "dzlifestyle"],
        taskPrefix: "Création Carrousel",
      },
      {
        theme: "Qualité & Goût",
        title: "Guide Gourmand : Les 4 étapes secrètes de préparation de notre plat phare",
        format: "CAROUSEL",
        hook: "« Vous nous demandez souvent le secret de sa tendreté... On vous dévoile les coulisses ! » 👨‍🍳🔥",
        scriptOrSlides: [
          { step: "Slide 1 (Couverture)", description: "Gros plan sur la sauce onctueuse : « Les coulisses secrètes de notre cuisine »." },
          { step: "Slide 2 (Étape 1 : Le Choix)", description: "Sélection rigoureuse des viandes et ingrédients auprès de producteurs locaux de confiance." },
          { step: "Slide 3 (Étape 2 : La Marinade)", description: "Une marinade secrète aux 12 épices reposée pendant 24 heures pour infuser chaque arôme." },
          { step: "Slide 4 (Étape 3 : La Cuisson)", description: "Cuisson lente à basse température pour préserver le moelleux et le fondant." },
          { step: "Slide 5 (Étape 4 : Le Dressage)", description: "Dressage à la minute avec notre garniture croustillante maison." },
          { step: "Slide 6 (Invitation)", description: "Venez savourer ce délice chez {brand} dès aujourd'hui !" },
        ],
        captionTemplate: "La cuisine est un art de patience et de passion. Chez {brand}, chaque plat est le fruit d'un savoir-faire soigné pour ravir vos papilles. Enregistrez ce carrousel !",
        cta: "Quel est votre plat préféré chez nous ? Dites-le nous en commentaire !",
        hashtags: ["cuisinedz", "coulissesrestaurant", "chefadomicile", "recettedz", "gourmanddz"],
        taskPrefix: "Création Carrousel",
      },
      {
        theme: "Preuve Sociale",
        title: "Ce que nos clients disent de nous : Leurs avis & plats favoris",
        format: "CAROUSEL",
        hook: "« Plus de 4.8 étoiles sur Google ! Voici ce que vous préférez chez {brand}... » ⭐⭐⭐⭐⭐",
        scriptOrSlides: [
          { step: "Slide 1 (Couverture)", description: "Mise en avant de la note Google et photos réelles de clients heureux à table." },
          { step: "Slide 2 (Avis n°1 : Amine)", description: "« Le meilleur accueil à {wilaya} ! Des plats servis chauds et copieux, on revient chaque semaine. »" },
          { step: "Slide 3 (Avis n°2 : Sarah)", description: "« Cadre familial magnifique, très propre et calme. Les enfants ont adoré ! »" },
          { step: "Slide 4 (Avis n°3 : Karim)", description: "« Le rapport qualité/prix est imbattable. Mention spéciale pour la viande braisée. »" },
          { step: "Slide 5 (Notre Merci)", description: "Votre fidélité et vos sourires sont notre plus belle récompense." },
          { step: "Slide 6 (Action)", description: "Rejoignez la communauté des habitués de {brand} !" },
        ],
        captionTemplate: "Merci du fond du cœur pour votre confiance renouvelée ! Vos retours motivent toute notre brigade à donner le meilleur chaque jour chez {brand}. ✨",
        cta: "Vous êtes déjà venus ? Partagez votre note en commentaire !",
        hashtags: ["avisclients", "fidelite", "recommandationdz", "satisfactionclient", "bonnetabledz"],
        taskPrefix: "Création Carrousel",
      },
      {
        theme: "Offres & Spécialités",
        title: "Comment composer le menu parfait pour votre table en 3 étapes",
        format: "CAROUSEL",
        hook: "« Première fois chez nous ? Suivez ce guide pour ne rien rater des pépites de la carte ! » 📖✨",
        scriptOrSlides: [
          { step: "Slide 1 (Couverture)", description: "Visuel complet de la carte : « Le guide officiel pour bien commander chez {brand} »." },
          { step: "Slide 2 (Pour démarrer)", description: "Nos entrées à partager incontournables pour ouvrir l'appétit." },
          { step: "Slide 3 (Le plat principal)", description: "Comment choisir entre notre spécialité viande braisée ou nos plats mijotés." },
          { step: "Slide 4 (Les accompagnements)", description: "Nos sauces signatures et frites croustillantes faites maison." },
          { step: "Slide 5 (La touche sucrée)", description: "Nos desserts maison et thé à la menthe pour clôturer en beauté." },
          { step: "Slide 6 (Pratique)", description: "Adresse, horaires et lien direct pour réserver sans attendre." },
        ],
        captionTemplate: "Pas toujours facile de choisir quand tout a l'air délicieux ! Voici notre guide pratique pour composer le repas parfait lors de votre prochaine visite chez {brand}.",
        cta: "Enregistrez ce post pour votre prochaine commande chez nous 📲",
        hashtags: ["menurestaurant", "guideculinaire", "dzfoodie", "restodzan", "bonappetitdz"],
        taskPrefix: "Création Carrousel",
      },
    ],
    reels: [
      {
        theme: "Qualité & Goût",
        title: "Comment nous préparons notre plat signature en 3 étapes secrètes",
        format: "REEL_9_16",
        hook: "« Si vous pensiez que toutes les recettes se valent, regardez jusqu'à la fin... » 🔥",
        scriptOrSlides: [
          { step: "0s - 3s (Accroche)", description: "Plan macro ultra serré sur la cuisson crépitante, fumée gourmande, son ASMR croustillant.", visualTip: "Gros plan 4K ralenti x0.5 avec texte dynamique centré" },
          { step: "3s - 12s (Secret n°1)", description: "Le chef ajoute l'ingrédient secret frais sélectionné chaque matin sur le marché local.", visualTip: "Mouvement de caméra fluide vers le visage concentré du cuisinier" },
          { step: "12s - 22s (Dressage)", description: "Dressage artistique de l'assiette avec la sauce onctueuse qui nappe le plat.", visualTip: "Plan plongeant (Top View) avec rotation légère" },
          { step: "22s - 30s (Appel à l'action)", description: "Dégustation avec coupe nette, réaction authentique et invitation à venir goûter ce week-end.", visualTip: "Affichage de l'adresse et du bouton WhatsApp" },
        ],
        captionTemplate: "Chez {brand}, chaque assiette raconte une passion. Venez savourer notre plat phare préparé avec des ingrédients frais du jour. ✨ Vous venez avec qui ce soir ? Tag votre acolyte en commentaire !",
        cta: "Réservez votre table par DM ou au numéro en bio 📞",
        hashtags: ["restaurant_algerie", "fooddz", "algerianfood", "bonplanfood", "dzgourmet", "restaurant"],
        taskPrefix: "Montage Reel Cuisine",
      },
      {
        theme: "Offres & Spécialités",
        title: "Zoom Découverte : Le Best-Seller que tout le monde redemande",
        format: "REEL_9_16",
        hook: "« Vous avez été plus de 500 à le commander ce mois-ci... Voici pourquoi ! » 🤤",
        scriptOrSlides: [
          { step: "0s - 4s (Le choc visuel)", description: "Fromage fondant étiré ou viande tendre qui se détache à la fourchette.", visualTip: "Accélération puis ralenti au moment où le fromage coule" },
          { step: "4s - 15s (Ce qui fait la différence)", description: "Voix-off dynamique expliquant la marinade de 24h et les épices choisies.", visualTip: "B-Roll dynamique sur les épices et la découpe" },
          { step: "15s - 25s (Le verdict)", description: "Un client sourit en recevant son plat chaud fumant.", visualTip: "Plan moyen souriant et chaleureux" },
          { step: "25s - 30s (Offre)", description: "Disponible dès ce midi. Mentionnez l'ami qui doit vous inviter !", visualTip: "Texte CTA : Tag un ami qui te doit un resto" },
        ],
        captionTemplate: "La star incontournable de notre carte chez {brand}. Une explosion de saveurs garantie dès la première bouchée ! 🤤 Qui n'a pas encore goûté ?",
        cta: "Envoyez 'MENU' par message privé pour recevoir notre carte complète 📲",
        hashtags: ["foodaddict_dz", "platsignature", "decouvertedz", "algerie", "recettedz"],
        taskPrefix: "Montage Reel Best-Seller",
      },
      {
        theme: "Coulisses en Cuisine",
        title: "Dans les coulisses : Le rush de midi avec notre brigade",
        format: "REEL_9_16",
        hook: "« 12h30 : 45 commandes tombent en 10 minutes ! Comment on gère ? » ⏱️⚡",
        scriptOrSlides: [
          { step: "0s - 3s (Tension)", description: "L'imprimante de tickets s'emballe, musique rythmée entraînante.", visualTip: "Montage cut rapide, transition sonore rythmée" },
          { step: "3s - 15s (Coordination)", description: "Chaque poste s'active avec précision : grillades, dressage, contrôle qualité.", visualTip: "Plans dynamiques caméra à l'épaule façon documentaire haut de gamme" },
          { step: "15s - 25s (Envoi)", description: "Les assiettes parfaites partent en salle chrono en main.", visualTip: "Passage de la cuisine à la salle illuminée" },
          { step: "25s - 30s (Sourire)", description: "Le chef lève le pouce : défi relevé, clients satisfaits.", visualTip: "Logo de l'enseigne et slogan" },
        ],
        captionTemplate: "Chez {brand}, chaque minute compte pour vous servir chaud et savoureux. Bravo à toute notre brigade en cuisine ! ❤️ Vous préférez venir le midi ou le soir ?",
        cta: "Laissez un ❤️ pour encourager notre équipe !",
        hashtags: ["coulisses", "chefcuisine", "restauration_dz", "teamwork", "foodlovers"],
        taskPrefix: "Montage Reel Coulisses Cuisine",
      },
      {
        theme: "Ambiance & Cadre",
        title: "Visite immersive 30 secondes au cœur de notre restaurant",
        format: "REEL_9_16",
        hook: "« Entrez, installez-vous... On vous fait faire le tour du propriétaire ! » ✨🚶",
        scriptOrSlides: [
          { step: "0s - 4s (Entrée)", description: "Ouverture des portes avec accueil souriant de l'équipe.", visualTip: "Travelling avant fluide caméra stabilisée" },
          { step: "4s - 14s (Espaces)", description: "Présentation des différents coins de la salle : coin cosy, grandes tablées, terrasse.", visualTip: "Plans panoramiques fluides et lumineux" },
          { step: "14s - 24s (Boissons & Desserts)", description: "Cocktails maison et desserts soignés servis en direct.", visualTip: "Gros plan sur les verres et garnitures fraîches" },
          { step: "24s - 30s (Conclusion)", description: "À très vite chez {brand} !", visualTip: "Adresse et bouton de réservation" },
        ],
        captionTemplate: "Un cadre soigné, une équipe aux petits soins et des saveurs inoubliables. Bienvenue chez {brand} à {wilaya} !",
        cta: "Réservez votre table par message privé dès maintenant 📲",
        hashtags: ["visiterestaurant", "ambiancedz", "foodtour", "algerie_visite"],
        taskPrefix: "Montage Reel Immersion",
      },
    ],
  },

  // Fallback et autres secteurs (Médical, Beauté, Immo, E-commerce, Général)
  "Cabinet médical": {
    defaultThemes: [
      { pillar: "Sensibilisation & Conseil", title: "Démystifier les Symptômes & Prévention", description: "Donner des conseils clairs pour rassurer et guider les patients.", color: "from-cyan-500 to-blue-600" },
      { pillar: "Expertise & Technologie", title: "Équipements Modernes & Sécurité Sanitaire", description: "Valoriser la précision des diagnostics et les protocoles d'hygiène.", color: "from-teal-500 to-emerald-600" },
      { pillar: "Preuve & Résultats", title: "Cas Traités & Témoignages", description: "Expliquer une démarche de soin réussie en respectant la déontologie.", color: "from-blue-600 to-indigo-700" },
      { pillar: "Vie du Cabinet", title: "Prise en Charge & Réponses aux Questions", description: "Faciliter la prise de rendez-vous et répondre aux interrogations courantes.", color: "from-purple-500 to-violet-600" },
    ],
    maquettes: [
      {
        theme: "Sensibilisation & Conseil",
        title: "Affiche Conseil Médical : 3 gestes simples pour protéger sa santé",
        format: "STATIC_POST",
        hook: "« Votre santé commence par de petites habitudes quotidiennes... Voici nos recommandations. » 🩺",
        scriptOrSlides: [
          { step: "Visuel Principal", description: "Infographie médicale épurée avec pictogrammes professionnels et tons bleus apaisants.", visualTip: "Design sobre et institutionnel" },
          { step: "Conseil n°1", description: "Hydratation et alimentation équilibrée adaptée au rythme quotidien.", visualTip: "Icône bienveillante" },
          { step: "Conseil n°2", description: "Activité physique régulière et gestion du stress.", visualTip: "Conseil pratico-pratique" },
          { step: "Conseil n°3", description: "Bilan préventif régulier sans attendre l'apparition des douleurs.", visualTip: "Encadré de prévention" },
        ],
        captionTemplate: "Prendre soin de soi au quotidien est le meilleur des investissements. Le cabinet {brand} vous accompagne avec expertise et bienveillance à {wilaya}.",
        cta: "Contactez notre secrétariat pour planifier votre consultation préventive 📞",
        hashtags: ["santedz", "prevention_sante", "cabinetmedical", "medecinalgerie", "bienetre"],
        taskPrefix: "Maquette Design Social",
      },
      {
        theme: "Vie du Cabinet",
        title: "Visuel Pratique : Horaires & Prise de Rendez-vous Simplifiée",
        format: "STATIC_POST",
        hook: "« Besoin d'un avis spécialisé sans longue attente ? Nos créneaux de la semaine sont disponibles. » 📅",
        scriptOrSlides: [
          { step: "Visuel Principal", description: "Photo soignée de la réception moderne et lumineuse du cabinet.", visualTip: "Clarté et propreté clinique" },
          { step: "Créneaux d'Ouverture", description: "Du Dimanche au Jeudi de 8h30 à 16h30 avec secrétariat dédié.", visualTip: "Tableau d'horaires lisible" },
          { step: "Modalités d'Accès", description: "Adresse précise à {wilaya}, ascenseur et accès PMR garanti.", visualTip: "Plan d'accès simplifié" },
          { step: "Numéro Direct", description: "Ligne directe et WhatsApp secrétariat.", visualTip: "Bouton vert WhatsApp pro" },
        ],
        captionTemplate: "Votre confort et votre santé sont au cœur de nos priorités. Prenez rendez-vous rapidement auprès de notre secrétariat chez {brand}.",
        cta: "Envoyez-nous un message privé ou appelez le secrétariat au numéro indiqué en bio 📲",
        hashtags: ["rdvmedical", "cabinetmedical_alger", "docteurdz", "soinsalgerie"],
        taskPrefix: "Maquette Design Social",
      },
    ],
    carousels: [
      {
        theme: "Sensibilisation & Conseil",
        title: "3 signes d'alerte à ne jamais ignorer pour votre santé",
        format: "CAROUSEL",
        hook: "« Beaucoup de personnes attendent trop longtemps... Voici les signes qui doivent vous alerter ! » 🩺",
        scriptOrSlides: [
          { step: "Slide 1 (Couverture)", description: "Titre rassurant et sobre avec photo professionnelle du praticien au cabinet." },
          { step: "Slide 2 (Signe n°1)", description: "Explication claire du premier symptôme fréquent mais souvent sous-estimé." },
          { step: "Slide 3 (Signe n°2)", description: "Deuxième indicateur avec conseil pratique de prévention immédiate." },
          { step: "Slide 4 (Signe n°3)", description: "Troisième signal qui nécessite impérativement un avis spécialisé." },
          { step: "Slide 5 (Le conseil du spécialiste)", description: "L'importance du diagnostic précoce pour un traitement plus doux et efficace." },
          { step: "Slide 6 (Contact & RDV)", description: "Modalités de consultation, créneaux disponibles et numéro de secrétariat." },
        ],
        captionTemplate: "Prendre soin de sa santé, c'est d'abord être à l'écoute de son corps. Chez {brand}, nous vous accompagnons avec bienveillance et rigueur médicale. Enregistrez ce post !",
        cta: "Pour toute consultation, contactez notre secrétariat au numéro en bio ou par message privé 📞",
        hashtags: ["santedz", "cabinetmedical", "conseilsante", "medecinalgerie", "prevention", "dzhealth"],
        taskPrefix: "Création Carrousel",
      },
      {
        theme: "Sensibilisation & Conseil",
        title: "Vrai ou Faux : 4 idées reçues sur les traitements courants",
        format: "CAROUSEL",
        hook: "« On entend tout et n'importe quoi sur la santé... Démêlons le vrai du faux avec notre équipe médicale ! » ❌✔️",
        scriptOrSlides: [
          { step: "Slide 1 (Couverture)", description: "Design sobre : « Idées reçues vs Réalité médicale : Le point avec le Dr chez {brand} »." },
          { step: "Slide 2 (Mythe 1)", description: "« Prendre des antibiotiques dès les premiers symptômes d'un rhume ? » Faux : inefficace sur les virus." },
          { step: "Slide 3 (Mythe 2)", description: "« Attendre que la douleur disparaisse seule ? » Dangereux : le symptôme peut masquer l'aggravation." },
          { step: "Slide 4 (Mythe 3)", description: "« L'automédication sans avis médical ? » Risque d'interactions et de surdosage." },
          { step: "Slide 5 (La bonne attitude)", description: "Toujours consulter un professionnel pour un diagnostic personnalisé et sûr." },
          { step: "Slide 6 (Ressources)", description: "Posez vos questions au secrétariat {brand}." },
        ],
        captionTemplate: "La vulgarisation scientifique et la prévention sont essentielles. Prenez soin de vous et évitez les pièges de l'automédication grâce aux conseils de {brand}.",
        cta: "Partagez ce carrousel à vos proches pour les informer !",
        hashtags: ["vraifaux", "conseildoctor", "santedzair", "preventionmedicale"],
        taskPrefix: "Création Carrousel",
      },
    ],
    reels: [
      {
        theme: "Sensibilisation & Conseil",
        title: "Idée reçue vs Vérité médicale : Ce qu'on entend souvent",
        format: "REEL_9_16",
        hook: "« Vrai ou Faux ? « Cette douleur finit toujours par passer toute seule »... On vous dit la vérité ! » ❌✔️",
        scriptOrSlides: [
          { step: "0s - 4s (Le mythe)", description: "Texte en rouge barrant l'idée fausse reçue couramment chez les patients.", visualTip: "Plan sur le médecin souriant qui fait signe 'non' avec bienveillance" },
          { step: "4s - 16s (La réalité scientifique)", description: "Explication vulgarisée en 2 phrases simples avec schéma anatomique à l'écran.", visualTip: "Incrustation graphique 3D épurée sur le côté droit" },
          { step: "16s - 26s (La bonne démarche)", description: "Ce qu'il faut réellement faire pour soulager sans risque.", visualTip: "Démonstration du geste ou explication face caméra claire et posée" },
          { step: "26s - 30s (Appel)", description: "Avez-vous déjà entendu cette idée ? Posez vos questions en commentaire.", visualTip: "Bannière avec coordonnées du cabinet" },
        ],
        captionTemplate: "Les idées reçues ont la vie dure ! Pourtant, une prise en charge précoce permet d'éviter des complications inutiles. Le cabinet {brand} reste à votre entière disposition pour vous guider en toute confiance.",
        cta: "Partagez ce Reel à un proche pour le sensibiliser et posez vos questions en commentaire !",
        hashtags: ["medecindz", "sante_algerie", "conseildocteur", "algerie", "bienetre"],
        taskPrefix: "Montage Reel Conseil Médical",
      },
      {
        theme: "Expertise & Technologie",
        title: "Comment se déroule votre première consultation chez nous ?",
        format: "REEL_9_16",
        hook: "« Vous hésitez à consulter ? Voici exactement comment nous prenons soin de vous de A à Z. » 🏥✨",
        scriptOrSlides: [
          { step: "0s - 4s (Accueil)", description: "Accueil chaleureux à la réception, espace d'attente calme et désinfecté.", visualTip: "Plan fluide d'entrée dans le cabinet lumineux" },
          { step: "4s - 14s (Écoute & Bilan)", description: "Écoute attentive des antécédents et explications claires des étapes du soin.", visualTip: "Plan moyen professionnel, échange bienveillant" },
          { step: "14s - 24s (Examen de pointe)", description: "Utilisation des technologies modernes de diagnostic indolores et précises.", visualTip: "Focus sur le matériel de pointe en action" },
          { step: "24s - 30s (Prise en charge)", description: "Plan de traitement personnalisé remis au patient avec toutes les explications.", visualTip: "Sourire du patient rassuré" },
        ],
        captionTemplate: "Votre confort et votre sérénité sont notre priorité absolue. Au sein du cabinet {brand}, bénéficiez d'une écoute attentive et d'une prise en charge médicale sur-mesure. À très bientôt !",
        cta: "Prenez rendez-vous directement via WhatsApp ou appel au numéro indiqué en bio 📅",
        hashtags: ["consultationdz", "cabinetmedical_alger", "expertise_sante", "soinsalgerie"],
        taskPrefix: "Montage Reel Consultation",
      },
    ],
  },
};

// Modèle universel générique pour tous les autres secteurs
const GENERAL_SECTOR_KNOWLEDGE: SectorKnowledge = {
  defaultThemes: [
    { pillar: "Expertise & Savoir-faire", title: "Les Secrets de Notre Métier", description: "Partager des connaissances concrètes et vulgarisées pour affirmer votre position d'autorité.", color: "from-blue-600 to-indigo-700" },
    { pillar: "Valeur & Offres", title: "Nos Solutions Sur-Mesure", description: "Présenter vos prestations phares en répondant aux problèmes réels de vos clients.", color: "from-amber-500 to-orange-600" },
    { pillar: "Preuve & Confiance", title: "Résultats Obtenus & Témoignages", description: "Montrer les succès réels et la satisfaction de vos clients partenaires.", color: "from-emerald-500 to-teal-600" },
    { pillar: "Équipe & Coulisses", title: "Les Hommes & Femmes Derrière la Marque", description: "Humaniser votre entreprise et instaurer un lien de proximité durable.", color: "from-purple-500 to-pink-600" },
  ],
  maquettes: [
    {
      theme: "Valeur & Offres",
      title: "Affiche Visuelle : Prestations Phares & Solutions Clé en Main",
      format: "STATIC_POST",
      hook: "« Vous avez un projet à concrétiser ? Voici notre solution sur-mesure conçue pour vous ! » 🚀",
      scriptOrSlides: [
        { step: "Visuel Principal", description: "Design graphique premium aux couleurs de {brand}, présentation épurée du service.", visualTip: "Graphisme moderne haute définition" },
        { step: "Points Forts", description: "3 bénéfices concrets : rapidité d'exécution, accompagnement dédié et garantie de résultat.", visualTip: "Badges illustrés avec icônes" },
        { step: "Garantie & Tarifs", description: "Transparence tarifaire et devis gratuit sans engagement sous 24h.", visualTip: "Pastille 'Devis Gratuit'" },
        { step: "Coordonnées", description: "Téléphone, WhatsApp, site web et adresse à {wilaya}.", visualTip: "Pied de page institutionnel" },
      ],
      captionTemplate: "Donnez vie à vos projets avec l'accompagnement de {brand} ! Nos spécialistes mettent leur expertise à votre service pour des résultats concrets et durables à {wilaya}.",
      cta: "Contactez-nous par DM ou au numéro en bio pour obtenir votre étude personnalisée 📲",
      hashtags: ["service_dz", "expertisealgerie", "projet_dz", "qualitegarantie", "businessdz"],
      taskPrefix: "Maquette Design Social",
    },
    {
      theme: "Preuve & Confiance",
      title: "Visuel Témoignage : La Satisfaction de Nos Clients en Chiffres",
      format: "STATIC_POST",
      hook: "« Merci pour votre confiance ! Voici ce que nos partenaires retiennent de notre collaboration. » ⭐",
      scriptOrSlides: [
        { step: "Visuel Principal", description: "Mise en avant graphique des indicateurs de réussite : 98% de clients satisfaits.", visualTip: "Chiffres en grand format stylisé" },
        { step: "Citation Client", description: "Extrait percutant d'un retour client vérifié valorisant la réactivité de l'équipe.", visualTip: "Typographie en italique avec guillemets dorés" },
        { step: "Signature", description: "Partenaire certifié et suivi personnalisé par l'équipe {brand}.", visualTip: "Logo et signature de marque" },
      ],
      captionTemplate: "Votre satisfaction est notre plus belle fierté. Bravo à nos équipes pour leur engagement sans faille aux côtés de nos partenaires chez {brand} !",
      cta: "Découvrez nos réalisations et rejoignez nos clients satisfaits 🤝",
      hashtags: ["avisclients_dz", "reussite_partagee", "confiancedz", "partenaire_algerie"],
      taskPrefix: "Maquette Design Social",
    },
    {
      theme: "Offres Spéciales",
      title: "Affiche Annonce : Lancement de la Nouvelle Formule du Mois",
      format: "STATIC_POST",
      hook: "« C'est officiel ! Découvrez notre nouvelle offre conçue pour répondre à vos attentes. » 📢",
      scriptOrSlides: [
        { step: "Visuel Principal", description: "Bannière visuelle dynamique avec effet de brillance et visuels du service.", visualTip: "Effet néon ou dégradé premium" },
        { step: "Contenu de l'Offre", description: "Tout ce qui est inclus dans le pack sans coûts cachés.", visualTip: "Liste à puces claire et contrastée" },
        { step: "Appel à l'Action", description: "Offre de lancement disponible dès maintenant.", visualTip: "Bouton d'action graphique" },
      ],
      captionTemplate: "Toujours à l'écoute de vos besoins ! {brand} a le plaisir de vous présenter sa nouvelle formule pensée pour vous simplifier la vie. Disponible dès aujourd'hui !",
      cta: "Écrivez-nous 'INFOS' par message privé pour recevoir tous les détails 📲",
      hashtags: ["nouveautedz", "lancement_dz", "innovation_algerie", "opportunitedz"],
      taskPrefix: "Maquette Design Social",
    },
  ],
  carousels: [
    {
      theme: "Expertise & Savoir-faire",
      title: "Ce que 90% des gens ignorent sur notre domaine d'activité",
      format: "CAROUSEL",
      hook: "« Vous pensez que tout est simple dans ce métier ? Voici la réalité en 5 points clés ! » 💡",
      scriptOrSlides: [
        { step: "Slide 1 (Couverture)", description: "Titre fort et accrocheur avec l'identité de l'entreprise : « Le guide vérité »." },
        { step: "Slide 2 (Point 1)", description: "Le piège n°1 souvent rencontré et comment s'en prémunir." },
        { step: "Slide 3 (Point 2)", description: "La différence entre un travail amateur et une prestation professionnelle garantie." },
        { step: "Slide 4 (Point 3)", description: "L'importance des normes et du suivi de qualité rigoureux." },
        { step: "Slide 5 (Notre solution)", description: "L'approche méthodologique éprouvée de notre équipe pour un résultat sans faille." },
        { step: "Slide 6 (Contact)", description: "Comment nous contacter pour un devis ou une prise en charge rapide." },
      ],
      captionTemplate: "Dans chaque projet, l'expertise et la rigueur font toute la différence. Chez {brand}, nous mettons notre savoir-faire au service de votre réussite. Enregistrez ce post !",
      cta: "Contactez-nous par message privé pour échanger sur vos besoins 📲",
      hashtags: ["expertise_dz", "businessalgerie", "professionneldz", "algerie", "entrepreneuriat_dz"],
      taskPrefix: "Création Carrousel",
    },
    {
      theme: "Valeur & Offres",
      title: "Les 4 critères indispensables pour choisir le bon prestataire",
      format: "CAROUSEL",
      hook: "« Avant de signer un devis, vérifiez impérativement ces 4 critères clés ! » 📋🔍",
      scriptOrSlides: [
        { step: "Slide 1 (Couverture)", description: "Design sobre : « Comment faire le bon choix pour votre projet »." },
        { step: "Slide 2 (Critère 1)", description: "La clarté du cahier des charges et l'absence de frais cachés." },
        { step: "Slide 3 (Critère 2)", description: "Les références réelles et réalisations vérifiables passées." },
        { step: "Slide 4 (Critère 3)", description: "La disponibilité et la réactivité du service après-vente." },
        { step: "Slide 5 (L'engagement {brand})", description: "Notre méthode de travail transparente et nos garanties écrites." },
        { step: "Slide 6 (Échange)", description: "Discutez de votre projet avec un conseiller dédié dès aujourd'hui." },
      ],
      captionTemplate: "Faire le bon choix de partenaire évite bien des déconvenues. Chez {brand}, la transparence et l'écoute sont les piliers de notre relation client. Enregistrez ces conseils !",
      cta: "Enregistrez ce post et écrivez-nous en DM pour échanger sur vos projets !",
      hashtags: ["conseilsprodz", "partenaireconfiance", "choixprestataire", "algeriebusiness"],
      taskPrefix: "Création Carrousel",
    },
  ],
  reels: [
    {
      theme: "Valeur & Offres",
      title: "Comment nous résolvons votre plus grand défi en 3 étapes claires",
      format: "REEL_9_16",
      hook: "« Vous perdez du temps et de l'argent avec ce problème ? On a la solution pour vous ! » 🚀",
      scriptOrSlides: [
        { step: "0s - 3s (Le problème)", description: "Mise en avant percutante de la douleur ou du besoin courant du client.", visualTip: "Texte rouge gras au centre avec transition sonore 'Boom'" },
        { step: "3s - 14s (L'analyse)", description: "Pourquoi les solutions classiques échouent souvent.", visualTip: "Plan face caméra dynamique ou démonstration concrète" },
        { step: "14s - 23s (Notre méthode)", description: "Présentation de notre accompagnement clé en main.", visualTip: "Plans de travail appliqués et professionnels" },
        { step: "23s - 30s (Appel)", description: "Passez à l'action dès aujourd'hui avec un devis gratuit.", visualTip: "Bannière avec numéro de téléphone et logo" },
      ],
      captionTemplate: "Gagnez en sérénité et atteignez vos objectifs avec l'accompagnement de {brand}. Notre équipe d'experts est à votre écoute pour vous proposer la solution idéale.",
      cta: "Écrivez-nous en DM pour recevoir une consultation ou un devis personnalisé 📞",
      hashtags: ["solutions_dz", "service_algerie", "qualitedz", "algeria_business"],
      taskPrefix: "Montage Reel Solution",
    },
    {
      theme: "Preuve & Confiance",
      title: "Étude de cas : Comment nous avons dépassé les attentes de notre client",
      format: "REEL_9_16",
      hook: "« Quand le client est venu nous voir, il avait un défi de taille... Voici le résultat ! » 🏆",
      scriptOrSlides: [
        { step: "0s - 4s (Le contexte)", description: "Présentation brève du besoin initial et des contraintes de temps.", visualTip: "Mise en situation rythmée" },
        { step: "4s - 15s (L'intervention)", description: "Les actions stratégiques mises en place par notre équipe.", visualTip: "Plans accélérés du travail d'équipe et de la coordination" },
        { step: "15s - 24s (Les résultats)", description: "Chiffres et satisfaction exprimée par le client.", visualTip: "Graphique ou retour client positif en surbrillance" },
        { step: "24s - 30s (Conclusion)", description: "Vous aussi, faites confiance à notre équipe pour vos projets.", visualTip: "Coordonnées de l'entreprise" },
      ],
      captionTemplate: "La satisfaction de nos partenaires est notre plus belle fierté ! Bravo à l'équipe {brand} pour ce projet mené avec brio. Et vous, quel est votre prochain projet ?",
      cta: "Prenez rendez-vous avec notre équipe pour concrétiser votre vision 🚀",
      hashtags: ["reussitedz", "projet_algerie", "partenaire_confiance", "businessdz"],
      taskPrefix: "Montage Reel Étude de Cas",
    },
  ],
};

// Bibliothèque de thèmes stratégiques variés pour génération dynamique illimitée
export const DYNAMIC_THEME_LIBRARY = [
  { pillar: "Qualité & Savoir-faire", title: "L'Exigence et le Savoir-faire {brand}", description: "Mettre en valeur le sens du détail, les standards de qualité et l'authenticité.", color: "from-amber-500 to-orange-600" },
  { pillar: "Expérience & Accueil", title: "Ambiance & Cadre Convivial à {wilaya}", description: "Plonger l'audience dans l'atmosphère chaleureuse et le service personnalisé.", color: "from-rose-500 to-red-600" },
  { pillar: "Offres & Spécialités", title: "Les Formules Signatures & Stars du Mois", description: "Zoom sur les incontournables et les offres phares qui déclenchent l'achat.", color: "from-emerald-500 to-teal-600" },
  { pillar: "Coulisses & Équipe", title: "Dans les Secrets de Fabrication & Coulisses", description: "Format dynamique valorisant l'équipe, la passion et l'engagement au quotidien.", color: "from-blue-500 to-indigo-600" },
  { pillar: "Storytelling & Identité", title: "L'Histoire et les Valeurs Derrière {brand}", description: "Créer une connexion émotionnelle forte avec l'histoire et les ambitions de la marque.", color: "from-purple-600 to-indigo-700" },
  { pillar: "Preuve Sociale & Avis", title: "Ce Que Nos Clients Disent de Nous", description: "Avis vérifiés, recommandations et notes Google pour rassurer et convaincre.", color: "from-amber-600 to-yellow-600" },
  { pillar: "Guides & Astuces", title: "Le Guide Pratique Sauvegardable", description: "Conseils pratiques et vulgarisés à conserver absolument pour son quotidien.", color: "from-cyan-600 to-blue-600" },
  { pillar: "Mythes vs Réalité", title: "Démêler le Vrai du Faux dans le Métier", description: "Briser les idées reçues pour positionner {brand} comme l'expert de référence.", color: "from-violet-600 to-purple-800" },
  { pillar: "Avant / Après Concret", title: "La Métamorphose & Résultats Réels", description: "Preuve irréfutable de l'impact et de l'efficacité de vos solutions.", color: "from-teal-600 to-emerald-700" },
  { pillar: "Questions Fréquentes (FAQ)", title: "Réponses Claires à Vos Interrogations", description: "Lever tous les freins à l'achat et faciliter le premier contact ou la réservation.", color: "from-sky-500 to-blue-700" },
  { pillar: "Vie Locale & Événements", title: "Au Cœur de la Vie Locale à {wilaya}", description: "Ancrage local fort, actualités de la région et célébration des moments festifs.", color: "from-orange-500 to-rose-600" },
  { pillar: "Défis & Communauté", title: "Quiz, Sondages et Interaction Abonnés", description: "Engager activement la communauté avec des formats ludiques et participatifs.", color: "from-pink-500 to-fuchsia-600" },
  { pillar: "Innovation & Avenir", title: "Les Nouveautés et Projets Exclusifs", description: "Présentation des évolutions et technologies modernes adoptées par {brand}.", color: "from-indigo-500 to-cyan-600" },
  { pillar: "Privilèges & Fidélité", title: "Avantages VIP et Offres Limitées", description: "Récompenser les habitués et générer de l'urgence avec des promotions ciblées.", color: "from-red-600 to-amber-600" },
  { pillar: "Transparence & Hygiène", title: "Rigueur, Propreté et Normes Appliquées", description: "Montrer le respect absolu des règles de sécurité et la transparence totale.", color: "from-emerald-600 to-green-700" },
  { pillar: "Moments de Partage", title: "Sourires, Émotions et Convivialité", description: "Mettre en lumière l'humain et les moments partagés au sein de l'établissement.", color: "from-amber-500 to-rose-500" },
];

/**
 * Moteur principal de génération éditoriale IA par secteur et pack client
 * Calibré strictement sur les livrables contractuels des packs :
 * - STARTER : 2 Carrousels + 2 Maquettes (SANS REELS)
 * - SILVER  : 3 Carrousels + 3 Maquettes + 2 Vidéos Reels
 * - GOLD    : 4 Carrousels + 4 Maquettes + 4 Vidéos Reels
 */
export function generateAiEditorialPlan(params: {
  clientName: string;
  brandName?: string | null;
  sector: string;
  wilaya?: string | null;
  offerType: OfferType;
  goal?: string;
  monthName?: string;
  seed?: number;
}): EditorialPlanResult {
  const {
    clientName,
    brandName,
    sector,
    wilaya = "Alger",
    offerType = "STARTER",
    goal = "ALL_ROUND",
    monthName = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date()),
    seed = 0,
  } = params;

  const displayName = brandName?.trim() || clientName.trim() || "Notre Marque";
  const quotaConfig = WEEKLY_QUOTAS_BY_OFFER[offerType] || WEEKLY_QUOTAS_BY_OFFER.STARTER;
  const weeklyQuota = quotaConfig.weekly;
  const totalPublicationsNeeded = quotaConfig.monthly;
  const goalInfo = STRATEGIC_GOALS[goal] || STRATEGIC_GOALS.ALL_ROUND;

  // Trouver les connaissances sectorielles
  const sLower = (sector || "").toLowerCase();
  let sectorData = GENERAL_SECTOR_KNOWLEDGE;

  if (
    sLower.includes("restau") ||
    sLower.includes("food") ||
    sLower.includes("café") ||
    sLower.includes("cafe") ||
    sLower.includes("pizz") ||
    sLower.includes("burger") ||
    sLower.includes("boulangerie")
  ) {
    sectorData = SECTOR_KNOWLEDGE_BASE["Restaurant"];
  } else if (
    sLower.includes("médic") ||
    sLower.includes("medic") ||
    sLower.includes("docteur") ||
    sLower.includes("santé") ||
    sLower.includes("sante") ||
    sLower.includes("clinique") ||
    sLower.includes("cabinet")
  ) {
    sectorData = SECTOR_KNOWLEDGE_BASE["Cabinet médical"];
  } else {
    const matchedSectorKey = Object.keys(SECTOR_KNOWLEDGE_BASE).find(
      (k) => sLower.includes(k.toLowerCase()) || k.toLowerCase().includes(sLower)
    );
    if (matchedSectorKey) {
      sectorData = SECTOR_KNOWLEDGE_BASE[matchedSectorKey];
    }
  }

  // Thèmes du mois : Sélection dynamique parmi la bibliothèque pour une variété illimitée à chaque régénération
  const themeStartIndex = (seed * 3) % DYNAMIC_THEME_LIBRARY.length;
  const themes: EditorialTheme[] = [];
  for (let i = 0; i < 4; i++) {
    const rawTheme = DYNAMIC_THEME_LIBRARY[(themeStartIndex + i) % DYNAMIC_THEME_LIBRARY.length];
    themes.push({
      id: `theme-${i + 1}`,
      pillar: rawTheme.pillar,
      title: rawTheme.title.replace(/\{brand\}/g, displayName).replace(/\{wilaya\}/g, wilaya || "Alger"),
      description: rawTheme.description.replace(/\{brand\}/g, displayName).replace(/\{wilaya\}/g, wilaya || "Alger"),
      color: rawTheme.color,
    });
  }

  // Pools de contenu par format : Combiner les blueprints sectoriels et généraux pour un vivier riche
  const maquettesPool = [
    ...sectorData.maquettes,
    ...GENERAL_SECTOR_KNOWLEDGE.maquettes,
  ];
  const carouselsPool = [
    ...sectorData.carousels,
    ...GENERAL_SECTOR_KNOWLEDGE.carousels,
  ];
  const reelsPool = [
    ...sectorData.reels,
    ...GENERAL_SECTOR_KNOWLEDGE.reels,
  ];

  // Structure des livrables par semaine selon le pack
  // STARTER: 4 publications (Semaine 1: Maquette, Semaine 2: Carrousel, Semaine 3: Maquette, Semaine 4: Carrousel) -> 2 Maquettes + 2 Carrousels (ZÉRO REEL)
  // SILVER: 8 publications (2 par semaine) -> 3 Carrousels + 3 Maquettes + 2 Reels
  // GOLD: 12 publications (3 par semaine) -> 4 Carrousels + 4 Maquettes + 4 Reels
  let weeklyPlanStructure: ("STATIC_POST" | "CAROUSEL" | "REEL_9_16")[][] = [];

  if (offerType === "STARTER") {
    weeklyPlanStructure = [
      ["STATIC_POST"], // Semaine 1 : Maquette visuelle
      ["CAROUSEL"],    // Semaine 2 : Carrousel 1
      ["STATIC_POST"], // Semaine 3 : Maquette visuelle
      ["CAROUSEL"],    // Semaine 4 : Carrousel 2
    ];
  } else if (offerType === "SILVER") {
    weeklyPlanStructure = [
      ["STATIC_POST", "CAROUSEL"],  // Semaine 1 (1 Maquette + 1 Carrousel)
      ["REEL_9_16", "STATIC_POST"], // Semaine 2 (1 Reel + 1 Maquette)
      ["CAROUSEL", "STATIC_POST"],  // Semaine 3 (1 Carrousel + 1 Maquette)
      ["REEL_9_16", "CAROUSEL"],    // Semaine 4 (1 Reel + 1 Carrousel)
    ];
  } else if (offerType === "GOLD") {
    weeklyPlanStructure = [
      ["STATIC_POST", "CAROUSEL", "REEL_9_16"], // Semaine 1
      ["STATIC_POST", "CAROUSEL", "REEL_9_16"], // Semaine 2
      ["STATIC_POST", "CAROUSEL", "REEL_9_16"], // Semaine 3
      ["STATIC_POST", "CAROUSEL", "REEL_9_16"], // Semaine 4
    ];
  } else {
    // CUSTOM
    weeklyPlanStructure = [
      ["STATIC_POST", "CAROUSEL"],
      ["STATIC_POST", "CAROUSEL"],
      ["STATIC_POST", "CAROUSEL"],
      ["STATIC_POST", "CAROUSEL"],
    ];
  }

  const daysOfWeek = ["Mardi (18h)", "Jeudi (19h)", "Dimanche (20h)", "Lundi (12h30)", "Vendredi (16h)"];
  const publications: PublicationProposal[] = [];

  let maquetteIdx = seed * 3;
  let carouselIdx = seed * 3 + 1;
  let reelIdx = seed * 3 + 2;

  for (let week = 1; week <= 4; week++) {
    const weekFormats = weeklyPlanStructure[week - 1] || ["CAROUSEL"];
    const weekLabel = `Semaine ${week} (Semaine ${week}/4)`;

    weekFormats.forEach((fmt, pInWeek) => {
      let bp: ContentBlueprint;
      let formatLabel = "";
      let taskPrefix = "";

      if (fmt === "STATIC_POST") {
        bp = maquettesPool[maquetteIdx % maquettesPool.length];
        maquetteIdx++;
        formatLabel = "Maquette Design Graphique";
        taskPrefix = "Maquette Design Social";
      } else if (fmt === "CAROUSEL") {
        bp = carouselsPool[carouselIdx % carouselsPool.length];
        carouselIdx++;
        formatLabel = "Carrousel (5-7 slides)";
        taskPrefix = "Création Carrousel";
      } else {
        bp = reelsPool[reelIdx % reelsPool.length];
        reelIdx++;
        // Quotas voix off : Silver = 1 voix off (semaine 2), Gold = 2 voix off (semaines 1 et 3)
        const isVoiceOverReel =
          (offerType === "SILVER" && week === 2) ||
          (offerType === "GOLD" && (week === 1 || week === 3));
        formatLabel = isVoiceOverReel
          ? "Reel 9:16 (30s avec Voix Off)"
          : "Reel 9:16 (30s dynamique)";
        taskPrefix = isVoiceOverReel ? "Montage Reel (Voix Off)" : "Montage Reel";
      }

      const isVoiceOver =
        fmt === "REEL_9_16" &&
        ((offerType === "SILVER" && week === 2) ||
          (offerType === "GOLD" && (week === 1 || week === 3)));

      const daySuggestion = daysOfWeek[(week + pInWeek) % daysOfWeek.length];
      const title = bp.title.replace(/\{brand\}/g, displayName).replace(/\{wilaya\}/g, wilaya || "Alger");
      const hook = bp.hook.replace(/\{brand\}/g, displayName).replace(/\{wilaya\}/g, wilaya || "Alger");
      const caption = bp.captionTemplate.replace(/\{brand\}/g, displayName).replace(/\{wilaya\}/g, wilaya || "Alger");
      const taskTitle = `${taskPrefix}: ${title.substring(0, 50)}`;

      // Hashtags personnalisés
      const sectorTag = sector.toLowerCase().replace(/[^a-z0-9]/g, "");
      const wilayaTag = (wilaya || "alger").toLowerCase().replace(/[^a-z0-9]/g, "");
      const finalHashtags = Array.from(
        new Set([...bp.hashtags, sectorTag, wilayaTag, "algerie", "dzair"])
      ).slice(0, 8);

      publications.push({
        id: `pub-w${week}-${pInWeek + 1}-${seed}-${Date.now().toString(36)}`,
        week,
        weekLabel,
        daySuggestion,
        theme: themes[(week - 1) % themes.length]?.title || bp.theme,
        title,
        format: bp.format,
        formatLabel,
        hook,
        scriptOrSlides: bp.scriptOrSlides.map((s) => ({
          step: s.step,
          description: s.description.replace(/\{brand\}/g, displayName).replace(/\{wilaya\}/g, wilaya || "Alger"),
          visualTip: s.visualTip,
        })),
        caption,
        cta: bp.cta,
        hashtags: finalHashtags,
        suggestedTaskTitle: taskTitle,
        hasVoiceOver: isVoiceOver,
        isCreatedAsTask: false,
      });
    });
  }

  const packSummary =
    offerType === "STARTER"
      ? "Pack Starter : 2 Carrousels & 2 Maquettes (SANS REELS)"
      : offerType === "SILVER"
      ? "Pack Silver : 3 Carrousels, 3 Maquettes, 2 Reels & 1 Voix off"
      : offerType === "GOLD"
      ? "Pack Gold : 4 Carrousels, 4 Maquettes, 4 Reels & 2 Voix off"
      : "Pack Personnalisé Sur-Mesure";

  const strategicSummary = `Plan éditorial pour ${displayName} (${sector} - ${wilaya || "Algérie"}). Offre active : ${packSummary}. Quota garanti : ${weeklyQuota} publication(s)/semaine (${totalPublicationsNeeded} au total pour le mois de ${monthName}).`;

  return {
    clientName,
    brandName,
    sector,
    wilaya,
    offerType,
    weeklyQuota,
    monthlyTotal: totalPublicationsNeeded,
    monthName,
    goal,
    goalLabel: goalInfo.label,
    strategicSummary,
    packSummary,
    themes,
    publications,
  };
}
