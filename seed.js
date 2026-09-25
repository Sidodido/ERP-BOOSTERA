const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("Boostera2026!", 10);
  const user = await prisma.user.upsert({
    where: { email: "admin@boostera.dz" },
    update: {},
    create: {
      email: "admin@boostera.dz",
      passwordHash: hash,
      name: "Direction BOOSTERA",
      role: "ADMIN",
      phone: "0550 00 00 01",
    },
  });

  await prisma.employee.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      firstName: "Direction",
      lastName: "HDZ SECURITY",
      position: "Direction Générale",
      department: "ADMINISTRATION",
    },
  });

  const userZidane = await prisma.user.upsert({
    where: { email: "zidanesidahmed18@gmail.com" },
    update: {
      role: "ADMIN",
      isActive: true,
      status: "ACTIVE",
      emailVerified: true,
      name: "Direction HDZ SECURITY",
    },
    create: {
      email: "zidanesidahmed18@gmail.com",
      passwordHash: hash,
      name: "Direction HDZ SECURITY",
      role: "ADMIN",
      phone: "0550 00 00 00",
      status: "ACTIVE",
      emailVerified: true,
    },
  });

  await prisma.employee.upsert({
    where: { userId: userZidane.id },
    update: {},
    create: {
      userId: userZidane.id,
      firstName: "Direction",
      lastName: "HDZ SECURITY",
      position: "Directeur Général",
      department: "ADMINISTRATION",
    },
  });

  console.log("Admin accounts ready: admin@boostera.dz and zidanesidahmed18@gmail.com / Boostera2026!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
