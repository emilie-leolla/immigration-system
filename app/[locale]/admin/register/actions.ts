"use server";

import prisma from "@/lib/prisma";
import { hashPassword } from "better-auth/crypto";
import { auditDetails } from "@/lib/audit-log";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Public self-registration: an agency signs itself up.
 *
 * Unlike super-admin's createAgencyAction, this has NO auth requirement —
 * anyone can call it — so validation here has to be strict. It creates the
 * Agency and its first ADMIN user in a single transaction, exactly like the
 * super-admin flow does, so both places stay consistent.
 *
 * NOTE: this only creates the database rows. The registration page still
 * has to send + verify an OTP (email-otp plugin) afterwards to actually
 * verify the email and log the new admin in — this action does not create
 * a session by itself.
 */
export async function registerAgencyAdminAction(
    formData: FormData,
    locale: string = "en"
) {
    const isFr = locale === "fr";

    const messages = {
        allFields: isFr
            ? "Tous les champs sont obligatoires."
            : "All fields are required.",
        agencyNameTooLong: isFr
            ? "Le nom de l'agence doit contenir 100 caractères maximum."
            : "Agency name must be 100 characters or less.",
        fullNameTooLong: isFr
            ? "Le nom complet doit contenir 50 caractères maximum."
            : "Full name must be 50 characters or less.",
        invalidEmail: isFr
            ? "Veuillez saisir une adresse e-mail valide."
            : "Please enter a valid email address.",
        professionTooLong: isFr
            ? "La profession doit contenir 100 caractères maximum."
            : "Profession must be 100 characters or less.",
        addressTooLong: isFr
            ? "L'adresse doit contenir 200 caractères maximum."
            : "Address must be 200 characters or less.",
        passwordTooShort: isFr
            ? "Le mot de passe doit contenir au moins 8 caractères."
            : "Password must be at least 8 characters long.",
        passwordsMismatch: isFr
            ? "Les mots de passe ne correspondent pas."
            : "Passwords do not match.",
        emailTaken: isFr
            ? "Un utilisateur avec cet e-mail existe déjà."
            : "A user with this email already exists.",
        agencyNameTaken: isFr
            ? "Une agence avec ce nom existe déjà."
            : "An agency with this name already exists.",
        genericError: isFr
            ? "Une erreur s'est produite lors de la création de votre compte."
            : "An error occurred while creating your account.",
    };

    const agencyName = (formData.get("agencyName") as string)?.trim();
    const name = (formData.get("name") as string)?.trim();
    const email = (formData.get("email") as string)?.trim().toLowerCase();
    const profession = (formData.get("profession") as string)?.trim();
    const address = (formData.get("address") as string)?.trim();
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!agencyName || !name || !email || !profession || !address || !password || !confirmPassword) {
        return { error: messages.allFields };
    }

    if (agencyName.length > 100) {
        return { error: messages.agencyNameTooLong };
    }

    if (name.length > 50) {
        return { error: messages.fullNameTooLong };
    }

    if (!emailRegex.test(email)) {
        return { error: messages.invalidEmail };
    }

    if (profession.length > 100) {
        return { error: messages.professionTooLong };
    }

    if (address.length > 200) {
        return { error: messages.addressTooLong };
    }

    if (password.length < 8) {
        return { error: messages.passwordTooShort };
    }

    if (password !== confirmPassword) {
        return { error: messages.passwordsMismatch };
    }

    try {
        // Better Auth users are global, so email must be unique across the
        // whole platform even though agencies are otherwise isolated.
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return { error: messages.emailTaken };
        }

        const existingAgency = await prisma.agency.findFirst({
            where: { name: { equals: agencyName, mode: "insensitive" } },
        });

        if (existingAgency) {
            return { error: messages.agencyNameTaken };
        }

        const hashedPassword = await hashPassword(password);

        const result = await prisma.$transaction(async (tx) => {
            const agency = await tx.agency.create({
                data: {
                    name: agencyName,
                    email,
                    address,
                    status: "ACTIVE",
                    isInternal: false,
                },
            });

            const admin = await tx.user.create({
                data: {
                    name,
                    email,
                    password: hashedPassword,
                    role: "ADMIN" as any,
                    agency: { connect: { id: agency.id } },
                    address,
                    profession,
                    emailVerified: false,
                    accounts: {
                        create: {
                            providerId: "credential",
                            accountId: email,
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

            await tx.auditLog.create({
                data: {
                    action: "CREATE_AGENCY",
                    details: auditDetails("agencyCreated", {
                        name: agencyName,
                        email,
                    }),
                    userId: admin.id,
                    agencyId: agency.id,
                    targetId: agency.id,
                },
            });

            return { agency, admin };
        });

        return { success: true, agencyId: result.agency.id };
    } catch (e: any) {
        console.error("Agency Self-Registration Error:", e);
        return { error: messages.genericError };
    }
}