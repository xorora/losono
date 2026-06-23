import { auth } from "@/auth";
import { getAgentForUser } from "@/lib/db/queries/agents";
import { SalesCrmError } from "@/lib/integrations/sales-crm/errors";
import { exportAllForAgent } from "@/lib/integrations/sales-crm/sync";
import { isTokenEncryptionAvailable } from "@/lib/integrations/token-encryption";

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isTokenEncryptionAvailable()) {
    return Response.json(
      { error: "sales_crm_not_configured" },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const agentId = url.searchParams.get("agentId");

  if (!agentId) {
    return Response.json({ error: "agent_id_required" }, { status: 400 });
  }

  const agent = await getAgentForUser(agentId, userId);

  if (!agent) {
    return Response.json({ error: "agent_not_found" }, { status: 404 });
  }

  try {
    const result = await exportAllForAgent(userId, agentId);

    return Response.json(result);
  } catch (error) {
    console.error("Sales CRM bulk export failed:", error);

    if (error instanceof SalesCrmError) {
      const status =
        error.code === "not_connected"
          ? 409
          : error.code === "campaign_required" ||
              error.code === "mapping_incomplete"
            ? 409
            : (error.status ?? 500);

      return Response.json(
        { error: error.message, code: error.code },
        { status },
      );
    }

    return Response.json({ error: "export_failed" }, { status: 500 });
  }
}
