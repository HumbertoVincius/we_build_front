"use client";

import { useEffect, useMemo, useState } from "react";
import {
  deleteAgentMessage,
  fetchAgentMessages,
  updateAgentMessage
} from "@/services/agentMessages";
import type { AgentMessage } from "@/types";
import { StatusBadge } from "@/components/ui/status-badge";
import { format } from "date-fns";
import { Spinner } from "@/components/ui/spinner";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { CredentialsWarning } from "@/components/ui/credentials-warning";

interface LogFilters {
  projectId: string;
  sessionId: string;
  fromAgent: string;
  toAgent: string;
  status: string;
  search: string;
}

const PAGE_SIZE = 25;

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
  }, [filters, page, supabaseReady]);

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

    setMessages((prev) =>
      prev.map((item) =>
        item.id === data.id ? { ...item, ...data } : item
      )
    );
    setActiveMessage(data);
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

    const remaining = messages.filter((item) => item.id !== activeMessage.id);
    setMessages(remaining);
    setCount((prev) => Math.max(0, prev - 1));
    setActiveMessage(remaining[0] ?? null);

    setIsDeleting(false);
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
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-left">De</th>
                  <th className="px-4 py-3 text-left">Para</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Conteúdo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 text-sm">
                {messages.map((message) => {
                  const isActive = activeMessage?.id === message.id;
                  return (
                    <tr
                      key={message.id}
                      className={`cursor-pointer transition hover:bg-slate-900 ${
                        isActive ? "bg-slate-900/60" : ""
                      }`}
                      onClick={() => setActiveMessage(message)}
                    >
                      <td className="px-4 py-2 text-xs text-slate-400">
                        {format(new Date(message.created_at), "dd/MM/yyyy HH:mm:ss")}
                      </td>
                      <td className="px-4 py-2 font-medium text-white">
                        {message.from_agent}
                      </td>
                      <td className="px-4 py-2 text-slate-300">{message.to_agent ?? "—"}</td>
                      <td className="px-4 py-2">
                        <StatusBadge status={message.status} />
                      </td>
                      <td className="max-w-xs px-4 py-2 text-xs text-slate-400">
                        {truncate(message.message_content)}
                      </td>
                    </tr>
                  );
                })}
                {!isLoading && messages.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
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
          <div>
            <p className="text-sm font-semibold text-white">Detalhes da mensagem</p>
            <p className="text-xs text-slate-400">
              {format(new Date(message.created_at), "dd/MM/yyyy HH:mm:ss")}
            </p>
            <div className="mt-1">
              <StatusBadge status={message.status} />
            </div>
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
          <h3 className="text-xs uppercase tracking-wide text-slate-500">Origem</h3>
          <p className="text-base font-medium text-white">{message.from_agent}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs text-slate-400">
          <div>
            <span className="block uppercase tracking-wide text-slate-500">Destinatário</span>
            <span className="text-sm text-white">{message.to_agent ?? "—"}</span>
          </div>
          <div>
            <span className="block uppercase tracking-wide text-slate-500">Status</span>
            <span className="text-sm text-white capitalize">{message.status}</span>
          </div>
          <div>
            <span className="block uppercase tracking-wide text-slate-500">Projeto</span>
            <span className="text-sm text-white">{message.project_id ?? "—"}</span>
          </div>
          <div>
            <span className="block uppercase tracking-wide text-slate-500">Sessão</span>
            <span className="text-sm text-white">{message.session_id ?? "—"}</span>
          </div>
        </div>
        <div>
          <h3 className="text-xs uppercase tracking-wide text-slate-500">Conteúdo</h3>
          <pre className="mt-2 max-h-72 overflow-auto rounded-md border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-100">
            {message.message_content ?? "—"}
          </pre>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs text-slate-500">
          <MetadataItem label="PRD" value={message.prd_id} />
          <MetadataItem label="Scaffold" value={message.scaffold_id} />
          <MetadataItem label="Codegen" value={message.codegen_id} />
          <MetadataItem label="Tester" value={message.tester_id} />
          <MetadataItem label="Deploy" value={message.deploy_id} />
          <MetadataItem label="QA" value={message.qa_id} />
        </div>
        {actionError ? (
          <div className="rounded-md border border-rose-900 bg-rose-950/30 px-4 py-3 text-xs text-rose-200">
            {actionError}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MetadataItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span className="block uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-sm text-white">{value ?? "—"}</span>
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

function truncate(value: string | null, length = 60) {
  if (!value) return "—";
  if (value.length <= length) return value;
  return `${value.slice(0, length)}…`;
}

