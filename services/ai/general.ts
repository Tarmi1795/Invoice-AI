
import { Type, Schema } from "@google/genai";
import { ai, trackCost, parseJSON, DEFAULT_MODEL } from "./utils";
import { LearningEngine } from "./LearningEngine";
import { ConfidenceAwareResult, GeneralDocData } from "../../types";

// We use an array of Key-Value pairs to allow dynamic schema extraction
// because 'Type.OBJECT' usually requires predefined properties in the strict schema.
const KEY_VALUE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    key: { type: Type.STRING, description: "The name of the field (e.g., 'Invoice Date', 'Total Amount', 'Vendor')" },
    value: { type: Type.STRING, description: "The extracted value" },
    confidence: { type: Type.NUMBER, description: "Confidence score 0.0-1.0" }
  },
  required: ["key", "value", "confidence"]
};

const GENERAL_DOC_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    document_type: { 
      type: Type.STRING, 
      description: "Classify the document (e.g., 'Invoice', 'Receipt', 'Purchase Order', 'Timesheet', 'ID Card', 'Contract')" 
    },
    summary: { 
      type: Type.STRING, 
      description: "A short 1-sentence summary of what this document is." 
    },
    extracted_fields: {
      type: Type.ARRAY,
      items: KEY_VALUE_SCHEMA,
      description: "List of all relevant fields extracted from the document."
    },
    extracted_text_context: {
      type: Type.STRING,
      description: "Raw text summary of the document used for extraction (for training)."
    }
  },
  required: ["document_type", "summary", "extracted_fields", "extracted_text_context"]
};

export const processGeneralDocument = async (base64Data: string, mimeType: string): Promise<ConfidenceAwareResult<GeneralDocData>> => {
  try {
    const basePrompt = `Role: Universal Document Parser.
    
    TASK:
    1. Analyze the image/PDF.
    2. Classify the Document Type (e.g., Invoice, Receipt, PO, Certificate, etc.).
    3. Extract ALL relevant metadata fields dynamically. 
       - For Invoices/Receipts: Extract Vendor, Date, Total, Tax, Invoice #.
       - For POs: Extract PO #, Vendor, Buyer, Total.
       - For ID Cards: Extract Name, ID Number, DOB.
       - For Technical Reports: Extract Report #, Date, Subject.
    4. Normalize keys (e.g., use "Total Amount" instead of "Grand Total" or "Total Due").
    5. Return confidence scores for each extracted field.
    `;

    // Inject past learnings
    const adaptivePrompt = await LearningEngine.buildAdaptivePrompt('general_parser', basePrompt);

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
        responseSchema: GENERAL_DOC_SCHEMA,
        temperature: 0.1,
      }
    });

    trackCost('general_parser', DEFAULT_MODEL, response.usageMetadata);

    const rawResult = parseJSON(response.text);

    // Transform the Key-Value array back into a flat object for the App's logic
    const dynamicFields: Record<string, string | number> = {};
    const confidenceScores: Record<string, number> = {};
    let totalConfidence = 0;
    let count = 0;

    if (rawResult.extracted_fields && Array.isArray(rawResult.extracted_fields)) {
        rawResult.extracted_fields.forEach((item: any) => {
            const key = item.key;
            // Clean up keys to be CSV friendly (remove newlines, keep simple)
            const cleanKey = key.trim().replace(/\s+/g, '_').toLowerCase();
            dynamicFields[cleanKey] = item.value;
            confidenceScores[cleanKey] = item.confidence || 0.5;
            
            totalConfidence += item.confidence || 0;
            count++;
        });
    }

    const data: GeneralDocData = {
        document_type: rawResult.document_type || 'Unknown',
        summary: rawResult.summary || '',
        dynamic_fields: dynamicFields
    };

    return {
        data,
        confidence_scores: { 
            ...confidenceScores, 
            document_type: 0.95 // Inherently high if it processed
        },
        average_confidence: count > 0 ? totalConfidence / count : 0.8,
        extracted_text: rawResult.extracted_text_context
    };

  } catch (error) {
    console.error("General Parser Error:", error);
    throw error;
  }
};
