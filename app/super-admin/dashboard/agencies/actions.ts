"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { hashPassword } from "better-auth/crypto";
import { revalidatePath } from "next/cache";
import { auditDetails } from "@/lib/audit-log";

/**
 * Make sure the current user is a SUPER_ADMIN.
 */
async function requireSuperAdmin() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session || (session.user as any).role !== "SUPER_ADMIN") {
        return {
            session: null,
            error: "Unauthorized access.",
        };
    }

    return {
        session,
        error: null,
    };
}

/**
 * Create a new agency + its first ADMIN account.
 */
export async function createAgencyAction(formData: FormData) {
    const { session, error } = await requireSuperAdmin();

    if (error || !session) {
        return { error: error || "Unauthorized access." };
    }

    const agencyName = (formData.get("agencyName") as string)?.trim();
    const adminName = (formData.get("adminName") as string)?.trim();
    const adminEmail = (formData.get("adminEmail") as string)
        ?.trim()
        .toLowerCase();
    const adminPassword = formData.get("adminPassword") as string;

    if (!agencyName || !adminName || !adminEmail || !adminPassword) {
        return {
            error: "All fields are required.",
        };
    }

    if (agencyName.length > 100) {
        return {
            error: "Agency name must be 100 characters or less.",
        };
    }

    if (adminName.length > 50) {
        return {
            error: "Admin name must be 50 characters or less.",
        };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(adminEmail)) {
        return {
            error: "Invalid email format.",
        };
    }

    if (adminPassword.length < 8) {
        return {
            error: "Password must contain at least 8 characters.",
        };
    }

    try {
        /**
         * Email must be globally unique because Better Auth users
         * are global even though agencies are isolated.
         */
        const existingUser = await prisma.user.findUnique({
            where: {
                email: adminEmail,
            },
        });

        if (existingUser) {
            return {
                error: "A user with this email already exists.",
            };
        }

        /**
         * Prevent duplicate agency names.
         */
        const existingAgency = await prisma.agency.findFirst({
            where: {
                name: {
                    equals: agencyName,
                    mode: "insensitive",
                },
            },
        });

        if (existingAgency) {
            return {
                error: "An agency with this name already exists.",
            };
        }

        const hashedPassword = await hashPassword(adminPassword);

        /**
         * Create agency and first admin together.
         */
        const result = await prisma.$transaction(async (tx) => {
            const agency = await tx.agency.create({
                data: {
                    name: agencyName,
                    status: "ACTIVE",
                    isInternal: false,
                },
            });

            const admin = await tx.user.create({
                data: {
                    name: adminName,
                    email: adminEmail,
                    password: hashedPassword,
                    role: "ADMIN" as any,
                    agency: { connect: { id: agency.id } },
                    emailVerified: true,

                    accounts: {
                        create: {
                            providerId: "credential",
                            accountId: adminEmail,
                            password: hashedPassword,
                        },
                    },
                },
            });

            /**
             * Every agency needs a real subscription row for the billing
             * page to work at all — without one, /admin/dashboard/billing
             * shows a dead-end "no subscription found" message. Start
             * every new agency on the Free plan; find-or-create it so this
             * never depends on prisma/seed-plans.ts having been run.
             */
            const freePlan = await tx.plan.upsert({
                where: { slug: "free" },
                update: {},
                create: {
                    name: "Gratuit",
                    slug: "free",
                    priceFcfa: 0,
                    maxAgents: 1,
                    maxClients: 10,
                    isPublic: true,
                },
            });

            await tx.subscription.create({
                data: {
                    agency: { connect: { id: agency.id } },
                    plan: { connect: { id: freePlan.id } },
                    status: "ACTIVE",
                    autoRenew: true,
                    currentPeriodEnd: new Date(
                        Date.now() + 365 * 24 * 60 * 60 * 1000
                    ),
                },
            });

            /**
             * Give the Super Admin a global audit entry.
             */
            await tx.auditLog.create({
                data: {
                    action: "CREATE_AGENCY",
                    details: auditDetails("agencyCreated", {
                        name: agencyName,
                        email: adminEmail,
                    }),
                    userId: session.user.id,
                    agencyId: agency.id,
                    targetId: agency.id,
                },
            });

            return {
                agency,
                admin,
            };
        });

        revalidatePath("/super-admin/dashboard");
        revalidatePath("/super-admin/dashboard/agencies");

        return {
            success: true,
            agencyId: result.agency.id,
        };
    } catch (e: any) {
        console.error("Create Agency Error:", e);

        return {
            error: "An error occurred while creating the agency.",
        };
    }
}

/**
 * Suspend / reactivate an agency.
 */
export async function toggleSuspendAgencyAction(
    agencyId: string,
    currentlySuspended: boolean
) {
    const { session, error } = await requireSuperAdmin();

    if (error || !session) {
        return { error: error || "Unauthorized access." };
    }

    if (!agencyId) {
        return {
            error: "Agency ID is required.",
        };
    }

    try {
        const agency = await prisma.agency.findUnique({
            where: {
                id: agencyId,
            },
        });

        if (!agency) {
            return {
                error: "Agency not found.",
            };
        }

        if (agency.isInternal) {
            return {
                error: "The internal agency cannot be suspended.",
            };
        }

        const newStatus = currentlySuspended
            ? "ACTIVE"
            : "SUSPENDED";

        await prisma.$transaction(async (tx) => {
            await tx.agency.update({
                where: {
                    id: agencyId,
                },
                data: {
                    status: newStatus,
                },
            });

            /**
             * Keep the users under the agency synchronized with the
             * agency status.
             *
             * We don't delete or change their roles.
             */
            await tx.user.updateMany({
                where: {
                    agencyId,
                    role: {
                        in: ["ADMIN", "AGENT", "CLIENT"] as any,
                    },
                },
                data: {
                    isSuspended: !currentlySuspended,
                },
            });

            await tx.auditLog.create({
                data: {
                    action: currentlySuspended
                        ? "REACTIVATE_AGENCY"
                        : "SUSPEND_AGENCY",

                    details: auditDetails(
                        currentlySuspended
                            ? "agencyReactivated"
                            : "agencySuspended",
                        {
                            name: agency.name,
                        }
                    ),

                    userId: session.user.id,
                    agencyId: agency.id,
                    targetId: agency.id,
                },
            });
        });

        revalidatePath("/super-admin/dashboard");
        revalidatePath("/super-admin/dashboard/agencies");

        return {
            success: true,
        };
    } catch (e: any) {
        console.error("Toggle Agency Status Error:", e);

        return {
            error: "Failed to update agency status.",
        };
    }
}

/**
 * Change an agency subscription plan.
 */
/**
 * Change an agency subscription plan.
 */
export async function setAgencyPlanAction(
    agencyId: string,
    planId: string
) {
    const { session, error } = await requireSuperAdmin();

    if (error || !session) {
        return { error: error || "Unauthorized access." };
    }

    if (!agencyId || !planId) {
        return {
            error: "Agency and plan are required.",
        };
    }

    try {
        const agency = await prisma.agency.findUnique({
            where: {
                id: agencyId,
            },
        });

        if (!agency) {
            return {
                error: "Agency not found.",
            };
        }

        if (agency.isInternal) {
            return {
                error: "The internal agency does not use subscription plans.",
            };
        }

        const plan = await prisma.plan.findUnique({
            where: {
                id: planId,
            },
        });

        if (!plan) {
            return {
                error: "Subscription plan not found.",
            };
        }

        if (plan.slug === "internal") {
            return {
                error: "The internal plan cannot be assigned to a normal agency.",
            };
        }

        const existingSubscription =
            await prisma.subscription.findUnique({
                where: {
                    agencyId,
                },
            });

        if (existingSubscription) {
            await prisma.subscription.update({
                where: {
                    agencyId,
                },
                data: {
                    planId,
                    status: "ACTIVE",
                },
            });
        } else {
            const currentPeriodEnd = new Date();

            currentPeriodEnd.setMonth(
                currentPeriodEnd.getMonth() + 1
            );

            await prisma.subscription.create({
                data: {
                    agencyId,
                    planId,
                    status: "ACTIVE",
                    autoRenew: true,
                    currentPeriodEnd,
                },
            });
        }

        await prisma.auditLog.create({
            data: {
                action: "CHANGE_AGENCY_PLAN",
                details: auditDetails("agencyPlanChanged", {
                    agencyName: agency.name,
                    planName: plan.name,
                }),
                userId: session.user.id,
                agencyId: agency.id,
                targetId: agency.id,
            },
        });

        revalidatePath("/super-admin/dashboard");
        revalidatePath("/super-admin/dashboard/agencies");

        return {
            success: true,
        };
    } catch (e: any) {
        console.error("Set Agency Plan Error:", e);

        return {
            error: "Failed to update agency subscription plan.",
        };
    }
}

/**
 * Update agency information.
 */
export async function updateAgencyAction(
    agencyId: string,
    formData: FormData
) {
    const { session, error } = await requireSuperAdmin();

    if (error || !session) {
        return { error: error || "Unauthorized access." };
    }

    const name = (formData.get("name") as string)?.trim();
    const email = (formData.get("email") as string)
        ?.trim()
        .toLowerCase();
    const phone = (formData.get("phone") as string)?.trim();
    const address = (formData.get("address") as string)?.trim();

    if (!agencyId) {
        return {
            error: "Agency ID is required.",
        };
    }

    if (!name) {
        return {
            error: "Agency name is required.",
        };
    }

    if (name.length > 100) {
        return {
            error: "Agency name must be 100 characters or less.",
        };
    }

    if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return {
                error: "Invalid email format.",
            };
        }
    }

    try {
        const agency = await prisma.agency.findUnique({
            where: {
                id: agencyId,
            },
        });

        if (!agency) {
            return {
                error: "Agency not found.",
            };
        }

        if (agency.isInternal) {
            return {
                error: "The internal agency cannot be modified.",
            };
        }

        const duplicateAgency = await prisma.agency.findFirst({
            where: {
                id: {
                    not: agencyId,
                },
                name: {
                    equals: name,
                    mode: "insensitive",
                },
            },
        });

        if (duplicateAgency) {
            return {
                error: "Another agency already uses this name.",
            };
        }

        await prisma.agency.update({
            where: {
                id: agencyId,
            },
            data: {
                name,
                email: email || null,
                phone: phone || null,
                address: address || null,
            },
        });

        await prisma.auditLog.create({
            data: {
                action: "UPDATE_AGENCY",
                details: auditDetails("agencyUpdated", {
                    name,
                    email: email || "",
                }),
                userId: session.user.id,
                agencyId,
                targetId: agencyId,
            },
        });

        revalidatePath("/super-admin/dashboard");
        revalidatePath("/super-admin/dashboard/agencies");

        return {
            success: true,
        };
    } catch (e: any) {
        console.error("Update Agency Error:", e);

        return {
            error: "Failed to update agency details.",
        };
    }
}

/**
 * Permanently delete an agency.
 */
export async function deleteAgencyAction(
    agencyId: string,
    agencyName?: string
) {
    const { session, error } = await requireSuperAdmin();

    if (error || !session) {
        return { error: error || "Unauthorized access." };
    }

    if (!agencyId) {
        return {
            error: "Agency ID is required.",
        };
    }

    try {
        const agency = await prisma.agency.findUnique({
            where: {
                id: agencyId,
            },
        });

        if (!agency) {
            return {
                error: "Agency not found.",
            };
        }

        /**
         * Never allow the Super Admin to delete the internal
         * migration/system agency.
         */
        if (agency.isInternal) {
            return {
                error: "The internal agency cannot be deleted.",
            };
        }

        const nameForLog = agencyName || agency.name;

        /**
         * IMPORTANT:
         *
         * If your Prisma relations use onDelete: Cascade,
         * deleting the agency will automatically delete its users,
         * applications, subscriptions, etc.
         *
         * If they don't, Prisma will return an FK constraint error
         * instead of silently deleting related data.
         */
        await prisma.$transaction(async (tx) => {
            await tx.auditLog.create({
                data: {
                    action: "DELETE_AGENCY",
                    details: auditDetails("agencyDeleted", {
                        name: nameForLog,
                    }),
                    userId: session.user.id,
                    agencyId,
                    targetId: agencyId,
                },
            });

            await tx.agency.delete({
                where: {
                    id: agencyId,
                },
            });
        });

        revalidatePath("/super-admin/dashboard");
        revalidatePath("/super-admin/dashboard/agencies");

        return {
            success: true,
        };
    } catch (e: any) {
        console.error("Delete Agency Error:", e);

        return {
            error:
                "Failed to delete agency. It may still contain related data that must be removed first.",
        };
    }
}