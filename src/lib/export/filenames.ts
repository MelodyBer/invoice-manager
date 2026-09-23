/** Filesystem- and header-safe names for exported files. Hebrew stays intact; only illegal characters are replaced. */
export function sanitizeFileNamePart(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim() || "ללא שם";
}

export function buildExportBaseName(businessName: string | null, periodLabel: string): string {
  return `חשבוניות_${sanitizeFileNamePart(businessName ?? "העסק שלי")}_${sanitizeFileNamePart(periodLabel)}`;
}

/** RFC 5987 filename* carries the Hebrew name; the plain filename is an ASCII fallback for older clients. */
export function contentDisposition(fileName: string, extension: string): string {
  return `attachment; filename="export.${extension}"; filename*=UTF-8''${encodeURIComponent(`${fileName}.${extension}`)}`;
}

/** Ensures unique names within a single zip archive by appending " (2)", " (3)", ... on collision. */
export function uniqueFileName(baseName: string, extension: string, used: Set<string>): string {
  let candidate = `${baseName}.${extension}`;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${baseName} (${suffix}).${extension}`;
    suffix++;
  }
  used.add(candidate);
  return candidate;
}
