import { DOCUMENT_TYPES } from "@/lib/documentConfig";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import type { DocumentRecord, DocumentType } from "@/types/tables";

export interface DocumentFilters {
  projectId?: string;
  search?: string;
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface DocumentListResult<T extends DocumentRecord> {
  data: T[];
  count: number;
  error?: string;
}

const DEFAULT_PAGE_SIZE = 20;

export async function fetchDocuments<T extends DocumentRecord>(
  type: DocumentType,
  filters: DocumentFilters = {}
): Promise<DocumentListResult<T>> {
  if (!isSupabaseConfigured) {
    return {
      data: [],
      count: 0,
      error:
        "Supabase credentials are missing. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    };
  }

  const config = DOCUMENT_TYPES[type];
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const page = filters.page ?? 0;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from<T>(config.table)
    .select("*", { count: "exact" })
    .order("created_at", { ascending: filters.order === "asc" })
    .range(from, to);

  if (filters.projectId) {
    query = query.eq("project_id", filters.projectId);
  }

  if (filters.search) {
    query = query.or(
      ["notes", "archetype", "project_id"]
        .map((column) => `${column}.ilike.%${filters.search}%`)
        .join(",")
    );
  }

  const { data, error, count } = await query;

  return {
    data: (data ?? []) as T[],
    count: count ?? 0,
    error: error?.message
  };
}

export async function fetchDocumentById<T extends DocumentRecord>(
  type: DocumentType,
  id: string
): Promise<T | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const config = DOCUMENT_TYPES[type];
  const { data, error } = await supabase
    .from<T>(config.table)
    .select("*")
    .eq(config.idKey as string, id)
    .single();

  if (error) {
    console.error(error);
    return null;
  }

  return data as T;
}

export async function deleteDocument(
  type: DocumentType,
  id: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) {
    return {
      error:
        "Supabase credentials are missing. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    };
  }

  const config = DOCUMENT_TYPES[type];
  const { error } = await supabase
    .from(config.table)
    .delete()
    .eq(config.idKey as string, id);

  if (error) {
    return { error: error.message };
  }

  return {};
}

