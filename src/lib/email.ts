import nodemailer from "nodemailer";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

type Transporter = ReturnType<typeof nodemailer.createTransport>;

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
  });

  return transporter;
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<{ success: boolean; simulated?: boolean }> {
  const from = process.env.SMTP_FROM || '"HDZ SECURITY ERP" <devnovainfo@gmail.com>';
  const transport = getTransporter();

  if (!transport) {
    console.log("=================================================");
    console.log(`📨 [SIMULATION EMAIL] Vers: ${to}`);
    console.log(`📌 Sujet: ${subject}`);
    console.log("-------------------------------------------------");
    console.log(text || html.replace(/<[^>]+>/g, " ").slice(0, 300) + "...");
    console.log("=================================================");
    return { success: true, simulated: true };
  }

  try {
    await transport.sendMail({
      from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, " "),
    });
    return { success: true };
  } catch (error) {
    console.error("❌ Erreur lors de l'envoi de l'e-mail via SMTP:", error);
    // En cas d'erreur de transport SMTP, on logge pour ne pas casser l'application
    return { success: false };
  }
}

// ============================================================
// TEMPLATES HTML TRANSACTIONNELS PROFESSIONNELS (BRAND BOOSTERA)
// ============================================================

function baseEmailTemplate(title: string, content: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #080b11; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ededed;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #080b11; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 40px 15px;">
        <table role="presentation" width="100%" max-width="560" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; background-color: #121824; border: 1px solid #1f293d; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 35px 20px 35px; border-bottom: 1px solid #1f293d; text-align: left;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width: 38px; height: 38px; background: linear-gradient(135deg, #2563eb, #4f46e5); border-radius: 12px; text-align: center; vertical-align: middle; color: #ffffff; font-weight: 900; font-size: 18px;">
                    H
                  </td>
                  <td style="padding-left: 12px;">
                    <span style="font-size: 16px; font-weight: 800; letter-spacing: 1px; color: #ffffff;">HDZ SECURITY</span>
                    <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; background-color: rgba(59,130,246,0.2); color: #60a5fa; border: 1px solid rgba(59,130,246,0.3); border-radius: 9999px; margin-left: 6px;">ERP</span>
                    <div style="font-size: 11px; color: #64748b; margin-top: 1px;">Plateforme ERP Collaborateurs & Direction</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding: 35px 35px 30px 35px; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 35px; background-color: #0c101a; border-top: 1px solid #1f293d; font-size: 11px; color: #64748b; text-align: center;">
              Cet e-mail a été envoyé automatiquement par le système sécurisé de HDZ SECURITY ERP.<br>
              Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer ce message ou contacter la direction.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export async function sendVerificationEmail(to: string, name: string, verificationUrl: string) {
  const content = `
    <h2 style="font-size: 18px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 12px;">
      Vérifiez votre adresse e-mail professionnelle
    </h2>
    <p style="margin-bottom: 20px; color: #94a3b8;">
      Bonjour <strong>${name}</strong>,<br>
      Votre demande de compte collaborateur sur la plateforme ERP de HDZ SECURITY a bien été enregistrée. Pour poursuivre la validation, veuillez confirmer que cette adresse e-mail vous appartient.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verificationUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #3b82f6); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 14px 28px; border-radius: 12px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);">
        VÉRIFIER MON ADRESSE E-MAIL
      </a>
    </div>

    <p style="font-size: 12px; color: #64748b; margin-top: 25px;">
      Ce lien unique est valable pendant <strong>24 heures</strong>. Après vérification de votre e-mail, votre dossier sera transmis aux administrateurs pour approbation finale.
    </p>
    <p style="font-size: 11px; color: #475569; word-break: break-all; margin-top: 15px;">
      Si le bouton ne fonctionne pas, copiez et collez cette URL dans votre navigateur :<br>
      <a href="${verificationUrl}" style="color: #60a5fa;">${verificationUrl}</a>
    </p>
  `;

  return sendEmail({
    to,
    subject: "Vérification de votre adresse e-mail — HDZ SECURITY ERP",
    html: baseEmailTemplate("Vérification d'e-mail — HDZ SECURITY", content),
  });
}

export async function sendAdminNewRegistrationNotification(params: {
  adminEmail: string;
  applicantName: string;
  applicantEmail: string;
  department: string;
  position: string;
  phone?: string | null;
  dashboardUrl: string;
}) {
  const content = `
    <div style="display: inline-block; padding: 4px 10px; background-color: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.3); border-radius: 8px; color: #60a5fa; font-size: 11px; font-weight: 700; margin-bottom: 12px;">
      ALERTE ADMINISTRATEUR
    </div>
    <h2 style="font-size: 18px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 14px;">
      Nouvelle demande d'inscription collaborateur
    </h2>
    <p style="margin-bottom: 20px; color: #94a3b8;">
      Un nouveau collaborateur a vérifié son adresse e-mail et attend votre approbation pour accéder à l'ERP :
    </p>
    
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0c101a; border: 1px solid #1f293d; border-radius: 12px; margin-bottom: 25px;">
      <tr>
        <td style="padding: 14px 18px; border-bottom: 1px solid #1f293d; color: #64748b; font-size: 12px; width: 130px;">Collaborateur :</td>
        <td style="padding: 14px 18px; border-bottom: 1px solid #1f293d; color: #ffffff; font-weight: 700; font-size: 13px;">${params.applicantName}</td>
      </tr>
      <tr>
        <td style="padding: 14px 18px; border-bottom: 1px solid #1f293d; color: #64748b; font-size: 12px;">Adresse e-mail :</td>
        <td style="padding: 14px 18px; border-bottom: 1px solid #1f293d; color: #60a5fa; font-size: 13px;">${params.applicantEmail}</td>
      </tr>
      <tr>
        <td style="padding: 14px 18px; border-bottom: 1px solid #1f293d; color: #64748b; font-size: 12px;">Fonction / Poste :</td>
        <td style="padding: 14px 18px; border-bottom: 1px solid #1f293d; color: #cbd5e1; font-size: 13px;">${params.position || "Non renseigné"}</td>
      </tr>
      <tr>
        <td style="padding: 14px 18px; color: #64748b; font-size: 12px;">Département :</td>
        <td style="padding: 14px 18px; color: #cbd5e1; font-size: 13px;">${params.department}</td>
      </tr>
    </table>

    <div style="text-align: center; margin: 25px 0;">
      <a href="${params.dashboardUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #3b82f6); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 10px;">
        VOIR LA DEMANDE DANS L'ERP
      </a>
    </div>
  `;

  return sendEmail({
    to: params.adminEmail,
    subject: `[Nouvelle Inscription] ${params.applicantName} (${params.applicantEmail}) — HDZ SECURITY ERP`,
    html: baseEmailTemplate("Nouvelle demande d'inscription — HDZ SECURITY", content),
  });
}

export async function sendAccountApprovedEmail(to: string, name: string, loginUrl: string) {
  const content = `
    <div style="display: inline-block; padding: 4px 10px; background-color: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 8px; color: #34d399; font-size: 11px; font-weight: 700; margin-bottom: 12px;">
      COMPTE VALIDÉ
    </div>
    <h2 style="font-size: 18px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 12px;">
      Félicitations, votre compte a été approuvé !
    </h2>
    <p style="margin-bottom: 20px; color: #94a3b8;">
      Bonjour <strong>${name}</strong>,<br>
      La direction générale de HDZ SECURITY a validé votre accès à l'ERP. Vous pouvez dès à présent vous connecter avec votre adresse e-mail et le mot de passe défini lors de votre inscription.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${loginUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #059669, #10b981); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 14px 28px; border-radius: 12px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
        SE CONNECTER À L'ERP
      </a>
    </div>

    <p style="font-size: 12px; color: #64748b; margin-top: 25px;">
      Pour des raisons de sécurité, votre mot de passe n'est jamais transmis par e-mail. Si vous l'avez oublié, utilisez l'option "Mot de passe oublié" sur la page de connexion.
    </p>
  `;

  return sendEmail({
    to,
    subject: "Votre compte collaborateur a été approuvé — HDZ SECURITY ERP",
    html: baseEmailTemplate("Compte Approuvé — HDZ SECURITY", content),
  });
}

export async function sendAccountRejectedEmail(to: string, name: string, reason?: string | null) {
  const content = `
    <div style="display: inline-block; padding: 4px 10px; background-color: rgba(244,63,94,0.15); border: 1px solid rgba(244,63,94,0.3); border-radius: 8px; color: #fb7185; font-size: 11px; font-weight: 700; margin-bottom: 12px;">
      DÉCISION D'ACCÈS
    </div>
    <h2 style="font-size: 18px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 12px;">
      Concernant votre demande de compte collaborateur
    </h2>
    <p style="margin-bottom: 16px; color: #94a3b8;">
      Bonjour <strong>${name}</strong>,<br>
      Nous vous informons que votre demande d'accès à l'ERP HDZ SECURITY n'a pas été retenue par l'administration.
    </p>

    ${
      reason
        ? `
      <div style="background-color: #1a1523; border: 1px solid rgba(244,63,94,0.3); border-radius: 12px; padding: 14px 18px; margin: 20px 0;">
        <span style="font-size: 11px; font-weight: 700; color: #fb7185; text-transform: uppercase;">Motif communiqué :</span>
        <p style="margin: 6px 0 0 0; color: #cbd5e1; font-size: 13px;">${reason}</p>
      </div>
    `
        : ""
    }

    <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
      Si vous estimez qu'il s'agit d'une erreur, nous vous invitons à contacter directement votre responsable d'équipe ou la direction des ressources humaines.
    </p>
  `;

  return sendEmail({
    to,
    subject: "Information concernant votre demande de compte — HDZ SECURITY ERP",
    html: baseEmailTemplate("Statut de votre demande — HDZ SECURITY", content),
  });
}

export async function sendEmailChangeVerificationEmail(params: {
  newEmail: string;
  name: string;
  oldEmail: string;
  verificationUrl: string;
}) {
  const content = `
    <h2 style="font-size: 18px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 12px;">
      Confirmation de changement d'adresse e-mail
    </h2>
    <p style="margin-bottom: 16px; color: #94a3b8;">
      Bonjour <strong>${params.name}</strong>,<br>
      Une demande de modification d'adresse e-mail pour votre compte collaborateur HDZ SECURITY a été initiée par l'administration :
    </p>

    <div style="background-color: #0c101a; border: 1px solid #1f293d; border-radius: 12px; padding: 14px 18px; margin: 20px 0; font-size: 13px;">
      <div style="color: #94a3b8; margin-bottom: 4px;">Ancienne adresse : <span style="color: #cbd5e1;">${params.oldEmail}</span></div>
      <div style="color: #94a3b8;">Nouvelle adresse : <span style="color: #60a5fa; font-weight: 700;">${params.newEmail}</span></div>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${params.verificationUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #3b82f6); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 14px 28px; border-radius: 12px;">
        CONFIRMER CETTE NOUVELLE ADRESSE
      </a>
    </div>

    <p style="font-size: 12px; color: #64748b;">
      Tant que cette nouvelle adresse n'est pas vérifiée, votre ancienne adresse demeure active pour la connexion.
    </p>
  `;

  return sendEmail({
    to: params.newEmail,
    subject: "Confirmation de votre nouvelle adresse e-mail — HDZ SECURITY ERP",
    html: baseEmailTemplate("Changement d'e-mail — HDZ SECURITY", content),
  });
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  const content = `
    <h2 style="font-size: 18px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 12px;">
      Réinitialisation de votre mot de passe
    </h2>
    <p style="margin-bottom: 20px; color: #94a3b8;">
      Bonjour <strong>${name}</strong>,<br>
      Une demande de réinitialisation du mot de passe de votre compte ERP HDZ SECURITY a été reçue. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #3b82f6); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 14px 28px; border-radius: 12px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);">
        RÉINITIALISER MON MOT DE PASSE
      </a>
    </div>

    <p style="font-size: 12px; color: #64748b; margin-top: 25px;">
      Ce lien sécurisé expirera dans <strong>1 heure</strong>. Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet e-mail.
    </p>
  `;

  return sendEmail({
    to,
    subject: "Réinitialisation de votre mot de passe — HDZ SECURITY ERP",
    html: baseEmailTemplate("Réinitialisation de mot de passe — HDZ SECURITY", content),
  });
}
