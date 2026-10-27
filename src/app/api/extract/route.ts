import { createSupabaseServerClient } from "@/server/supabase/server";
import { extractTerms } from "@/server/meta";
import { handleExtraction } from "@/server/extraction-handler";

export async function POST(request: Request) {
  return handleExtraction(request, {
    extract: extractTerms,
    authenticate: async () => {
      const supabase = await createSupabaseServerClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user || user.is_anonymous) return null;
      return {
        userId: user.id,
        repository: {
          draft: (ownerId, draftId) => supabase.from("gig_drafts").select("version").eq("owner_id", ownerId).eq("id", draftId).maybeSingle(),
          history: (ownerId, draftId) => supabase.from("gig_reviews").select("draft_id,revision,source_text,draft")
            .eq("owner_id", ownerId).eq("draft_id", draftId).order("revision", { ascending: false }).limit(100),
        },
        reserve: () => supabase.rpc("reserve_model_call"),
      };
    },
  });
}
