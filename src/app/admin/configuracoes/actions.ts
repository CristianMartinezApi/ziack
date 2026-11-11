"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const optionalMoney = z.string()
  .trim()
  .refine((value) => value === "" || /^\d{1,6}(\.\d{1,2})?$/.test(value), "Informe um valor em reais com até duas casas decimais.")
  .transform((value) => value === "" ? null : Number(value))
  .refine((value) => value === null || (value >= 0 && value <= 100000), "O valor deve estar entre R$ 0,00 e R$ 100.000,00.");

const optionalDays = z.string()
  .trim()
  .refine((value) => value === "" || /^\d{1,2}$/.test(value), "Informe um prazo em dias inteiros.")
  .transform((value) => value === "" ? null : Number(value))
  .refine((value) => value === null || (value >= 1 && value <= 90), "O prazo deve ser de 1 a 90 dias.");

const settingsSchema = z.object({
  storeName: z.string().trim().min(2).max(100),
  contactEmail: z.union([z.literal(""), z.string().trim().email().max(254)]),
  contactPhone: z.string().trim().max(20).refine((value) => value === "" || /^[+\d\s().-]{10,20}$/.test(value), "Informe um telefone válido."),
  shippingFee: optionalMoney,
  freeShippingThreshold: optionalMoney,
  shippingOriginPostalCode: z.string()
    .trim()
    .refine((value) => value === "" || /^\d{5}-?\d{3}$/.test(value), "Informe um CEP de origem válido."),
  shippingDeadlineDays: optionalDays,
  checkoutNotice: z.string().trim().min(5).max(300),
  orderPolicy: z.string().trim().min(5).max(1000),
});

export type SettingsState = {
  message: string;
  success: boolean;
};

export async function saveStoreSettings(_previousState: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Confira os campos e tente novamente.", success: false };
  }

  const data = parsed.data;
  await prisma.storeSettings.upsert({
    where: { id: "store" },
    update: {
      storeName: data.storeName,
      contactEmail: data.contactEmail || null,
      contactPhone: data.contactPhone || null,
      shippingFee: data.shippingFee,
      freeShippingThreshold: data.freeShippingThreshold,
      shippingOriginPostalCode: data.shippingOriginPostalCode.replace(/\D/g, "") || null,
      shippingDeadlineDays: data.shippingDeadlineDays,
      checkoutNotice: data.checkoutNotice,
      orderPolicy: data.orderPolicy,
    },
    create: {
      id: "store",
      storeName: data.storeName,
      contactEmail: data.contactEmail || null,
      contactPhone: data.contactPhone || null,
      shippingFee: data.shippingFee,
      freeShippingThreshold: data.freeShippingThreshold,
      shippingOriginPostalCode: data.shippingOriginPostalCode.replace(/\D/g, "") || null,
      shippingDeadlineDays: data.shippingDeadlineDays,
      checkoutNotice: data.checkoutNotice,
      orderPolicy: data.orderPolicy,
    },
  });

  revalidatePath("/admin/configuracoes");
  revalidatePath("/checkout");
  revalidatePath("/admin", "layout");
  return { message: "Configurações salvas e aplicadas ao checkout.", success: true };
}
