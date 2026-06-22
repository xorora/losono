"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Display name is required"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

type ProfileFormProps = {
  initialName: string;
  email: string | null;
  image: string | null;
};

function getInitials(name: string, email: string | null) {
  const source = name.trim() || email || "?";
  const parts = source.trim().split(/\s+/);

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export function ProfileForm({ initialName, email, image }: ProfileFormProps) {
  const router = useRouter();
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: initialName },
  });

  const name = form.watch("name");
  const displayLabel = name.trim() || email || "Account";

  async function onSubmit(values: ProfileFormValues) {
    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: values.name }),
      });

      const data = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message ?? data.error ?? "Failed to save");
      }

      toast.success("Profile saved");
      router.refresh();
    } catch (saveError) {
      toast.error(
        saveError instanceof Error ? saveError.message : "Failed to save",
      );
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
      noValidate
    >
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-medium">Profile</h2>
          <p className="text-sm text-muted-foreground">
            Your display name appears in the sidebar and across the app.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Avatar className="size-16 rounded-xl">
            {image ? <AvatarImage src={image} alt={displayLabel} /> : null}
            <AvatarFallback className="rounded-xl text-base">
              {getInitials(name, email)}
            </AvatarFallback>
          </Avatar>
          <FieldDescription>
            Profile photo is managed by your sign-in provider.
          </FieldDescription>
        </div>

        <FieldGroup>
          <Field data-invalid={!!form.formState.errors.name}>
            <FieldLabel htmlFor="profile-name">Display name</FieldLabel>
            <Input
              id="profile-name"
              autoComplete="name"
              aria-invalid={!!form.formState.errors.name}
              {...form.register("name")}
            />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="profile-email">Email</FieldLabel>
            <Input
              id="profile-email"
              value={email ?? ""}
              readOnly
              disabled
              className="disabled:opacity-100"
            />
          </Field>
        </FieldGroup>
      </section>

      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
