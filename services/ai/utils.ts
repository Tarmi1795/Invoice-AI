
import { GoogleGenAI } from "@google/genai";
import { logUsage, getUserProfile, supabase } from "../supabaseClient";

// Initialize the shared client
export const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
export const DEFAULT_MODEL = 'gemini-3-flash-preview';

// Pricing Constants (per 1M tokens) - Based on Gemini Flash
const PRICE_INPUT_PER_1M = 0.075;
const PRICE_OUTPUT_PER_1M = 0.30;

export const checkUsageLimit = async (): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Allow anon if not enforced, or handle in UI

    const profile = await getUserProfile(user.id);
    if (profile) {
        if (profile.current_usage >= profile.monthly_limit) {
            throw new Error(`Monthly budget limit reached ($${profile.monthly_limit.toFixed(2)}). Please contact admin.`);
        }
    }
};

export const trackCost = (moduleName: string, model: string, usage: any) => {
    if (!usage) return;
    const input = usage.promptTokenCount || 0;
    const output = usage.candidatesTokenCount || 0;
    
    const cost = (input / 1_000_000 * PRICE_INPUT_PER_1M) + 
                 (output / 1_000_000 * PRICE_OUTPUT_PER_1M);

    logUsage({
        module: moduleName,
        model: model,
        input_tokens: input,
        output_tokens: output,
        cost: cost
    });
};

export const parseJSON = (text?: string) => {
    if (!text) throw new Error("No response text received from Gemini.");
    const cleaned = text.trim().replace(/^```(json)?/, "").replace(/```$/, "").trim();
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        console.error("JSON Parse Error. Raw Text:", text);
        throw new Error("Failed to parse AI response. The document might be too large or the output was truncated.");
    }
};
