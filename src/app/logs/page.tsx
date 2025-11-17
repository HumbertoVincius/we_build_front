"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteAgentMessage,
  fetchAgentMessages,
  updateAgentMessage
} from "@/services/agentMessages";
import type { AgentMessage } from "@/types";
import { StatusBadge } from "@/components/ui/status-badge";
import { Spinner } from "@/components/ui/spinner";
import { RefreshButton } from "@/components/ui/refresh-button";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { CredentialsWarning } from "@/components/ui/credentials-warning";
import clsx from "clsx";

interface LogFilters {
  projectId: string;
  sessionId: string;
  fromAgent: string;
  toAgent: string;
  status: string;
  search: string;
}

const PAGE_SIZE = 25;

const AGENT_STYLES: Record<
  string,
  {
    dot: string;
    border: string;
    badge: string;
  }
> = {
  prd_agent: {
    dot: "bg-emerald-400",
    border: "border-emerald-500/60",
    badge: "border border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
  },
  scaffold_agent: {
    dot: "bg-sky-400",
    border: "border-sky-500/60",
    badge: "border border-sky-500/40 bg-sky-500/10 text-sky-200"
  },
  codegen_agent: {
    dot: "bg-violet-400",
    border: "border-violet-500/60",
    badge: "border border-violet-500/40 bg-violet-500/10 text-violet-200"
  },
  tester_agent: {
    dot: "bg-amber-400",
    border: "border-amber-500/60",
    badge: "border border-amber-500/40 bg-amber-500/10 text-amber-200"
  },
  deploy_agent: {
    dot: "bg-fuchsia-400",
    border: "border-fuchsia-500/60",
    badge: "border border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200"
  },
  depploy_agent: {
    dot: "bg-fuchsia-400",
    border: "border-fuchsia-500/60",
    badge: "border border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200"
  },
  qa_agent: {
    dot: "bg-rose-400",
    border: "border-rose-500/60",
    badge: "border border-rose-500/40 bg-rose-500/10 text-rose-200"
  }
};

function getAgentStyle(agent: string | null | undefined) {
  if (!agent) {
    return {
      dot: "bg-slate-500",
      border: "border-slate-700/50",
      badge: "border border-slate-600/40 bg-slate-700/20 text-slate-200"
    };
  }
  return (
    AGENT_STYLES[agent.toLowerCase()] ?? {
      dot: "bg-slate-500",
      border: "border-slate-700/50",
      badge: "border border-slate-600/40 bg-slate-700/20 text-slate-200"
    }
  );
}

function formatDateTimeBr(value: string | null | undefined) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

function calculateDuration(
  createdAt: string | null | undefined,
  updatedAt: string | null | undefined
): string {
  if (!createdAt) {
    return "—";
  }

  try {
    const start = new Date(createdAt);
    // Se updated_at não existe ou é null, usa a data atual
    const end = updatedAt ? new Date(updatedAt) : new Date();

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return "—";
    }

    const diffMs = end.getTime() - start.getTime();
    
    // Se a diferença for negativa ou zero, retorna 00:00:00
    if (diffMs <= 0) {
      return "00:00:00";
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  } catch (error) {
    console.error("Error calculating duration:", error, { createdAt, updatedAt });
    return "—";
  }
}

export default function LogsPage() {
  const supabaseReady = isSupabaseConfigured;
  const [filters, setFilters] = useState<LogFilters>({
    projectId: "",
    sessionId: "",
    fromAgent: "",
    toAgent: "",
    status: "",
    search: ""
  });
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [count, setCount] = useState(0);
  const [activeMessage, setActiveMessage] = useState<AgentMessage | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState({
    content: "",
    status: "",
    fromAgent: "",
    toAgent: ""
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [inlineSaving, setInlineSaving] = useState<{ id: string; field: EditableField } | null>(
    null
  );
  const [inlineDeletingId, setInlineDeletingId] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!supabaseReady) {
      return;
    }

    let ignore = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      const { data, count: total, error: messageError } = await fetchAgentMessages({
        projectId: filters.projectId || undefined,
        sessionId: filters.sessionId || undefined,
        fromAgent: filters.fromAgent || undefined,
        toAgent: filters.toAgent || undefined,
        status: filters.status || undefined,
        search: filters.search || undefined,
        page,
        pageSize: PAGE_SIZE
      });

      if (!ignore) {
        // Debug: verificar dados de duração
        if (data.length > 0) {
          console.log("Sample message data:", {
            id: data[0].id,
            created_at: data[0].created_at,
            updated_at: data[0].updated_at,
            duration: calculateDuration(data[0].created_at, data[0].updated_at ?? null)
          });
        }
        setMessages(data);
        setCount(total);
        setActiveMessage((prev) =>
          prev ? data.find((item) => item.id === prev.id) ?? data[0] ?? null : data[0] ?? null
        );
        if (messageError) {
          setError(messageError);
        }
        setIsLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [filters, page, supabaseReady, refreshTrigger]);

  // Refresh handler - force reload by creating a refresh trigger
  const handleRefresh = async () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(count / PAGE_SIZE)),
    [count]
  );

  function updateFilter<Key extends keyof LogFilters>(key: Key, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  }

  useEffect(() => {
    setEditDraft({
      content: activeMessage?.message_content ?? "",
      status: activeMessage?.status ?? "",
      fromAgent: activeMessage?.from_agent ?? "",
      toAgent: activeMessage?.to_agent ?? ""
    });
    setActionError(null);
  }, [activeMessage]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  function applyMessageUpdate(updated: AgentMessage) {
    setMessages((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setActiveMessage((prev) => (prev?.id === updated.id ? updated : prev));
  }

  function removeMessageFromState(id: string) {
    let updatedMessages: AgentMessage[] = [];
    setMessages((prev) => {
      updatedMessages = prev.filter((item) => item.id !== id);
      return updatedMessages;
    });
    setCount((prev) => Math.max(0, prev - 1));
    setActiveMessage((prev) => {
      if (prev?.id === id) {
        return updatedMessages[0] ?? null;
      }
      return prev;
    });
  }

  async function handleSaveEdit() {
    if (!activeMessage) return;
    setIsSaving(true);
    setActionError(null);
    const sanitizedStatus = editDraft.status.trim() || activeMessage.status;
    const sanitizedFrom = editDraft.fromAgent.trim() || activeMessage.from_agent;
    const sanitizedTo = editDraft.toAgent.trim();
    const payload = {
      message_content: editDraft.content,
      status: sanitizedStatus,
      from_agent: sanitizedFrom,
      to_agent: sanitizedTo.length ? sanitizedTo : null
    };
    const { data, error: updateError } = await updateAgentMessage(
      activeMessage.id,
      payload
    );
    if (updateError || !data) {
      setActionError(updateError ?? "Falha ao atualizar mensagem.");
      setIsSaving(false);
      return;
    }

    applyMessageUpdate(data);
    setIsEditing(false);
    setIsSaving(false);
  }

  async function handleDelete() {
    if (!activeMessage) return;
    const confirmed = window.confirm(
      "Tem certeza que deseja excluir esta mensagem? Esta ação não pode ser desfeita."
    );
    if (!confirmed) {
      return;
    }
    setIsDeleting(true);
    setActionError(null);
    const { error: deleteError } = await deleteAgentMessage(activeMessage.id);
    if (deleteError) {
      setActionError(deleteError);
      setIsDeleting(false);
      return;
    }
    removeMessageFromState(activeMessage.id);

    setIsDeleting(false);
  }

  async function handleInlineUpdate(
    id: string,
    field: EditableField,
    rawValue: string
  ): Promise<void> {
    const message = messages.find((item) => item.id === id);
    if (!message) {
      return;
    }

    const trimmedValue = field === "message_content" ? rawValue : rawValue.trim();

    const patch: Partial<AgentMessage> = {};
    switch (field) {
      case "status": {
        patch.status = trimmedValue || message.status;
        break;
      }
      case "from_agent": {
        patch.from_agent = trimmedValue || message.from_agent;
        break;
      }
      case "to_agent": {
        patch.to_agent = trimmedValue.length ? trimmedValue : null;
        break;
      }
      case "message_content": {
        patch.message_content = rawValue;
        break;
      }
      default:
        break;
    }

    if (Object.keys(patch).length === 0) {
      return;
    }

    setInlineSaving({ id, field });
    setActionError(null);
    try {
      const { data, error } = await updateAgentMessage(id, patch);
      if (error || !data) {
        throw new Error(error ?? "Falha ao atualizar mensagem.");
      }
      applyMessageUpdate(data);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      if (isMountedRef.current) {
        setInlineSaving(null);
      }
    }
  }

  async function handleInlineDelete(id: string) {
    setInlineDeletingId(id);
    setActionError(null);
    try {
      const { error } = await deleteAgentMessage(id);
      if (error) {
        throw new Error(error);
      }
      removeMessageFromState(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      if (isMountedRef.current) {
        setInlineDeletingId(null);
      }
    }
  }

  if (!supabaseReady) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-950">
        <CredentialsWarning />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <div className="border-b border-slate-800 bg-slate-950/70 px-6 py-4">
        <div className="flex flex-wrap gap-3 text-sm text-slate-300">
          <input
            placeholder="Project ID"
            className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-0 sm:w-40"
            value={filters.projectId}
            onChange={(event) => updateFilter("projectId", event.target.value)}
          />
          <input
            placeholder="Session ID"
            className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-0 sm:w-40"
            value={filters.sessionId}
            onChange={(event) => updateFilter("sessionId", event.target.value)}
          />
          <input
            placeholder="Agent origem"
            className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-0 sm:w-40"
            value={filters.fromAgent}
            onChange={(event) => updateFilter("fromAgent", event.target.value)}
          />
          <input
            placeholder="Agent destino"
            className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-0 sm:w-40"
            value={filters.toAgent}
            onChange={(event) => updateFilter("toAgent", event.target.value)}
          />
          <input
            placeholder="Status"
            className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-0 sm:w-32"
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}
          />
          <input
            placeholder="Buscar mensagem"
            className="flex-1 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-0"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-2/3 flex-col border-r border-slate-800 lg:w-1/2">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/50 px-6 py-3">
            <div>
              <p className="text-sm font-medium text-white">
                {isLoading ? "Carregando logs…" : `${count} mensagens`}
              </p>
              <p className="text-xs text-slate-400">
                Página {page + 1} de {totalPages}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600"
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                disabled={page === 0 || isLoading}
              >
                Anterior
              </button>
              <button
                className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600"
                onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
                disabled={page >= totalPages - 1 || isLoading}
              >
                Próxima
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="min-w-full table-fixed divide-y divide-slate-800">
              <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
                <tr>
                  <th className="w-36 px-4 py-3 text-left">Data</th>
                  <th className="w-44 px-4 py-3 text-left">De</th>
                  <th className="w-44 px-4 py-3 text-left">Para</th>
                  <th className="w-36 px-4 py-3 text-left">Status</th>
                  <th className="w-24 px-4 py-3 text-left">Duração</th>
                  <th className="px-4 py-3 text-left">Conteúdo</th>
                  <th className="w-14 px-3 py-3 text-left">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 text-sm">
                {messages.map((message) => {
                  const isActive = activeMessage?.id === message.id;
                  const agentStyle = getAgentStyle(message.from_agent);
                  return (
                    <tr
                      key={message.id}
                      className={clsx(
                        "cursor-pointer border-l-4 border-transparent transition hover:bg-slate-900/50",
                        isActive ? "bg-slate-900/60" : "",
                        agentStyle.border
                      )}
                      onClick={() => setActiveMessage(message)}
                    >
                      <td className="px-4 py-2 text-xs text-slate-400">
                        {formatDateTimeBr(message.created_at)}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className={clsx("h-2.5 w-2.5 rounded-full", agentStyle.dot)} />
                          <InlineEditableCell
                            value={message.from_agent}
                            placeholder="from_agent"
                            saving={
                              inlineSaving?.id === message.id && inlineSaving.field === "from_agent"
                            }
                            onSave={(value) => handleInlineUpdate(message.id, "from_agent", value)}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <InlineEditableCell
                          value={message.to_agent}
                          placeholder="to_agent"
                          saving={
                            inlineSaving?.id === message.id && inlineSaving.field === "to_agent"
                          }
                          onSave={(value) => handleInlineUpdate(message.id, "to_agent", value)}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <InlineEditableCell
                          value={message.status}
                          placeholder="status"
                          fieldType="status"
                          saving={
                            inlineSaving?.id === message.id && inlineSaving.field === "status"
                          }
                          onSave={(value) => handleInlineUpdate(message.id, "status", value)}
                        />
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-400 font-mono">
                        {calculateDuration(message.created_at, message.updated_at ?? null)}
                      </td>
                      <td className="px-4 py-2 break-words">
                        <InlineEditableCell
                          value={message.message_content}
                          placeholder="conteúdo"
                          saving={
                            inlineSaving?.id === message.id &&
                            inlineSaving.field === "message_content"
                          }
                          onSave={(value) =>
                            handleInlineUpdate(message.id, "message_content", value)
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-400 transition hover:border-rose-600 hover:text-rose-300 disabled:cursor-not-allowed disabled:border-rose-900 disabled:text-rose-700"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleInlineDelete(message.id);
                          }}
                          disabled={inlineDeletingId === message.id}
                          title="Excluir mensagem"
                          aria-label="Excluir mensagem"
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  );
                })}
                 {!isLoading && messages.length === 0 ? (
                   <tr>
                     <td
                       colSpan={7}
                       className="px-4 py-6 text-center text-sm text-slate-500"
                     >
                       Nenhuma mensagem encontrada para os filtros atuais.
                     </td>
                   </tr>
                 ) : null}
              </tbody>
            </table>
            {isLoading ? (
              <div className="flex justify-center border-t border-slate-900 py-6">
                <Spinner label="Carregando mensagens…" />
              </div>
            ) : null}
            {error ? (
              <div className="border-t border-rose-900 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
                Erro ao carregar mensagens: {error}
              </div>
            ) : null}
          </div>
        </div>

        <div className="hidden flex-1 flex-col overflow-hidden lg:flex">
          {activeMessage ? (
            <MessageDetails
              message={activeMessage}
              onEdit={() => {
                setEditDraft({
                  content: activeMessage.message_content ?? "",
                  status: activeMessage.status ?? "",
                  fromAgent: activeMessage.from_agent ?? "",
                  toAgent: activeMessage.to_agent ?? ""
                });
                setIsEditing(true);
              }}
              onDelete={handleDelete}
              isDeleting={isDeleting}
              actionError={actionError}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
              Selecione uma mensagem para ver detalhes.
            </div>
          )}
        </div>
      </div>
      {isEditing && activeMessage ? (
        <EditContentDialog
          value={editDraft}
          onChange={setEditDraft}
          onClose={() => {
            setIsEditing(false);
            setEditDraft({
              content: activeMessage.message_content ?? "",
              status: activeMessage.status ?? "",
              fromAgent: activeMessage.from_agent ?? "",
              toAgent: activeMessage.to_agent ?? ""
            });
          }}
          onSave={handleSaveEdit}
          isSaving={isSaving}
          error={actionError}
        />
      ) : null}
      
      <RefreshButton onRefresh={handleRefresh} isLoading={isLoading} />
    </div>
  );
}

function MessageDetails({
  message,
  onEdit,
  onDelete,
  isDeleting,
  actionError
}: {
  message: AgentMessage;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  actionError: string | null;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800 bg-slate-900/60 px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-white">Detalhes da mensagem</p>
            <p className="text-xs text-slate-400">
              {formatDateTimeBr(message.created_at)}
            </p>
            <div className="mt-1">
              <StatusBadge status={message.status} />
            </div>
            <AgentBadge agent={message.from_agent} />
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
              onClick={onEdit}
            >
              Editar conteúdo
            </button>
            <button
              className="rounded-md border border-rose-700 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:border-rose-500 hover:text-rose-100 disabled:cursor-not-allowed disabled:border-rose-900 disabled:text-rose-800"
              onClick={onDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Excluindo…" : "Excluir"}
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-6 overflow-auto px-6 py-6 text-sm text-slate-200">
        <div>
          <h3 className="text-xs uppercase tracking-wide text-slate-500 break-words overflow-wrap-anywhere">Origem</h3>
          <div className="mt-1 flex items-center gap-2 text-base font-medium text-white break-words overflow-wrap-anywhere">
            <span className="break-words overflow-wrap-anywhere">{message.from_agent}</span>
            <span
              className={clsx("h-2.5 w-2.5 rounded-full flex-shrink-0", getAgentStyle(message.from_agent).dot)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs text-slate-400">
          <div>
            <span className="block uppercase tracking-wide text-slate-500 break-words overflow-wrap-anywhere">Destinatário</span>
            <span className="text-sm text-white break-words overflow-wrap-anywhere">{message.to_agent ?? "—"}</span>
          </div>
          <div>
            <span className="block uppercase tracking-wide text-slate-500 break-words overflow-wrap-anywhere">Status</span>
            <span className={clsx("text-sm capitalize font-semibold break-words overflow-wrap-anywhere", getStatusColor(message.status))}>
              {message.status}
            </span>
          </div>
          <div>
            <span className="block uppercase tracking-wide text-slate-500 break-words overflow-wrap-anywhere">Projeto</span>
            <span className="text-sm text-white break-words overflow-wrap-anywhere">{message.project_id ?? "—"}</span>
          </div>
          <div>
            <span className="block uppercase tracking-wide text-slate-500 break-words overflow-wrap-anywhere">Sessão</span>
            <span className="text-sm text-white break-words overflow-wrap-anywhere">{message.session_id ?? "—"}</span>
          </div>
          <div>
            <span className="block uppercase tracking-wide text-slate-500 break-words overflow-wrap-anywhere">Duração</span>
            <span className="text-sm font-mono text-slate-200 break-words overflow-wrap-anywhere">
              {calculateDuration(message.created_at, message.updated_at ?? null)}
            </span>
          </div>
        </div>
        <div>
          <h3 className="text-xs uppercase tracking-wide text-slate-500 break-words overflow-wrap-anywhere">Conteúdo</h3>
          <pre className="mt-2 max-h-72 overflow-auto rounded-md border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-100 break-words overflow-wrap-anywhere whitespace-pre-wrap">
            {message.message_content ?? "—"}
          </pre>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs text-slate-500">
          <MetadataItem 
            label="PRD" 
            value={message.prd_id} 
            documentType="prd"
            fromAgent={message.from_agent}
            toAgent={message.to_agent}
          />
          <MetadataItem 
            label="Scaffold" 
            value={message.scaffold_id} 
            documentType="scaffold"
            fromAgent={message.from_agent}
            toAgent={message.to_agent}
          />
          <MetadataItem 
            label="Codegen" 
            value={message.codegen_id} 
            documentType="codegen"
            fromAgent={message.from_agent}
            toAgent={message.to_agent}
          />
          <MetadataItem 
            label="Tester" 
            value={message.tester_id} 
            documentType="tester"
            fromAgent={message.from_agent}
            toAgent={message.to_agent}
          />
          <MetadataItem 
            label="Deploy" 
            value={message.deploy_id} 
            documentType="deploy"
            fromAgent={message.from_agent}
            toAgent={message.to_agent}
          />
          <MetadataItem 
            label="QA" 
            value={message.qa_id} 
            documentType="qa"
            fromAgent={message.from_agent}
            toAgent={message.to_agent}
          />
        </div>
        {actionError ? (
          <div className="rounded-md border border-rose-900 bg-rose-950/30 px-4 py-3 text-xs text-rose-200 break-words overflow-wrap-anywhere">
            {actionError}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MetadataItem({ 
  label, 
  value, 
  documentType,
  fromAgent,
  toAgent
}: { 
  label: string; 
  value: string | null;
  documentType: "prd" | "scaffold" | "schema" | "codegen" | "tester" | "deploy" | "qa";
  fromAgent: string | null;
  toAgent: string | null;
}) {
  const router = useRouter();
  
  // Check if this document type matches the from_agent
  const agentToDocType: Record<string, string> = {
    "prd_agent": "prd",
    "scaffold_agent": "scaffold",
    "schema_agent": "schema",
    "codegen_agent": "codegen",
    "tester_agent": "tester",
    "deploy_agent": "deploy",
    "depploy_agent": "deploy",
    "qa_agent": "qa"
  };
  
  const isFromThisAgent = fromAgent && agentToDocType[fromAgent.toLowerCase()] === documentType;
  
  // For tester messages, determine color based on destination
  let testerColorClass = "";
  if (documentType === "tester" && isFromThisAgent && toAgent) {
    const toAgentLower = toAgent.toLowerCase();
    if (toAgentLower === "deploy_agent" || toAgentLower === "depploy_agent") {
      testerColorClass = "border-emerald-500/50 bg-emerald-500/10 text-emerald-200";
    } else if (toAgentLower === "codegen_agent") {
      testerColorClass = "border-rose-500/50 bg-rose-500/10 text-rose-200";
    }
  }
  
  const handleNavigate = () => {
    if (value) {
      router.push(`/documents?type=${documentType}&id=${value}`);
    }
  };
  
  return (
    <div>
      <span className="block uppercase tracking-wide text-slate-500 break-words overflow-wrap-anywhere">{label}</span>
      {value ? (
        <button
          onClick={handleNavigate}
          className={clsx(
            "mt-1 rounded border px-2 py-1 text-xs font-medium transition hover:opacity-80 break-words overflow-wrap-anywhere whitespace-normal",
            testerColorClass || "border-slate-700 bg-slate-800/40 text-slate-200 hover:border-slate-600 hover:bg-slate-800/60"
          )}
        >
          Ver documento
        </button>
      ) : (
        <span className="text-sm text-white break-words overflow-wrap-anywhere">—</span>
      )}
    </div>
  );
}

function EditContentDialog({
  value,
  onChange,
  onClose,
  onSave,
  isSaving,
  error
}: {
  value: {
    content: string;
    status: string;
    fromAgent: string;
    toAgent: string;
  };
  onChange: (value: {
    content: string;
    status: string;
    fromAgent: string;
    toAgent: string;
  }) => void;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
  error: string | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur">
      <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Editar conteúdo</h2>
          <button
            className="text-slate-400 transition hover:text-white"
            onClick={onClose}
            disabled={isSaving}
          >
            ✕
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Ajuste os metadados e conteúdo da mensagem e salve suas alterações.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 text-sm text-slate-200 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wide text-slate-500">
              Status
            </label>
            <input
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-500 focus:outline-none focus:ring-0 disabled:opacity-60"
              value={value.status}
              onChange={(event) =>
                onChange({
                  ...value,
                  status: event.target.value
                })
              }
              disabled={isSaving}
              placeholder="completed, running..."
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wide text-slate-500">
              De (from_agent)
            </label>
            <input
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-500 focus:outline-none focus:ring-0 disabled:opacity-60"
              value={value.fromAgent}
              onChange={(event) =>
                onChange({
                  ...value,
                  fromAgent: event.target.value
                })
              }
              disabled={isSaving}
              placeholder="Agent origem"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wide text-slate-500">
              Para (to_agent)
            </label>
            <input
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-500 focus:outline-none focus:ring-0 disabled:opacity-60"
              value={value.toAgent}
              onChange={(event) =>
                onChange({
                  ...value,
                  toAgent: event.target.value
                })
              }
              disabled={isSaving}
              placeholder="Agent destino"
            />
          </div>
        </div>
        <label className="mt-4 block text-xs uppercase tracking-wide text-slate-500">
          Conteúdo
        </label>
        <textarea
          className="mt-2 h-56 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-500 focus:outline-none focus:ring-0 disabled:opacity-60"
          value={value.content}
          onChange={(event) =>
            onChange({
              ...value,
              content: event.target.value
            })
          }
          disabled={isSaving}
        />
        {error ? (
          <div className="mt-3 rounded-md border border-rose-900 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="rounded-md border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button
            className="rounded-md border border-emerald-600 bg-emerald-600/20 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:border-emerald-500 hover:bg-emerald-600/30 hover:text-emerald-100 disabled:cursor-not-allowed disabled:border-emerald-900 disabled:text-emerald-800"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

type EditableField = "status" | "from_agent" | "to_agent" | "message_content";

function getStatusColor(status: string | null): string {
  if (!status) return "text-slate-300";
  const normalized = status.toLowerCase();
  if (normalized === "pending") return "text-rose-300 font-semibold";
  if (normalized === "working" || normalized === "running") return "text-amber-300 font-semibold";
  if (normalized === "done" || normalized === "completed") return "text-emerald-300 font-semibold";
  return "text-slate-300";
}

interface InlineEditableCellProps {
  value: string | null;
  placeholder?: string;
  multiline?: boolean;
  saving?: boolean;
  onSave: (value: string) => Promise<void>;
  fieldType?: "status" | "default";
}

function InlineEditableCell({
  value,
  placeholder,
  multiline = false,
  saving = false,
  onSave,
  fieldType = "default"
}: InlineEditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isEditing) {
      setDraft(value ?? "");
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        if (inputRef.current instanceof HTMLInputElement) {
          inputRef.current.select();
        }
      });
    }
  }, [isEditing]);

  const displayValue = value && value.length ? value : placeholder ?? "—";

  const startEditing = (event: React.MouseEvent) => {
    if (isEditing || saving) return;
    event.stopPropagation();
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraft(value ?? "");
    setIsEditing(false);
  };

  const commit = async () => {
    if (!isEditing || saving) return;
    const nextValue = multiline ? draft : draft.trim();
    const currentValue = value ?? "";

    if (nextValue === currentValue) {
      setIsEditing(false);
      return;
    }

    try {
      await onSave(nextValue);
      setIsEditing(false);
    } catch {
      setDraft(value ?? "");
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    void commit();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!multiline && event.key === "Enter") {
      event.preventDefault();
      void commit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    }
    if (multiline && (event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void commit();
    }
  };

  const inputBaseClasses =
    "w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 focus:border-slate-500 focus:outline-none focus:ring-0 disabled:opacity-60";

  return (
    <div className="relative">
      {isEditing ? (
        multiline ? (
          <textarea
            ref={(node) => {
              inputRef.current = node;
            }}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onClick={(event) => event.stopPropagation()}
            className={`${inputBaseClasses} h-24 resize-none`}
            disabled={saving}
          />
        ) : (
          <input
            ref={(node) => {
              inputRef.current = node;
            }}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onClick={(event) => event.stopPropagation()}
            className={inputBaseClasses}
            disabled={saving}
            placeholder={placeholder}
          />
        )
      ) : (
        <span
          className={clsx(
            "block cursor-text text-xs",
            fieldType === "status" ? getStatusColor(value) : "text-slate-300",
            multiline ? "whitespace-pre-wrap break-words overflow-wrap-anywhere" : "break-words overflow-wrap-anywhere",
            saving ? "opacity-60" : ""
          )}
          onClick={startEditing}
        >
          {displayValue}
        </span>
      )}
    </div>
  );
}

function AgentBadge({ agent }: { agent: string | null }) {
  const style = getAgentStyle(agent ?? "");
  const label = agent ?? "desconhecido";

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize break-words overflow-wrap-anywhere",
        style.badge
      )}
    >
      {label.replace(/_/g, " ")}
    </span>
  );
}

