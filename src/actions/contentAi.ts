"use server";

import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { TaskStatus, TaskPriority, OfferType, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { dispatchTaskNotifications } from "@/actions/notifications";
import {
  generateAiEditorialPlan,
  EditorialPlanResult,
  PublicationProposal,
  WEEKLY_QUOTAS_BY_OFFER,
} from "@/lib/aiContentGenerator";
import { generateEditorialPlanWithGemini } from "@/lib/gemini";
import { generateEditorialPlanWithOpenAi } from "@/lib/openai";
import {
  getResolvedGeminiApiKey,
  getResolvedOpenAiApiKey,
  maskApiKey,
} from "@/lib/aiConfig";
import {
  parseClientMedia,
  serializeClientMedia,
  getMonthKey,
  getStoredEditorialPlan,
  saveEditorialPlanToNotes,
  updateStoredPublicationInNotes,
} from "@/lib/utils";

/**
 * Génère ou recalcule le plan éditorial IA relié à Google Gemini
 * Fonctionne soit par projectId soit par clientId pour la section Abonnements
 */
export async function generateEditorialPlanAction(params: {
  projectId?: string;
  clientId?: string;
  goal?: string;
  monthName?: string;
  seed?: number;
  apiKey?: string;
  openAiApiKey?: string;
  provider?: "AUTO" | "GEMINI" | "OPENAI";
  forceRegenerate?: boolean;
}): Promise<{
  success: boolean;
  plan?: EditorialPlanResult;
  source?: "GEMINI_AI" | "OPENAI_CHATGPT" | "LOCAL_ENGINE";
  modelUsed?: string;
  notice?: string;
  error?: string;
}> {
  try {
    await requireAuth();

    let client: any = null;
    let existingTaskTitles: string[] = [];

    if (params.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: params.projectId },
        include: {
          client: true,
          tasks: {
            select: { id: true, title: true, status: true },
          },
        },
      });

      if (!project) {
        return { success: false, error: "Projet introuvable" };
      }
      client = project.client;
      existingTaskTitles = project.tasks.map((t) => t.title.toLowerCase());
    } else if (params.clientId) {
      client = await prisma.client.findUnique({
        where: { id: params.clientId },
        include: {
          projects: {
            include: {
              tasks: { select: { id: true, title: true } },
            },
          },
        },
      });

      if (!client) {
        return { success: false, error: "Client introuvable" };
      }

      existingTaskTitles = client.projects.flatMap((p: any) =>
        p.tasks.map((t: any) => t.title.toLowerCase())
      );
    } else {
      return { success: false, error: "Identifiant de projet ou client requis" };
    }

    // Vérifier si un plan éditorial a déjà été généré pour ce client pour le mois en cours
    const monthKey = getMonthKey();
    const storedPlan = getStoredEditorialPlan(client.notes, monthKey);

    if (storedPlan && !params.forceRegenerate && (!params.seed || params.seed === 0)) {
      // Détecter les publications déjà converties en tâches réelles
      const publicationsWithTasks = (storedPlan.publications || []).map((pub: PublicationProposal) => {
        const isCreated = existingTaskTitles.some(
          (extTitle) =>
            extTitle.includes(pub.title.toLowerCase().substring(0, 25)) ||
            (pub.suggestedTaskTitle && extTitle.includes(pub.suggestedTaskTitle.toLowerCase().substring(0, 25)))
        );
        return { ...pub, isCreatedAsTask: isCreated };
      });

      return {
        success: true,
        plan: { ...storedPlan, publications: publicationsWithTasks },
        source: (storedPlan as any)._source || "GEMINI_AI",
        modelUsed: (storedPlan as any)._modelUsed,
        notice: `Plan éditorial enregistré du mois (${storedPlan.monthName || monthKey}) chargé selon le contrat.`,
      };
    }

    // Extraire les réseaux sociaux stockés dans les médias du client (notes [CLIENT_MEDIA:...])
    const { media, cleanNotes } = parseClientMedia(client.notes, client);
    const clientFacebook = media.facebook || client.facebook;
    const clientInstagram = media.instagram || client.instagram;
    const clientTiktok = media.tiktok;

    const providerChoice = params.provider || "AUTO";
    const openAiKey = getResolvedOpenAiApiKey(params.openAiApiKey);
    const geminiKey = getResolvedGeminiApiKey(params.apiKey);

    let aiResult: {
      success: boolean;
      source: "GEMINI_AI" | "OPENAI_CHATGPT" | "LOCAL_ENGINE";
      modelUsed?: string;
      plan: EditorialPlanResult;
      notice?: string;
      error?: string;
    };

    if (providerChoice === "OPENAI" || (providerChoice === "AUTO" && openAiKey && !geminiKey)) {
      aiResult = await generateEditorialPlanWithOpenAi({
        clientName: client.companyName,
        brandName: client.brandName,
        sector: client.sector,
        wilaya: client.wilaya,
        offerType: client.offerType,
        facebook: clientFacebook,
        instagram: clientInstagram,
        tiktok: clientTiktok,
        phone: client.phone,
        email: client.email,
        notes: cleanNotes || client.notes,
        goal: params.goal,
        monthName: params.monthName,
        seed: params.seed,
        apiKey: openAiKey,
      });

      // Si OpenAI échoue (ex: solde de crédits 429 épuisé) et que Google Gemini est disponible, basculer sur Gemini
      if (aiResult.source === "LOCAL_ENGINE" && geminiKey) {
        const geminiTry = await generateEditorialPlanWithGemini({
          clientName: client.companyName,
          brandName: client.brandName,
          sector: client.sector,
          wilaya: client.wilaya,
          offerType: client.offerType,
          facebook: clientFacebook,
          instagram: clientInstagram,
          tiktok: clientTiktok,
          phone: client.phone,
          email: client.email,
          notes: cleanNotes || client.notes,
          goal: params.goal,
          monthName: params.monthName,
          seed: params.seed,
          apiKey: geminiKey,
        });
        if (geminiTry.source === "GEMINI_AI") {
          aiResult = {
            ...geminiTry,
            notice: `Généré en direct par Google Gemini (Basculement automatique : le solde de crédits OpenAI est épuisé).`,
          };
        }
      }
    } else {
      aiResult = await generateEditorialPlanWithGemini({
        clientName: client.companyName,
        brandName: client.brandName,
        sector: client.sector,
        wilaya: client.wilaya,
        offerType: client.offerType,
        facebook: clientFacebook,
        instagram: clientInstagram,
        tiktok: clientTiktok,
        phone: client.phone,
        email: client.email,
        notes: cleanNotes || client.notes,
        goal: params.goal,
        monthName: params.monthName,
        seed: params.seed,
        apiKey: geminiKey,
      });

      // Si Gemini échoue mais qu'OpenAI est configuré, basculer sur OpenAI
      if (aiResult.source === "LOCAL_ENGINE" && openAiKey) {
        const openAiTry = await generateEditorialPlanWithOpenAi({
          clientName: client.companyName,
          brandName: client.brandName,
          sector: client.sector,
          wilaya: client.wilaya,
          offerType: client.offerType,
          facebook: clientFacebook,
          instagram: clientInstagram,
          tiktok: clientTiktok,
          phone: client.phone,
          email: client.email,
          notes: cleanNotes || client.notes,
          goal: params.goal,
          monthName: params.monthName,
          seed: params.seed,
          apiKey: openAiKey,
        });
        if (openAiTry.source === "OPENAI_CHATGPT") {
          aiResult = openAiTry;
        }
      }
    }

    const plan = aiResult.plan;

    // Détecter les publications déjà converties en tâches
    plan.publications = plan.publications.map((pub) => {
      const isCreated = existingTaskTitles.some(
        (extTitle) =>
          extTitle.includes(pub.title.toLowerCase().substring(0, 25)) ||
          extTitle.includes(pub.suggestedTaskTitle.toLowerCase().substring(0, 25))
      );
      return { ...pub, isCreatedAsTask: isCreated };
    });

    // Sauvegarder automatiquement ce plan pour le mois dans les notes du client (généré une seule fois par mois)
    try {
      const planToSave = {
        ...plan,
        _source: aiResult.source,
        _modelUsed: aiResult.modelUsed,
      };
      const updatedNotes = saveEditorialPlanToNotes(client.notes, planToSave, monthKey);
      await prisma.client.update({
        where: { id: client.id },
        data: { notes: updatedNotes },
      });
    } catch (saveErr) {
      console.warn("Erreur sauvegarde plan éditorial dans client.notes:", saveErr);
    }

    return {
      success: true,
      plan,
      source: aiResult.source,
      modelUsed: aiResult.modelUsed,
      notice: aiResult.notice,
    };
  } catch (error: any) {
    console.error("Erreur lors de la génération du plan éditorial IA:", error);
    return { success: false, error: error.message || "Erreur inconnue" };
  }
}

/**
 * Convertit une proposition de publication IA en tâche réelle de Phase 2 (Partie 2)
 */
export async function convertProposalToTaskAction(params: {
  projectId?: string;
  clientId?: string;
  proposal: PublicationProposal;
  assigneeId?: string;
}): Promise<{ success: boolean; task?: any; error?: string }> {
  try {
    const user = await requireAuth();

    let project: any = null;

    if (params.projectId) {
      project = await prisma.project.findUnique({
        where: { id: params.projectId },
        include: {
          client: true,
          manager: true,
        },
      });
    }

    if (!project && params.clientId) {
      project = await prisma.project.findFirst({
        where: { clientId: params.clientId },
        include: { client: true, manager: true },
        orderBy: { createdAt: "desc" },
      });

      if (!project) {
        const client = await prisma.client.findUnique({ where: { id: params.clientId } });
        if (client) {
          project = await prisma.project.create({
            data: {
              code: `ABN-${Date.now().toString(36).toUpperCase()}`,
              name: `Abonnement Mensuel - ${client.brandName || client.companyName}`,
              clientId: client.id,
              status: "IN_PRODUCTION",
              budget: client.monthlyFee || 0,
            },
            include: { client: true, manager: true },
          });
        }
      }
    }

    if (!project) {
      return { success: false, error: "Projet ou client introuvable" };
    }

    // Calcul de la date d'échéance selon la semaine
    const now = new Date();
    const targetDate = new Date(now.getTime() + params.proposal.week * 7 * 24 * 60 * 60 * 1000);
    const dueDate = project.deadline && new Date(project.deadline) < targetDate
      ? new Date(project.deadline)
      : targetDate;

    // Construction de la description détaillée de la tâche
    const formattedDescription = [
      `🎯 AXE ÉDITORIAL & THÈME : ${params.proposal.theme}`,
      `📐 FORMAT RECOMMANDÉ : ${params.proposal.formatLabel}`,
      `📅 DIFFUSION CONSEILLÉE : ${params.proposal.daySuggestion} (${params.proposal.weekLabel})`,
      "",
      `⚡ ACCROCHE (HOOK 0-3s / SLIDE 1) :`,
      `"${params.proposal.hook}"`,
      "",
      `🎬 DÉROULÉ DÉTAILLÉ :`,
      ...params.proposal.scriptOrSlides.map(
        (s) => `• ${s.step} : ${s.description}${s.visualTip ? ` [Visuel : ${s.visualTip}]` : ""}`
      ),
      "",
      `📢 CALL TO ACTION (CTA) :`,
      `"${params.proposal.cta}"`,
      "",
      `📝 LÉGENDE / CAPTION :`,
      params.proposal.caption,
      "",
      `🏷️ HASHTAGS :`,
      params.proposal.hashtags.map((h) => `#${h}`).join(" "),
    ].join("\n");

    // Déterminer l'assigné par défaut : technicien (Sidahmed ou rôle technique)
    let finalAssigneeId: string | undefined = params.assigneeId || undefined;
    if (!finalAssigneeId) {
      const defaultTech = await prisma.user.findFirst({
        where: {
          isActive: true,
          OR: [
            { name: { contains: "sidahmed", mode: "insensitive" } },
            { email: { contains: "sidahmed", mode: "insensitive" } },
            { role: { in: [Role.TECH_LEAD, Role.DEVELOPER, Role.DESIGNER, Role.VIDEO_EDITOR] } },
          ],
        },
        orderBy: { createdAt: "asc" },
      });
      finalAssigneeId = defaultTech?.id || undefined;
    }

    const task = await prisma.projectTask.create({
      data: {
        projectId: project.id,
        title: params.proposal.suggestedTaskTitle,
        description: formattedDescription,
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        dueDate,
        assigneeId: finalAssigneeId,
        timeSpentHours: 0,
      },
      include: {
        assignee: true,
        project: { include: { client: true } },
      },
    });

    // Mettre à jour le plan stocké dans les notes du client pour enregistrer le statut créé
    if (project.client?.notes) {
      try {
        const monthKey = getMonthKey();
        const { updatedNotes } = updateStoredPublicationInNotes(
          project.client.notes,
          params.proposal.id,
          { isCreatedAsTask: true },
          monthKey
        );
        await prisma.client.update({
          where: { id: project.client.id },
          data: { notes: updatedNotes },
        });
      } catch (markErr) {
        console.warn("Erreur mise à jour isCreatedAsTask dans client.notes:", markErr);
      }
    }

    await createAuditLog({
      userId: user.id,
      action: "CREATE_TASK_FROM_AI",
      module: "PRODUCTION",
      entityId: task.id,
      details: {
        projectId: project.id,
        clientId: project.clientId,
        title: task.title,
        week: params.proposal.week,
        format: params.proposal.format,
      },
    });

    // Envoi des notifications automatiques (Direction, Assigné, etc.)
    await dispatchTaskNotifications({
      taskId: task.id,
      taskTitle: task.title,
      taskDescription: task.description,
      projectId: task.projectId,
      projectName: task.project.name,
      projectCode: task.project.code,
      assigneeId: task.assigneeId,
    });

    revalidatePath("/production");
    revalidatePath("/projets");
    revalidatePath(`/projets/${project.id}`);
    revalidatePath("/abonnements");
    if (project.clientId) {
      revalidatePath(`/abonnements/${project.clientId}`);
    }

    return { success: true, task };
  } catch (error: any) {
    console.error("Erreur lors de la conversion de la proposition en tâche:", error);
    return { success: false, error: error.message || "Erreur inconnue" };
  }
}

/**
 * Déclenche l'envoi des notifications de début de semaine pour un projet spécifique
 * selon l'offre du client (Starter: 1, Silver: 2, Gold: 3)
 */
export async function sendWeeklyContentNotificationAction(params: {
  projectId?: string;
  clientId?: string;
  weekNumber: number;
  posts: PublicationProposal[];
  skipAuth?: boolean;
}): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    if (!params.skipAuth) {
      await requireAuth();
    }

    let client: any = null;
    let managerId: string | null = null;

    if (params.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: params.projectId },
        include: {
          client: true,
          manager: true,
        },
      });
      if (project) {
        client = project.client;
        managerId = project.managerId;
      }
    }

    if (!client && params.clientId) {
      client = await prisma.client.findUnique({
        where: { id: params.clientId },
        include: {
          assignedTo: true,
        },
      });
    }

    if (!client) {
      return { success: false, count: 0, error: "Client ou projet introuvable" };
    }
    const clientOffer = (client.offerType as OfferType) || "STARTER";
    const quotaInfo = WEEKLY_QUOTAS_BY_OFFER[clientOffer] || WEEKLY_QUOTAS_BY_OFFER.STARTER;
    const postsForWeek = params.posts.filter((p) => p.week === params.weekNumber);
    const postCount = postsForWeek.length || quotaInfo.weekly;

    const postsSummary = postsForWeek
      .map((p, idx) => `${idx + 1}. [${p.format === "REEL_9_16" ? "Reel" : "Carrousel"}] ${p.title}`)
      .join(" | ");

    const notificationTitle = `📅 Planning Semaine ${params.weekNumber} : ${client.companyName} (${clientOffer})`;
    const notificationMessage = `Début de semaine : ${postCount} publication(s) à produire pour ${client.companyName} (Offre ${clientOffer} - Quota ${quotaInfo.weekly}/semaine). Sujets : ${postsSummary || "À générer via le Studio IA"}`;

    // Collecte des destinataires : Chef de projet, Direction Technique, Admins et Equipe de production
    // NOTE : Les rôles commerciaux (SALES_REP, SALES_DIRECTOR) ne doivent JAMAIS recevoir de notifications de publications
    const candidateIds = new Set<string>();

    if (managerId) {
      candidateIds.add(managerId);
    }

    // Direction Technique, Admins et Profils de production technique
    const techAndAdminUsers = await prisma.user.findMany({
      where: {
        OR: [
          { role: Role.ADMIN },
          { role: Role.TECH_LEAD },
          { role: Role.DEVELOPER },
          { role: Role.DESIGNER },
          { role: Role.VIDEO_EDITOR },
        ],
        isActive: true,
      },
      select: { id: true },
    });

    for (const d of techAndAdminUsers) {
      candidateIds.add(d.id);
    }

    // Filtrage strict : éliminer formellement tout utilisateur ayant un rôle commercial
    const validRecipients = await prisma.user.findMany({
      where: {
        id: { in: Array.from(candidateIds) },
        role: {
          notIn: [Role.SALES_REP, Role.SALES_DIRECTOR],
        },
        isActive: true,
      },
      select: { id: true },
    });

    let sentCount = 0;
    const targetLink = params.projectId ? `/projets/${params.projectId}` : `/abonnements/${client.id}`;
    for (const recipient of validRecipients) {
      await prisma.notification.create({
        data: {
          userId: recipient.id,
          title: notificationTitle,
          message: notificationMessage,
          type: "CONTENT_AI",
          link: targetLink,
        },
      });
      sentCount++;
    }

    try {
      revalidatePath(`/projets/${params.projectId}`);
    } catch {
      // Ignored outside Next request context
    }
    return { success: true, count: sentCount };
  } catch (error: any) {
    console.error("Erreur lors de l'envoi de la notification de début de semaine:", error);
    return { success: false, count: 0, error: error.message || "Erreur inconnue" };
  }
}

/**
 * Action globale (Cron hebdomadaire) pour notifier tous les projets actifs de l'agence
 * chaque début de semaine selon l'offre respective de chaque client (Starter 1, Silver 2, Gold 3).
 */
export async function triggerWeeklyCronForAllActiveClientsAction(): Promise<{
  success: boolean;
  notifiedProjects: number;
  totalNotifications: number;
  details: string[];
}> {
  try {
    // Projets actifs en cours (hors terminés ou annulés)
    const activeProjects = await prisma.project.findMany({
      where: {
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        client: {
          status: { notIn: ["TERMINATED", "CONTENTIOUS"] },
        },
      },
      include: {
        client: true,
        manager: true,
      },
    });

    // Calcul de la semaine du mois courante (1 à 4)
    const dayOfMonth = new Date().getDate();
    const currentWeekNumber = Math.min(4, Math.max(1, Math.ceil(dayOfMonth / 7)));

    let totalNotifications = 0;
    const details: string[] = [];

    for (const project of activeProjects) {
      const client = project.client;
      const plan = generateAiEditorialPlan({
        clientName: client.companyName,
        brandName: client.brandName,
        sector: client.sector,
        wilaya: client.wilaya,
        offerType: client.offerType,
      });

      const res = await sendWeeklyContentNotificationAction({
        projectId: project.id,
        weekNumber: currentWeekNumber,
        posts: plan.publications,
        skipAuth: true,
      });

      if (res.success) {
        totalNotifications += res.count;
        details.push(
          `${client.companyName} (${client.offerType}) : ${plan.weeklyQuota} pub(s) / sem -> ${res.count} notifs envoyées`
        );
      }
    }

    return {
      success: true,
      notifiedProjects: activeProjects.length,
      totalNotifications,
      details,
    };
  } catch (error: any) {
    console.error("Erreur lors du cron hebdomadaire de contenu:", error);
    return {
      success: false,
      notifiedProjects: 0,
      totalNotifications: 0,
      details: [error.message || "Erreur"],
    };
  }
}

/**
 * Enregistre la clé API Google Gemini dans le fichier .env et dans le process actif
 */
export async function saveGeminiApiKeyAction(apiKey: string): Promise<{
  success: boolean;
  maskedKey?: string;
  error?: string;
}> {
  try {
    await requireAuth();
    const cleanKey = apiKey.trim();

    // 1. Mettre à jour en mémoire pour effet immédiat
    process.env.GEMINI_API_KEY = cleanKey;

    // 2. Écrire dans le fichier .env
    const envPath = path.join(process.cwd(), ".env");
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf-8");
    }

    if (/^GEMINI_API_KEY=/m.test(envContent)) {
      envContent = envContent.replace(/^GEMINI_API_KEY=.*$/m, `GEMINI_API_KEY="${cleanKey}"`);
    } else {
      envContent += `\nGEMINI_API_KEY="${cleanKey}"\n`;
    }

    fs.writeFileSync(envPath, envContent, "utf-8");

    revalidatePath("/abonnements");
    revalidatePath("/projets");

    const masked =
      cleanKey.length > 8
        ? `${cleanKey.substring(0, 6)}...${cleanKey.substring(cleanKey.length - 4)}`
        : cleanKey
        ? "***"
        : "";

    return { success: true, maskedKey: masked };
  } catch (error: any) {
    console.error("Erreur lors de l'enregistrement de la clé Gemini:", error);
    return { success: false, error: error.message || "Erreur lors de l'enregistrement" };
  }
}

/**
 * Vérifie si une clé Google Gemini est active sur le serveur
 */
export async function getGeminiApiKeyStatusAction(): Promise<{
  hasKey: boolean;
  maskedKey?: string;
}> {
  try {
    const key = getResolvedGeminiApiKey();

    if (!key) {
      return { hasKey: false };
    }

    return { hasKey: true, maskedKey: maskApiKey(key) };
  } catch {
    return { hasKey: false };
  }
}

/**
 * Met à jour les réseaux sociaux et coordonnées d'un client
 */
export async function updateClientSocialNetworksAction(
  clientId: string,
  data: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    phone?: string;
    notes?: string;
  }
): Promise<{ success: boolean; client?: any; error?: string }> {
  try {
    await requireAuth();
    const existing = await prisma.client.findUnique({ where: { id: clientId } });
    if (!existing) return { success: false, error: "Client introuvable" };

    const { media, cleanNotes } = parseClientMedia(existing.notes, existing);
    if (data.instagram !== undefined) media.instagram = data.instagram.trim();
    if (data.facebook !== undefined) media.facebook = data.facebook.trim();
    if (data.tiktok !== undefined) media.tiktok = data.tiktok.trim();

    let baseNotes = existing.notes || "";
    if (data.notes !== undefined) {
      const tags = (existing.notes || "").match(/\[[A-Z0-9_]+:[^\]]+\]/g) || [];
      baseNotes = tags.join("\n") + (data.notes.trim() ? `\n${data.notes.trim()}` : "");
    }
    const serializedNotes = serializeClientMedia(media, baseNotes);

    const updated = await prisma.client.update({
      where: { id: clientId },
      data: {
        instagram: media.instagram || null,
        facebook: media.facebook || null,
        phone: data.phone !== undefined ? data.phone.trim() : undefined,
        notes: serializedNotes,
      },
    });

    revalidatePath(`/abonnements/${clientId}`);
    revalidatePath("/abonnements");
    revalidatePath(`/clients/${clientId}`);
    return { success: true, client: updated };
  } catch (error: any) {
    console.error("Erreur lors de la mise à jour des réseaux client:", error);
    return { success: false, error: error.message || "Erreur" };
  }
}

/**
 * Enregistre la clé API OpenAI (ChatGPT) dans le fichier .env et dans le process actif
 */
export async function saveOpenAiApiKeyAction(apiKey: string): Promise<{
  success: boolean;
  maskedKey?: string;
  error?: string;
}> {
  try {
    await requireAuth();
    const cleanKey = apiKey.trim();

    // 1. Mettre à jour en mémoire pour effet immédiat
    process.env.OPENAI_API_KEY = cleanKey;

    // 2. Écrire dans le fichier .env
    const envPath = path.join(process.cwd(), ".env");
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf-8");
    }

    if (/^OPENAI_API_KEY=/m.test(envContent)) {
      envContent = envContent.replace(/^OPENAI_API_KEY=.*$/m, `OPENAI_API_KEY="${cleanKey}"`);
    } else {
      envContent += `\nOPENAI_API_KEY="${cleanKey}"\n`;
    }

    fs.writeFileSync(envPath, envContent, "utf-8");

    revalidatePath("/abonnements");
    revalidatePath("/projets");

    const masked =
      cleanKey.length > 8
        ? `${cleanKey.substring(0, 7)}...${cleanKey.substring(cleanKey.length - 4)}`
        : cleanKey
        ? "***"
        : "";

    return { success: true, maskedKey: masked };
  } catch (error: any) {
    console.error("Erreur lors de l'enregistrement de la clé OpenAI:", error);
    return { success: false, error: error.message || "Erreur lors de l'enregistrement" };
  }
}

/**
 * Vérifie si une clé OpenAI (ChatGPT) est active sur le serveur
 */
export async function getOpenAiApiKeyStatusAction(): Promise<{
  hasKey: boolean;
  maskedKey?: string;
}> {
  try {
    const key = getResolvedOpenAiApiKey();

    if (!key) {
      return { hasKey: false };
    }

    return { hasKey: true, maskedKey: maskApiKey(key) };
  } catch {
    return { hasKey: false };
  }
}

/**
 * Régénère unitairement le sujet ou le thème d'une seule publication spécifique
 */
export async function regenerateSinglePublicationAction(params: {
  projectId?: string;
  clientId?: string;
  publication: PublicationProposal;
  goal?: string;
  provider?: "AUTO" | "GEMINI" | "OPENAI";
  apiKey?: string;
  openAiApiKey?: string;
}): Promise<{
  success: boolean;
  publication?: PublicationProposal;
  source?: "GEMINI_AI" | "OPENAI_CHATGPT" | "LOCAL_ENGINE";
  error?: string;
}> {
  try {
    await requireAuth();

    let client: any = null;
    if (params.clientId) {
      client = await prisma.client.findUnique({ where: { id: params.clientId } });
    } else if (params.projectId) {
      const p = await prisma.project.findUnique({
        where: { id: params.projectId },
        include: { client: true },
      });
      client = p?.client;
    }

    if (!client) {
      return { success: false, error: "Client introuvable" };
    }

    const { media, cleanNotes } = parseClientMedia(client.notes, client);
    const pub = params.publication;
    const displayName = client.brandName || client.companyName;
    const providerChoice = params.provider || "AUTO";
    const geminiKey = getResolvedGeminiApiKey(params.apiKey);
    const openAiKey = getResolvedOpenAiApiKey(params.openAiApiKey);

    let newPubData: any = null;
    let sourceUsed: "GEMINI_AI" | "OPENAI_CHATGPT" | "LOCAL_ENGINE" = "LOCAL_ENGINE";

    const promptText = `Tu es le Directeur Artistique et Concepteur-Rédacteur Senior de l'agence BOOSTERA en Algérie.
L'utilisateur souhaite RÉGÉNÉRER LE SUJET ET LE THÈME de cette publication spécifique pour le client :
- Entreprise / Marque : "${displayName}" (Raison sociale : "${client.companyName}")
- Secteur d'activité : "${client.sector}"
- Wilaya : "${client.wilaya || "Algérie"}"
- Instagram : "${media.instagram || "Non spécifié"}"
- Facebook : "${media.facebook || "Non spécifié"}"
- TikTok : "${media.tiktok || "Non spécifié"}"
- Spécificités client : "${cleanNotes || ""}"

PUBLICATION ACTUELLE :
- Semaine : Semaine ${pub.week} (${pub.weekLabel})
- Format obligatoire : ${pub.format === "REEL_9_16" ? "Vidéo Reel 9:16 vertical" : pub.format === "CAROUSEL" ? "Carrousel multi-slides" : "Maquette visuelle graphique"}
- Voix Off : ${pub.hasVoiceOver ? "OUI, voix off requise (indiquer le texte de la voix off dans les scènes)" : "NON, sans voix off (musique rythmée + texte dynamique à l'écran)"}
- ANCIEN THÈME À CHANGER : "${pub.theme}"
- ANCIEN TITRE À CHANGER : "${pub.title}"

CONSIGNE :
Propose un NOUVEAU thème/axe éditorial totalement frais et différent, un NOUVEAU titre accrocheur, un hook irrésistible (0-3s ou slide 1), un déroulé de 3 à 5 étapes ou scènes concrètes avec astuces visuelles de tournage/graphisme pour le marché algérien, une légende complète et engageante, un CTA clair avec contact et 5 hashtags ciblés.

Réponds UNIQUEMENT avec un JSON respectant exactement cette structure :
{
  "theme": "Nouveau thème ou axe éditorial",
  "title": "Nouveau titre de publication accrocheur",
  "hook": "Accroche percutante (0-3s / slide 1)",
  "scriptOrSlides": [
    { "step": "Scène 1 / Slide 1", "description": "Description...", "visualTip": "Astuce visuelle..." },
    { "step": "Scène 2 / Slide 2", "description": "Description...", "visualTip": "Astuce visuelle..." },
    { "step": "Scène 3 / Slide 3", "description": "Description...", "visualTip": "Astuce visuelle..." }
  ],
  "caption": "Texte complet de la légende...",
  "cta": "Appel à l'action précis",
  "hashtags": ["dz", "algerie", "alger", "business"],
  "suggestedTaskTitle": "Titre court pour la tâche"
}`;

    // 1. Essai avec Google Gemini
    if ((providerChoice === "GEMINI" || providerChoice === "AUTO") && geminiKey) {
      try {
        const CANDIDATE_MODELS = [
          "gemini-flash-lite-latest",
          "gemini-flash-latest",
          "gemini-pro-latest",
        ];
        for (const model of CANDIDATE_MODELS) {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }],
              generationConfig: {
                temperature: 0.95,
                topP: 0.95,
                maxOutputTokens: 2048,
                responseMimeType: "application/json",
              },
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              let clean = text.trim();
              if (clean.startsWith("```json")) clean = clean.substring(7);
              if (clean.startsWith("```")) clean = clean.substring(3);
              if (clean.endsWith("```")) clean = clean.substring(0, clean.length - 3);
              newPubData = JSON.parse(clean.trim());
              sourceUsed = "GEMINI_AI";
              break;
            }
          }
        }
      } catch (gemErr) {
        console.warn("Erreur régénération unitaire Gemini:", gemErr);
      }
    }

    // 2. Essai avec OpenAI ChatGPT si demandé ou en fallback
    if (!newPubData && (providerChoice === "OPENAI" || providerChoice === "AUTO") && openAiKey) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openAiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "Tu es un stratège éditorial et créatif social media. Réponds en JSON strict." },
              { role: "user", content: promptText },
            ],
            response_format: { type: "json_object" },
            temperature: 0.9,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const content = data?.choices?.[0]?.message?.content;
          if (content) {
            newPubData = JSON.parse(content);
            sourceUsed = "OPENAI_CHATGPT";
          }
        }
      } catch (openAiErr) {
        console.warn("Erreur régénération unitaire OpenAI:", openAiErr);
      }
    }

    // 2.bis Fallback vers Google Gemini si OpenAI a échoué (ex: solde de crédits 429 épuisé)
    if (!newPubData && geminiKey && providerChoice === "OPENAI") {
      try {
        const CANDIDATE_MODELS = [
          "gemini-flash-lite-latest",
          "gemini-flash-latest",
          "gemini-pro-latest",
        ];
        for (const model of CANDIDATE_MODELS) {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }],
              generationConfig: {
                temperature: 0.95,
                topP: 0.95,
                maxOutputTokens: 2048,
                responseMimeType: "application/json",
              },
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              let clean = text.trim();
              if (clean.startsWith("```json")) clean = clean.substring(7);
              if (clean.startsWith("```")) clean = clean.substring(3);
              if (clean.endsWith("```")) clean = clean.substring(0, clean.length - 3);
              newPubData = JSON.parse(clean.trim());
              sourceUsed = "GEMINI_AI";
              break;
            }
          }
        }
      } catch (gemBackupErr) {
        console.warn("Erreur fallback Gemini unitaire:", gemBackupErr);
      }
    }

    // 3. Fallback algorithmique dynamique
    if (!newPubData) {
      const fallbackPlan = generateAiEditorialPlan({
        clientName: client.companyName,
        brandName: client.brandName,
        sector: client.sector,
        wilaya: client.wilaya,
        offerType: client.offerType,
        seed: Math.floor(Math.random() * 1000) + 1,
      });
      const match = fallbackPlan.publications.find(
        (p) => p.format === pub.format && p.title !== pub.title
      ) || fallbackPlan.publications[0];

      if (match) {
        newPubData = {
          theme: match.theme,
          title: match.title,
          hook: match.hook,
          scriptOrSlides: match.scriptOrSlides,
          caption: match.caption,
          cta: match.cta,
          hashtags: match.hashtags,
          suggestedTaskTitle: match.suggestedTaskTitle,
        };
      }
    }

    const updatedPub: PublicationProposal = {
      ...pub,
      theme: newPubData?.theme || pub.theme,
      title: newPubData?.title || pub.title,
      hook: newPubData?.hook || pub.hook,
      scriptOrSlides: Array.isArray(newPubData?.scriptOrSlides) && newPubData.scriptOrSlides.length > 0
        ? newPubData.scriptOrSlides
        : pub.scriptOrSlides,
      caption: newPubData?.caption || pub.caption,
      cta: newPubData?.cta || pub.cta,
      hashtags: Array.isArray(newPubData?.hashtags) && newPubData.hashtags.length > 0
        ? newPubData.hashtags
        : pub.hashtags,
      suggestedTaskTitle: newPubData?.suggestedTaskTitle || `${pub.formatLabel} : ${newPubData?.title || pub.title}`,
    };

    // Mettre à jour dans les notes du client pour persistance
    const monthKey = getMonthKey();
    const { updatedNotes } = updateStoredPublicationInNotes(
      client.notes,
      pub.id,
      updatedPub,
      monthKey
    );
    await prisma.client.update({
      where: { id: client.id },
      data: { notes: updatedNotes },
    });

    revalidatePath("/abonnements");
    revalidatePath(`/abonnements/${client.id}`);

    return {
      success: true,
      publication: updatedPub,
      source: sourceUsed,
    };
  } catch (error: any) {
    console.error("Erreur regenerateSinglePublicationAction:", error);
    return { success: false, error: error.message || "Erreur" };
  }
}

/**
 * Met à jour manuellement le thème d'une publication dans le plan éditorial
 */
export async function updatePublicationThemeAction(params: {
  clientId?: string;
  projectId?: string;
  publicationId: string;
  newTheme: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();
    let client: any = null;
    if (params.clientId) {
      client = await prisma.client.findUnique({ where: { id: params.clientId } });
    } else if (params.projectId) {
      const p = await prisma.project.findUnique({
        where: { id: params.projectId },
        include: { client: true },
      });
      client = p?.client;
    }

    if (!client) {
      return { success: false, error: "Client introuvable" };
    }

    const monthKey = getMonthKey();
    const { updatedNotes } = updateStoredPublicationInNotes(
      client.notes,
      params.publicationId,
      { theme: params.newTheme.trim() },
      monthKey
    );

    await prisma.client.update({
      where: { id: client.id },
      data: { notes: updatedNotes },
    });

    revalidatePath("/abonnements");
    revalidatePath(`/abonnements/${client.id}`);

    return { success: true };
  } catch (error: any) {
    console.error("Erreur updatePublicationThemeAction:", error);
    return { success: false, error: error.message || "Erreur" };
  }
}

/**
 * Met à jour manuellement tous les détails d'une publication (titre, axe, format, hook, scènes, légende, CTA, hashtags)
 */
export async function updatePublicationDetailsAction(params: {
  clientId?: string;
  projectId?: string;
  publicationId: string;
  updatedPublication: Partial<PublicationProposal>;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();
    let client: any = null;
    if (params.clientId) {
      client = await prisma.client.findUnique({ where: { id: params.clientId } });
    } else if (params.projectId) {
      const p = await prisma.project.findUnique({
        where: { id: params.projectId },
        include: { client: true },
      });
      client = p?.client;
    }

    if (!client) {
      return { success: false, error: "Client introuvable" };
    }

    const monthKey = getMonthKey();
    const { updatedNotes } = updateStoredPublicationInNotes(
      client.notes,
      params.publicationId,
      params.updatedPublication,
      monthKey
    );

    await prisma.client.update({
      where: { id: client.id },
      data: { notes: updatedNotes },
    });

    revalidatePath("/abonnements");
    revalidatePath(`/abonnements/${client.id}`);
    if (params.projectId) {
      revalidatePath(`/projets/${params.projectId}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Erreur updatePublicationDetailsAction:", error);
    return { success: false, error: error.message || "Erreur lors de la mise à jour" };
  }
}



