import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/contact:
 *   post:
 *     summary: Send contact email
 *     description: Submits the contact form and sends an email to the administrator.
 *     tags:
 *       - Contact
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - message
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email sent successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Internal server error
 *       503:
 *         description: Service unavailable (SMTP credentials not configured)
 */
export async function POST(req: NextRequest) {
    try {
        const { fullName, email, phone, message } = await req.json();

        if (!fullName || !email || !message) {
            return NextResponse.json(
                { error: "Missing required fields." },
                { status: 400 }
            );
        }

        // Check that Gmail credentials are configured
        const gmailUser = process.env.GMAIL_USER;
        const gmailPass = process.env.GMAIL_APP_PASSWORD;

        if (!gmailUser || !gmailPass) {
            console.error("[Contact API] Gmail credentials not configured.");
            return NextResponse.json(
                { error: "Failed to send message. Please email us directly at emilieag573@gmail.com" },
                { status: 503 }
            );
        }

        // Create Gmail SMTP transporter
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: gmailUser,
                pass: gmailPass, // Must be a Gmail App Password, not your account password
            },
        });
        console.log("Transporter configured:", { gmailUser });
        // Send the email
        await transporter.sendMail({
            from: `"Procédure Facile" <${gmailUser}>`,
            to: "emilieag573@gmail.com",
            replyTo: email,
            subject: `New Inquiry from ${fullName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #1E3A8A; padding: 24px 32px;">
                        <h1 style="color: white; margin: 0; font-size: 20px;">New Contact Inquiry</h1>
                        <p style="color: #93c5fd; margin: 4px 0 0; font-size: 14px;">ATLE Immigration — Contact Form</p>
                    </div>
                    <div style="padding: 32px; background: white;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 10px 0; font-size: 13px; color: #6b7280; font-weight: 600; width: 130px; border-bottom: 1px solid #f1f5f9;">Full Name</td>
                                <td style="padding: 10px 0; font-size: 14px; color: #111827; border-bottom: 1px solid #f1f5f9;">${fullName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; font-size: 13px; color: #6b7280; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Email</td>
                                <td style="padding: 10px 0; font-size: 14px; color: #111827; border-bottom: 1px solid #f1f5f9;">
                                    <a href="mailto:${email}" style="color: #1E3A8A;">${email}</a>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; font-size: 13px; color: #6b7280; font-weight: 600;">Phone</td>
                                <td style="padding: 10px 0; font-size: 14px; color: #111827;">${phone || "Not provided"}</td>
                            </tr>
                        </table>
                        <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                            <p style="font-size: 13px; color: #6b7280; font-weight: 600; margin: 0 0 10px;">Message</p>
                            <p style="font-size: 14px; color: #111827; line-height: 1.7; margin: 0; white-space: pre-wrap; background: #f8fafc; padding: 16px; border-radius: 6px; border: 1px solid #e2e8f0;">${message}</p>
                        </div>
                    </div>
                    <div style="background: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0;">
                        <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                            Sent from the ATLE Immigration contact form. Hit Reply to respond directly to ${fullName}.
                        </p>
                    </div>
                </div>
            `,
        });

        return NextResponse.json({ success: true }, { status: 200 });

    } catch (err: any) {
        console.error("[Contact API] Error:", err?.message || err);
        return NextResponse.json(
            { error: "Failed to send message. Please email us directly at emilieag573@gmail.com" },
            { status: 500 }
        );
    }
}
