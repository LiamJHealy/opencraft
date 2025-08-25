import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["warn", "error"], // add "query" to debug SQL if needed
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
