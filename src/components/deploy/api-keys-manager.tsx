"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, KeyRound, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const createApiKeySchema = z.object({
  name: z.string().transform((value) => value.trim() || "Default key"),
});

type CreateApiKeyValues = z.infer<typeof createApiKeySchema>;

type ApiKeySummary = {
  id: string;
  name: string;
  createdAt: string | Date;
  lastUsedAt: string | Date | null;
};

type ApiKeysManagerProps = {
  agentId: string;
  published: boolean;
  initialKeys: ApiKeySummary[];
};

export function ApiKeysManager({
  agentId,
  published,
  initialKeys,
}: ApiKeysManagerProps) {
  const router = useRouter();
  const [keys, setKeys] = useState(initialKeys);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeySummary | null>(null);
  const [revoking, setRevoking] = useState(false);

  const form = useForm<CreateApiKeyValues>({
    resolver: zodResolver(createApiKeySchema),
    defaultValues: { name: "" },
  });

  async function onSubmit(values: CreateApiKeyValues) {
    try {
      const response = await fetch(`/api/agents/${agentId}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: values.name }),
      });

      const data = (await response.json()) as {
        rawKey?: string;
        key?: ApiKeySummary;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create API key");
      }

      if (data.key && data.rawKey) {
        setKeys((current) => [data.key as ApiKeySummary, ...current]);
        setRawKey(data.rawKey);
        form.reset();
        toast.success("API key created");
        router.refresh();
      }
    } catch (createError) {
      toast.error(
        createError instanceof Error
          ? createError.message
          : "Failed to create API key",
      );
    }
  }

  async function revokeKey() {
    if (!revokeTarget) {
      return;
    }

    setRevoking(true);

    try {
      const response = await fetch(
        `/api/agents/${agentId}/api-keys/${revokeTarget.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        toast.error("Failed to revoke API key");
        return;
      }

      setKeys((current) => current.filter((key) => key.id !== revokeTarget.id));
      toast.success("API key revoked");
      router.refresh();
      setRevokeTarget(null);
    } finally {
      setRevoking(false);
    }
  }

  async function copyRawKey() {
    if (!rawKey) {
      return;
    }

    await navigator.clipboard.writeText(rawKey);
    toast.success("API key copied to clipboard");
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">API keys</h2>
        <p className="text-sm text-muted-foreground">
          Use Bearer tokens for server-side or custom client integrations. Keys
          are not required for the embed widget — see{" "}
          <Link href="/docs" className="text-primary hover:underline">
            API docs
          </Link>{" "}
          for when to use keys vs the embed snippet.
        </p>
      </div>

      {!published && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          Publish this agent before creating API keys.
        </p>
      )}

      {rawKey && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="font-medium">Copy your new API key now</p>
          <p className="mt-1 text-muted-foreground">
            This secret will not be shown again.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-muted px-2 py-1 text-xs break-all">
              {rawKey}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={copyRawKey}
            >
              <Copy />
              Copy
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setRawKey(null)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-wrap items-end gap-2"
        noValidate
      >
        <Field
          className="min-w-[200px] flex-1"
          data-invalid={!!form.formState.errors.name}
        >
          <FieldLabel htmlFor="api-key-name">Key name</FieldLabel>
          <Input
            id="api-key-name"
            placeholder="Production website"
            disabled={!published || form.formState.isSubmitting}
            aria-invalid={!!form.formState.errors.name}
            {...form.register("name")}
          />
          <FieldError errors={[form.formState.errors.name]} />
        </Field>
        <Button
          type="submit"
          disabled={!published || form.formState.isSubmitting}
        >
          <KeyRound />
          Generate key
        </Button>
      </form>

      <ul className="divide-y divide-border rounded-xl border border-border">
        {keys.length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">
            No active API keys yet.
          </li>
        ) : (
          keys.map((key) => (
            <li
              key={key.id}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">{key.name}</p>
                <p className="text-muted-foreground">
                  Created {new Date(key.createdAt).toLocaleString()}
                  {key.lastUsedAt
                    ? ` · Last used ${new Date(key.lastUsedAt).toLocaleString()}`
                    : ""}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => setRevokeTarget(key)}
              >
                <Trash2 />
                Revoke
              </Button>
            </li>
          ))
        )}
      </ul>

      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRevokeTarget(null);
          }
        }}
        title="Revoke API key?"
        description={
          revokeTarget
            ? `"${revokeTarget.name}" will stop working immediately. Any integrations using this key will fail.`
            : ""
        }
        confirmLabel={revoking ? "Revoking…" : "Revoke key"}
        onConfirm={revokeKey}
        loading={revoking}
      />
    </section>
  );
}
