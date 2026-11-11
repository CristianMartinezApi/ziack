-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" TEXT NOT NULL DEFAULT 'store',
    "storeName" TEXT NOT NULL DEFAULT 'Ziack',
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "shippingFee" DECIMAL(10,2),
    "freeShippingThreshold" DECIMAL(10,2),
    "shippingDeadlineDays" INTEGER,
    "checkoutNotice" TEXT NOT NULL DEFAULT 'Este é um checkout demonstrativo. Nenhum pagamento será cobrado.',
    "orderPolicy" TEXT NOT NULL DEFAULT 'O frete e o valor final serão confirmados antes de qualquer pagamento.',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);
