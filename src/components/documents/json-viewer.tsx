"use client";

import { useState } from "react";

type JsonValue = string | number | boolean | null | JsonValue[] | Record<string, JsonValue>;

function isRecord(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function JsonViewer({
  data,
  initialCollapsed = false,
  collapseSignal,
  expandSignal
}: {
  data: unknown;
  initialCollapsed?: boolean;
  collapseSignal?: number;
  expandSignal?: number;
}) {
  const normalized = normalizeJson(data);
  return (
    <div className="font-mono text-xs text-slate-200">
      <JsonNode
        name="root"
        value={normalized}
        depth={0}
        collapsed={initialCollapsed}
        hideRoot
        collapseSignal={collapseSignal}
        expandSignal={expandSignal}
      />
    </div>
  );
}

function normalizeJson(input: unknown): JsonValue {
  if (
    typeof input === "string" ||
    typeof input === "number" ||
    typeof input === "boolean" ||
    input === null
  ) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => normalizeJson(item));
  }

  if (typeof input === "object" && input) {
    return Object.entries(input).reduce<Record<string, JsonValue>>((acc, [key, value]) => {
      acc[key] = normalizeJson(value);
      return acc;
    }, {});
  }

  return String(input ?? "");
}

interface JsonNodeProps {
  name: string | number;
  value: JsonValue;
  depth: number;
  collapsed?: boolean;
  hideRoot?: boolean;
  collapseSignal?: number;
  expandSignal?: number;
}

function JsonNode({
  name,
  value,
  depth,
  collapsed = true,
  hideRoot = false,
  collapseSignal,
  expandSignal
}: JsonNodeProps) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const padding = hideRoot ? depth * 16 : (depth + 1) * 16;

  useEffect(() => {
    if (collapseSignal !== undefined) {
      setIsCollapsed(true);
    }
  }, [collapseSignal]);

  useEffect(() => {
    if (expandSignal !== undefined) {
      setIsCollapsed(false);
    }
  }, [expandSignal]);

  if (!isRecord(value) && !Array.isArray(value)) {
    return (
      <div style={{ paddingLeft: hideRoot ? 0 : padding }} className="py-0.5">
        {!hideRoot ? (
          <span className="text-slate-400">
            {name}:{" "}
          </span>
        ) : null}
        <span className={value === null ? "text-rose-300" : "text-sky-200"}>
          {formatValue(value)}
        </span>
      </div>
    );
  }

  const entries: Array<[string | number, JsonValue]> = Array.isArray(value)
    ? value.map((item, index) => [index, item])
    : Object.entries(value);

  return (
    <div className="py-0.5" style={{ paddingLeft: hideRoot ? 0 : depth * 16 }}>
      {!hideRoot ? (
        <button
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="inline-flex items-center gap-2 text-slate-300 hover:text-white"
        >
          <span className="text-slate-500">{isCollapsed ? "▸" : "▾"}</span>
          <span>{name}</span>
          <span className="text-slate-500">
            {Array.isArray(value) ? `[${value.length}]` : "{ }"}
          </span>
        </button>
      ) : null}
      {!isCollapsed || hideRoot ? (
        <div className="mt-1 border-l border-slate-800">
          {entries.length === 0 ? (
            <div className="pl-4 text-slate-500">Ø vazio</div>
          ) : (
            entries.map(([key, child]) => (
              <JsonNode
                key={String(key)}
                name={key}
                value={child}
                depth={depth + 1}
                collapseSignal={collapseSignal}
                expandSignal={expandSignal}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function formatValue(value: Exclude<JsonValue, JsonValue[] | Record<string, JsonValue>>) {
  if (typeof value === "string") {
    return `"${value}"`;
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (value === null) {
    return "null";
  }

  return value;
}

