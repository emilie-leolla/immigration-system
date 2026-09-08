import "dotenv/config";
import prisma from "../lib/prisma";

const PLANS = [
    { name: "Gratuit", slug: "free", priceFcfa: 0, maxAgents: 1, maxClients: 10, maxWorkflows: 1, isPublic: true },
    { name: "Standard", slug: "standard", priceFcfa: 25000, maxAgents: 4, maxClients: 100, isPublic: true },
    { name: "Pro", slug: "pro", priceFcfa: 100000, maxAgents: null, maxClients: 1000, isPublic: true },
    { name: "Sur mesure", slug: "custom", priceFcfa: 0, maxAgents: null, maxClients: null, isPublic: false },
    { name: "Interne", slug: "internal", priceFcfa: 0, maxAgents: null, maxClients: null, isPublic: false },
];

async function main() {
    for (const p of PLANS) {
        await prisma.plan.upsert({
            where: { slug: p.slug },
            update: p,
            create: p,
        });
    }
    console.log("Plans seeded.");

    const internalPlan = await prisma.plan.findUnique({ where: { slug: "internal" } });
    const freePlan = await prisma.plan.findUnique({ where: { slug: "free" } });

    const agencies = await prisma.agency.findMany({
        include: { subscription: true },
    });

    for (const agency of agencies) {
        if (agency.subscription) continue;
        const plan = agency.isInternal ? internalPlan : freePlan;
        if (!plan) continue;

        await prisma.subscription.create({
            data: {
                agencyId: agency.id,
                planId: plan.id,
                status: "ACTIVE",
                autoRenew: true,
                currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            },
        });
        console.log(`Subscription created for agency ${agency.name} (${plan.name})`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });