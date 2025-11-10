import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import type { AgentMessage, AgentMessageStatus } from "@/types/tables";

export interface AgentMessagesFilters {
  projectId?: string;
  sessionId?: string;
  fromAgent?: string;
  toAgent?: string;
  status?: AgentMessageStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface AgentMessagesResult {
  data: AgentMessage[];
  count: number;
  error?: string;
}

const DEFAULT_PAGE_SIZE = 25;

export async function fetchAgentMessages(
  filters: AgentMessagesFilters = {}
): Promise<AgentMessagesResult> {
  if (!isSupabaseConfigured) {
    return {
      data: [],
      count: 0,
      error:
        "Supabase credentials are missing. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    };
  }

  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const page = filters.page ?? 0;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("agent_messages")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.projectId) {
    query = query.eq("project_id", filters.projectId);
  }

  if (filters.sessionId) {
    query = query.eq("session_id", filters.sessionId);
  }

  if (filters.fromAgent) {
    query = query.eq("from_agent", filters.fromAgent);
  }

  if (filters.toAgent) {
    query = query.eq("to_agent", filters.toAgent);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.search) {
    query = query.ilike("message_content", `%${filters.search}%`);
  }

  const { data, error, count } = await query;

  return {
    data: data ?? [],
    count: count ?? 0,
    error: error?.message
  };
}

export async function fetchAgentMessageById(
  id: string
): Promise<AgentMessage | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data, error } = await supabase
    .from("agent_messages")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error(error);
    return null;
  }

  return data;
}

export async function updateAgentMessage(
  id: string,
  payload: Partial<
    Pick<
      AgentMessage,
      "message_content" | "status" | "from_agent" | "to_agent" | "updated_at"
    >
  >
): Promise<{ data?: AgentMessage; error?: string }> {
  if (!isSupabaseConfigured) {
    return {
      error:
        "Supabase credentials are missing. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    };
  }

  const updates = {
    ...payload,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("agent_messages")
    .update(updates)
    .eq("id", id)
    .select();

  if (error) {
    return { error: error.message };
  }

  const updatedRecord = Array.isArray(data) ? (data[0] as AgentMessage | undefined) : data;

  if (updatedRecord) {
    return { data: updatedRecord };
  }

  const { data: fallback, error: fetchError } = await supabase
    .from("agent_messages")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message };
  }

  return { data: fallback ?? undefined };
}

export async function deleteAgentMessage(
  id: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) {
    return {
      error:
        "Supabase credentials are missing. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    };
  }

  const { error } = await supabase.from("agent_messages").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  return {};
}

