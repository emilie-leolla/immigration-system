import prisma from "@/lib/prisma";

/**
 * The pricing settings row always exists after this is called once — it's
 * created with sensible defaults on first read if missing, so nothing else
 * in the app has to worry about a missing row.
 */
export async function getPricingSettings() {
    return prisma.pricingSettings.upsert({
        where: { id: "singleton" },
        update: {},
        create: { id: "singleton" },
    });
}

export function calculateCustomPlanPrice(
    numAgents: number,
    numClients: number,
    settings: { basePriceFcfa: number; pricePerAgentFcfa: number; pricePerClientFcfa: number }
): number {
    return (
        settings.basePriceFcfa +
        numAgents * settings.pricePerAgentFcfa +
        numClients * settings.pricePerClientFcfa
    );
}