import { PrismaClient, Role, ProspectStatus, ClientStatus, OfferType, CallResult, AppointmentType, AppointmentStatus, FollowUpStatus, PaymentMethod, PaymentType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting BOOSTERA ERP Database Seeding...");

  // 1. Clean existing records in reverse order
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.projectTask.deleteMany();
  await prisma.project.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.call.deleteMany();
  await prisma.client.deleteMany();
  await prisma.prospect.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.commissionRule.deleteMany();
  await prisma.user.deleteMany();

  const defaultPasswordHash = await bcrypt.hash("Boostera2026!", 10);

  // 2. Create Users
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@boostera.dz",
      passwordHash: defaultPasswordHash,
      name: "Direction BOOSTERA",
      role: Role.ADMIN,
      phone: "0550 00 00 01",
    },
  });

  const salesDirector = await prisma.user.create({
    data: {
      email: "karim.dir@boostera.dz",
      passwordHash: defaultPasswordHash,
      name: "Karim Benali (Dir. Commercial)",
      role: Role.SALES_DIRECTOR,
      phone: "0550 00 00 02",
    },
  });

  const salesRep1 = await prisma.user.create({
    data: {
      email: "amine.rep@boostera.dz",
      passwordHash: defaultPasswordHash,
      name: "Amine Khelil (Commercial)",
      role: Role.SALES_REP,
      phone: "0550 00 00 03",
    },
  });

  const salesRep2 = await prisma.user.create({
    data: {
      email: "sarah.rep@boostera.dz",
      passwordHash: defaultPasswordHash,
      name: "Sarah Mansouri (Commerciale)",
      role: Role.SALES_REP,
      phone: "0550 00 00 04",
    },
  });

  const wiamRep = await prisma.user.create({
    data: {
      email: "wiam@boostera.dz",
      passwordHash: defaultPasswordHash,
      name: "Wiam (Commerciale)",
      role: Role.SALES_REP,
      phone: "0550 11 22 31",
    },
  });

  const merouaRep = await prisma.user.create({
    data: {
      email: "meroua@boostera.dz",
      passwordHash: defaultPasswordHash,
      name: "Meroua (Commerciale)",
      role: Role.SALES_REP,
      phone: "0550 11 22 32",
    },
  });

  const toufikRep = await prisma.user.create({
    data: {
      email: "toufik@boostera.dz",
      passwordHash: defaultPasswordHash,
      name: "Toufik (Commercial)",
      role: Role.SALES_REP,
      phone: "0550 11 22 33",
    },
  });

  const techLead = await prisma.user.create({
    data: {
      email: "mehdi.tech@boostera.dz",
      passwordHash: defaultPasswordHash,
      name: "Mehdi Meziane (Chef de Projet)",
      role: Role.TECH_LEAD,
      phone: "0550 00 00 05",
    },
  });

  const sidahmedTech = await prisma.user.create({
    data: {
      email: "sidahmed@boostera.dz",
      passwordHash: defaultPasswordHash,
      name: "Sidahmed (Technicien)",
      role: Role.TECH_LEAD,
      phone: "0550 11 22 34",
    },
  });

  const accountant = await prisma.user.create({
    data: {
      email: "leila.finance@boostera.dz",
      passwordHash: defaultPasswordHash,
      name: "Leila Hadj (Comptabilité)",
      role: Role.ACCOUNTANT,
      phone: "0550 00 00 06",
    },
  });

  const hrManager = await prisma.user.create({
    data: {
      email: "ryma.rh@boostera.dz",
      passwordHash: defaultPasswordHash,
      name: "Ryma Cherif (Responsable RH)",
      role: Role.HR,
      phone: "0550 00 00 07",
    },
  });

  console.log("✅ Users created (Password for all: Boostera2026!)");

  // 3. Commission Rules
  await prisma.commissionRule.createMany({
    data: [
      {
        name: "Nouveau contrat signé (10%)",
        ruleType: "NEW_CLIENT_PERCENTAGE",
        ratePercentage: 10.0,
        description: "10% sur le montant total du premier contrat signé",
      },
      {
        name: "Abonnement récurrent mensuel (5%)",
        ruleType: "RECURRING_MONTHLY_PERCENTAGE",
        ratePercentage: 5.0,
        description: "5% chaque mois pendant 6 mois sur les abonnements actifs",
      },
      {
        name: "Campagne Sponsor Ads (7%)",
        ruleType: "SPONSOR_PERCENTAGE",
        ratePercentage: 7.0,
        description: "7% sur les budgets sponsorisés gérés",
      },
    ],
  });

  // 4. Create Converted Clients (already existing accounts)
  const client1 = await prisma.client.create({
    data: {
      companyName: "Vigie Voyages Algérie",
      brandName: "Vigie Voyages",
      contactName: "M. Tarek Bouzid",
      phone: "0555 12 34 56",
      email: "contact@vigie-voyages.dz",
      facebook: "facebook.com/vigievoyages",
      instagram: "instagram.com/vigievoyages",
      address: "14 Boulevard Didouche Mourad, Alger",
      sector: "Voyage",
      wilaya: "Alger",
      status: ClientStatus.ACTIVE,
      offerType: OfferType.GOLD,
      contractStart: new Date("2026-01-01"),
      contractEnd: new Date("2026-12-31"),
      contractValue: 432000.0,
      monthlyFee: 36000.0,
      assignedToId: salesRep1.id,
      notes: "Client clé dans le secteur du tourisme. Pack Gold (36 000 DA/mois) — 4 carrousels, 4 maquettes, 4 vidéos Reels, 1M vues.",
    },
  });

  const client2 = await prisma.client.create({
    data: {
      companyName: "Restaurant Le Sultan d'Oran",
      brandName: "Le Sultan",
      contactName: "Mme Amel Zerrouki",
      phone: "0541 98 76 54",
      email: "contact@lesultan-oran.dz",
      facebook: "facebook.com/lesultan.oran",
      instagram: "instagram.com/lesultan_oran",
      address: "Front de Mer, Oran",
      sector: "Restaurant",
      wilaya: "Oran",
      status: ClientStatus.ACTIVE,
      offerType: OfferType.STARTER,
      contractStart: new Date("2026-02-01"),
      contractEnd: new Date("2026-08-01"),
      contractValue: 54000.0,
      monthlyFee: 9000.0,
      assignedToId: salesRep2.id,
      notes: "Pack Starter (9 000 DA/mois) — 2 carrousels, 2 maquettes, site pro, 50K vues.",
    },
  });

  const client3 = await prisma.client.create({
    data: {
      companyName: "Clinique Médico-Chirurgicale El Chiffa",
      brandName: "Clinique El Chiffa",
      contactName: "Dr. Hamza Khamri",
      phone: "0560 45 67 89",
      email: "direction@clinique-chiffa.dz",
      address: "Route de Chéraga, Dely Ibrahim, Alger",
      sector: "Cabinet médical",
      wilaya: "Alger",
      status: ClientStatus.ACTIVE,
      offerType: OfferType.SILVER,
      hasWebsite: true,
      contractStart: new Date("2026-03-01"),
      contractEnd: new Date("2026-06-30"),
      contractValue: 112000.0,
      monthlyFee: 28000.0,
      assignedToId: salesRep1.id,
      notes: "Pack Silver (26 000 DA) + Option Site Vitrine (+2 000 DA) = 28 000 DA/mois.",
    },
  });

  console.log("✅ Clients created");

  // 5. Create Prospects
  const prospect1 = await prisma.prospect.create({
    data: {
      companyName: "Hôtel Les Pins d'Or",
      contactName: "M. Mourad Belkacem (Gérant)",
      phone: "0551 23 45 67",
      email: "info@pinsdor-hotel.dz",
      sector: "Hôtel",
      wilaya: "Constantine",
      address: "Nouvelle Ville Ali Mendjeli",
      status: ProspectStatus.INTERESTED,
      assignedToId: salesRep1.id,
      createdById: salesRep1.id,
      notes: "Très intéressé par un shooting 360° des suites et un sponsoring Meta Ads pour l'été.",
    },
  });

  const prospect2 = await prisma.prospect.create({
    data: {
      companyName: "Dr. Yacine Benali (Cabinet Dentaire)",
      contactName: "Dr. Yacine Benali",
      phone: "0540 11 22 33",
      email: "contact@cabinet-benali.dz",
      sector: "Cabinet médical",
      wilaya: "Alger",
      address: "Hydra, Alger",
      status: ProspectStatus.MEETING_SCHEDULED,
      assignedToId: salesRep2.id,
      createdById: salesRep2.id,
      notes: "Rendez-vous de présentation du pack Médical fixé pour mardi 14h.",
    },
  });

  const prospect3 = await prisma.prospect.create({
    data: {
      companyName: "Cosmétique Noun Beauté",
      contactName: "Mme Sarah Noun",
      phone: "0661 77 88 99",
      email: "contact@noun-beaute.dz",
      sector: "Beauté",
      wilaya: "Sétif",
      status: ProspectStatus.CONTACTED,
      assignedToId: salesRep1.id,
      createdById: salesRep1.id,
      notes: "Premier appel passé. A demandé un rappel après avoir consulté notre présentation PDF.",
    },
  });

  const prospect4 = await prisma.prospect.create({
    data: {
      companyName: "SARL Batimex Construction",
      contactName: "M. Reda Boudiaf",
      phone: "0550 99 88 77",
      email: "commercial@batimex-dz.com",
      sector: "Industrie",
      wilaya: "Blida",
      status: ProspectStatus.NEW,
      assignedToId: salesRep2.id,
      createdById: salesDirector.id,
      notes: "Lead issu de la prospection terrain. À contacter en priorité.",
    },
  });

  const prospect5 = await prisma.prospect.create({
    data: {
      companyName: "Agence Immobilière Darna",
      contactName: "M. Farid Kaci",
      phone: "0554 33 22 11",
      email: "contact@darna-immobilier.dz",
      sector: "Immobilier",
      wilaya: "Oran",
      status: ProspectStatus.PROPOSAL_SENT,
      assignedToId: salesRep1.id,
      createdById: salesRep1.id,
      notes: "Offre Sponsoring Instagram envoyée à 60 000 DA/mois. Relance programmée.",
    },
  });

  console.log("✅ Prospects created");

  // 6. Log Calls
  await prisma.call.createMany({
    data: [
      {
        prospectId: prospect1.id,
        userId: salesRep1.id,
        result: CallResult.INTERESTED,
        comment: "Échange positif de 12 min. Directeur intéressé par nos références dans le tourisme.",
        durationSeconds: 720,
        calledAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
      },
      {
        prospectId: prospect2.id,
        userId: salesRep2.id,
        result: CallResult.APPOINTMENT_BOOKED,
        comment: "Rendez-vous physique fixé au cabinet pour signer le devis.",
        durationSeconds: 450,
        calledAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      },
      {
        prospectId: prospect3.id,
        userId: salesRep1.id,
        result: CallResult.CALLBACK_REQUESTED,
        comment: "En réunion lors de l'appel. A demandé à être rappelée jeudi matin.",
        durationSeconds: 90,
        calledAt: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
      },
      {
        prospectId: prospect5.id,
        userId: salesRep1.id,
        result: CallResult.INTERESTED,
        comment: "Validation de principe par le gérant. Devis officiel transmis.",
        durationSeconds: 600,
        calledAt: new Date(Date.now() - 1000 * 60 * 60 * 3), // 3 hours ago
      },
    ],
  });

  console.log("✅ Calls logged");

  // 7. Appointments
  const now = new Date();
  const inTwoDays = new Date(now.getTime() + 1000 * 60 * 60 * 48);
  inTwoDays.setHours(14, 0, 0, 0);
  const inTwoDaysEnd = new Date(inTwoDays.getTime() + 1000 * 60 * 60);

  const inFourDays = new Date(now.getTime() + 1000 * 60 * 60 * 96);
  inFourDays.setHours(10, 30, 0, 0);
  const inFourDaysEnd = new Date(inFourDays.getTime() + 1000 * 60 * 90);

  await prisma.appointment.createMany({
    data: [
      {
        title: "Présentation Pack Médical — Dr Benali",
        type: AppointmentType.COMMERCIAL_VISIT,
        status: AppointmentStatus.SCHEDULED,
        startTime: inTwoDays,
        endTime: inTwoDaysEnd,
        durationMin: 60,
        location: "Cabinet Dentaire Dr Benali, Hydra, Alger",
        notes: "Apporter les contrats imprimés et les exemples de vidéos Reels pour les cabinets.",
        prospectId: prospect2.id,
        userId: salesRep2.id,
      },
      {
        title: "Point Stratégie Social Ads — Vigie Voyages",
        type: AppointmentType.VIDEO,
        status: AppointmentStatus.SCHEDULED,
        startTime: inFourDays,
        endTime: inFourDaysEnd,
        durationMin: 90,
        location: "Google Meet",
        notes: "Revue mensuelle des performances publicitaires Meta et planification du shooting.",
        clientId: client1.id,
        userId: salesRep1.id,
      },
    ],
  });

  console.log("✅ Appointments created");

  // 8. Automatic Follow-ups (Séquences J+3, J+7, J+15)
  await prisma.followUp.createMany({
    data: [
      {
        prospectId: prospect1.id,
        userId: salesRep1.id,
        stepNumber: 1,
        scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3), // +3 days
        status: FollowUpStatus.SCHEDULED,
        notes: "Relance 1 : Vérifier la réception de la plaquette tarifaire.",
      },
      {
        prospectId: prospect1.id,
        userId: salesRep1.id,
        stepNumber: 2,
        scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // +7 days
        status: FollowUpStatus.SCHEDULED,
        notes: "Relance 2 : Proposer une démonstration de nos réalisations hôtelières.",
      },
      {
        prospectId: prospect5.id,
        userId: salesRep1.id,
        stepNumber: 1,
        scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 1), // Tomorrow
        status: FollowUpStatus.SCHEDULED,
        notes: "Relance 1 : Suivi du devis envoyé à M. Farid Kaci.",
      },
    ],
  });

  console.log("✅ Follow-ups created");

  // 9. Initial Financial Invoices and Payments
  const invoice1 = await prisma.invoice.create({
    data: {
      invoiceNumber: "FAC-2026-0001",
      clientId: client1.id,
      issueDate: new Date("2026-02-01"),
      dueDate: new Date("2026-02-15"),
      subtotal: 35000.0,
      taxRate: 0,
      taxAmount: 0,
      total: 35000.0,
      amountPaid: 35000.0,
      balanceDue: 0,
      status: "PAID",
      notes: "Mensualité Février 2026 - Pack Elite",
      items: {
        create: [
          {
            description: "Abonnement Mensuel Elite (8 Reels + Gestion Réseaux)",
            quantity: 1,
            unitPrice: 35000.0,
            total: 35000.0,
          },
        ],
      },
    },
  });

  await prisma.payment.create({
    data: {
      invoiceId: invoice1.id,
      clientId: client1.id,
      amount: 35000.0,
      paymentMethod: PaymentMethod.BARIDIMOB,
      paymentType: PaymentType.MONTHLY_SUBSCRIPTION,
      reference: "BM-98234710-ALG",
      status: "COMPLETED",
      paymentDate: new Date("2026-02-05"),
      notes: "Virement BaridiMob reçu et validé par la comptabilité.",
      recordedById: accountant.id,
    },
  });

  const invoice2 = await prisma.invoice.create({
    data: {
      invoiceNumber: "FAC-2026-0002",
      clientId: client2.id,
      issueDate: new Date("2026-03-01"),
      dueDate: new Date("2026-03-15"),
      subtotal: 25000.0,
      taxRate: 0,
      taxAmount: 0,
      total: 25000.0,
      amountPaid: 15000.0,
      balanceDue: 10000.0,
      status: "PARTIAL",
      notes: "Mensualité Mars 2026 - Pack Boutique",
      items: {
        create: [
          {
            description: "Abonnement Mensuel Boutique Restaurant (Shooting + Postes)",
            quantity: 1,
            unitPrice: 25000.0,
            total: 25000.0,
          },
        ],
      },
    },
  });

  await prisma.payment.create({
    data: {
      invoiceId: invoice2.id,
      clientId: client2.id,
      amount: 15000.0,
      paymentMethod: PaymentMethod.CASH,
      paymentType: PaymentType.MONTHLY_SUBSCRIPTION,
      reference: "RECU-ESP-0042",
      status: "COMPLETED",
      paymentDate: new Date("2026-03-02"),
      notes: "Acompte en espèces reçu au bureau. Reste 10 000 DA prévu le 15 mars.",
      recordedById: accountant.id,
    },
  });

  console.log("✅ Invoices and Payments created");

  console.log("🚀 BOOSTERA ERP Database successfully seeded!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
