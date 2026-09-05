export type UploadFileStatus =
  | "pending"
  | "compressing"
  | "uploading"
  | "extracting"
  | "success"
  | "error"
  | "extraction_failed";

export interface UploadFileItem {
  id: string;
  file: File;
  previewUrl: string | null;
  status: UploadFileStatus;
  progressPercent: number;
  errorMessage: string | null;
  documentId: string | null;
}
