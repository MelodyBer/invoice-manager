export type ImportState = "pending" | "processing" | "review" | "ignored" | "duplicate" | "imported" | "failed";
export type GmailImportRow = {
  id: string; user_id: string; mailbox: string; message_id: string; part_id: string;
  file_name: string; mime_type: string; file_size: number; received_on: string;
  state: ImportState; recipient_name: string | null; reason: string | null;
  storage_path: string | null; content_hash: string | null;
  extraction_raw: Record<string, unknown> | null; document_id: string | null;
  claim_token: string | null; claimed_at: string | null; created_at: string;
}
export type GmailImportInsert = Pick<GmailImportRow, "user_id" | "mailbox" | "message_id" | "part_id" | "file_name" | "mime_type" | "file_size" | "received_on">;
export type GmailImportUpdate = Partial<Omit<GmailImportRow, "id" | "user_id" | "created_at">>;
export type ImportView = Pick<GmailImportRow, "id" | "file_name" | "received_on" | "state" | "recipient_name" | "reason" | "document_id">;
export interface GmailPart { partId: string; filename: string; mimeType: string; size: number; attachmentId: string | null; data: string | null }
export interface ImportReply { ok: boolean; message: string; documentId?: string }
