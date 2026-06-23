import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmbedWidget } from "@/components/embed/embed-widget";
import { getSubscriptionByUserId } from "@/lib/billing/subscriptions";
import { canUseVoiceInPlayground } from "@/lib/billing/voice-access";
import { getPublishedAgentBySlug } from "@/lib/db/queries/agents";
import { resolvePreChatForm } from "@/lib/pre-chat-form";
import { resolveWidgetTheme } from "@/lib/widget-theme";

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
  await connection();
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
  const theme = resolveWidgetTheme(agent.settings.widgetTheme, {
    agentName: agent.name,
  });
  const preChatForm = resolvePreChatForm(agent.settings.preChatForm);

  return (
    <EmbedWidget
      agentId={agent.id}
      agentName={agent.name}
      greeting={theme.greeting}
      preChatForm={preChatForm}
      appearance={{
        backgroundColor: theme.backgroundColor,
        userFontColor: theme.userFontColor,
        assistantFontColor: theme.assistantFontColor,
        userBubbleColor: theme.userBubbleColor,
        assistantBubbleColor: theme.assistantBubbleColor,
        sendButtonColor: theme.sendButtonColor,
        sendButtonIconColor: theme.sendButtonIconColor,
        windowBorderColor: theme.windowBorderColor,
        launcherBorderColor: theme.launcherBorderColor,
        logoUrl: theme.logoUrl,
      }}
      voiceEnabled={theme.modes === "chat+voice" && voiceAccess.allowed}
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
