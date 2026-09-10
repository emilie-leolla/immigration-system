"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auditDetails } from "@/lib/audit-log";

export async function completeProfileAction(formData: FormData) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) return { error: "Unauthorized" };

    const dateOfBirth = formData.get("dateOfBirth") as string;
    const nationality = formData.get("nationality") as string;
    const maritalStatus = formData.get("maritalStatus") as string;
    const numberOfChildren = parseInt(formData.get("numberOfChildren") as string || "0");
    const address = formData.get("address") as string;

    if (!dateOfBirth || !nationality || !maritalStatus || !address) {
        return { error: "All fields are required." };
    }

    try {
        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                dateOfBirth: new Date(dateOfBirth),
                nationality,
                maritalStatus: maritalStatus as any,
                numberOfChildren,
                address,
                profileCompleted: true
            }
        });

        // Add audit log
        await prisma.auditLog.create({
            data: {
                action: "PROFILE_UPDATE",
                details: auditDetails("profileCompleted", { userName: session.user.name }),
                userId: session.user.id
            }
        });

        revalidatePath("/complete-profile");
        return { success: true };
    } catch (e: any) {
        console.error("Profile update error:", e);
        return { error: e.message || "An error occurred while updating profile." };
    }
}