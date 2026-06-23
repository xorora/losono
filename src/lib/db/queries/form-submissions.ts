import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { formSubmissions } from "@/lib/db/schema";

export async function getFormSubmissionForVisitor(
  agentId: string,
  visitorId: string,
) {
  const [submission] = await getDb()
    .select()
    .from(formSubmissions)
    .where(
      and(
        eq(formSubmissions.agentId, agentId),
        eq(formSubmissions.visitorId, visitorId),
      ),
    )
    .limit(1);

  return submission ?? null;
}

export async function createFormSubmission(input: {
  agentId: string;
  visitorId: string;
  responses: Record<string, string>;
}) {
  const [submission] = await getDb()
    .insert(formSubmissions)
    .values({
      agentId: input.agentId,
      visitorId: input.visitorId,
      responses: input.responses,
    })
    .onConflictDoNothing({
      target: [formSubmissions.agentId, formSubmissions.visitorId],
    })
    .returning();

  if (submission) {
    return submission;
  }

  return getFormSubmissionForVisitor(input.agentId, input.visitorId);
}

export async function listFormSubmissionsForAgent(agentId: string) {
  return getDb()
    .select()
    .from(formSubmissions)
    .where(eq(formSubmissions.agentId, agentId))
    .orderBy(desc(formSubmissions.createdAt));
}

export async function getFormSubmissionById(
  agentId: string,
  submissionId: string,
) {
  const [submission] = await getDb()
    .select()
    .from(formSubmissions)
    .where(
      and(
        eq(formSubmissions.agentId, agentId),
        eq(formSubmissions.id, submissionId),
      ),
    )
    .limit(1);

  return submission ?? null;
}
