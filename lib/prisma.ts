import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = `${process.env.DATABASE_URL}`;

const globalForPrisma = global as unknown as {
    prisma: PrismaClient | undefined;
    pool: Pool | undefined;
};

// Singleton Pool to prevent connection exhaustion.
// IMPORTANT: this must be cached in ALL environments, not just non-production.
// Serverless platforms (Vercel, etc.) reuse the same warm Node process across
// requests, so caching only outside of production meant every single
// production request was opening a brand-new pg.Pool (and a new TCP+TLS
// handshake to Neon) instead of reusing one. That was the main source of
// added latency and, under load, connection exhaustion against the DB.
const pool = globalForPrisma.pool ?? new Pool({
    connectionString,
    connectionTimeoutMillis: 30000,
    max: 10,
});

globalForPrisma.pool = pool;

const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
    adapter,
    log: ["error", "warn"],
});

globalForPrisma.prisma = prisma;

export default prisma;