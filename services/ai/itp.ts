
import { Type, Schema } from "@google/genai";
import { ai, trackCost, parseJSON, DEFAULT_MODEL } from "./utils";
import { LearningEngine } from "./LearningEngine";
import { ConfidenceAwareResult, ITPData } from "../../types";

// Schema is relaxed (not all fields required) to ensure we get partial data instead of failure.
const ITP_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    itpNo: { type: Type.STRING },
    location: { type: Type.STRING },
    inspectorName: { type: Type.STRING },
    itpEndDate: { type: Type.STRING },
    revision: { type: Type.STRING },
    itpBudget: { type: Type.STRING },
    designation: { type: Type.STRING },
    duration: { type: Type.STRING },
    rate: { type: Type.STRING },
    otRate: { type: Type.STRING },
    poNumber: { type: Type.STRING },
  },
  // Removed strict requirements so one missing field doesn't break the whole parser
  required: ["itpNo"] 
};

const CONTAINER_SCHEMA: Schema = {
    type: Type.OBJECT,
    properties: {
        data: ITP_SCHEMA,
        confidence_scores: {
            type: Type.OBJECT,
            properties: {
                itpNo: { type: Type.NUMBER },
                inspectorName: { type: Type.NUMBER },
                rate: { type: Type.NUMBER },
                overall: { type: Type.NUMBER }
            }
        },
        extracted_text: { type: Type.STRING, description: "Raw text context used for extraction." }
    }
};

export const parseITP = async (input: string, mimeType?: string): Promise<ConfidenceAwareResult<ITPData>> => {
  try {
    const basePrompt = `Analyze the ITP document (Instruction to Proceed) and extract contract details.

KEY EXTRACTION RULES:
- **ITP No**: Look for "INSTRUCTION TO PROCEED NO.:", "ITP No", or "Reference" at the top.
- **LOCATION**: Look for "Delivery Place", "Work Location", or "Services Location".
- **INSPECTOR**: Look for "Attn:", "Inspector Name", "Short Description", or person names listed in the item table.
- **ITP End Date**: Look for "Completion Date", "Valid until", or "End Date".
- **Revision**: Look for "Revision", "Rev", or the suffix of the ITP number.
- **Designation**: Look for "ITP Title", "Item Description", "Short Description" (e.g. "Senior Welding Inspector").
- **Rate**: Look for "Unit Rate", "Daily Rate", "Hourly Rate". If the rate column is empty, look for text like "Rate as per contract" or check for a total amount divided by quantity. If unknown, return "0".
- **PO#**: Look for "Contract Reference", "SAP Account Code", "Purchase Order", or "Contract No".

If a field is visually missing or blank, return an empty string or "0". Do not hallucinate values.`;

    const adaptivePrompt = await LearningEngine.buildAdaptivePrompt('itp_parser', basePrompt);

    const parts: any[] = [];
    if (mimeType) {
        // Multimodal input (base64 image/pdf) - PREFERRED
        parts.push({ inlineData: { data: input, mimeType: mimeType } });
        parts.push({ text: adaptivePrompt });
    } else {
        // Text-only input (fallback)
        parts.push({ text: "Here is the document text content:" });
        parts.push({ text: input });
        parts.push({ text: adaptivePrompt });
    }

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: {
        role: 'user',
        parts: parts,
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: CONTAINER_SCHEMA,
        temperature: 0.1,
        maxOutputTokens: 20000, 
      },
    });

    trackCost('itp_parser', DEFAULT_MODEL, response.usageMetadata);

    const result = parseJSON(response.text);

    return {
        data: result.data,
        confidence_scores: result.confidence_scores || {},
        average_confidence: result.confidence_scores?.overall || 0.85,
        extracted_text: result.extracted_text
    };

  } catch (error) {
    console.error("ITP Processing Error:", error);
    throw error;
  }
};
