import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { getUserById } from "@/lib/db/queries/users";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const user = await getUserById(session.user.id);

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6 md:p-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">
          Manage your account details and how you appear in Losono.
        </p>
      </div>

      <ProfileForm
        initialName={user.name ?? ""}
        email={user.email}
        image={user.image}
      />
    </div>
  );
}
