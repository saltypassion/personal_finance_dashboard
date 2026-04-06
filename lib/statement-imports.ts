import crypto from "crypto";
import { TransactionDirection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ParseResponse } from "@/lib/types";

const DEV_USER = {
  clerkId: "dev-local-user",
  email: "local@finance-os.dev",
  displayName: "Local User"
};

function statementPeriodFromParse(parsed: ParseResponse) {
  if (parsed.transactions.length === 0) {
    return {
      statementStartDate: null,
      statementEndDate: null
    };
  }

  const sortedDates = parsed.transactions.map((transaction) => transaction.date).sort();
  return {
    statementStartDate: new Date(`${sortedDates[0]}T00:00:00.000Z`),
    statementEndDate: new Date(`${sortedDates[sortedDates.length - 1]}T00:00:00.000Z`)
  };
}

async function getOrCreateDevAccount(institutionName: string, accountName: string | null | undefined) {
  const user = await prisma.user.upsert({
    where: { clerkId: DEV_USER.clerkId },
    update: {
      email: DEV_USER.email,
      displayName: DEV_USER.displayName
    },
    create: DEV_USER
  });

  const account = await prisma.account.upsert({
    where: {
      id: `${user.id}-${institutionName}-${accountName ?? "main"}`
    },
    update: {
      institutionName,
      accountName: accountName ?? "Main Account"
    },
    create: {
      id: `${user.id}-${institutionName}-${accountName ?? "main"}`,
      userId: user.id,
      institutionName,
      accountName: accountName ?? "Main Account"
    }
  });

  return { user, account };
}

function transactionHash(accountId: string, input: { date: string; description: string; amount: number }) {
  return crypto
    .createHash("sha256")
    .update(`${accountId}|${input.date}|${input.description}|${input.amount.toFixed(2)}`)
    .digest("hex");
}

function statementImportId(input: { userId: string; accountId: string; filename: string; fileHash: string }) {
  return crypto
    .createHash("sha256")
    .update(`${input.userId}|${input.accountId}|${input.filename}|${input.fileHash}`)
    .digest("hex");
}

export async function persistParsedStatement(filename: string, parsed: ParseResponse, fileHash: string) {
  const { statementStartDate, statementEndDate } = statementPeriodFromParse(parsed);
  const { user, account } = await getOrCreateDevAccount(parsed.institution, parsed.account_name);
  const importId = statementImportId({
    userId: user.id,
    accountId: account.id,
    filename,
    fileHash
  });

  const existingImport = await prisma.statementImport.findUnique({
    where: {
      id: importId
    }
  });

  if (existingImport) {
    return existingImport;
  }

  const statementImport = await prisma.statementImport.create({
    data: {
      id: importId,
      userId: user.id,
      accountId: account.id,
      sourceFilename: filename,
      statementStartDate,
      statementEndDate,
      transactionCount: parsed.transactions.length
    }
  });

  if (parsed.transactions.length > 0) {
    await prisma.transaction.createMany({
      data: parsed.transactions.map((transaction) => ({
        userId: user.id,
        accountId: account.id,
        statementImportId: statementImport.id,
        externalHash: transactionHash(account.id, {
          date: transaction.date,
          description: transaction.description,
          amount: transaction.amount
        }),
        postedAt: new Date(`${transaction.date}T00:00:00.000Z`),
        description: transaction.description,
        merchant: transaction.description,
        category: transaction.category ?? null,
        amount: transaction.amount,
        currency: transaction.currency,
        direction: transaction.amount >= 0 ? TransactionDirection.CREDIT : TransactionDirection.DEBIT
      })),
      skipDuplicates: true
    });
  }

  return statementImport;
}

export async function listStatementImports() {
  const user = await prisma.user.findUnique({
    where: { clerkId: DEV_USER.clerkId }
  });

  if (!user) {
    return [];
  }

  return prisma.statementImport.findMany({
    where: { userId: user.id },
    include: {
      account: true
    },
    orderBy: {
      importedAt: "desc"
    }
  });
}

export async function listPersistedTransactions() {
  const user = await prisma.user.findUnique({
    where: { clerkId: DEV_USER.clerkId }
  });

  if (!user) {
    return [];
  }

  return prisma.transaction.findMany({
    where: { userId: user.id },
    include: {
      account: true,
      statementImport: true
    },
    orderBy: {
      postedAt: "asc"
    }
  });
}
