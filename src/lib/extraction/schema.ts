import type Anthropic from "@anthropic-ai/sdk";

export const EXTRACTION_TOOL_NAME = "extract_document_data";

export const SYSTEM_PROMPT = `את עוזרת שמחלצת נתונים ממסמכי הנהלת חשבונות (חשבוניות, קבלות, הצעות מחיר) עבור עוסק מורשה בישראל.

הנחיות חשובות:
- סוג התנועה קובע את הצד שכנגד: בהוצאה חלצי את שם הספק שהנפיק את המסמך. בהכנסה חלצי את שם הלקוח מתוך לכבוד, שם לקוח, נמען או מקבל השירות, ולא את שם המנפיק או מי שמקבל את התשלום. גם business_number שייך לצד זה. אם אין שם ברור החזירי מחרוזת ריקה ו-confidence.counterparty_name=0, ולא שם של הצד השני.
- כל המסמכים בעברית, מישראל, והסכומים בהם הם בשקלים חדשים (₪), אלא אם צוין אחרת במפורש במסמך.
- תאריכים במסמכים ישראליים נכתבים בפורמט יום/חודש/שנה. לדוגמה: 03/04/2026 פירושו 3 באפריל 2026, ולא 4 במרץ. יש להחזיר את התאריך בפורמט YYYY-MM-DD.
- "סה״כ לתשלום" או "סה״כ כולל מע״מ" הם amount_total (הסכום הכולל).
- "סה״כ לפני מע״מ" או "סכום ביניים" הם amount_before_vat.
- אם מצוין במסמך "עוסק פטור", "ללא מע״מ" או פטור ממע״מ, החזירי vat_rate=0, vat_amount=0 ו-amount_before_vat=amount_total. אין לחשב מע״מ לאחור במקרה זה.
- אם במסמך מופיע רק הסכום הכולל בלי פירוט מע״מ ואין בו ציון פטור או ללא מע״מ, יש לחשב לאחור לפי שיעור מע״מ של 18%: amount_before_vat = amount_total חלקי 1.18, ו-vat_amount = amount_total פחות amount_before_vat.
- אם מופיע הביטוי "חשבונית מס קבלה" — doc_type הוא invoice_tax_receipt.
- אם מופיע הביטוי "חשבונית עסקה" או "הצעת מחיר" — doc_type הוא invoice_offer. מסמך כזה אינו מזכה בקיזוז מע״מ.
- לעולם אל תמציאי ערך שאינו מופיע במסמך. אם שדה אינו ברור מהמסמך, החזירי null עבורו (כשמותר) וקבעי לו ציון confidence נמוך.
- החזירי את הנתונים אך ורק באמצעות הכלי extract_document_data, ללא טקסט חופשי נוסף.`;

export const USER_INSTRUCTION = "חלצי את הנתונים מהמסמך המצורף לפי ההנחיות שקיבלת.";

export const EXTRACTION_INPUT_SCHEMA: Anthropic.Tool.InputSchema = {
  type: "object",
  properties: {
    counterparty_name: {
      type: "string",
      description: "הצד שכנגד: בהוצאה שם הספק שהוציא את המסמך; בהכנסה שם הלקוח המופיע בשדה לכבוד, לקוח או מקבל השירות.",
    },
    business_number: {
      type: ["string", "null"],
      description: "מספר העסק של הצד שכנגד: ספק בהוצאה, לקוח בהכנסה; null אם אינו מופיע.",
    },
    doc_number: {
      type: ["string", "null"],
      description: "מספר החשבונית, הקבלה, או המסמך.",
    },
    doc_type: {
      type: "string",
      enum: ["invoice_tax", "invoice_tax_receipt", "receipt", "invoice_offer", "other"],
      description:
        "סוג המסמך: invoice_tax (חשבונית מס), invoice_tax_receipt (חשבונית מס-קבלה), receipt (קבלה), invoice_offer (חשבונית עסקה או הצעת מחיר), other (אחר).",
    },
    doc_date: {
      type: "string",
      format: "date",
      description: "תאריך המסמך בפורמט YYYY-MM-DD.",
    },
    currency: {
      type: "string",
      description: "המטבע של הסכומים במסמך. ברירת מחדל ILS.",
    },
    amount_before_vat: {
      type: "number",
      description: "הסכום לפני מע״מ.",
    },
    vat_amount: {
      type: "number",
      description: "סכום המע״מ.",
    },
    amount_total: {
      type: "number",
      description: "הסכום הכולל (כולל מע״מ).",
    },
    vat_rate: {
      type: "number",
      description: "שיעור המע״מ באחוזים, לדוגמה 18.",
    },
    confidence: {
      type: "object",
      description: "ציון ביטחון בין 0 ל-1 לכל אחד מהשדות המרכזיים.",
      properties: {
        counterparty_name: { type: "number" },
        doc_number: { type: "number" },
        doc_date: { type: "number" },
        amount_total: { type: "number" },
        doc_type: { type: "number" },
      },
      required: ["counterparty_name", "doc_number", "doc_date", "amount_total", "doc_type"],
      additionalProperties: false,
    },
    notes: {
      type: ["string", "null"],
      description: "הערה חופשית אם יש משהו חריג במסמך, אחרת null.",
    },
  },
  required: [
    "counterparty_name",
    "business_number",
    "doc_number",
    "doc_type",
    "doc_date",
    "currency",
    "amount_before_vat",
    "vat_amount",
    "amount_total",
    "vat_rate",
    "confidence",
    "notes",
  ],
  additionalProperties: false,
};

export const EXTRACTION_TOOL = {
  name: EXTRACTION_TOOL_NAME,
  description:
    "חילוץ נתונים מובנים ממסמך חשבונית, קבלה או הצעת מחיר בעברית עבור עוסק מורשה בישראל.",
  strict: true,
  input_schema: EXTRACTION_INPUT_SCHEMA,
};

export function extractionInstruction(direction: "income" | "expense"): string {
  return `${USER_INSTRUCTION} סוג התנועה: ${direction === "income" ? "הכנסה — חלצי את שם הלקוח, ולא את שם העסק המנפיק או מקבל התשלום." : "הוצאה — חלצי את שם הספק שהנפיק את המסמך."}`;
}
