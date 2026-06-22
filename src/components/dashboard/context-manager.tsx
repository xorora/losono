"use client";

import { Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type ContextSourceSummary = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  chunkCount: number;
  createdAt: string;
};

type ContextLimits = {
  maxBytes: number;
  used: number;
  limit: number | null;
  remaining: number | null;
  allowedMimeTypes: string[];
};

type ContextManagerProps = {
  agentId: string;
  initialSources: ContextSourceSummary[];
  initialLimits: ContextLimits;
  isPro: boolean;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ContextManager({
  agentId,
  initialSources,
  initialLimits,
  isPro,
}: ContextManagerProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sources, setSources] = useState(initialSources);
  const [limits, setLimits] = useState(initialLimits);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContextSourceSummary | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const refreshLimits = useCallback(async () => {
    const response = await fetch(`/api/agents/${agentId}/context/limits`);
    if (response.ok) {
      const data = (await response.json()) as ContextLimits;
      setLimits(data);
    }
  }, [agentId]);

  useEffect(() => {
    setSources(initialSources);
    setLimits(initialLimits);
  }, [initialSources, initialLimits]);

  const atFileLimit =
    limits.limit !== null && limits.remaining !== null && limits.remaining <= 0;

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size === 0) {
      toast.error("File is empty.");
      event.target.value = "";
      return;
    }

    if (file.size > limits.maxBytes) {
      toast.error(
        `File is too large (${formatBytes(file.size)}). Max ${formatBytes(limits.maxBytes)} per file.`,
      );
      event.target.value = "";
      return;
    }

    if (atFileLimit) {
      toast.error(
        isPro
          ? "Unexpected file limit reached."
          : `Free plan allows ${limits.limit} context files. Delete one to upload another, or upgrade to Pro.`,
      );
      event.target.value = "";
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/agents/${agentId}/context`, {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as {
        id?: string;
        filename?: string;
        mimeType?: string;
        sizeBytes?: number;
        chunkCount?: number;
        createdAt?: string;
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        if (data.error === "context_file_limit_reached") {
          throw new Error(
            isPro
              ? "Context file limit reached."
              : `Free plan allows ${limits.limit} files. Delete one or upgrade to Pro.`,
          );
        }
        if (data.error === "context_file_too_large") {
          throw new Error(
            `File exceeds ${formatBytes(limits.maxBytes)} limit.`,
          );
        }
        throw new Error(data.message ?? data.error ?? "Upload failed");
      }

      if (data.id && data.filename && data.createdAt) {
        setSources((current) => [
          {
            id: data.id as string,
            filename: data.filename as string,
            mimeType: data.mimeType ?? file.type,
            sizeBytes: data.sizeBytes ?? file.size,
            chunkCount: data.chunkCount ?? 0,
            createdAt: data.createdAt as string,
          },
          ...current,
        ]);
      }

      await refreshLimits();
      toast.success("File uploaded");
      router.refresh();
    } catch (uploadError) {
      toast.error(
        uploadError instanceof Error ? uploadError.message : "Upload failed",
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch(
        `/api/agents/${agentId}/context/${deleteTarget.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        toast.error("Failed to delete file");
        return;
      }

      setSources((current) =>
        current.filter((source) => source.id !== deleteTarget.id),
      );
      await refreshLimits();
      toast.success("File deleted");
      router.refresh();
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">Context files</h2>
        <p className="text-sm text-muted-foreground">
          Upload documents to index into pgvector. Original files are not stored
          — only embeddings and text snippets.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-lg bg-muted px-3 py-1.5">
          {limits.limit === null
            ? `${limits.used} files · Unlimited on Pro`
            : `${limits.used} / ${limits.limit} files used`}
        </span>
        <span className="text-muted-foreground">
          Max {formatBytes(limits.maxBytes)} per file
        </span>
      </div>

      {!isPro && atFileLimit && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          File limit reached on the free plan. Delete a file to swap in a new
          one, or upgrade to Pro for unlimited context files.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={limits.allowedMimeTypes.join(",")}
          onChange={handleUpload}
          disabled={uploading || atFileLimit}
        />
        <Button
          type="button"
          disabled={uploading || atFileLimit}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload />
          {uploading ? "Processing…" : "Upload file"}
        </Button>
        {uploading && (
          <span className="text-sm text-muted-foreground">
            Chunking and embedding — this may take a moment.
          </span>
        )}
      </div>

      <ul className="divide-y divide-border rounded-xl border border-border">
        {sources.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            No context files yet. Upload a PDF, text file, or document to ground
            your agent&apos;s answers.
          </li>
        ) : (
          sources.map((source) => (
            <li
              key={source.id}
              className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{source.filename}</p>
                <p className="text-muted-foreground">
                  {formatBytes(source.sizeBytes)} · {source.chunkCount} chunk
                  {source.chunkCount === 1 ? "" : "s"} ·{" "}
                  {new Date(source.createdAt).toLocaleString()}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => setDeleteTarget(source)}
              >
                <Trash2 />
                Delete
              </Button>
            </li>
          ))
        )}
      </ul>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title="Delete context file?"
        description={
          deleteTarget
            ? `"${deleteTarget.filename}" will be removed from this agent's context. This cannot be undone.`
            : ""
        }
        confirmLabel={deleting ? "Deleting…" : "Delete file"}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </section>
  );
}
