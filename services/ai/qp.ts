
import { Type, Schema } from "@google/genai";
import { QPReportData, ConfidenceAwareResult } from "../../types";
import { ai, trackCost, parseJSON, DEFAULT_MODEL } from "./utils";
import { LearningEngine } from "./LearningEngine";

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

// Wrapper schema to include confidence scores and training context
const QP_CONTAINER_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    data: QP_REPORT_SCHEMA,
    confidence_scores: {
      type: Type.OBJECT,
      properties: {
        vendor: { type: Type.NUMBER },
        country: { type: Type.NUMBER },
        date_start: { type: Type.NUMBER },
        date_end: { type: Type.NUMBER },
        designation: { type: Type.NUMBER },
        travel: { type: Type.NUMBER },
        hours: { type: Type.NUMBER },
        distance: { type: Type.NUMBER }
      }
    },
    extracted_text: {
      type: Type.STRING,
      description: "A raw text summary of the relevant parts of the document used for extraction. This will be used for future training."
    }
  },
  required: ["data", "confidence_scores", "extracted_text"]
};

export const parseQPReport = async (base64Data: string, mimeType: string): Promise<ConfidenceAwareResult<QPReportData>> => {
    try {
        const basePrompt = `Role: You are a highly accurate Document Extraction Specialist specializing in industrial inspection reports.

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

IMPORTANT:
- You must return 'confidence_scores' (0.0 to 1.0) for every field based on how clearly it was visible or matched.
- You must return 'extracted_text' containing the raw text segments you used to make these decisions.
`;

        // Inject past learnings
        const adaptivePrompt = await LearningEngine.buildAdaptivePrompt('qp_report', basePrompt);

        const response = await ai.models.generateContent({
            model: DEFAULT_MODEL,
            contents: {
                role: 'user',
                parts: [
                    { inlineData: { data: base64Data, mimeType: mimeType } },
                    { text: adaptivePrompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: QP_CONTAINER_SCHEMA,
                temperature: 0.1,
            }
        });

        trackCost('qp_report', DEFAULT_MODEL, response.usageMetadata);

        const result = parseJSON(response.text);
        
        // Calculate average confidence
        const scores = Object.values(result.confidence_scores) as number[];
        const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

        return {
            data: result.data,
            confidence_scores: result.confidence_scores,
            average_confidence: avg,
            extracted_text: result.extracted_text
        };

    } catch (error) {
        console.error("QP Report Parse Error:", error);
        throw error;
    }
};
