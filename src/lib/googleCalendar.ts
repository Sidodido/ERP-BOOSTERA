/**
 * Utilitaires pour l'intégration de Google Calendar (Google Agenda) et format iCal (.ics)
 */

export const DEFAULT_CALENDAR_ATTENDEES = [
  "zidanesidahmed18@gmail.com",
  "toufikzidane325@gmail.com",
];

export interface CalendarEventData {
  title: string;
  startTime: Date | string;
  endTime: Date | string;
  location?: string | null;
  description?: string | null;
  targetName?: string | null;
  targetPhone?: string | null;
  targetEmail?: string | null;
  assignedUserName?: string | null;
  crmUrl?: string | null;
  attendees?: string[];
}

/**
 * Formate une date au format UTC requis par Google Calendar (YYYYMMDDTHHmmssZ)
 */
function formatUtcForGoogle(date: Date): string {
  return date.toISOString().replace(/-|:|\.\d+/g, "");
}

/**
 * Construit l'URL officielle Google Calendar (Google Agenda)
 * Permet l'ajout en 1 clic ou l'ouverture automatique avec invités pré-remplis
 */
export function buildGoogleCalendarUrl(event: CalendarEventData): string {
  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);

  const startStr = formatUtcForGoogle(startDate);
  const endStr = formatUtcForGoogle(endDate);

  const eventTitle = event.targetName
    ? `[RDV CRM] ${event.title} — ${event.targetName}`
    : `[RDV CRM] ${event.title}`;

  const allAttendees = Array.from(
    new Set([
      ...DEFAULT_CALENDAR_ATTENDEES,
      ...(event.attendees || []),
      ...(event.targetEmail ? [event.targetEmail] : []),
    ])
  ).filter(Boolean);

  const descriptionParts: string[] = [];
  if (event.targetName) {
    descriptionParts.push(`🏢 Client / Prospect : ${event.targetName}`);
  }
  if (event.targetPhone) {
    descriptionParts.push(`📞 Téléphone : ${event.targetPhone}`);
  }
  if (event.targetEmail) {
    descriptionParts.push(`✉️ Email client : ${event.targetEmail}`);
  }
  if (event.assignedUserName) {
    descriptionParts.push(`👤 Commercial assigné : ${event.assignedUserName}`);
  }
  if (allAttendees.length > 0) {
    descriptionParts.push(`👥 Invités / Participants : ${allAttendees.join(", ")}`);
  }
  if (event.location) {
    descriptionParts.push(`📍 Lieu : ${event.location}`);
  }
  if (event.description) {
    descriptionParts.push(`\n📝 Notes & Détails :\n${event.description}`);
  }
  descriptionParts.push(`\n🔗 Rendez-vous géré dans HDZ SECURITY CRM`);

  const fullDescription = descriptionParts.join("\n");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: eventTitle,
    dates: `${startStr}/${endStr}`,
    details: fullDescription,
  });

  if (allAttendees.length > 0) {
    // In Google Calendar template URLs, 'add' specifies the attendee emails (comma-separated)
    params.append("add", allAttendees.join(","));
  }

  if (event.location && event.location.trim() !== "") {
    params.append("location", event.location.trim());
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Génère et déclenche le téléchargement d'un fichier .ics standard (compatible Google Calendar, Outlook, iPhone)
 */
export function downloadIcsFile(event: CalendarEventData) {
  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);

  const startStr = formatUtcForGoogle(startDate);
  const endStr = formatUtcForGoogle(endDate);
  const nowStr = formatUtcForGoogle(new Date());

  const eventTitle = event.targetName
    ? `[RDV CRM] ${event.title} - ${event.targetName}`
    : `[RDV CRM] ${event.title}`;

  const allAttendees = Array.from(
    new Set([
      ...DEFAULT_CALENDAR_ATTENDEES,
      ...(event.attendees || []),
      ...(event.targetEmail ? [event.targetEmail] : []),
    ])
  ).filter(Boolean);

  const summary = eventTitle.replace(/\n/g, " ");
  const location = (event.location || "").replace(/\n/g, " ");
  const description = [
    event.targetName ? `Contact: ${event.targetName}` : "",
    event.targetPhone ? `Tel: ${event.targetPhone}` : "",
    event.assignedUserName ? `Commercial: ${event.assignedUserName}` : "",
    allAttendees.length > 0 ? `Invités: ${allAttendees.join(", ")}` : "",
    event.description ? `Notes: ${event.description}` : "",
  ]
    .filter(Boolean)
    .join("\\n");

  const attendeeIcsLines = allAttendees.map(
    (email) => `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${email}`
  );

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HDZ SECURITY CRM//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:rdv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@hdz-security.crm`,
    `DTSTAMP:${nowStr}`,
    `DTSTART:${startStr}`,
    `DTEND:${endStr}`,
    `SUMMARY:${summary}`,
    location ? `LOCATION:${location}` : "",
    description ? `DESCRIPTION:${description}` : "",
    ...attendeeIcsLines,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `rdv-${eventTitle.replace(/[^a-zA-Z0-9]/g, "_")}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

