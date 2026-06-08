-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('CENTRAL_BANK', 'BANK', 'PRIMARY_DEALER', 'CUSTODIAN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "OpStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "InstrumentStatus" AS ENUM ('DRAFT', 'CREATED', 'PUBLISHED', 'RELEASED', 'SETTLED');

-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('DRAFT', 'ALLOCATED', 'SETTLED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OPERATOR_ADMIN', 'ISSUANCE_OFFICER', 'COMPLIANCE_OFFICER', 'PARTICIPANT_ADMIN', 'TRADER', 'OPS', 'COMPLIANCE_VIEWER');

-- CreateTable
CREATE TABLE "Org" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrgType" NOT NULL,
    "onchainAddress" TEXT NOT NULL,
    "paladinIdentity" TEXT NOT NULL,
    "isSelf" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Org_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "payload" JSONB NOT NULL,
    "txHash" TEXT,
    "result" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operation" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" "OpStatus" NOT NULL DEFAULT 'PENDING',
    "request" JSONB NOT NULL,
    "txHash" TEXT,
    "result" JSONB,
    "error" TEXT,
    "steps" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Operation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instrument" (
    "id" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "status" "InstrumentStatus" NOT NULL DEFAULT 'DRAFT',
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "isin" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "tokenAddress" TEXT NOT NULL,
    "bondId" TEXT,
    "couponRateBps" INTEGER,
    "maturityDate" TIMESTAMP(3),
    "principalAmount" TEXT,
    "dayCount" INTEGER,
    "finalRedemptionPct" INTEGER,
    "isSyariah" BOOLEAN NOT NULL DEFAULT false,
    "shariahBoard" TEXT,
    "decimals" INTEGER,
    "configJson" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionRound" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "bondId" TEXT,
    "isin" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "auctionType" TEXT NOT NULL DEFAULT 'DIRECT_ALLOCATION',
    "status" "AuctionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allocation" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "bondAmount" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "cbdcAmount" TEXT NOT NULL,
    "settlementId" TEXT,
    "txHash" TEXT,
    "settled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_role_key" ON "UserRole"("userId", "role");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_createdAt_idx" ON "AuditLog"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Operation_idempotencyKey_key" ON "Operation"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Instrument_bondId_key" ON "Instrument"("bondId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionRound" ADD CONSTRAINT "AuctionRound_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "AuctionRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
