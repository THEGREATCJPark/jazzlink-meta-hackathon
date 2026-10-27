import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Request-scoped session client: never bypasses Postgres row-level security. */
export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(values) {
        // Route handlers and server actions can write cookies; Server Components
        // cannot. Proxy refreshes the session for those requests.
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // A render-only context cannot write response cookies.
        }
      },
    },
  });
}
