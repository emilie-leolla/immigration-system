import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { getAnsweredQuestionsBySection, formatAnswerForDisplay } from "@/lib/intake-form/engine";

export const dynamic = "force-dynamic";

const COUNTRY_LABELS: Record<string, string> = {
    CANADA: "Canada",
    FRANCE: "France",
    GERMANY: "Allemagne",
};

export default async function ClientQuestionnairePage({ params }: { params: { id: string } }) {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session || !["AGENT", "ADMIN"].includes((session.user as any).role)) {
        return null;
    }

    const { id } = await params;
    const isAdmin = (session.user as any).role === "ADMIN";
    const agencyId = (session.user as any).agencyId;

    const client = await prisma.user.findUnique({
        where: isAdmin ? { id, agencyId } : { id, agentId: session.user.id },
        select: { id: true, name: true },
    });

    if (!client) {
        notFound();
    }

    const form = await prisma.intakeFormResponse.findUnique({
        where: { clientId: id },
    });

    const answers = (form?.answers as Record<string, any>) || {};
    const country = form?.country || null;
    const steps = form ? getAnsweredQuestionsBySection(country, answers) : [];

    return (
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
            <Link
                href={`/dashboard/agent/clients/${id}`}
                className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-[#1E3A8A] transition-colors"
            >
                <ArrowLeft className="h-4 w-4" />
                Retour au profil
            </Link>

            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <ClipboardList className="h-5 w-5 text-[#1E3A8A]" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-900">
                        Réponses au questionnaire — {client.name}
                    </h1>
                    {country && (
                        <p className="text-sm text-gray-500">
                            Destination : {COUNTRY_LABELS[country] || country}
                        </p>
                    )}
                </div>
            </div>

            {!form || Object.keys(answers).length === 0 ? (
                <div className="bg-white border-2 border-dashed border-gray-100 rounded-3xl p-16 text-center">
                    <p className="text-gray-400 font-semibold">
                        Ce client n'a pas encore commencé ou soumis son formulaire de renseignement.
                    </p>
                </div>
            ) : (
                <>
                    <div
                        className={`text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl inline-block ${
                            form.status === "SUBMITTED"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-yellow-50 text-yellow-700"
                        }`}
                    >
                        {form.status === "SUBMITTED" ? "Formulaire soumis" : "Brouillon en cours"}
                    </div>

                    <div className="space-y-6">
                        {steps.map((step) => (
                            <div
                                key={step.section}
                                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                            >
                                <div className="bg-gray-50/70 px-6 py-3 border-b border-gray-100">
                                    <h2 className="text-sm font-black text-[#1E3A8A] uppercase tracking-wide">
                                        {step.label}
                                    </h2>
                                </div>
                                <div className="divide-y divide-gray-50">
                                    {step.questions.map((q) => (
                                        <div key={q.id} className="px-6 py-4">
                                            <p className="text-xs font-bold text-gray-400 mb-1">{q.label}</p>
                                            <p className="text-sm font-semibold text-gray-900">
                                                {formatAnswerForDisplay(q, answers[q.id])}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}