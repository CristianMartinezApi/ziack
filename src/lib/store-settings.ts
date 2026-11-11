import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CHECKOUT_NOTICE, DEFAULT_ORDER_POLICY } from "@/lib/store-settings-defaults";

export type PublicStoreSettings = {
  storeName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  shippingFee: string | null;
  freeShippingThreshold: string | null;
  shippingDeadlineDays: number | null;
  checkoutNotice: string;
  orderPolicy: string;
};

export async function getStoreSettings(): Promise<PublicStoreSettings> {
  const settings = await prisma.storeSettings.findUnique({ where: { id: "store" } });
  if (!settings) {
    return {
      storeName: "Ziack",
      contactEmail: null,
      contactPhone: null,
      shippingFee: null,
      freeShippingThreshold: null,
      shippingDeadlineDays: null,
      checkoutNotice: DEFAULT_CHECKOUT_NOTICE,
      orderPolicy: DEFAULT_ORDER_POLICY,
    };
  }

  return {
    storeName: settings.storeName,
    contactEmail: settings.contactEmail,
    contactPhone: settings.contactPhone,
    shippingFee: settings.shippingFee?.toFixed(2) ?? null,
    freeShippingThreshold: settings.freeShippingThreshold?.toFixed(2) ?? null,
    shippingDeadlineDays: settings.shippingDeadlineDays,
    checkoutNotice: settings.checkoutNotice,
    orderPolicy: settings.orderPolicy,
  };
}
