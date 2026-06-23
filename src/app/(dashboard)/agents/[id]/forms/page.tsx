import { notFound } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { FormSubmissionsPanel } from "@/components/deploy/form-submissions-panel";
import { PreChatFormSettings } from "@/components/deploy/pre-chat-form-settings";
import { getAgentForUser } from "@/lib/db/queries/agents";
import { listFormSubmissionsForAgent } from "@/lib/db/queries/form-submissions";
import { resolvePreChatForm } from "@/lib/pre-chat-form";

type FormsPageProps = {
  params: Promise<{ id: string }>;
};

function FormsFallback() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="h-40 animate-pulse rounded-2xl border border-border bg-muted/40" />
    </div>
  );
}

async function FormsContent({ params }: FormsPageProps) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    notFound();
  }

  const agent = await getAgentForUser(id, userId);
  if (!agent) {
    notFound();
  }

  const [formSubmissions, preChatForm] = await Promise.all([
    listFormSubmissionsForAgent(agent.id),
    Promise.resolve(resolvePreChatForm(agent.settings.preChatForm)),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 md:p-8">
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Agent</p>
        <h1 className="text-3xl font-semibold tracking-tight">{agent.name}</h1>
        <p className="text-muted-foreground">
          Forms · Collect visitor details before chat or voice
        </p>
      </div>

      <PreChatFormSettings agentId={agent.id} initialConfig={preChatForm} />

      <FormSubmissionsPanel
        fields={preChatForm.fields}
        submissions={formSubmissions.map((submission) => ({
          id: submission.id,
          visitorId: submission.visitorId,
          responses: submission.responses,
          createdAt: submission.createdAt,
        }))}
      />
    </div>
  );
}

export default function FormsPage({ params }: FormsPageProps) {
  return (
    <Suspense fallback={<FormsFallback />}>
      <FormsContent params={params} />
    </Suspense>
  );
}
