"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { duotoneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { guessLanguage } from "@/lib/language";

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
        path={[]}
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
  parent?: JsonValue;
  path: Array<string | number>;
}

interface FormatContext {
  key: string | number;
  parent?: JsonValue;
  path: Array<string | number>;
}

interface FormattedValue {
  node: ReactNode;
  isBlock: boolean;
}

function JsonNode({
  name,
  value,
  depth,
  collapsed = true,
  hideRoot = false,
  collapseSignal,
  expandSignal,
  parent,
  path
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
    const formatted = formatValue(value, { key: name, parent, path });
    return (
      <div style={{ paddingLeft: hideRoot ? 0 : padding }} className="py-0.5">
        {!hideRoot ? (
          <span className="text-slate-400">
            {name}
            {formatted.isBlock ? ":" : ": "}
          </span>
        ) : null}
        {formatted.isBlock && !hideRoot ? <br /> : null}
        {formatted.node}
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
                parent={value}
                path={[...path, key]}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function formatValue(
  value: Exclude<JsonValue, JsonValue[] | Record<string, JsonValue>>,
  context: FormatContext
): FormattedValue {
  if (value === null) {
    return { node: <span className="text-rose-300">null</span>, isBlock: false };
  }

  if (typeof value === "boolean") {
    return {
      node: <span className="text-amber-200">{value ? "true" : "false"}</span>,
      isBlock: false
    };
  }

  if (typeof value === "number") {
    return { node: <span className="text-emerald-200">{value}</span>, isBlock: false };
  }

  if (typeof value === "string") {
    const decoded = decodeEscapedString(value);
    const languageHint = getLanguageHint(decoded, context);
    const parsedJson = shouldPrettyPrintJson(languageHint) ? tryParseJson(decoded) : null;

    if (parsedJson) {
      const pretty = JSON.stringify(parsedJson, null, 2);
      return {
        node: renderCodeBlock(pretty, "json"),
        isBlock: true
      };
    }

    if (languageHint && languageHint !== "text") {
      return {
        node: renderCodeBlock(decoded, languageHint),
        isBlock: true
      };
    }

    const isMultiline = decoded.includes("\n") || decoded.includes("\t");
    const isLengthy = decoded.length > 120;

    if (isMultiline || isLengthy) {
      return {
        node: renderCodeBlock(decoded, undefined),
        isBlock: true
      };
    }

    return {
      node: <span className="text-sky-200">"{decoded}"</span>,
      isBlock: false
    };
  }

  return { node: <span className="text-sky-200">{String(value)}</span>, isBlock: false };
}

function renderCodeBlock(code: string, language: string | undefined): ReactNode {
  return (
    <div className="mt-1 max-h-96 overflow-auto rounded border border-slate-800 bg-slate-950/40">
      <SyntaxHighlighter
        language={language ?? "text"}
        style={duotoneDark}
        customStyle={{
          margin: 0,
          padding: "1rem",
          background: "transparent",
          fontSize: "0.75rem",
          lineHeight: "1.1rem"
        }}
        wrapLines
        wrapLongLines
        lineProps={() => ({
          style: { display: "block", background: "transparent" }
        })}
        PreTag="div"
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function getLanguageHint(value: string, context: FormatContext): string | undefined {
  if (context.parent && isRecord(context.parent)) {
    const parentRecord = context.parent;

    if (typeof parentRecord.language === "string") {
      return parentRecord.language;
    }

    if (typeof parentRecord.path === "string") {
      const language = guessLanguage(parentRecord.path);
      return language === "text" ? undefined : language;
    }
  }

  if (typeof context.key === "string") {
    const key = context.key.toLowerCase();
    if (key.includes("json")) return "json";
    if (key.includes("yaml") || key.includes("yml")) return "yaml";
    if (key.includes("ts") || key.includes("typescript")) return "typescript";
    if (key.includes("tsx")) return "tsx";
    if (key.includes("js") || key.includes("javascript")) return "javascript";
    if (key.includes("jsx")) return "jsx";
    if (key.includes("sql")) return "sql";
    if (key.includes("md") || key.includes("markdown")) return "markdown";
  }

  const looksLikeJson = tryParseJson(value) !== null;
  return looksLikeJson ? "json" : undefined;
}

function shouldPrettyPrintJson(languageHint: string | undefined): boolean {
  return languageHint === "json";
}

function tryParseJson(value: string): unknown | null {
  try {
    const parsed = JSON.parse(value);
    return parsed;
  } catch {
    return null;
  }
}

function decodeEscapedString(input: string): string {
  if (!input.includes("\\")) {
    return input;
  }

  let decoded = input;

  decoded = decoded.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\r/g, "\r");
  decoded = decoded.replace(/\\t/g, "\t");
  decoded = decoded.replace(/\\u([\dA-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  decoded = decoded.replace(/\\"/g, '"').replace(/\\'/g, "'");
  decoded = decoded.replace(/\\\\/g, "\\");

  return decoded;
}

