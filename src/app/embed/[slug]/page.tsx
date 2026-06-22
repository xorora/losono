import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmbedWidget } from "@/components/embed/embed-widget";
import { getSubscriptionByUserId } from "@/lib/billing/subscriptions";
import { canUseVoiceInPlayground } from "@/lib/billing/voice-access";
import { getPublishedAgentBySlug } from "@/lib/db/queries/agents";

type EmbedPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ position?: string }>;
};

function EmbedFallback() {
  return (
    <div className="relative size-14 bg-transparent">
      <div className="flex size-full items-center justify-center">
        <div className="size-10 animate-pulse rounded-full bg-muted/50" />
      </div>
    </div>
  );
}

async function EmbedContent({ params, searchParams }: EmbedPageProps) {
  const { slug } = await params;
  const { position: positionParam } = await searchParams;
  const position =
    positionParam === "bottom-left" ? "bottom-left" : "bottom-right";
  const agent = await getPublishedAgentBySlug(slug);

  if (!agent) {
    notFound();
  }

  const subscription = await getSubscriptionByUserId(agent.userId);
  const voiceAccess = canUseVoiceInPlayground(subscription, agent);
  const widgetTheme = agent.settings.widgetTheme ?? {};
  const modes = widgetTheme.modes === "chat+voice" ? "chat+voice" : "chat";

  return (
    <EmbedWidget
      agentId={agent.id}
      agentName={agent.name}
      greeting={
        typeof widgetTheme.greeting === "string"
          ? widgetTheme.greeting
          : `Hi! I'm ${agent.name}. How can I help?`
      }
      primaryColor={
        typeof widgetTheme.primaryColor === "string"
          ? widgetTheme.primaryColor
          : "#2563eb"
      }
      voiceEnabled={modes === "chat+voice" && voiceAccess.allowed}
      compact
      defaultOpen={false}
      position={position}
    />
  );
}

export default function EmbedPage({ params, searchParams }: EmbedPageProps) {
  return (
    <Suspense fallback={<EmbedFallback />}>
      <EmbedContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
