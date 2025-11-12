export function guessLanguage(path: string, explicit?: string) {
  if (explicit) return explicit;
  const extension = path.split(".").pop();
  switch (extension) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "json":
      return "json";
    case "py":
      return "python";
    case "rb":
      return "ruby";
    case "go":
      return "go";
    case "rs":
      return "rust";
    case "java":
      return "java";
    case "css":
      return "css";
    case "md":
      return "markdown";
    case "sh":
      return "bash";
    case "yml":
    case "yaml":
      return "yaml";
    case "sql":
      return "sql";
    case "php":
      return "php";
    default:
      return "text";
  }
}

