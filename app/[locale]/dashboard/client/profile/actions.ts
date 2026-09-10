"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { MaritalStatus } from "@prisma/client";
import { auditDetails } from "@/lib/audit-log";

export async function updateProfileTranslate(formData: { 
    name: string; 
    email: string; 
    phoneNumber: string;
    nationality?: string;
    dateOfBirth?: string;
    maritalStatus?: string;
    numberOfChildren?: number;
    address?: string;
}) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) return { error: "Session expired. Please login again." };

    const { name, email, phoneNumber, nationality, dateOfBirth, maritalStatus, numberOfChildren, address } = formData;

    if (!name || !email || !phoneNumber) {
        return { error: "Name, Email, and Phone Number are required fields." };
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { error: "Please provide a valid email address." };
    }

    try {
        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                name,
                email,
                phoneNumber,
                nationality: nationality || null,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                maritalStatus: (maritalStatus as MaritalStatus) || null,
                numberOfChildren: numberOfChildren !== undefined ? Number(numberOfChildren) : 0,
                address: address || null
            }
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
                action: "PROFILE_UPDATE",
                details: auditDetails("clientUpdatedOwnProfile"),
                userId: session.user.id
            }
        });

        revalidatePath("/dashboard/client/profile");
        return { success: "Detailed profile updated successfully!" };
    } catch (e: any) {
        console.error("Profile Update Error:", e);
        if (e.code === 'P2002' && e.meta?.target?.includes('email')) {
            return { error: "This email address is already in use." };
        }
        return { error: "A server error occurred while updating your profile information." };
    }
}