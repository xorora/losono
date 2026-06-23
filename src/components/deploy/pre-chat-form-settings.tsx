"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_PRE_CHAT_FORM,
  PRE_CHAT_FIELD_TYPES,
  type PreChatFormConfig,
  preChatFormConfigSchema,
} from "@/lib/pre-chat-form";

const settingsSchema = preChatFormConfigSchema.extend({
  fields: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1, "Label is required"),
        type: z.enum(PRE_CHAT_FIELD_TYPES),
        required: z.boolean(),
        placeholder: z.string().optional(),
        options: z.string().optional(),
      }),
    )
    .max(12, "Maximum 12 fields allowed"),
});

type SettingsValues = z.infer<typeof settingsSchema>;

type PreChatFormSettingsProps = {
  agentId: string;
  initialConfig: PreChatFormConfig;
};

function createFieldId() {
  return crypto.randomUUID();
}

function toFormValues(config: PreChatFormConfig): SettingsValues {
  return {
    enabled: config.enabled,
    title: config.title ?? DEFAULT_PRE_CHAT_FORM.title,
    description: config.description ?? DEFAULT_PRE_CHAT_FORM.description,
    submitLabel: config.submitLabel ?? DEFAULT_PRE_CHAT_FORM.submitLabel,
    fields: config.fields.map((field) => ({
      ...field,
      options: field.options?.join("\n") ?? "",
    })),
  };
}

export function PreChatFormSettings({
  agentId,
  initialConfig,
}: PreChatFormSettingsProps) {
  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: toFormValues(initialConfig),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "fields",
  });

  const enabled = form.watch("enabled");

  async function onSubmit(values: SettingsValues) {
    const config: PreChatFormConfig = {
      enabled: values.enabled,
      title: values.title?.trim() || DEFAULT_PRE_CHAT_FORM.title,
      description:
        values.description?.trim() || DEFAULT_PRE_CHAT_FORM.description,
      submitLabel:
        values.submitLabel?.trim() || DEFAULT_PRE_CHAT_FORM.submitLabel,
      fields: values.fields.map((field) => ({
        id: field.id,
        label: field.label.trim(),
        type: field.type,
        required: field.required,
        placeholder: field.placeholder?.trim() || undefined,
        options:
          field.type === "select"
            ? (field.options ?? "")
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
            : undefined,
      })),
    };

    if (config.enabled && config.fields.length === 0) {
      toast.error("Add at least one field when the pre-chat form is enabled.");
      return;
    }

    if (
      config.fields.some(
        (field) => field.type === "select" && !field.options?.length,
      )
    ) {
      toast.error("Select fields need at least one option.");
      return;
    }

    try {
      const response = await fetch(`/api/agents/${agentId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            preChatForm: config,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save pre-chat form settings");
      }

      toast.success("Pre-chat form settings saved");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save pre-chat form settings",
      );
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">Pre-chat form</h2>
        <p className="text-sm text-muted-foreground">
          Collect visitor details before they can use chat or voice. Responses
          are saved and included in the agent context.
        </p>
      </div>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
        noValidate
      >
        <Field orientation="horizontal">
          <input
            id="pre-chat-enabled"
            type="checkbox"
            className="size-4 rounded border border-input"
            {...form.register("enabled")}
          />
          <FieldLabel htmlFor="pre-chat-enabled">
            Require form before chat or voice
          </FieldLabel>
        </Field>

        {enabled && (
          <>
            <FieldGroup>
              <Field data-invalid={!!form.formState.errors.title}>
                <FieldLabel htmlFor="pre-chat-title">Form title</FieldLabel>
                <Input
                  id="pre-chat-title"
                  {...form.register("title")}
                  aria-invalid={!!form.formState.errors.title}
                />
                <FieldError errors={[form.formState.errors.title]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.description}>
                <FieldLabel htmlFor="pre-chat-description">
                  Description
                </FieldLabel>
                <Textarea
                  id="pre-chat-description"
                  rows={2}
                  {...form.register("description")}
                  aria-invalid={!!form.formState.errors.description}
                />
                <FieldError errors={[form.formState.errors.description]} />
              </Field>

              <Field data-invalid={!!form.formState.errors.submitLabel}>
                <FieldLabel htmlFor="pre-chat-submit-label">
                  Submit button label
                </FieldLabel>
                <Input
                  id="pre-chat-submit-label"
                  {...form.register("submitLabel")}
                  aria-invalid={!!form.formState.errors.submitLabel}
                />
                <FieldError errors={[form.formState.errors.submitLabel]} />
              </Field>
            </FieldGroup>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium">Fields</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      id: createFieldId(),
                      label: "New field",
                      type: "text",
                      required: true,
                      placeholder: "",
                      options: "",
                    })
                  }
                >
                  <Plus />
                  Add field
                </Button>
              </div>

              {fields.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                  No fields yet. Add at least one field to collect visitor
                  information.
                </p>
              ) : (
                <div className="space-y-3">
                  {fields.map((field, index) => {
                    const fieldType = form.watch(`fields.${index}.type`);

                    return (
                      <div
                        key={field.id}
                        className="space-y-3 rounded-xl border border-border p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <GripVertical className="size-4" />
                            <span className="text-sm font-medium text-foreground">
                              Field {index + 1}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => remove(index)}
                            aria-label={`Remove field ${index + 1}`}
                          >
                            <Trash2 />
                          </Button>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field
                            data-invalid={
                              !!form.formState.errors.fields?.[index]?.label
                            }
                          >
                            <FieldLabel>Label</FieldLabel>
                            <Input
                              {...form.register(`fields.${index}.label`)}
                              aria-invalid={
                                !!form.formState.errors.fields?.[index]?.label
                              }
                            />
                            <FieldError
                              errors={[
                                form.formState.errors.fields?.[index]?.label,
                              ]}
                            />
                          </Field>

                          <Field>
                            <FieldLabel>Type</FieldLabel>
                            <Select
                              value={fieldType}
                              onValueChange={(value) =>
                                form.setValue(
                                  `fields.${index}.type`,
                                  value as SettingsValues["fields"][number]["type"],
                                  { shouldDirty: true },
                                )
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Text</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="phone">Phone</SelectItem>
                                <SelectItem value="textarea">
                                  Long text
                                </SelectItem>
                                <SelectItem value="select">Select</SelectItem>
                              </SelectContent>
                            </Select>
                          </Field>

                          <Field>
                            <FieldLabel>Placeholder</FieldLabel>
                            <Input
                              {...form.register(`fields.${index}.placeholder`)}
                            />
                          </Field>

                          <Field orientation="horizontal">
                            <input
                              id={`field-required-${field.id}`}
                              type="checkbox"
                              className="size-4 rounded border border-input"
                              {...form.register(`fields.${index}.required`)}
                            />
                            <FieldLabel htmlFor={`field-required-${field.id}`}>
                              Required
                            </FieldLabel>
                          </Field>
                        </div>

                        {fieldType === "select" && (
                          <Field
                            data-invalid={
                              !!form.formState.errors.fields?.[index]?.options
                            }
                          >
                            <FieldLabel>Options (one per line)</FieldLabel>
                            <Textarea
                              rows={3}
                              placeholder={"Option 1\nOption 2"}
                              {...form.register(`fields.${index}.options`)}
                            />
                            <FieldError
                              errors={[
                                form.formState.errors.fields?.[index]?.options,
                              ]}
                            />
                          </Field>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="mt-2.5"
        >
          {form.formState.isSubmitting
            ? "Saving…"
            : "Save pre-chat form settings"}
        </Button>
      </form>
    </section>
  );
}
