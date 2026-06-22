import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getAgentForUser, updateAgentSettings } from "@/lib/db/queries/agents";
import type { AgentSettings } from "@/lib/db/schema";

type RouteParams = { params: Promise<{ id: string }> };

type SettingsBody = {
  settings: AgentSettings;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id: agentId } = await params;
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const agent = await getAgentForUser(agentId, userId);
  if (!agent) {
    return Response.json({ error: "agent_not_found" }, { status: 404 });
  }

  let body: SettingsBody;
  try {
    body = (await request.json()) as SettingsBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.settings || typeof body.settings !== "object") {
    return Response.json({ error: "settings_required" }, { status: 400 });
  }

  if (
    body.settings.voiceGender !== undefined &&
    body.settings.voiceGender !== "male" &&
    body.settings.voiceGender !== "female"
  ) {
    return Response.json({ error: "invalid_voice_gender" }, { status: 400 });
  }

  const updated = await updateAgentSettings(agentId, userId, {
    ...agent.settings,
    ...body.settings,
    widgetTheme: {
      ...agent.settings.widgetTheme,
      ...body.settings.widgetTheme,
    },
  });

  if (!updated) {
    return Response.json({ error: "update_failed" }, { status: 500 });
  }

  revalidatePath(`/embed/${updated.slug}`);

  return Response.json({ settings: updated.settings });
}
