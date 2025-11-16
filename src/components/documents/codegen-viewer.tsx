"use client";

import { useMemo, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { duotoneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import clsx from "clsx";
import { guessLanguage } from "@/lib/language";
import { decodeEscapedString } from "@/lib/text";

export interface CodegenFile {
  path: string;
  content: string;
  language?: string;
}

type TreeNode =
  | {
      type: "directory";
      name: string;
      path: string;
      children: TreeNode[];
    }
  | {
      type: "file";
      name: string;
      path: string;
      content: string;
      language?: string;
    };

function buildTree(files: CodegenFile[]): TreeNode {
  const root: TreeNode = {
    type: "directory",
    name: "root",
    path: "",
    children: []
  };

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;

    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        current.children.push({
          type: "file",
          name: part,
          path: file.path,
          content: file.content,
          language: file.language
        });
        return;
      }

      let next = current.children.find(
        (child) => child.type === "directory" && child.name === part
      ) as TreeNode | undefined;

      if (!next) {
        next = {
          type: "directory",
          name: part,
          path: [current.path, part].filter(Boolean).join("/"),
          children: []
        };
        current.children.push(next);
      }

      current = next;
    });
  }

  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    return nodes
      .map((node) => {
        if (node.type === "directory") {
          return { ...node, children: sortNodes(node.children) };
        }
        return node;
      })
      .sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name);
        }
        return a.type === "directory" ? -1 : 1;
      });
  };

  return { ...root, children: sortNodes(root.children) };
}

interface CodegenViewerProps {
  payload: unknown;
  files?: CodegenFile[];
}

export function CodegenViewer({ payload, files: providedFiles }: CodegenViewerProps) {
  const files = useMemo(
    () => (providedFiles ? providedFiles : resolveCodegenFiles(payload)),
    [payload, providedFiles]
  );
  const tree = useMemo(() => buildTree(files), [files]);
  const [activePath, setActivePath] = useState<string | null>(
    files.length ? files[0].path : null
  );
  const [collapsedPaths, setCollapsedPaths] = useState<Record<string, boolean>>({});

  const activeFile = files.find((file) => file.path === activePath) ?? files[0];

  const toggleCollapse = (path: string) => {
    setCollapsedPaths((prev) => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  if (!files.length) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-slate-800 bg-slate-950/60 text-sm text-slate-400">
        Nenhuma estrutura de arquivos encontrada no conteúdo do documento.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[420px] overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60">
      <div className="w-64 border-r border-slate-800 bg-slate-950/80">
        <Tree
          node={tree}
          activePath={activePath}
          onSelect={(path) => setActivePath(path)}
          collapsedPaths={collapsedPaths}
          onToggleCollapse={toggleCollapse}
        />
      </div>
      <div className="flex-1 overflow-auto">
        {activeFile ? (
          <SyntaxHighlighter
            language={guessLanguage(activeFile.path, activeFile.language)}
            style={duotoneDark}
            customStyle={{
              margin: 0,
              padding: "1.5rem",
              background: "transparent",
              fontSize: "0.8rem"
            }}
            showLineNumbers
          >
            {activeFile.content}
          </SyntaxHighlighter>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Selecione um arquivo para visualizar o conteúdo.
          </div>
        )}
      </div>
    </div>
  );
}

export function resolveCodegenFiles(
  payload: unknown,
  visited: WeakSet<object> = new WeakSet()
): CodegenFile[] {
  const toCodegenFile = (entry: unknown): CodegenFile | null => {
    if (!entry || typeof entry !== "object") return null;
    const candidate = entry as Record<string, unknown>;
    const path = typeof candidate.path === "string" ? candidate.path : null;
    const content =
      typeof candidate.content === "string"
        ? candidate.content
        : typeof candidate.source === "string"
          ? candidate.source
          : null;

    if (!path || content === null) return null;

    return {
      path,
      content: decodeEscapedString(content),
      language: typeof candidate.language === "string" ? candidate.language : undefined
    };
  };

  const normalizeArray = (entries: unknown[]): CodegenFile[] =>
    entries.map(toCodegenFile).filter(Boolean) as CodegenFile[];

  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload);
      return resolveCodegenFiles(parsed, visited);
    } catch {
      return [];
    }
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  if (visited.has(payload as object)) {
    return [];
  }
  visited.add(payload as object);

  if (Array.isArray(payload)) {
    return normalizeArray(payload);
  }

  const record = payload as Record<string, unknown>;

  // Collect all files_* arrays (for scaffold documents)
  const allFiles: CodegenFile[] = [];
  for (const key in record) {
    if (key.startsWith("files_") && Array.isArray(record[key])) {
      const files = normalizeArray(record[key] as unknown[]);
      allFiles.push(...files);
    }
  }
  if (allFiles.length) {
    return allFiles;
  }

  const candidateKeys = ["files", "content", "artifacts", "entries", "bundle"];

  for (const key of candidateKeys) {
    const candidate = record[key];
    if (Array.isArray(candidate)) {
      const files = normalizeArray(candidate);
      if (files.length) return files;
    }
  }

  const nestedKeys = ["content", "payload", "data", "result", "bundle"];
  for (const key of nestedKeys) {
    const value = record[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      // First check for files_* arrays in nested objects (for scaffold)
      const nestedRecord = value as Record<string, unknown>;
      const nestedFiles: CodegenFile[] = [];
      for (const nestedKey in nestedRecord) {
        if (nestedKey.startsWith("files_") && Array.isArray(nestedRecord[nestedKey])) {
          const files = normalizeArray(nestedRecord[nestedKey] as unknown[]);
          nestedFiles.push(...files);
        }
      }
      if (nestedFiles.length) {
        return nestedFiles;
      }
      // Then do recursive search
      const files = resolveCodegenFiles(value, visited);
      if (files.length) return files;
    }
  }

  const single = toCodegenFile(record);
  return single ? [single] : [];
}

interface TreeProps {
  node: TreeNode;
  activePath: string | null;
  onSelect: (path: string) => void;
  collapsedPaths: Record<string, boolean>;
  onToggleCollapse: (path: string) => void;
}

function Tree({ node, activePath, onSelect, collapsedPaths, onToggleCollapse }: TreeProps) {
  if (node.type === "file") {
    const isActive = node.path === activePath;
    return (
      <button
        onClick={() => onSelect(node.path)}
        className={clsx(
          "flex w-full items-center gap-2 px-4 py-1.5 text-left text-xs transition",
          isActive
            ? "bg-slate-800/80 text-white"
            : "text-slate-300 hover:bg-slate-800/40 hover:text-white"
        )}
      >
        <span className="text-slate-500">📄</span>
        <span className="truncate">{node.name}</span>
      </button>
    );
  }

  const pathKey = node.path || `dir-${node.name}`;
  const isCollapsed = Boolean(collapsedPaths[pathKey]);

  return (
    <div className="text-xs text-slate-300">
      {node.path ? (
        <button
          type="button"
          onClick={() => onToggleCollapse(pathKey)}
          className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-slate-400 hover:bg-slate-900/40"
        >
          <span className="text-slate-500">{isCollapsed ? "▸" : "▾"}</span>
          <span className="font-medium">{node.name}</span>
        </button>
      ) : null}
      {!isCollapsed ? (
        <div className="pl-3">
          {node.children.map((child) => (
            <Tree
              key={`${child.path}-${child.name}`}
              node={child}
              activePath={activePath}
              onSelect={onSelect}
              collapsedPaths={collapsedPaths}
              onToggleCollapse={onToggleCollapse}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

