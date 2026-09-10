import prisma from "@/lib/prisma";
import {
  verifyTransaction,
  mapPaymentType,
  getCamPayFailureMessage,
} from "@/lib/campay";
import { auditDetails } from "@/lib/audit-log";

export type ConfirmResult =
  | { outcome: "success"; planName: string }
  | { outcome: "already_processed" }
  | { outcome: "pending" }
  | { outcome: "failed"; reason: string }
  | { outcome: "not_found" };

export async function confirmCampayPayment(
  gatewayReference: string
): Promise<ConfirmResult> {
  const verification = await verifyTransaction(gatewayReference);

  if (!verification.ok) {
    return {
      outcome: "failed",
      reason:
        verification.error ||
        "Could not verify the transaction. Please try again.",
    };
  }

  const payment = await prisma.payment.findUnique({
    where: { gatewayTransactionId: gatewayReference },
    include: { subscription: true, targetPlan: true },
  });

  if (!payment) return { outcome: "not_found" };

  if (payment.status !== "PENDING") {
    return payment.status === "SUCCESS"
      ? { outcome: "already_processed" }
      : {
          outcome: "failed",
          reason:
            "This payment was already unsuccessful. Please start a new payment attempt.",
        };
  }

  if (verification.pending) return { outcome: "pending" };

  if (!verification.successful) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });

    const reason = getCamPayFailureMessage(
      verification.reasonCode || verification.reason
    );

    return { outcome: "failed", reason };
  }

  if (!payment.targetPlan || (verification.amount ?? 0) < payment.amountFcfa) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });

    return {
      outcome: "failed",
      reason:
        "The amount paid did not match the plan price. Please contact support if money was deducted.",
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const fresh = await tx.payment.findUnique({
      where: { id: payment.id },
    });

    if (!fresh || fresh.status !== "PENDING") return null;

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCESS",
        method: mapPaymentType(verification.paymentType),
      },
    });

    await tx.subscription.update({
      where: { id: payment.subscriptionId },
      data: {
        planId: payment.targetPlan!.id,
        pendingPlanId: null,
        status: "ACTIVE",
        currentPeriodEnd: new Date(
          Date.now() + 365 * 24 * 60 * 60 * 1000
        ),
      },
    });

    await tx.auditLog.create({
      data: {
        action: "UPGRADE_SUBSCRIPTION",
        details: auditDetails("subscriptionUpgraded", { planName: payment.targetPlan!.name, amount: payment.amountFcfa.toLocaleString() }),
        agencyId: payment.subscription.agencyId,
        targetId: payment.subscriptionId,
      },
    });

    return payment.targetPlan!.name;
  });

  return result
    ? { outcome: "success", planName: result }
    : { outcome: "already_processed" };
}