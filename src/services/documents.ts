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

  console.log(`[fetchDocuments] Fetching ${type} from table: ${config.table}`);

  let query = supabase
    .from<T>(config.table)
    .select("*", { count: "exact" })
    .order("created_at", { ascending: filters.order === "asc", nullsFirst: false })
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

  if (error) {
    console.error(`[fetchDocuments] Error fetching ${type}:`, error);
    console.error(`[fetchDocuments] Error details:`, {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
  } else {
    console.log(`[fetchDocuments] Successfully fetched ${type}:`, { 
      count, 
      dataLength: data?.length ?? 0,
      table: config.table,
      firstDoc: data?.[0] ? { id: (data[0] as Record<string, unknown>)[config.idKey as string], hasContent: !!data[0].content } : null
    });
  }

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

export async function markDocumentOpened(
  type: DocumentType,
  id: string
): Promise<{ data?: DocumentRecord; error?: string }> {
  if (!isSupabaseConfigured) {
    return {
      error:
        "Supabase credentials are missing. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    };
  }

  const config = DOCUMENT_TYPES[type];
  const { data, error } = await supabase
    .from(config.table)
    .update({ new: false })
    .eq(config.idKey as string, id)
    .select()
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  return { data: data ?? undefined };
}

// Debug function - can be called from browser console
export async function testSchemaTable() {
  if (!isSupabaseConfigured) {
    console.error("Supabase not configured");
    return;
  }

  console.log("Testing schema_documents table...");
  
  // Test 1: Simple select without filters
  const { data: allData, error: allError, count: allCount } = await supabase
    .from("schema_documents")
    .select("*", { count: "exact" });
  
  console.log("Test 1 - Simple select:", { 
    count: allCount, 
    dataLength: allData?.length ?? 0, 
    error: allError,
    data: allData 
  });

  // Test 2: With order by
  const { data: orderedData, error: orderedError, count: orderedCount } = await supabase
    .from("schema_documents")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false, nullsFirst: false });
  
  console.log("Test 2 - With order by:", { 
    count: orderedCount, 
    dataLength: orderedData?.length ?? 0, 
    error: orderedError 
  });

  // Test 3: Check table structure
  const { data: sampleData } = await supabase
    .from("schema_documents")
    .select("*")
    .limit(1)
    .single();
  
  console.log("Test 3 - Sample document structure:", sampleData);

  return { allData, orderedData, sampleData };
}

// Make it available globally for debugging
if (typeof window !== "undefined") {
  (window as typeof window & { testSchemaTable?: typeof testSchemaTable }).testSchemaTable = testSchemaTable;
}

