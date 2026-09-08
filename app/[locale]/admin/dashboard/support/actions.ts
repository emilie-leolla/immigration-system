"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { sendEmail } from "@/lib/resend";
import prisma from "@/lib/prisma";

const SUPPORT_EMAILS = process.env.SUPPORT_EMAIL
    ? process.env.SUPPORT_EMAIL.split(",").map((e) => e.trim())
    : ["immigrationsupport106@gmail.com", "contact@procedure-facile.com"];

export async function sendSupportRequestAction(formData: FormData) {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session || !["ADMIN", "AGENT"].includes((session.user as any).role)) {
        return { error: "Unauthorized." };
    }

    const subject = (formData.get("subject") as string)?.trim();
    const message = (formData.get("message") as string)?.trim();

    if (!subject || !message) {
        return { error: "Please fill in both the subject and the message." };
    }

    const adminName = session.user.name || "Unknown";
    const adminEmail = session.user.email || "Unknown";
    const agencyId = (session.user as any).agencyId;

    let agencyName = "N/A";
    if (agencyId) {
        const agency = await prisma.agency.findUnique({
            where: { id: agencyId },
            select: { name: true },
        });
        agencyName = agency?.name || "N/A";
    }

    const html = `
        <h2>New Support Request</h2>
        <p><strong>From:</strong> ${adminName} (${adminEmail})</p>
        <p><strong>Agency:</strong> ${agencyName}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, "<br/>")}</p>
    `;

    const result = await sendEmail({
        to: SUPPORT_EMAILS,
        subject: `[Support] ${agencyName} — ${subject}`,
        html,
        fromName: `${adminName} via Procédure Facile`,
    });

    if (result.error) {
        return { error: result.error };
    }

    return { success: true };
}