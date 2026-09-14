import type Anthropic from "@anthropic-ai/sdk";
import type { createClient } from "@/lib/supabase/server";
import type { DocumentRow } from "@/types/db";
import type { ValidatedExtractionResult } from "@/types/extraction";
import { getAnthropicClient } from "./anthropic-client";
import { withExtractionConcurrencyLimit } from "./concurrency-limiter";
import { parseExtractionResult } from "./parse-result";
import { EXTRACTION_INPUT_SCHEMA, EXTRACTION_TOOL_NAME, SYSTEM_PROMPT, extractionInstruction } from "./schema";
import { applyBusinessValidation } from "./validate-result";

export class ExtractionError extends Error {}

const PDF_MIME_TYPE = "application/pdf";
const MAX_TOKENS = 16000;

type AppSupabaseClient = Awaited<ReturnType<typeof createClient>>;

function buildContentBlock(
  mimeType: string,
  base64Data: string
): Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam {
  if (mimeType === PDF_MIME_TYPE) {
    return {
      type: "document",
      source: { type: "base64", media_type: PDF_MIME_TYPE, data: base64Data },
    };
  }

  if (mimeType === "image/jpeg" || mimeType === "image/png") {
    return {
      type: "image",
      source: { type: "base64", media_type: mimeType, data: base64Data },
    };
  }

  throw new ExtractionError(
    "סוג הקובץ אינו נתמך כרגע לזיהוי אוטומטי (נתמכים: JPG, PNG, PDF). יש להזין את הנתונים ידנית."
  );
}

export async function extractDocumentData(
  supabase: AppSupabaseClient,
  document: DocumentRow
): Promise<ValidatedExtractionResult> {
  const requestedAt = performance.now();
  return withExtractionConcurrencyLimit(async () => {
    let stage = "download";
    let startedAt = performance.now();
    console.info("extraction_timing", { stage: "queue", durationMs: Math.round(startedAt - requestedAt) });
    try {
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("documents")
      .download(document.storage_path);

    if (downloadError || !fileBlob) {
      throw new ExtractionError("לא ניתן היה להוריד את הקובץ מהאחסון.");
    }

    const arrayBuffer = await fileBlob.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");
    const contentBlock = buildContentBlock(document.mime_type, base64Data);

    console.info("extraction_timing", { stage, durationMs: Math.round(performance.now() - startedAt) });
    stage = "recognition"; startedAt = performance.now();
    const client = getAnthropicClient();

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: "claude-sonnet-5",
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        tools: [
          {
            name: EXTRACTION_TOOL_NAME,
            description:
              "חילוץ נתונים מובנים ממסמך חשבונית, קבלה או הצעת מחיר בעברית עבור עוסק מורשה בישראל.",
            strict: true,
            input_schema: EXTRACTION_INPUT_SCHEMA,
          },
        ],
        tool_choice: { type: "tool", name: EXTRACTION_TOOL_NAME },
        messages: [
          {
            role: "user",
            content: [contentBlock, { type: "text", text: extractionInstruction(document.direction) }],
          },
        ],
      });
    } catch {
      throw new ExtractionError("החיבור לשירות זיהוי הנתונים נכשל. נסי שוב.");
    }

    if (response.stop_reason === "refusal") {
      throw new ExtractionError("זיהוי הנתונים נדחה על ידי המערכת. נסי מסמך אחר או הזיני ידנית.");
    }

    const toolUseBlock = response.content.find(
      (block): block is Anthropic.ToolUseBlock =>
        block.type === "tool_use" && block.name === EXTRACTION_TOOL_NAME
    );

    if (!toolUseBlock) {
      throw new ExtractionError("לא התקבלו נתונים מובנים מהמסמך. נסי שוב.");
    }

    const parsed = parseExtractionResult(toolUseBlock.input);
    if (!parsed) {
      throw new ExtractionError("הנתונים שהתקבלו אינם תקינים. נסי שוב או הזיני ידנית.");
    }

    const validated = applyBusinessValidation(parsed);

    console.info("extraction_timing", { stage, durationMs: Math.round(performance.now() - startedAt) });
    stage = "save"; startedAt = performance.now();
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        status: "processed",
        extraction_raw: validated,
        error_message: null,
      })
      .eq("id", document.id)
      .eq("user_id", document.user_id);

    if (updateError) {
      throw new ExtractionError("הנתונים חולצו אך שמירתם במסד הנתונים נכשלה.");
    }

    return validated;
    } finally {
      console.info("extraction_timing", { stage, durationMs: Math.round(performance.now() - startedAt) });
    }
  });
}
