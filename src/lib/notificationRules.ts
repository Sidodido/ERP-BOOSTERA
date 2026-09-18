/**
 * Business rules for automatic task notifications:
 * 1. Voix-Off / Enregistrement -> Notifier Meroua
 * 2. Shooting / Captation -> Notifier Toufik
 * 3. Site vitrine / E-commerce / Plateforme / Application / Web -> Notifier la Direction
 */

export interface NotificationTarget {
  type: "MEROUA" | "TOUFIK" | "DIRECTION";
  recipientName: string;
  badgeText: string;
  hint: string;
  color: string;
}

export function detectTaskNotificationTarget(
  title: string,
  description?: string | null
): NotificationTarget | null {
  const content = `${title || ""} ${description || ""}`.toLowerCase();

  // 1. Voix-Off -> Meroua
  if (
    content.includes("voix off") ||
    content.includes("voix-off") ||
    content.includes("voix") ||
    content.includes("enregistrement")
  ) {
    return {
      type: "MEROUA",
      recipientName: "Meroua",
      badgeText: "🎤 Meroua sera automatiquement notifiée",
      hint: "Cette tâche concerne la Voix-Off : une notification automatique sera envoyée à Meroua.",
      color: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    };
  }

  // 2. Shooting -> Toufik
  if (
    content.includes("shooting") ||
    content.includes("captation")
  ) {
    return {
      type: "TOUFIK",
      recipientName: "Toufik",
      badgeText: "📸 Toufik sera automatiquement notifié",
      hint: "Cette tâche concerne un Shooting sur site : une notification automatique sera envoyée à Toufik.",
      color: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    };
  }

  // 3. Tous les choix de la Partie 2 (Montage Reel/TikTok, Carrousel, Maquette, Site Web, Ads, etc.) -> Direction
  if (
    // Web, Tech & Plateformes
    content.includes("site vitrine") ||
    content.includes("vitrine") ||
    content.includes("vitrin") ||
    content.includes("e-commerce") ||
    content.includes("ecommerce") ||
    content.includes("plateforme") ||
    content.includes("platform") ||
    content.includes("plaform") ||
    content.includes("application") ||
    content.includes("appli") ||
    content.includes("site web") ||
    content.includes("site") ||
    content.includes("web") ||
    content.includes("intégration") ||
    content.includes("integration") ||
    content.includes("développement") ||
    content.includes("developpement") ||
    // Montage Reel / TikTok
    content.includes("montage") ||
    content.includes("reel") ||
    content.includes("tiktok") ||
    content.includes("vidéo") ||
    content.includes("video") ||
    // Carrousel & Design Social
    content.includes("carrousel") ||
    content.includes("carousel") ||
    content.includes("instagram") ||
    // Maquette & UI/UX Figma
    content.includes("maquette") ||
    content.includes("figma") ||
    content.includes("ui/ux") ||
    content.includes("design") ||
    // Campagne & Meta Ads
    content.includes("campagne") ||
    content.includes("meta ads") ||
    content.includes("ads") ||
    content.includes("sponsor") ||
    content.includes("publicité") ||
    content.includes("publicite")
  ) {
    return {
      type: "DIRECTION",
      recipientName: "Direction BOOSTERA",
      badgeText: "💻 La Direction sera automatiquement notifiée",
      hint: "Cette tâche concerne la Partie 2 (Montage, Carrousel, Maquette, Web ou Ads) : la Direction recevra une alerte immédiate.",
      color: "border-purple-500/30 bg-purple-500/10 text-purple-400",
    };
  }

  return null;
}

export function findSuggestedAssigneeId(
  targetType: "MEROUA" | "TOUFIK" | "DIRECTION",
  users: Array<{ id: string; name: string; role?: string; email?: string }>
): string | undefined {
  if (targetType === "MEROUA") {
    const user = users.find(
      (u) =>
        u.name.toLowerCase().includes("meroua") ||
        (u.email && u.email.toLowerCase().includes("meroua"))
    );
    return user?.id;
  }

  if (targetType === "TOUFIK") {
    const user = users.find(
      (u) =>
        u.name.toLowerCase().includes("toufik") ||
        (u.email && u.email.toLowerCase().includes("toufik"))
    );
    return user?.id;
  }

  if (targetType === "DIRECTION") {
    const user = users.find(
      (u) =>
        u.role === "ADMIN" ||
        u.role === "SALES_DIRECTOR" ||
        u.name.toLowerCase().includes("direction")
    );
    return user?.id;
  }

  return undefined;
}

export interface ResolvedNotificationInfo {
  badgeText: string;
  hint: string;
  theme: {
    bg: string;
    border: string;
    text: string;
    hintText: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    iconColor: string;
  };
}

export function resolveTaskNotificationInfo(
  title: string,
  description?: string | null,
  assignee?: { id: string; name: string; role?: string } | null
): ResolvedNotificationInfo | null {
  const target = detectTaskNotificationTarget(title, description);

  // Si ni cible spéciale ni assigné, pas de bandeau
  if (!target && !assignee) return null;

  const amberTheme = {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-300",
    hintText: "text-amber-200/90",
    badgeBg: "bg-amber-500/20",
    badgeText: "text-amber-300",
    badgeBorder: "border-amber-500/40",
    iconColor: "text-amber-400",
  };

  const blueTheme = {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-300",
    hintText: "text-blue-200/90",
    badgeBg: "bg-blue-500/20",
    badgeText: "text-blue-300",
    badgeBorder: "border-blue-500/40",
    iconColor: "text-blue-400",
  };

  const purpleTheme = {
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    text: "text-purple-300",
    hintText: "text-purple-200/90",
    badgeBg: "bg-purple-500/20",
    badgeText: "text-purple-300",
    badgeBorder: "border-purple-500/40",
    iconColor: "text-purple-400",
  };

  // Cas 1 : Cible Toufik (Shooting)
  if (target?.type === "TOUFIK") {
    if (assignee && !assignee.name.toLowerCase().includes("toufik")) {
      return {
        badgeText: `🔔 ${assignee.name} & Toufik seront automatiquement notifiés`,
        hint: `Notification directe pour ${assignee.name} (assigné à la tâche) ainsi que pour Toufik (technicien shooting sur site).`,
        theme: amberTheme,
      };
    }
    return {
      badgeText: `📸 Toufik sera automatiquement notifié`,
      hint: `Cette tâche concerne un Shooting sur site : une notification automatique sera envoyée à Toufik.`,
      theme: amberTheme,
    };
  }

  // Cas 2 : Cible Meroua (Voix-Off)
  if (target?.type === "MEROUA") {
    if (assignee && !assignee.name.toLowerCase().includes("meroua")) {
      return {
        badgeText: `🔔 ${assignee.name} & Meroua seront automatiquement notifiés`,
        hint: `Notification directe pour ${assignee.name} (assigné à la tâche) ainsi que pour Meroua (voix-off).`,
        theme: blueTheme,
      };
    }
    return {
      badgeText: `🎤 Meroua sera automatiquement notifiée`,
      hint: `Cette tâche concerne la Voix-Off : une notification automatique sera envoyée à Meroua.`,
      theme: blueTheme,
    };
  }

  // Cas 3 : Cible Direction (Montage, Web, Ads, etc.)
  if (target?.type === "DIRECTION") {
    const isDir = assignee?.role === "ADMIN" || assignee?.role === "SALES_DIRECTOR";
    if (assignee && !isDir) {
      return {
        badgeText: `🔔 ${assignee.name} & la Direction seront notifiés`,
        hint: `Notification directe pour ${assignee.name} (assigné à la tâche) avec copie à la Direction BOOSTERA.`,
        theme: purpleTheme,
      };
    }
    return {
      badgeText: `💻 La Direction sera automatiquement notifiée`,
      hint: `Cette tâche concerne la Partie 2 (Montage, Carrousel, Maquette, Web ou Ads) : la Direction recevra une alerte immédiate.`,
      theme: purpleTheme,
    };
  }

  // Cas 4 : Pas de cible spéciale, mais un membre assigné sélectionné
  if (assignee) {
    return {
      badgeText: `🔔 ${assignee.name} sera automatiquement notifié(e)`,
      hint: `Une alerte directe sera envoyée dans l'espace notifications de ${assignee.name} dès la création de cette tâche.`,
      theme: blueTheme,
    };
  }

  return null;
}
