export function buildStoragePath(userId: string, extension: string): string {
  const year = new Date().getFullYear();
  const uniqueId = crypto.randomUUID();
  return `${userId}/${year}/${uniqueId}.${extension}`;
}

export function getExtensionFromMimeType(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/heic":
      return "heic";
    case "application/pdf":
      return "pdf";
    default:
      return "bin";
  }
}
