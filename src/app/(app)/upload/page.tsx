import UploadPageClient from "./UploadPageClient";
import type { SearchValues } from "@/lib/transactions/reporting";

export default async function UploadPage({ searchParams }: { searchParams: Promise<SearchValues> }): Promise<React.JSX.Element> {
  const params = await searchParams;
  const autoOpenCamera = params.mode === "camera";
  return <UploadPageClient autoOpenCamera={autoOpenCamera} />;
}
