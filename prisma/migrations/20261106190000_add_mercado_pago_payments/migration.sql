-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "paymentProvider" TEXT,
ADD COLUMN "paymentPreferenceId" TEXT,
ADD COLUMN "paymentId" TEXT,
ADD COLUMN "paymentStatus" TEXT,
ADD COLUMN "paymentStatusDetail" TEXT,
ADD COLUMN "paymentExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Order_paymentPreferenceId_key" ON "Order"("paymentPreferenceId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_paymentId_key" ON "Order"("paymentId");
