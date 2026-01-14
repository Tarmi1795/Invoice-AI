
import { ModuleId } from "../../types";
import { getLearningExamples } from "../supabaseClient";

export class LearningEngine {
  /**
   * Fetches past verified examples and injects them into the system prompt.
   * This creates a "Few-Shot" learning context tailored to the module.
   */
  static async buildAdaptivePrompt(
    moduleId: ModuleId,
    baseSystemPrompt: string
  ): Promise<string> {
    try {
      const examples = await getLearningExamples(moduleId, 3);

      if (!examples || examples.length === 0) {
        return baseSystemPrompt;
      }

      let learningContext = `\n\n### REFERENCE EXAMPLES (LEARN FROM THESE CORRECTED PATTERNS):\n`;
      learningContext += `Use the following Input -> Output examples to understand how to handle specific edge cases or formatting quirks.\n`;
      
      examples.forEach((ex, idx) => {
        // Truncate input if it's massive to save tokens, though generally we want enough context
        const safeInput = ex.input_context.length > 1000 ? ex.input_context.substring(0, 1000) + "...(truncated)" : ex.input_context;
        
        learningContext += `\n--- EXAMPLE ${idx + 1} ---\n`;
        learningContext += `INPUT TEXT CONTEXT:\n${safeInput}\n`;
        learningContext += `CORRECT OUTPUT JSON:\n${JSON.stringify(ex.output_json, null, 2)}\n`;
      });
      learningContext += `\n--------------------------------\n`;

      return `${baseSystemPrompt}${learningContext}`;
    } catch (error) {
      console.warn("Learning Engine failed to build adaptive prompt, falling back to base.", error);
      return baseSystemPrompt;
    }
  }
}
