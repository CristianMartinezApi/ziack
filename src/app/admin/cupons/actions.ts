"use server";

import { CouponDiscountType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const optionalDate = z.string().trim().transform((value) => value ? new Date(value) : null).refine((value) => value === null || !Number.isNaN(value.getTime()), "Data inválida.");
const couponSchema = z.object({
  code: z.string().trim().min(3).max(32).regex(/^[A-Za-z0-9_-]+$/).transform((value) => value.toUpperCase()),
  partnerName: z.string().trim().min(2).max(100),
  partnerEmail: z.union([z.literal(""), z.string().trim().email().max(254)]).transform((value) => value || null),
  discountType: z.nativeEnum(CouponDiscountType),
  discountValue: z.coerce.number().positive().max(100000),
  minimumSubtotal: z.union([z.literal(""), z.coerce.number().nonnegative().max(100000)]),
  startsAt: optionalDate,
  expiresAt: optionalDate,
  maxUses: z.union([z.literal(""), z.coerce.number().int().positive().max(1000000)]),
}).superRefine((data, context) => {
  if (data.discountType === "PERCENTAGE" && data.discountValue > 100) {
    context.addIssue({ code: "custom", path: ["discountValue"], message: "O percentual máximo é 100%." });
  }
  if (data.startsAt && data.expiresAt && data.startsAt >= data.expiresAt) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "O término precisa ser posterior ao início." });
  }
});

export type CouponActionState = { message: string; success: boolean };
const initialError: CouponActionState = { message: "Confira os dados do cupom e tente novamente.", success: false };

export async function createCoupon(_previousState: CouponActionState, formData: FormData): Promise<CouponActionState> {
  await requireAdmin();
  const parsed = couponSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return initialError;
  const data = parsed.data;

  try {
    await prisma.partnerCoupon.create({
      data: {
        code: data.code,
        partnerName: data.partnerName,
        partnerEmail: data.partnerEmail,
        discountType: data.discountType,
        discountValue: new Prisma.Decimal(data.discountValue),
        minimumSubtotal: data.minimumSubtotal === "" ? null : new Prisma.Decimal(data.minimumSubtotal),
        startsAt: data.startsAt,
        expiresAt: data.expiresAt,
        maxUses: data.maxUses === "" ? null : data.maxUses,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { message: "Já existe um cupom com esse código.", success: false };
    }
    throw error;
  }

  revalidatePath("/admin/cupons");
  return { message: "Cupom criado e ativo.", success: true };
}

export async function toggleCoupon(_previousState: CouponActionState, formData: FormData): Promise<CouponActionState> {
  await requireAdmin();
  const id = z.string().cuid().safeParse(formData.get("id"));
  if (!id.success) return { message: "Cupom inválido.", success: false };

  const coupon = await prisma.partnerCoupon.findUniqueOrThrow({ where: { id: id.data }, select: { active: true } });
  const result = await prisma.partnerCoupon.updateMany({
    where: { id: id.data, active: coupon.active },
    data: { active: !coupon.active },
  });
  if (result.count !== 1) return { message: "O cupom foi alterado em outra sessão. Atualize a página.", success: false };

  revalidatePath("/admin/cupons");
  revalidatePath("/checkout");
  return { message: coupon.active ? "Cupom desativado." : "Cupom reativado.", success: true };
}
