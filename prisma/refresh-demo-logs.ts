import "dotenv/config";
import prisma from "../lib/prisma";
import { auditDetails } from "../lib/audit-log";

const AGENCY_NAME = "Objectif Canada";
const ADMIN_NAME = "Paul Barga";
const AGENT_NAME = "Steve Ondoa";

async function main() {
    const agency = await prisma.agency.findFirst({ where: { name: AGENCY_NAME } });
    if (!agency) {
        console.error(`❌ Agence "${AGENCY_NAME}" introuvable — rien à faire, aucune modification.`);
        return;
    }

    const admin = await prisma.user.findUnique({ where: { email: "admin@objectifcanada.cm" } });
    const agent = await prisma.user.findUnique({ where: { email: "agent@objectifcanada.cm" } });
    if (!admin || !agent) {
        console.error("❌ Compte admin ou agent introuvable — rien à faire, aucune modification.");
        return;
    }

    const clients = [];
    for (let i = 1; i <= 10; i++) {
        const c = await prisma.user.findUnique({ where: { email: `client${i}@objectifcanada.cm` } });
        if (c) clients.push(c);
    }
    if (clients.length < 5) {
        console.error("❌ Pas assez de clients trouvés — rien à faire, aucune modification.");
        return;
    }

    // Seule opération destructive : les entrées du journal de CETTE agence
    // uniquement. Rien d'autre (agence, comptes, workflows, procédures,
    // documents) n'est touché par ce script.
    const { count: deletedCount } = await prisma.auditLog.deleteMany({
        where: { agencyId: agency.id },
    });
    console.log(`🗑️  ${deletedCount} anciennes entrées du journal supprimées pour "${AGENCY_NAME}".`);

    const now = Date.now();

    const activityLog: { action: string; details: string; hoursAgo: number; userId?: string }[] = [
        { action: "CREATE_CLIENT", details: auditDetails("clientCreatedByAdmin", { name: clients[0].name, email: clients[0].email, adminName: ADMIN_NAME }), hoursAgo: 96, userId: admin.id },
        { action: "CREATE_CLIENT", details: auditDetails("clientCreatedByAdmin", { name: clients[1].name, email: clients[1].email, adminName: ADMIN_NAME }), hoursAgo: 90, userId: admin.id },
        { action: "CREATE_APPLICATION", details: auditDetails("applicationCreatedByAgent", { templateName: "Standard PR - Canada", clientName: clients[0].name, actorName: AGENT_NAME }), hoursAgo: 88, userId: agent.id },
        { action: "DOCUMENT_UPLOAD", details: auditDetails("documentUploadedByActor", { actorName: AGENT_NAME, docName: "Passeport.pdf", clientName: clients[0].name, stepType: "DOCUMENT_COLLECTION" }), hoursAgo: 70, userId: agent.id },
        { action: "STEP_UPDATE", details: auditDetails("stepUpdatedByActor", { actorRole: "Agent", actorName: AGENT_NAME, stepType: "REGISTRATION", status: "APPROVED" }), hoursAgo: 65, userId: agent.id },
        { action: "CREATE_CLIENT", details: auditDetails("clientCreatedByAdmin", { name: clients[2].name, email: clients[2].email, adminName: ADMIN_NAME }), hoursAgo: 60, userId: admin.id },
        { action: "STEP_UPDATE", details: auditDetails("stepUpdatedByActor", { actorRole: "Agent", actorName: AGENT_NAME, stepType: "CONTRACT_SIGNING", status: "APPROVED" }), hoursAgo: 48, userId: agent.id },
        { action: "DOCUMENT_UPLOAD", details: auditDetails("documentUploadedByActor", { actorName: AGENT_NAME, docName: "Diplome.pdf", clientName: clients[1].name, stepType: "DOCUMENT_COLLECTION" }), hoursAgo: 40, userId: agent.id },
        { action: "CREATE_APPLICATION", details: auditDetails("applicationCreatedByAgent", { templateName: "Standard PR - Canada", clientName: clients[3].name, actorName: AGENT_NAME }), hoursAgo: 36, userId: agent.id },
        { action: "STEP_UPDATE", details: auditDetails("stepUpdatedByActor", { actorRole: "Agent", actorName: AGENT_NAME, stepType: "FEE_PAYMENT", status: "APPROVED" }), hoursAgo: 30, userId: agent.id },
        { action: "CREATE_CLIENT", details: auditDetails("clientCreatedByAdmin", { name: clients[3].name, email: clients[3].email, adminName: ADMIN_NAME }), hoursAgo: 24, userId: admin.id },
        { action: "CREATE_APPLICATION_TEMPLATE", details: auditDetails("workflowCreated", { adminName: ADMIN_NAME, templateName: "Visa Vacances-Travail (PVT) - Sur mesure" }), hoursAgo: 22, userId: admin.id },
        { action: "CREATE_APPLICATION", details: auditDetails("applicationCreatedByAgent", { templateName: "Visa Vacances-Travail - Sur mesure", clientName: clients[7]?.name || clients[4].name, actorName: AGENT_NAME }), hoursAgo: 20, userId: agent.id },
        { action: "STEP_UPDATE", details: auditDetails("stepUpdatedByActor", { actorRole: "Agent", actorName: AGENT_NAME, stepType: "DOCUMENT_COLLECTION", status: "APPROVED" }), hoursAgo: 15, userId: agent.id },
        { action: "DOCUMENT_UPLOAD", details: auditDetails("documentUploadedByActor", { actorName: AGENT_NAME, docName: "CV.pdf", clientName: clients[3].name, stepType: "DOCUMENT_COLLECTION" }), hoursAgo: 10, userId: agent.id },
        { action: "STEP_UPDATE", details: auditDetails("stepUpdatedByActor", { actorRole: "Agent", actorName: AGENT_NAME, stepType: "DIPLOMA_EQUIVALENCE", status: "IN_PROGRESS" }), hoursAgo: 6, userId: agent.id },
        { action: "CREATE_CLIENT", details: auditDetails("clientCreatedByAdmin", { name: clients[4].name, email: clients[4].email, adminName: ADMIN_NAME }), hoursAgo: 4, userId: admin.id },
        { action: "STEP_UPDATE", details: auditDetails("finalStepApprovedByActor", { actorName: AGENT_NAME, stepType: "PASSPORT_SUBMISSION", clientName: clients[4].name }), hoursAgo: 2, userId: agent.id },
    ];

    for (const entry of activityLog) {
        await prisma.auditLog.create({
            data: {
                action: entry.action,
                details: entry.details,
                userId: entry.userId,
                agencyId: agency.id,
                createdAt: new Date(now - entry.hoursAgo * 60 * 60 * 1000),
            },
        });
    }

    console.log(`✅ ${activityLog.length} nouvelles entrées traduisibles créées pour "${AGENCY_NAME}".`);
    console.log("Aucune autre donnée (comptes, workflows, procédures, documents) n'a été modifiée.");
}

main()
    .catch((e) => {
        console.error("❌ Erreur:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });