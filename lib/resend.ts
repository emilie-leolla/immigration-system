"use server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
    to,
    subject,
    html,
    fromName
}: {
    to: string | string[];
    subject: string;
    html: string;
    fromName?: string;
}) {
    if (!process.env.RESEND_API_KEY) {
        console.error("RESEND_API_KEY is not set");
        return { error: "Mailing service not configured." };
    }

    try {
        await resend.emails.send({
            from: `${fromName || "Procédure Facile"} <noreply@procedure-facile.com>`,
            to,
            subject,
            html,
        });
        return { success: true };
    } catch (error) {
        console.error("Error sending email:", error);
        return { error: "Failed to send email." };
    }
}

export async function contactAction(formData: FormData) {
    const fullName = formData.get("fullName") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const message = formData.get("message") as string;

    if (!fullName || !email || !message) {
        return { error: "Please fill in all required fields." };
    }

    const html = `
        <h2>New Contact Inquiry</h2>
        <p><strong>Name:</strong> ${fullName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
    `;

    return await sendEmail({
                to: process.env.AGENCY_CONTACT_EMAIL || "emilieag573@gmail.com",
             subject: `New Inquiry from ${fullName}`,
        html,
    });
}