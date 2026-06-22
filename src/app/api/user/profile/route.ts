import { auth } from "@/auth";
import { getUserById, updateUserProfile } from "@/lib/db/queries/users";

type ProfileBody = {
  name?: string;
};

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await getUserById(userId);
  if (!user) {
    return Response.json({ error: "user_not_found" }, { status: 404 });
  }

  return Response.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    },
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: ProfileBody;
  try {
    body = (await request.json()) as ProfileBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (typeof body.name !== "string" || !body.name.trim()) {
    return Response.json({ error: "name_required" }, { status: 400 });
  }

  const updated = await updateUserProfile(userId, { name: body.name });
  if (!updated) {
    return Response.json({ error: "update_failed" }, { status: 500 });
  }

  return Response.json({
    user: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      image: updated.image,
    },
  });
}
