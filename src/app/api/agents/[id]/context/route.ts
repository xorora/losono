import { auth } from "@/auth";
import { getSubscriptionWithStripeSync } from "@/lib/billing/sync-subscription";
import {
  countContextSources,
  getAgentForUser,
  getContextFileLimit,
  listContextSources,
} from "@/lib/db/queries/context";
import { MAX_CONTEXT_FILE_BYTES } from "@/lib/rag/constants";
import { ContextIngestError, ingestContextFile } from "@/lib/rag/ingest";

export const maxDuration = 60;

type RouteParams = { params: Promise<{ id: string }> };

async function requireAgentOwner(agentId: string) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { error: Response.json({ error: "unauthorized" }, { status: 401 }) };
  }

  const agent = await getAgentForUser(agentId, userId);
  if (!agent) {
    return {
      error: Response.json({ error: "agent_not_found" }, { status: 404 }),
    };
  }

  const subscription = await getSubscriptionWithStripeSync(
    userId,
    session?.user?.email,
  );
  return { userId, agent, subscription };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id: agentId } = await params;
  const result = await requireAgentOwner(agentId);

  if ("error" in result) {
    return result.error;
  }

  const sources = await listContextSources(agentId);
  return Response.json({ sources });
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id: agentId } = await params;
  const result = await requireAgentOwner(agentId);

  if ("error" in result) {
    return result.error;
  }

  const { subscription } = result;
  const sourceCount = await countContextSources(agentId);
  const fileLimit = getContextFileLimit(subscription);

  if (fileLimit !== null && sourceCount >= fileLimit) {
    return Response.json(
      {
        error: "context_file_limit_reached",
        limit: fileLimit,
        used: sourceCount,
      },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "file_required" }, { status: 400 });
  }

  if (file.size === 0) {
    return Response.json({ error: "context_file_empty" }, { status: 400 });
  }

  if (file.size > MAX_CONTEXT_FILE_BYTES) {
    return Response.json(
      {
        error: "context_file_too_large",
        maxBytes: MAX_CONTEXT_FILE_BYTES,
        actualBytes: file.size,
      },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";
  const filename = file.name || "upload";

  try {
    const { source, chunkCount } = await ingestContextFile({
      agentId,
      filename,
      mimeType,
      buffer,
    });

    return Response.json(
      {
        id: source.id,
        filename: source.filename,
        mimeType: source.mimeType,
        sizeBytes: source.sizeBytes,
        chunkCount,
        createdAt: source.createdAt,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ContextIngestError) {
      return Response.json(
        {
          error: error.code,
          message: error.message,
          ...error.details,
        },
        { status: error.status },
      );
    }

    console.error("Context ingest failed:", error);
    return Response.json({ error: "context_ingest_failed" }, { status: 500 });
  }
}
