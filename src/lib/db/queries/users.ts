import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { type User, users } from "@/lib/db/schema";

export async function getUserById(userId: string): Promise<User | null> {
  const [user] = await getDb()
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user ?? null;
}

export async function updateUserProfile(
  userId: string,
  data: { name?: string | null },
): Promise<User | null> {
  const name = data.name?.trim() || null;

  const [updated] = await getDb()
    .update(users)
    .set({ name })
    .where(eq(users.id, userId))
    .returning();

  return updated ?? null;
}
