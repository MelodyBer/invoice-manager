export type UploadFileStatus = "pending" | "compressing" | "uploading" | "success" | "error";

export interface UploadFileItem {
  id: string;
  file: File;
  previewUrl: string | null;
  status: UploadFileStatus;
  progressPercent: number;
  errorMessage: string | null;
}
