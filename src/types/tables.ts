export type AgentMessageStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | string;

export interface AgentMessage {
  id: string;
  project_id: string | null;
  session_id: string | null;
  from_agent: string;
  to_agent: string | null;
  status: AgentMessageStatus;
  message_content: string | null;
  scaffold_id: string | null;
  codegen_id: string | null;
  tester_id: string | null;
  deploy_id: string | null;
  qa_id: string | null;
  prd_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export type DocumentType =
  | "prd"
  | "scaffold"
  | "schema"
  | "codegen"
  | "tester"
  | "deploy"
  | "qa";

export interface BaseDocumentRecord {
  created_at: string | null;
  project_id: string | null;
  system_id?: string | null;
  archetype: string | null;
  locale: string | null;
  revision?: string | null;
  notes: string | null;
  content: unknown;
  new?: boolean | null;
}

export interface PRDDocument extends BaseDocumentRecord {
  prd_id: string;
}

export interface ScaffoldDocument extends BaseDocumentRecord {
  scaffold_id: string;
}

export interface SchemaDocument extends BaseDocumentRecord {
  schema_id: string;
}

export interface CodegenDocument extends BaseDocumentRecord {
  codegen_id: string;
}

export interface TesterDocument extends BaseDocumentRecord {
  tester_id: string;
}

export interface DeployDocument extends BaseDocumentRecord {
  deploy_id: string;
}

export interface QADocument extends BaseDocumentRecord {
  qa_id: string;
}

export type DocumentRecord =
  | PRDDocument
  | ScaffoldDocument
  | SchemaDocument
  | CodegenDocument
  | TesterDocument
  | DeployDocument
  | QADocument;

