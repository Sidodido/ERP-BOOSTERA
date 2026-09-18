"use client";

import { logActivityAction } from "@/actions/activities";

export interface CommunicationClickParams {
  type: "PHONE" | "WHATSAPP";
  targetName?: string | null;
  phone?: string | null;
  entityType?: "PROSPECT" | "CLIENT" | "APPOINTMENT";
  entityId?: string | null;
  notes?: string | null;
}

/**
 * Client-side fire-and-forget tracker for phone calls and WhatsApp clicks
 */
export function trackCommunicationClick({
  type,
  targetName,
  phone,
  entityType = "PROSPECT",
  entityId,
  notes,
}: CommunicationClickParams) {
  try {
    const action = type === "WHATSAPP" ? "COMMUNICATION_WHATSAPP" : "COMMUNICATION_PHONE";
    const details = {
      type: type === "WHATSAPP" ? "WHATSAPP_MESSAGE" : "PHONE_CALL",
      targetName: targetName || "Contact / Entreprise",
      phone: phone || "Numéro non renseigné",
      entityType,
      notes: notes || null,
      clickedAt: new Date().toISOString(),
    };

    // Non-blocking fire-and-forget
    setTimeout(() => {
      logActivityAction({
        action,
        module: "COMMUNICATION",
        entityId: entityId || null,
        details,
      }).catch(() => {
        // Silently swallow errors to never disrupt user navigation
      });
    }, 0);
  } catch {
    // Non-blocking
  }
}
