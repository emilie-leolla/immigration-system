import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import IntakeFormClient from "./intake-form-client";

export const dynamic = "force-dynamic";

export default async function IntakeFormPage() {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) {
        redirect("/sign-in");
    }

    if ((session.user as any).role !== "CLIENT") {
        return (
            <div className="flex items-center justify-center min-h-[60vh] px-4 text-center">
                <p className="text-gray-500 font-medium">
                    Ce formulaire est réservé aux clients.
                </p>
            </div>
        );
    }

    let form = await prisma.intakeFormResponse.findUnique({
        where: { clientId: session.user.id },
    });

    if (!form) {
        form = await prisma.intakeFormResponse.create({
            data: { clientId: session.user.id },
        });
    }

    return (
        <IntakeFormClient
            clientName={session.user.name || ""}
            initialAnswers={(form.answers as Record<string, any>) || {}}
            initialSection={form.currentSection}
            initialStatus={form.status}
        />
    );
}