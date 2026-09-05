export const ALLOWED_MIME_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "application/pdf",
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heic",
  pdf: "application/pdf",
};

export function getFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

export function resolveMimeType(file: File): string {
  if (file.type) {
    return file.type;
  }
  const extension = getFileExtension(file.name);
  return EXTENSION_TO_MIME[extension] ?? "";
}

export function isPreviewableImage(mimeType: string): boolean {
  return mimeType === "image/jpeg" || mimeType === "image/png";
}

export interface FileValidationResult {
  isValid: boolean;
  errorMessage: string | null;
}

export function validateFile(file: File): FileValidationResult {
  const mimeType = resolveMimeType(file);

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      isValid: false,
      errorMessage: `סוג הקובץ של "${file.name}" אינו נתמך. אפשר להעלות קבצי JPG, PNG, HEIC או PDF בלבד.`,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      errorMessage: `הקובץ "${file.name}" גדול מדי (מעל 10MB). נסי לצלם/לשמור באיכות נמוכה יותר או לבחור קובץ אחר.`,
    };
  }

  return { isValid: true, errorMessage: null };
}
