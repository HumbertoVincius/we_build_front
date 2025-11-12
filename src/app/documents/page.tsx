"use client";

import { useEffect, useMemo, useState } from "react";
import { DOCUMENT_TYPES } from "@/lib/documentConfig";
import type { DocumentRecord, DocumentType } from "@/types";
import { deleteDocument, fetchDocuments } from "@/services/documents";
import { JsonViewer } from "@/components/documents/json-viewer";
import { CodegenViewer, resolveCodegenFiles } from "@/components/documents/codegen-viewer";
import { format } from "date-fns";
import clsx from "clsx";
import { Spinner } from "@/components/ui/spinner";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { CredentialsWarning } from "@/components/ui/credentials-warning";

interface DocumentFilters {
  projectId: string;
  search: string;
  order: "asc" | "desc";
}

const tabs = Object.entries(DOCUMENT_TYPES).map(([key, value]) => ({
  type: key as DocumentType,
  label: value.label,
  description: value.description
}));

const PAGE_SIZE = 20;

export default function DocumentsPage() {
  const supabaseReady = isSupabaseConfigured;
  const [activeTab, setActiveTab] = useState<DocumentType>("prd");
  const [filters, setFilters] = useState<DocumentFilters>({
    projectId: "",
    search: "",
    order: "desc"
  });
  const [page, setPage] = useState(0);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentRecord | null>(null);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [collapseSignal, setCollapseSignal] = useState(0);
  const [expandSignal, setExpandSignal] = useState(0);
  const codegenFiles = useMemo(() => {
    if (!selectedDocument) {
      return [];
    }
    try {
      return resolveCodegenFiles(selectedDocument.content);
    } catch {
      return [];
    }
  }, [selectedDocument]);
  const shouldUseCodeViewer = Boolean(
    selectedDocument && (activeTab === "codegen" || codegenFiles.length > 0)
  );

  useEffect(() => {
    if (!supabaseReady) {
      return;
    }

    let ignore = false;
    async function loadDocs() {
      setIsLoading(true);
      setError(null);
      const { data, count, error: message } = await fetchDocuments(activeTab, {
        projectId: filters.projectId || undefined,
        search: filters.search || undefined,
        order: filters.order,
        page,
        pageSize: PAGE_SIZE
      });

      if (!ignore) {
        setDocuments(data);
        setTotal(count);
        setSelectedDocument((prev) => {
          if (!prev) return data[0] ?? null;
          const config = DOCUMENT_TYPES[activeTab];
          const currentId = (prev as Record<string, unknown>)[config.idKey as string];
          return data.find((doc) => {
            const docId = (doc as Record<string, unknown>)[config.idKey as string];
            return docId === currentId;
          }) ?? data[0] ?? null;
        });

        if (message) {
          setError(message);
        }
        setIsLoading(false);
      }
    }

    loadDocs();
    return () => {
      ignore = true;
    };
  }, [activeTab, filters, page, supabaseReady]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total]
  );

  function updateFilter<Key extends keyof DocumentFilters>(key: Key, value: DocumentFilters[Key]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  }

  async function handleDeleteDocument(document: DocumentRecord) {
    if (deletingId) {
      return;
    }

    const currentType = activeTab;
    const config = DOCUMENT_TYPES[currentType];
    const documentId = (document as Record<string, unknown>)[config.idKey as string];

    if (!documentId || typeof documentId !== "string") {
      setError("Não foi possível identificar o documento selecionado.");
      return;
    }

    const confirmed = window.confirm("Tem certeza que deseja excluir este documento?");
    if (!confirmed) {
      return;
    }

    setDeletingId(documentId);
    setError(null);

    const { error: deleteError } = await deleteDocument(currentType, documentId);
    if (deleteError) {
      setError(`Erro ao excluir documento: ${deleteError}`);
      setDeletingId(null);
      return;
    }

    const updatedDocuments = documents.filter((item) => {
      const itemId = (item as Record<string, unknown>)[config.idKey as string];
      return itemId !== documentId;
    });

    setDocuments(updatedDocuments);
    setTotal((prev) => Math.max(0, prev - 1));
    setSelectedDocument((previousSelected) => {
      if (!previousSelected) {
        return updatedDocuments[0] ?? null;
      }

      const previousSelectedId = (previousSelected as Record<string, unknown>)[config.idKey as string];
      if (previousSelectedId === documentId) {
        return updatedDocuments[0] ?? null;
      }

      return previousSelected;
    });

    if (!updatedDocuments.length && page > 0) {
      setPage((prev) => Math.max(0, prev - 1));
    }

    setDeletingId(null);
  }

  useEffect(() => {
    setExpandSignal((prev) => prev + 1);
  }, [selectedDocument, activeTab]);

  if (!supabaseReady) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-950">
        <CredentialsWarning />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <header className="border-b border-slate-800 bg-slate-950/80 px-6 py-4">
        <nav className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.type}
              className={clsx(
                "rounded-lg border px-4 py-2 text-sm transition",
                tab.type === activeTab
                  ? "border-slate-500 bg-slate-800 text-white"
                  : "border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-600 hover:text-white"
              )}
              onClick={() => {
                setActiveTab(tab.type);
                setPage(0);
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <p className="mt-3 text-xs text-slate-400">
          {tabs.find((tab) => tab.type === activeTab)?.description}
        </p>
      </header>

      <div className="flex flex-wrap gap-3 border-b border-slate-800 bg-slate-950/60 px-6 py-4 text-sm text-slate-200">
        <input
          placeholder="Project ID"
          className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-0 sm:w-60"
          value={filters.projectId}
          onChange={(event) => updateFilter("projectId", event.target.value)}
        />
        <input
          placeholder="Buscar por notas, archetype…"
          className="flex-1 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-0"
          value={filters.search}
          onChange={(event) => updateFilter("search", event.target.value)}
        />
        <select
          className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-slate-500 focus:outline-none focus:ring-0"
          value={filters.order}
          onChange={(event) => updateFilter("order", event.target.value as "asc" | "desc")}
        >
          <option value="desc">Mais recentes</option>
          <option value="asc">Mais antigos</option>
        </select>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-full flex-col border-r border-slate-800 bg-slate-950/40 lg:w-80">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-xs text-slate-400">
            <span>{isLoading ? "Carregando…" : `${total} documentos`}</span>
            <span>
              Página {page + 1} / {totalPages}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2 text-xs text-slate-400">
            <button
              className="rounded border border-slate-700 px-2 py-1 hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:border-slate-900 disabled:text-slate-600"
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              disabled={page === 0 || isLoading}
            >
              Anterior
            </button>
            <button
              className="rounded border border-slate-700 px-2 py-1 hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:border-slate-900 disabled:text-slate-600"
              onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
              disabled={page >= totalPages - 1 || isLoading}
            >
              Próxima
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex justify-center px-4 py-6">
                <Spinner label="Carregando documentos…" />
              </div>
            ) : null}
            {documents.map((document) => {
              const config = DOCUMENT_TYPES[activeTab];
              const id = (document as Record<string, unknown>)[config.idKey as string];
              const createdAt = document.created_at
                ? format(new Date(document.created_at), "dd/MM/yyyy HH:mm")
                : "—";
              const isActive =
                selectedDocument &&
                (selectedDocument as Record<string, unknown>)[config.idKey as string] === id;
              const summaryMetadata = extractSummaryMetadata(document, activeTab);

              return (
                <div
                  key={id as string}
                  className={clsx(
                    "group border-b border-slate-900 px-4 py-3 text-left transition cursor-pointer",
                    isActive ? "bg-slate-800/80 text-white" : "hover:bg-slate-900/40"
                  )}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedDocument(document)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedDocument(document);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">
                        {config.label} {document.revision ?? ""}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">{createdAt}</p>
                      <p className="mt-2 line-clamp-2 text-xs text-slate-300">
                        {document.notes ?? document.archetype ?? document.project_id ?? "—"}
                      </p>
                      {summaryMetadata.length ? (
                        <div className="mt-2 space-y-1">
                          {summaryMetadata.map((entry) => (
                            <p key={entry.label} className="text-[0.7rem] text-slate-400">
                              <span className="text-slate-500">{entry.label}:</span>{" "}
                              <span className="text-slate-300">{entry.value}</span>
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className={clsx(
                        "rounded border px-2 py-1 text-xs font-medium transition",
                        "border-slate-800 text-slate-400 hover:border-rose-700 hover:text-rose-200",
                        deletingId === id
                          ? "cursor-wait border-rose-950 text-rose-600"
                          : "group-hover:border-rose-700 group-hover:text-white"
                      )}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteDocument(document);
                      }}
                      disabled={deletingId !== null}
                    >
                      {deletingId === id ? "Excluindo…" : "Excluir"}
                    </button>
                  </div>
                </div>
              );
            })}
            {!isLoading && !documents.length ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                Nenhum documento encontrado com os filtros atuais.
              </div>
            ) : null}
          </div>
        </aside>

        <section className="flex flex-1 flex-col overflow-hidden">
          {selectedDocument ? (
            <>
              <DocumentMetadata
                type={activeTab}
                document={selectedDocument}
              />
              <div className="flex flex-1 flex-col overflow-hidden p-6">
                {!shouldUseCodeViewer ? (
                  <div className="mb-4 flex justify-end gap-2">
                    <button
                      className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
                      onClick={() => setCollapseSignal((prev) => prev + 1)}
                    >
                      Colapsar tudo
                    </button>
                    <button
                      className="rounded-md border border-slate-500 bg-slate-800 px-3 py-1.5 text-xs font-medium text-white transition hover:border-slate-400"
                      onClick={() => setExpandSignal((prev) => prev + 1)}
                    >
                      Expandir tudo
                    </button>
                  </div>
                ) : null}
                {shouldUseCodeViewer ? (
                  <CodegenViewer payload={selectedDocument.content} />
                ) : (
                  <div className="flex-1 overflow-auto rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                    <JsonViewer
                      data={selectedDocument.content as never}
                      initialCollapsed={false}
                      collapseSignal={collapseSignal}
                      expandSignal={expandSignal}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
              Selecione um documento para visualizar.
            </div>
          )}
        </section>
      </div>

      {error ? (
        <div className="border-t border-rose-950 bg-rose-950/30 px-6 py-3 text-sm text-rose-300">
          Erro ao carregar documentos: {error}
        </div>
      ) : null}
    </div>
  );
}

function DocumentMetadata({
  type,
  document
}: {
  type: DocumentType;
  document: DocumentRecord;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const config = DOCUMENT_TYPES[type];
  const id = (document as Record<string, unknown>)[config.idKey as string];
  const createdAt = document.created_at
    ? format(new Date(document.created_at), "dd/MM/yyyy HH:mm:ss")
    : "—";
  const summaryMetadata = extractSummaryMetadata(document, type);

  const baseMetaEntries = [
    { label: "Projeto", value: document.project_id ?? "—" },
    { label: "Archetype", value: document.archetype ?? "—" },
    { label: "Locale", value: document.locale ?? "—" },
    { label: "Notas", value: document.notes ?? "—" }
  ];

  const contentMetadataEntries = extractContentMetadataEntries(document.content);
  const parameterEntries =
    type === "prd" ? extractMetadataParameters(document.content) : [];

  return (
    <div className="border-b border-slate-800 bg-slate-950/80 px-5 py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex-1 space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{config.label}</p>
          <h2 className="text-xl font-semibold text-white break-all">{id as string}</h2>
          {document.notes ? (
            <p className="max-w-2xl text-sm text-slate-300">{document.notes}</p>
          ) : null}
          {summaryMetadata.length ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
              {summaryMetadata.map((entry) => (
                <span key={entry.label} className="flex items-center gap-1">
                  <span className="text-slate-500">{entry.label}:</span>
                  <span className="text-slate-200">{entry.value}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-3 self-start text-xs text-slate-400 md:flex-col md:items-end">
          <span className="whitespace-nowrap">Criado em {createdAt}</span>
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="rounded border border-slate-800 px-3 py-1 text-[0.7rem] font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
          >
            {showDetails ? "Ocultar detalhes" : "Mostrar detalhes"}
          </button>
        </div>
      </div>
      {showDetails ? (
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-3">
          {[...baseMetaEntries, ...contentMetadataEntries].map((entry) => (
            <div key={entry.label}>
              <dt className="text-xs uppercase tracking-wide text-slate-500">{entry.label}</dt>
              <dd className="text-white">{entry.value}</dd>
            </div>
          ))}
          {parameterEntries.map((entry) => (
            <div key={entry.label}>
              <dt className="text-xs uppercase tracking-wide text-slate-500">{entry.label}</dt>
              <dd className="text-white">{entry.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function extractContentMetadataEntries(content: unknown): { label: string; value: string }[] {
  const entries: { label: string; value: string }[] = [];

  const completionTokens = findCompletionTokens(content);
  if (completionTokens !== null) {
    entries.push({ label: "Completion tokens", value: formatParameterValue(completionTokens) });
  }

  return entries;
}

function extractSummaryMetadata(
  document: DocumentRecord,
  type: DocumentType
): { label: string; value: string }[] {
  const content = document.content;
  const config = DOCUMENT_TYPES[type];
  const labelPrefix = config.label;
  const entries: { label: string; value: string }[] = [];

  const tokens = findTokenUsage(content);
  if (tokens !== null) {
    entries.push({
      label: `${labelPrefix} tokens`,
      value: formatParameterValue(tokens)
    });
  }

  const agentModel = findAgentModel(content);
  if (agentModel !== null) {
    entries.push({
      label: `${labelPrefix} agent model`,
      value: formatParameterValue(agentModel)
    });
  }

  return entries;
}

function extractMetadataParameters(content: unknown): { label: string; value: string }[] {
  if (!content || typeof content !== "object") {
    return [];
  }

  const metadata = (content as Record<string, unknown>).metadata;
  if (!metadata || typeof metadata !== "object") {
    return [];
  }

  const parameters = (metadata as Record<string, unknown>).parameters;
  if (!parameters) {
    return [];
  }

  const entries: { label: string; value: string }[] = [];

  if (Array.isArray(parameters)) {
    parameters.forEach((item, index) => {
      if (!item || typeof item !== "object") return;
      const param = item as Record<string, unknown>;
      const label =
        typeof param.name === "string"
          ? param.name
          : typeof param.key === "string"
            ? param.key
            : `Parametro ${index + 1}`;
      const value = formatParameterValue(param.value ?? param.default ?? param);
      entries.push({ label, value });
    });
    return entries;
  }

  if (typeof parameters === "object") {
    Object.entries(parameters as Record<string, unknown>).forEach(([key, value]) => {
      entries.push({ label: key, value: formatParameterValue(value) });
    });
    return entries;
  }

  return [];
}

function findCompletionTokens(content: unknown): unknown {
  if (!content || typeof content !== "object") {
    return null;
  }

  const metadata = (content as Record<string, unknown>).metadata;
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const metadataRecord = metadata as Record<string, unknown>;
  const candidates: Array<string[]> = [
    ["completion_tokens"],
    ["completionTokens"],
    ["usage", "completion_tokens"],
    ["usage", "completionTokens"],
    ["token_usage", "completion_tokens"],
    ["token_usage", "completionTokens"]
  ];

  for (const path of candidates) {
    const value = getNestedValue(metadataRecord, path);
    if (value !== undefined) {
      return value;
    }
  }

  return null;
}

function findTokenUsage(content: unknown): unknown {
  if (!content || typeof content !== "object") {
    return null;
  }

  const metadata = (content as Record<string, unknown>).metadata;
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const metadataRecord = metadata as Record<string, unknown>;
  const candidates: Array<string[]> = [
    ["usage", "total_tokens"],
    ["usage", "totalTokens"],
    ["usage", "tokens"],
    ["token_usage", "total_tokens"],
    ["token_usage", "totalTokens"],
    ["token_usage", "tokens"],
    ["tokens"],
    ["token"]
  ];

  for (const path of candidates) {
    const value = getNestedValue(metadataRecord, path);
    if (value !== undefined) {
      return value;
    }
  }

  return null;
}

function findAgentModel(content: unknown): unknown {
  if (!content || typeof content !== "object") {
    return null;
  }

  const metadata = (content as Record<string, unknown>).metadata;
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const metadataRecord = metadata as Record<string, unknown>;
  const candidates: Array<string[]> = [
    ["agent_model"],
    ["agentModel"],
    ["model"],
    ["usage", "model"],
    ["metadata", "agent_model"]
  ];

  for (const path of candidates) {
    const value = getNestedValue(metadataRecord, path);
    if (value !== undefined) {
      return value;
    }
  }

  return null;
}

function getNestedValue(source: Record<string, unknown>, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[key];
  }, source);
}

function formatParameterValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

