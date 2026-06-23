import { getFormSubmissionForVisitor } from "@/lib/db/queries/form-submissions";
import type { Agent } from "@/lib/db/schema";
import { isPreChatFormActive } from "@/lib/pre-chat-form";

export async function assertPreChatComplete(input: {
  agent: Agent;
  visitorId?: string;
}) {
  if (!isPreChatFormActive(input.agent.settings.preChatForm)) {
    return null;
  }

  if (!input.visitorId?.trim()) {
    return Response.json({ error: "pre_chat_required" }, { status: 403 });
  }

  const submission = await getFormSubmissionForVisitor(
    input.agent.id,
    input.visitorId.trim(),
  );

  if (!submission) {
    return Response.json({ error: "pre_chat_required" }, { status: 403 });
  }

  return submission;
}
