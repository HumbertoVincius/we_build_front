"use client";

import { useMemo, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { duotoneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import clsx from "clsx";

interface SchemaViewerProps {
  payload: unknown;
}

interface TableColumn {
  name: string;
  type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  is_unique: boolean;
  default?: string;
  notes?: string;
}

interface TableIndex {
  name: string;
  columns: string[];
  notes?: string;
}

interface SchemaTable {
  name: string;
  description?: string;
  columns: TableColumn[];
  indexes?: TableIndex[];
}

interface SchemaSummary {
  tables: SchemaTable[];
  relations?: unknown[];
  enums?: unknown[];
}

export function SchemaViewer({ payload }: SchemaViewerProps) {
  const schemaData = useMemo(() => {
    if (!payload || typeof payload !== "object") {
      return null;
    }

    const record = payload as Record<string, unknown>;
    const migrationSql = typeof record.migration_sql === "string" ? record.migration_sql : null;
    const schemaSummary = record.schema_summary as SchemaSummary | undefined;

    return {
      migrationSql,
      schemaSummary,
      metadata: record.metadata
    };
  }, [payload]);

  const [activeTab, setActiveTab] = useState<"sql" | "structure">("sql");
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  if (!schemaData) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-slate-800 bg-slate-950/60 text-sm text-slate-400">
        Nenhum conteúdo de schema encontrado no documento.
      </div>
    );
  }

  const toggleTable = (tableName: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableName)) {
        next.delete(tableName);
      } else {
        next.add(tableName);
      }
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60">
      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/80">
        <button
          type="button"
          onClick={() => setActiveTab("sql")}
          className={clsx(
            "px-4 py-2 text-sm font-medium transition",
            activeTab === "sql"
              ? "border-b-2 border-emerald-500 text-emerald-200"
              : "text-slate-400 hover:text-slate-200"
          )}
        >
          SQL de Migração
        </button>
        {schemaData.schemaSummary && (
          <button
            type="button"
            onClick={() => setActiveTab("structure")}
            className={clsx(
              "px-4 py-2 text-sm font-medium transition",
              activeTab === "structure"
                ? "border-b-2 border-emerald-500 text-emerald-200"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            Estrutura do Schema
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "sql" && schemaData.migrationSql ? (
          <div className="h-full">
            <SyntaxHighlighter
              language="sql"
              style={duotoneDark}
              customStyle={{
                margin: 0,
                padding: "1.5rem",
                background: "transparent",
                fontSize: "0.875rem",
                height: "100%"
              }}
              showLineNumbers
            >
              {schemaData.migrationSql}
            </SyntaxHighlighter>
          </div>
        ) : activeTab === "structure" && schemaData.schemaSummary ? (
          <div className="p-6 space-y-6">
            {schemaData.schemaSummary.tables?.map((table) => {
              const isExpanded = expandedTables.has(table.name);
              return (
                <div
                  key={table.name}
                  className="rounded-lg border border-slate-800 bg-slate-900/40 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleTable(table.name)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/40 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500">{isExpanded ? "▾" : "▸"}</span>
                      <div>
                        <h3 className="text-sm font-semibold text-white break-words overflow-wrap-anywhere">{table.name}</h3>
                        {table.description && (
                          <p className="text-xs text-slate-400 mt-1 break-words overflow-wrap-anywhere">{table.description}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">
                      {table.columns?.length ?? 0} colunas
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-800 p-4 space-y-4">
                      {/* Columns */}
                      <div>
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                          Colunas
                        </h4>
                        <div className="space-y-2">
                          {table.columns?.map((column) => (
                            <div
                              key={column.name}
                              className="rounded border border-slate-800 bg-slate-950/60 p-3"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium text-white break-words overflow-wrap-anywhere">
                                      {column.name}
                                    </span>
                                    {column.is_primary_key && (
                                      <span className="text-[0.65rem] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-200 font-medium">
                                        PK
                                      </span>
                                    )}
                                    {column.is_unique && !column.is_primary_key && (
                                      <span className="text-[0.65rem] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-200 font-medium">
                                        UNIQUE
                                      </span>
                                    )}
                                    {!column.is_nullable && (
                                      <span className="text-[0.65rem] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-200 font-medium">
                                        NOT NULL
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-slate-400">
                                    <span className="font-mono text-emerald-300">{column.type}</span>
                                    {column.default && (
                                      <span className="text-slate-500">
                                        default: <span className="font-mono">{column.default}</span>
                                      </span>
                                    )}
                                  </div>
                                  {column.notes && (
                                    <p className="text-xs text-slate-500 mt-1 break-words overflow-wrap-anywhere">{column.notes}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Indexes */}
                      {table.indexes && table.indexes.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                            Índices
                          </h4>
                          <div className="space-y-2">
                            {table.indexes.map((index) => (
                              <div
                                key={index.name}
                                className="rounded border border-slate-800 bg-slate-950/60 p-3"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-sm font-medium text-white break-words overflow-wrap-anywhere">
                                        {index.name}
                                      </span>
                                    </div>
                                    <div className="text-xs text-slate-400">
                                      Colunas:{" "}
                                      <span className="font-mono text-emerald-300">
                                        {index.columns.join(", ")}
                                      </span>
                                    </div>
                                    {index.notes && (
                                      <p className="text-xs text-slate-500 mt-1 break-words overflow-wrap-anywhere">{index.notes}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {(!schemaData.schemaSummary.tables || schemaData.schemaSummary.tables.length === 0) && (
              <div className="text-center py-8 text-sm text-slate-500">
                Nenhuma tabela encontrada no schema.
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Conteúdo não disponível.
          </div>
        )}
      </div>
    </div>
  );
}

