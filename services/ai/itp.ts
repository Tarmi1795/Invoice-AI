
import { Type, Schema } from "@google/genai";
import { ai, trackCost, parseJSON, DEFAULT_MODEL } from "./utils";
import { LearningEngine } from "./LearningEngine";
import { ConfidenceAwareResult } from "../../types";

const ITP_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          reference: { type: Type.STRING, description: "ITP Reference or Item No" },
          activity: { type: Type.STRING, description: "Description of activity or inspection" },
          date: { type: Type.STRING },
          status: { type: Type.STRING, description: "Status or Result (e.g. Accepted)" }
        }
      }
    }
  }
};

const CONTAINER_SCHEMA: Schema = {
    type: Type.OBJECT,
    properties: {
        data: ITP_SCHEMA,
        confidence_scores: {
            type: Type.OBJECT,
            properties: {
                overall_accuracy: { type: Type.NUMBER }
            }
        },
        extracted_text: { type: Type.STRING, description: "Raw text of the ITP table region." }
    }
};

export interface ITPData {
    items: Array<{
        reference: string;
        activity: string;
        date: string;
        status: string;
    }>
}

export const parseITP = async (base64Data: string, mimeType: string): Promise<ConfidenceAwareResult<ITPData>> => {
  try {
    const basePrompt = `You are an Inspection Engineer AI. Parse this ITP (Inspection Test Plan) or Inspection Report. Extract all inspection activities, dates, references, and statuses into a list.
    
    Return 'extracted_text' containing the raw text segments you used for future training.
    Return 'confidence_scores' with an 'overall_accuracy' estimate (0-1).`;

    const adaptivePrompt = await LearningEngine.buildAdaptivePrompt('itp_parser', basePrompt);

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: {
        role: 'user',
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: adaptivePrompt },
        ],
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
        confidence_scores: result.confidence_scores,
        average_confidence: result.confidence_scores?.overall_accuracy || 0.8,
        extracted_text: result.extracted_text
    };

  } catch (error) {
    console.error("ITP Processing Error:", error);
    throw error;
  }
};
