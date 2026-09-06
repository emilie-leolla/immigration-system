import "dotenv/config";
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import prisma from '@/lib/prisma'
import { multiSession, emailOTP } from "better-auth/plugins"
import { sendEmail } from "@/lib/resend"
import { buildOtpEmailHtml } from "@/lib/otp-email"

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: 'postgresql',
    }),
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    secret: process.env.BETTER_AUTH_SECRET,
    session: {
        expiresIn: 60 * 60 * 24 * 90, // 90 days in seconds (7,776,000s)
        updateAge: 60 * 60 * 24 * 1, // 1 day
    },
    advanced: {
        // Ensure the session cookie always carries a Max-Age so it persists
        // across browser restarts (not treated as a session-only cookie).
        defaultCookieAttributes: {
            maxAge: 60 * 60 * 24 * 90, // 90 days
        },
    },
    plugins: [
        emailOTP({
            otpLength: 6,
            expiresIn: 300, // 5 minutes
            allowedAttempts: 3,
            // Registration already creates the user directly (see
            // app/[locale]/admin/register/actions.ts) — the OTP plugin is
            // only ever used to verify an email that already exists, never
            // to sign someone up on its own.
            disableSignUp: true,
            sendVerificationOTP: async ({ email, otp, type }) => {
                const subject =
                    type === "email-verification"
                        ? "Your verification code"
                        : "Your sign-in code";

                const result = await sendEmail({
                    to: email,
                    subject,
                    html: buildOtpEmailHtml({ otp, type }),
                });

                if (result.error) {
                    console.error(`[Email OTP] Failed to send to ${email}:`, result.error);
                }
            },
        }),
    ],
    debug: true,
    emailAndPassword: {
        enabled: true,
        autoSignIn: true,
    },
    emailVerification: {
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, url, token }: any) => {
            console.log(`[Email Verification] Send to ${user.email}: ${url}`);
        },
    },
    user: {
        additionalFields: {
           role: {
                type: "string",
                defaultValue: "CLIENT",
            },
           agencyId: {
                type: "string",
                required: false
            },
            mustChangePassword: {
                type: "boolean",
                defaultValue: false,
                required: false
            },
            status: {
                type: "string",
                defaultValue: "ACTIVE",
            },
            isSuspended: {
                type: "boolean",
                defaultValue: false
            },
            profileCompleted: {
                type: "boolean",
                defaultValue: false
            },
            dateOfBirth: {
                type: "date",
                required: false
            },
            nationality: {
                type: "string",
                required: false
            },
            maritalStatus: {
                type: "string",
                required: false
            },
            numberOfChildren: {
                type: "number",
                defaultValue: 0,
                required: false
            },
            phoneNumber: {
                type: "string",
                required: false
            },
            profession: {
                type: "string",
                required: false
            },
            address: {
                type: "string",
                required: false
            }
        },
    },
    baseHooks: {
        session: {
            create: {
                after: async (session: any) => {
                    // Better-Auth hooks usually pass the session object which has userId
                    if (session.userId) {
                        try {
                            // 1. Fetch the actual user to get the 'name'
                            const user = await prisma.user.findUnique({ 
                                where: { id: session.userId } 
                            });

                            
                            await prisma.auditLog.create({
                                data: {
                                    action: "USER_LOGIN",
                                    details: `${user?.name || 'Unknown User'} (${user?.email || 'No Email'}) logged in.`,
                                    userId: session.userId
                                }
                            });

                        } catch (error) {
                            console.error("[AUTH_HOOK_ERROR]:", error);
                        }
                    }
                }
            }
        }

    },
    trustedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
})