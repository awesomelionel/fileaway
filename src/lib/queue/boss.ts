/**
 * pg-boss job queue client.
 *
 * Provides a singleton PgBoss instance for background job processing.
 * Jobs are processed by worker processes — not inside Next.js request handlers.
 *
 * Usage:
 *   import { getQueue } from "@/lib/queue/boss";
 *   const boss = await getQueue();
 *   const jobId = await boss.send("process-url", { savedItemId, url });
 */

import { PgBoss } from "pg-boss";

const DATABASE_URL = process.env.DATABASE_URL!;

let instance: PgBoss | null = null;

export async function getQueue(): Promise<PgBoss> {
  if (!instance) {
    instance = new PgBoss({
      connectionString: DATABASE_URL,
      schema: "pgboss",
    });

    instance.on("error", (err: Error) => {
      console.error("[pg-boss] error:", err);
    });

    await instance.start();
  }
  return instance;
}

/** Job name constants — keep in sync with workers */
export const JOB_NAMES = {
  PROCESS_URL: "process-url",
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

export interface ProcessUrlJobData {
  savedItemId: string;
  url: string;
}
