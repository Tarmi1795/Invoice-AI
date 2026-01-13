
import { Type, Schema } from "@google/genai";
import { ai, trackCost, parseJSON, DEFAULT_MODEL } from "./utils";

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

export const parseITP = async (base64Data: string, mimeType: string): Promise<any> => {
  try {
    const prompt = `You are an Inspection Engineer AI. Parse this ITP (Inspection Test Plan) or Inspection Report. Extract all inspection activities, dates, references, and statuses into a list.`;

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: {
        role: 'user',
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: ITP_SCHEMA,
        temperature: 0.1,
        maxOutputTokens: 20000, 
      },
    });

    trackCost('itp_parser', DEFAULT_MODEL, response.usageMetadata);

    return parseJSON(response.text);

  } catch (error) {
    console.error("ITP Processing Error:", error);
    throw error;
  }
};
