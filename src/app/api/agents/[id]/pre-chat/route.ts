import { auth } from "@/auth";
import { resolveDeployedAccess } from "@/lib/auth/deploy-access";
import { getAgentForUser } from "@/lib/db/queries/agents";
import {
  createFormSubmission,
  getFormSubmissionForVisitor,
  listFormSubmissionsForAgent,
} from "@/lib/db/queries/form-submissions";
import { syncNewSubmission } from "@/lib/integrations/sales-crm/sync";
import {
  buildPreChatResponseSchema,
  isPreChatFormActive,
  resolvePreChatForm,
} from "@/lib/pre-chat-form";

type RouteParams = { params: Promise<{ id: string }> };

type SubmitBody = {
  visitorId?: string;
  responses?: Record<string, string>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const { id: agentId } = await params;
  const { searchParams } = new URL(request.url);
  const visitorId = searchParams.get("visitorId");

  if (visitorId) {
    const access = await resolveDeployedAccess({
      agentId,
      request,
      visitorId,
    });

    if (access instanceof Response) {
      return access;
    }

    const submission = await getFormSubmissionForVisitor(agentId, visitorId);

    return Response.json({
      submitted: Boolean(submission),
      submissionId: submission?.id,
    });
  }

  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const agent = await getAgentForUser(agentId, userId);
  if (!agent) {
    return Response.json({ error: "agent_not_found" }, { status: 404 });
  }

  const submissions = await listFormSubmissionsForAgent(agentId);

  return Response.json({
    config: resolvePreChatForm(agent.settings.preChatForm),
    submissions: submissions.map((submission) => ({
      id: submission.id,
      visitorId: submission.visitorId,
      responses: submission.responses,
      createdAt: submission.createdAt,
    })),
  });
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id: agentId } = await params;

  let body: SubmitBody;
  try {
    body = (await request.json()) as SubmitBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const visitorId = body.visitorId?.trim();
  if (!visitorId) {
    return Response.json({ error: "visitor_id_required" }, { status: 400 });
  }

  const access = await resolveDeployedAccess({
    agentId,
    request,
    visitorId,
  });

  if (access instanceof Response) {
    return access;
  }

  const config = resolvePreChatForm(access.agent.settings.preChatForm);
  if (!isPreChatFormActive(config)) {
    return Response.json({ error: "pre_chat_disabled" }, { status: 400 });
  }

  const responses = body.responses ?? {};
  const schema = buildPreChatResponseSchema(config);
  const parsed = schema.safeParse(responses);

  if (!parsed.success) {
    return Response.json(
      {
        error: "validation_failed",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const normalizedResponses = Object.fromEntries(
    config.fields.map((field) => [
      field.id,
      (parsed.data[field.id] ?? "").trim(),
    ]),
  );

  const submission = await createFormSubmission({
    agentId,
    visitorId,
    responses: normalizedResponses,
  });

  if (!submission) {
    return Response.json({ error: "submission_failed" }, { status: 500 });
  }

  void syncNewSubmission(agentId, submission.id).catch((error) => {
    console.error("Sales CRM sync hook failed:", error);
  });

  return Response.json({
    submissionId: submission.id,
    submitted: true,
  });
}
