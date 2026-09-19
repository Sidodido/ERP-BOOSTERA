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
      lastName: "BOOSTERA",
      position: "Direction Générale",
      department: "ADMINISTRATION",
    },
  });

  console.log("Admin account ready: admin@boostera.dz / Boostera2026!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
