import {PrismaPg} from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client';


const gloablForPrisma = globalThis as unknown as{
    prisma:PrismaClient | undefined
}


function createPrismaClient(){

    const adapter = new PrismaPg({
        connectionString:process.env.DATABASE_URL!,
    })


    return new PrismaClient({adapter})
}

export const db = gloablForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") gloablForPrisma.prisma =db;