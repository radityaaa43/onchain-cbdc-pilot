import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  const central = await db.org.upsert({
    where: { id: "bi-central" },
    update: {},
    create: {
      id: "bi-central", name: "Bank Indonesia (Central)", type: "CENTRAL_BANK",
      onchainAddress: "0x0000000000000000000000000000000000000001",
      paladinIdentity: "cbdc-pilot@node1", isSelf: true,
    },
  });
  await db.org.upsert({
    where: { id: "bank-xyz" },
    update: {},
    create: {
      id: "bank-xyz", name: "Bank XYZ (Primary Dealer)", type: "PRIMARY_DEALER",
      onchainAddress: "0x0000000000000000000000000000000000000002",
      paladinIdentity: "bank-xyz@node2", isSelf: false,
    },
  });
  const pw = await argon2.hash("ChangeMe123!");
  const admin = await db.user.upsert({
    where: { email: "admin@bi.go.id" },
    update: {},
    create: { email: "admin@bi.go.id", name: "Operator Admin", passwordHash: pw, orgId: central.id },
  });
  for (const role of ["OPERATOR_ADMIN", "ISSUANCE_OFFICER"] as const) {
    await db.userRole.upsert({
      where: { userId_role: { userId: admin.id, role } },
      update: {}, create: { userId: admin.id, role },
    });
  }
  console.log("seeded");
}

main().finally(() => db.$disconnect());
