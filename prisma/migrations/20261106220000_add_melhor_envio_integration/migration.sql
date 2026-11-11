-- AlterTable
ALTER TABLE "StoreSettings"
ADD COLUMN "shippingOriginPostalCode" TEXT;

-- CreateTable
CREATE TABLE "ShippingIntegration" (
    "id" TEXT NOT NULL DEFAULT 'store',
    "mode" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingIntegration_pkey" PRIMARY KEY ("id")
);
