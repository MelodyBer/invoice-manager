// Hands a file captured outside /upload (the floating quick-camera button) to the upload
// screen once it mounts, so the same compression/upload/extraction flow handles it —
// no duplicate upload logic. In-memory only: it only needs to survive a client-side
// navigation within the same tab, not a real page reload.
let pendingFiles: File[] | null = null;

export function setPendingCapture(files: File[]): void {
  pendingFiles = files;
}

export function takePendingCapture(): File[] | null {
  const files = pendingFiles;
  pendingFiles = null;
  return files;
}
