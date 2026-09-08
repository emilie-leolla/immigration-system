-- CreateTable
CREATE TABLE "pricing_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "basePriceFcfa" INTEGER NOT NULL DEFAULT 5000,
    "pricePerAgentFcfa" INTEGER NOT NULL DEFAULT 3000,
    "pricePerClientFcfa" INTEGER NOT NULL DEFAULT 100,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_settings_pkey" PRIMARY KEY ("id")
);
