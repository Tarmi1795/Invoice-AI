
import { Type, Schema } from "@google/genai";
import { ReconResult, ConfidenceAwareResult } from "../../types";
import { ai, trackCost, parseJSON, DEFAULT_MODEL } from "./utils";
import { LearningEngine } from "./LearningEngine";

const RECON_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.OBJECT,
      properties: {
        total_records_file_a: { type: Type.NUMBER },
        total_records_file_b: { type: Type.NUMBER },
        total_unmatched_a: { type: Type.NUMBER },
        total_unmatched_b: { type: Type.NUMBER },
        total_mismatched_amounts: { type: Type.NUMBER }
      }
    },
    unmatched_in_a: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING },
          description: { type: Type.STRING },
          amount: { type: Type.NUMBER },
          reference: { type: Type.STRING }
        }
      }
    },
    unmatched_in_b: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING },
          description: { type: Type.STRING },
          amount: { type: Type.NUMBER },
          reference: { type: Type.STRING }
        }
      }
    },
    amount_mismatches: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          item_a: {
             type: Type.OBJECT,
             properties: { date: {type: Type.STRING}, description: {type: Type.STRING}, amount: {type: Type.NUMBER} }
          },
          item_b: {
             type: Type.OBJECT,
             properties: { date: {type: Type.STRING}, description: {type: Type.STRING}, amount: {type: Type.NUMBER} }
          },
          variance: { type: Type.NUMBER }
        }
      }
    },
    matches: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            description: { type: Type.STRING },
            amount: { type: Type.NUMBER }
          }
        }
    }
  }
};

const CONTAINER_SCHEMA: Schema = {
    type: Type.OBJECT,
    properties: {
        data: RECON_SCHEMA,
        confidence_scores: {
            type: Type.OBJECT,
            properties: {
                match_accuracy: { type: Type.NUMBER }
            }
        },
        extracted_text: { type: Type.STRING, description: "A brief summary of the comparison strategy used." }
    }
};

export const reconcileDocuments = async (fileA: {data: string, type: string}, fileB: {data: string, type: string}): Promise<ConfidenceAwareResult<ReconResult>> => {
    try {
        const basePrompt = `You are an expert Forensic Accountant AI.
        
        TASK:
        Compare the transactions in FILE A against FILE B.
        
        RULES:
        1. Extract all financial transactions (Date, Description, Amount) from both files.
        2. Match transactions based on AMOUNT (exact matches or very close tolerance +/- 0.05).
        3. Secondary matching on Date (approximate match allowed) and Description (fuzzy match).
        4. Identify items that appear in File A but are MISSING in File B ("unmatched_in_a").
        5. Identify items that appear in File B but are MISSING in File A ("unmatched_in_b").
        6. Identify items that clearly correspond to each other (similar description/date) but have different amounts ("amount_mismatches").
        7. List all perfect matches ("matches").
        
        Output strictly in the requested JSON schema.`;

        const adaptivePrompt = await LearningEngine.buildAdaptivePrompt('reconciliation', basePrompt);

        const response = await ai.models.generateContent({
            model: DEFAULT_MODEL,
            contents: {
                role: 'user',
                parts: [
                    { text: "Here is FILE A:" },
                    { inlineData: { data: fileA.data, mimeType: fileA.type } },
                    { text: "Here is FILE B:" },
                    { inlineData: { data: fileB.data, mimeType: fileB.type } },
                    { text: adaptivePrompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: CONTAINER_SCHEMA,
                temperature: 0.1,
                maxOutputTokens: 20000,
            }
        });

        trackCost('reconciliation', DEFAULT_MODEL, response.usageMetadata);

        const result = parseJSON(response.text);

        return {
            data: result.data,
            confidence_scores: result.confidence_scores,
            average_confidence: result.confidence_scores?.match_accuracy || 0.85,
            extracted_text: result.extracted_text
        };

    } catch (error) {
        console.error("Reconciliation Error:", error);
        throw error;
    }
};
