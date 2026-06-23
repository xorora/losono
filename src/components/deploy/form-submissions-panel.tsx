"use client";

import type { PreChatField } from "@/lib/pre-chat-form";

type FormSubmission = {
  id: string;
  visitorId: string;
  responses: Record<string, string>;
  createdAt: string | Date;
};

type FormSubmissionsPanelProps = {
  fields: PreChatField[];
  submissions: FormSubmission[];
};

export function FormSubmissionsPanel({
  fields,
  submissions,
}: FormSubmissionsPanelProps) {
  const fieldLabels = new Map(fields.map((field) => [field.id, field.label]));

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">Form submissions</h2>
        <p className="text-sm text-muted-foreground">
          Visitor responses collected before chat or voice sessions.
        </p>
      </div>

      {submissions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          No submissions yet.
        </p>
      ) : (
        <div className="space-y-3">
          {submissions.map((submission) => (
            <article
              key={submission.id}
              className="space-y-3 rounded-xl border border-border p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium">
                  {new Date(submission.createdAt).toLocaleString()}
                </span>
                <span className="text-muted-foreground">
                  Visitor {submission.visitorId.slice(0, 8)}…
                </span>
              </div>

              <dl className="grid gap-2 text-sm">
                {Object.entries(submission.responses).map(
                  ([fieldId, value]) => {
                    if (!value) {
                      return null;
                    }

                    return (
                      <div
                        key={fieldId}
                        className="grid gap-1 rounded-lg bg-muted/40 px-3 py-2"
                      >
                        <dt className="text-muted-foreground">
                          {fieldLabels.get(fieldId) ?? fieldId}
                        </dt>
                        <dd className="whitespace-pre-wrap">{value}</dd>
                      </div>
                    );
                  },
                )}
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
