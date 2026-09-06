"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { hashPassword } from "better-auth/crypto";
import { revalidatePath } from "next/cache";
import { auditDetails } from "@/lib/audit-log";

async function requireSuperAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || (session.user as any).role !== "SUPER_ADMIN") {
        return null;
    }
    return session;
}

export async function getAgencies() {
    const session = await requireSuperAdmin();
    if (!session) throw new Error("Unauthorized");

    const agencies = await prisma.agency.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            _count: {
                select: { users: true, applications: true }
            },
            subscription: {
                include: { plan: true }
            }
        }
    });

    return agencies;
}

export async function createAgencyAction(formData: FormData) {
    const session = await requireSuperAdmin();
    if (!session) return { error: "Unauthorized access." };

    const agencyName = (formData.get("agencyName") as string)?.trim();
    const adminName = (formData.get("adminName") as string)?.trim();
    const adminEmail = (formData.get("adminEmail") as string)?.trim()?.toLowerCase();
    const adminPassword = formData.get("adminPassword") as string;

    if (!agencyName || !adminName || !adminEmail || !adminPassword) {
        return { error: "All fields are required." };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail)) {
        return { error: "Invalid email format." };
    }

    try {
        const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
        if (existingUser) {
            return { error: "A user with this email already exists." };
        }

        const hashedPassword = await hashPassword(adminPassword);

        const result = await prisma.$transaction(async (tx) => {
            const agency = await tx.agency.create({
                data: {
                    name: agencyName,
                    status: "ACTIVE",
                    isInternal: false,
                }
            });

            const admin = await tx.user.create({
                data: {
                    name: adminName,
                    email: adminEmail,
                    password: hashedPassword,
                    role: "ADMIN" as any,
                    agencyId: agency.id,
                    emailVerified: true,
                    accounts: {
                        create: {
                            providerId: "credential",
                            accountId: adminEmail,
                            password: hashedPassword,
                        }
                    }
                }
            });

            const freePlan = await tx.plan.findUnique({ where: { slug: "free" } });
            if (freePlan) {
                await tx.subscription.create({
                    data: {
                        agencyId: agency.id,
                        planId: freePlan.id,
                        status: "ACTIVE",
                        autoRenew: true,
                        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                    }
                });
            }

            await tx.auditLog.create({
                data: {
                    action: "CREATE_AGENCY",
                    details: auditDetails("agencyCreatedBySuperAdmin", { agencyName, adminName, adminEmail }),
                    userId: session.user.id,
                    agencyId: agency.id,
                    targetId: agency.id,
                }
            });

            return { agency, admin };
        });

        revalidatePath("/super-admin/dashboard");
        return { success: true, agencyId: result.agency.id };
    } catch (e: any) {
        console.error("Agency creation error:", e);
        return { error: e.message || "Failed to create agency." };
    }
}

export async function toggleSuspendAgencyAction(agencyId: string, currentlySuspended: boolean) {
    const session = await requireSuperAdmin();
    if (!session) return { error: "Unauthorized access." };

    try {
        const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
        if (!agency) return { error: "Agency not found." };
        if (agency.isInternal) return { error: "The internal agency cannot be suspended." };

        await prisma.agency.update({
            where: { id: agencyId },
            data: { status: currentlySuspended ? "ACTIVE" : "SUSPENDED" }
        });

        await prisma.auditLog.create({
            data: {
                action: currentlySuspended ? "UNSUSPEND_AGENCY" : "SUSPEND_AGENCY",
                details: auditDetails(currentlySuspended ? "agencyUnsuspendedBySuperAdmin" : "agencySuspendedBySuperAdmin", { agencyName: agency.name }),
                userId: session.user.id,
                agencyId: agencyId,
                targetId: agencyId,
            }
        });

        revalidatePath("/super-admin/dashboard");
        return { success: true };
    } catch (e: any) {
        return { error: "Failed to update agency status." };
    }
}

export async function getPlans() {
    const session = await requireSuperAdmin();
    if (!session) throw new Error("Unauthorized");
    return prisma.plan.findMany({ orderBy: { priceFcfa: "asc" } });
}

export async function setAgencyPlanAction(agencyId: string, planId: string) {
    const session = await requireSuperAdmin();
    if (!session) return { error: "Unauthorized access." };

    try {
        const [agency, plan] = await Promise.all([
            prisma.agency.findUnique({ where: { id: agencyId } }),
            prisma.plan.findUnique({ where: { id: planId } }),
        ]);
        if (!agency) return { error: "Agency not found." };
        if (!plan) return { error: "Plan not found." };

        await prisma.subscription.upsert({
            where: { agencyId },
            update: { planId, pendingPlanId: null, status: "ACTIVE" },
            create: {
                agencyId,
                planId,
                status: "ACTIVE",
                autoRenew: true,
                currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            },
        });

        await prisma.auditLog.create({
            data: {
                action: "SET_AGENCY_PLAN",
                details: auditDetails("agencyPlanSetBySuperAdmin", { agencyName: agency.name, planName: plan.name }),
                userId: session.user.id,
                agencyId,
                targetId: agencyId,
            }
        });

        revalidatePath("/super-admin/dashboard");
        return { success: true };
    } catch (e: any) {
        return { error: e.message || "Failed to set agency plan." };
    }
}