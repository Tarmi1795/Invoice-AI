
import { Type, Schema } from "@google/genai";
import { QPReportData } from "../../types";
import { ai, trackCost, parseJSON, DEFAULT_MODEL } from "./utils";

const QP_REPORT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    vendor: { type: Type.STRING },
    country: { type: Type.STRING },
    date_start: { type: Type.STRING },
    date_end: { type: Type.STRING },
    designation: { type: Type.STRING },
    travel: { type: Type.STRING },
    hours: { type: Type.STRING },
    distance: { type: Type.STRING }
  },
  required: ["vendor", "country", "date_start", "date_end", "designation", "travel", "hours", "distance"]
};

export const parseQPReport = async (base64Data: string, mimeType: string): Promise<QPReportData> => {
    try {
        const prompt = `Role: You are a highly accurate Document Extraction Specialist specializing in industrial inspection reports.

TASK: Extract specific metadata and logistics data from the provided Third-Party Inspection (TPI) report.

EXTRACTION LOGIC & RULES:
1. Vendor: Identify the sub-supplier or manufacturer. This is usually found under "VENDOR/LOCATION" on Page 1 or "SUB-SUPPLIER/S" on Page 2.
2. Country: Extract the country name from the Vendor Location field (e.g., Malaysia, UK, Japan).
3. Inspection date start/end: 
   - Look at the "DATE OF VISIT" field.
   - If a single date is listed (e.g., 02.10.2025), both start and end are that date.
   - If multiple dates or a range are listed (e.g., 11.12.2025 & 12.12.2025), assign the first to "start" and the last to "end".
4. Inspector Designation: Find the "INSPECTED BY" section (usually at the bottom of Page 2). Extract the designation in parentheses, such as "Sr. Inspection Engineer-AS".
5. Travel, Hours, Distance: These are found in the "INSPECTION DETAILS" table on Page 2.
   - Capture "TRAVEL(TO/FROM)" exactly as written.
   - Capture "INSPECTION HOURS" including units (e.g., 5 Hrs, 8 hours x 2 Days).
   - Capture "TOTAL DISTANCE" including units (e.g., 78 kms, 354 Kms x 2 Days).

Output as JSON.`;

        const response = await ai.models.generateContent({
            model: DEFAULT_MODEL,
            contents: {
                role: 'user',
                parts: [
                    { inlineData: { data: base64Data, mimeType: mimeType } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: QP_REPORT_SCHEMA,
                temperature: 0.1,
            }
        });

        trackCost('qp_report', DEFAULT_MODEL, response.usageMetadata);

        return parseJSON(response.text);

    } catch (error) {
        console.error("QP Report Parse Error:", error);
        throw error;
    }
};
