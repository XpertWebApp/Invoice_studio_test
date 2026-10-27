import { MongoClient, ObjectId, type Collection } from "mongodb";
import type { Invoice, InvoiceInput, Totals } from "./types";

/** Shape of a document in the "invoices" collection. */
export interface InvoiceDoc extends InvoiceInput {
  _id: ObjectId;
  totals: Totals;
  createdAt: Date;
  updatedAt: Date;
}

const globalForMongo = globalThis as unknown as {
  _invoiceMongoClient?: Promise<MongoClient>;
};

function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Add it to .env.local.");
  }
  if (!globalForMongo._invoiceMongoClient) {
    const promise = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 }).connect();
    // Do not cache a failed connection, so the next request can retry.
    promise.catch(() => {
      if (globalForMongo._invoiceMongoClient === promise) {
        globalForMongo._invoiceMongoClient = undefined;
      }
    });
    globalForMongo._invoiceMongoClient = promise;
  }
  return globalForMongo._invoiceMongoClient;
}

/** Lazily connects on first call. Never runs at import time. */
export async function getInvoicesCollection(): Promise<Collection<InvoiceDoc>> {
  const dbName = process.env.MONGODB_DB;
  if (!dbName) {
    throw new Error("MONGODB_DB is not set. Add it to .env.local.");
  }
  const client = await getClient();
  return client.db(dbName).collection<InvoiceDoc>("invoices");
}

export function toInvoice(doc: InvoiceDoc): Invoice {
  const { _id, createdAt, updatedAt, ...rest } = doc;
  return {
    ...rest,
    id: _id.toHexString(),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}
