import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  const central = await db.org.upsert({
    where: { id: "bi-central" },
    update: { onchainAddress: "0xd61f35111dd2df020909ea2c2332ba8f84b22996" },
    create: {
      id: "bi-central", name: "Bank Indonesia (Central)", type: "CENTRAL_BANK",
      onchainAddress: "0xd61f35111dd2df020909ea2c2332ba8f84b22996",
      paladinIdentity: "cbdc-pilot@node1", isSelf: true,
    },
  });
  const org2 = await db.org.upsert({
    where: { id: "bank-xyz" },
    update: { onchainAddress: "0x92b261e23a5f57ca1ee576c7c89d01644097b722" },
    create: {
      id: "bank-xyz", name: "Bank XYZ (Primary Dealer)", type: "PRIMARY_DEALER",
      onchainAddress: "0x92b261e23a5f57ca1ee576c7c89d01644097b722",
      paladinIdentity: "cbdc-pilot@org2-node", isSelf: false,
    },
  });
  const org3 = await db.org.upsert({
    where: { id: "bank-abc" },
    update: { onchainAddress: "0x6c1901c1c4ebfdb71c81b66d7e3d36b0bea08d69" },
    create: {
      id: "bank-abc", name: "Bank ABC (Secondary Dealer)", type: "BANK",
      onchainAddress: "0x6c1901c1c4ebfdb71c81b66d7e3d36b0bea08d69",
      paladinIdentity: "cbdc-pilot@org3-node", isSelf: false,
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
  const trader2 = await db.user.upsert({
    where: { email: "trader@bank.id" },
    update: {},
    create: { email: "trader@bank.id", name: "Trader Bank XYZ", passwordHash: pw, orgId: org2.id },
  });
  await db.userRole.upsert({
    where: { userId_role: { userId: trader2.id, role: "TRADER" } },
    update: {}, create: { userId: trader2.id, role: "TRADER" },
  });
  const trader3 = await db.user.upsert({
    where: { email: "trader@bank-abc.id" },
    update: {},
    create: { email: "trader@bank-abc.id", name: "Trader Bank ABC", passwordHash: pw, orgId: org3.id },
  });
  await db.userRole.upsert({
    where: { userId_role: { userId: trader3.id, role: "TRADER" } },
    update: {}, create: { userId: trader3.id, role: "TRADER" },
  });
  console.log("seeded");
}

main().finally(() => db.$disconnect());
