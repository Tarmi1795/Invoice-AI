
import { Type, Schema } from "@google/genai";
import { InvoiceData, ConfidenceAwareResult } from "../../types";
import { ai, trackCost, parseJSON, DEFAULT_MODEL, checkUsageLimit } from "./utils";
import { LearningEngine } from "./LearningEngine";

const INVOICE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    metadata: {
      type: Type.OBJECT,
      description: "Header information extracted from the document",
      properties: {
        vendorName: { type: Type.STRING, description: "Company issuing the invoice/PO" },
        vendorAddress: { type: Type.STRING },
        vendorPhone: { type: Type.STRING },
        vendorFax: { type: Type.STRING },
        vendorEmail: { type: Type.STRING },
        clientName: { type: Type.STRING, description: "Client/Buyer name" },
        clientAddress: { type: Type.STRING },
        invoiceNumber: { type: Type.STRING, description: "Invoice number or PO Number" },
        date: { type: Type.STRING },
        clientRef: { type: Type.STRING, description: "Client Reference or ITP Number" },
        contractNo: { type: Type.STRING },
        projectName: { type: Type.STRING },
        scopeOfWork: { type: Type.STRING },
        paymentTerms: { type: Type.STRING },
        workOrder: { type: Type.STRING },
        department: { type: Type.STRING },
        ourReference: { type: Type.STRING },
        currency: { type: Type.STRING }
      }
    },
    summary: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          quantity: { type: Type.NUMBER },
          unit: { type: Type.STRING },
          rate: { type: Type.NUMBER },
          total: { type: Type.NUMBER },
          lineText: { type: Type.STRING }
        },
        required: ["description", "quantity", "unit", "rate", "total", "lineText"]
      }
    },
    bankDetails: {
      type: Type.OBJECT,
      properties: {
        accountName: { type: Type.STRING },
        bankName: { type: Type.STRING },
        branch: { type: Type.STRING },
        accountNo: { type: Type.STRING },
        swiftCode: { type: Type.STRING },
        ibanQar: { type: Type.STRING },
        ibanUsd: { type: Type.STRING },
        currency: { type: Type.STRING }
      }
    },
    grandTotal: { type: Type.NUMBER },
    currency: { type: Type.STRING }
  },
  required: ["summary", "grandTotal", "currency"]
};

// Container Schema for Confidence & Training Data
const CONTAINER_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    data: INVOICE_SCHEMA,
    confidence_scores: {
      type: Type.OBJECT,
      description: "Confidence scores (0.0 - 1.0) for key metadata fields",
      properties: {
        vendorName: { type: Type.NUMBER },
        clientName: { type: Type.NUMBER },
        invoiceNumber: { type: Type.NUMBER },
        date: { type: Type.NUMBER },
        grandTotal: { type: Type.NUMBER }
      }
    },
    extracted_text: {
      type: Type.STRING,
      description: "A summary of the raw text from the document header/footer used to extract metadata. Do not include the full line item table text, just the context."
    }
  },
  required: ["data", "confidence_scores", "extracted_text"]
};

export type FinancialDocType = 'invoice' | 'po' | 'timesheet';

export const processFinancialDocument = async (base64Data: string, mimeType: string, type: FinancialDocType): Promise<ConfidenceAwareResult<InvoiceData>> => {
  try {
    // Check Limits
    await checkUsageLimit();

    let basePrompt = "";

    if (type === 'invoice') {
        basePrompt = `You are an expert Invoice Auditor AI. 
        
        TASK:
        1. Analyze the invoice PDF/Image.
        2. Extract Metadata (Vendor, Client, References, etc).
        3. Extract Bank Details.
        
        CRITICAL - LINE ITEM SUMMARIZATION:
        - Do NOT list every single daily entry (e.g. "01-11-2025 ...", "02-11-2025 ...").
        - You MUST GROUP and SUMMARIZE line items by Description/Person/Role and Rate.
        - Calculate the Total Quantity (Sum of days/hours) for each group.
        
        Example Input: 
        "01 Nov - John Doe - 1 Day - $100"
        "02 Nov - John Doe - 1 Day - $100"
        
        Example Output Summary:
        Description: "John Doe - Inspection Services (Nov 2025)"
        Quantity: 2
        Unit: "Day"
        Rate: 100
        Total: 200

        4. Provide confidence scores for the main metadata fields.
        5. Provide 'extracted_text' containing the raw header/metadata text for future training.`;
    } else if (type === 'po') {
        basePrompt = `You are a Procurement AI. Analyze this PO and convert to PROFORMA INVOICE data. Vendor=Supplier, Client=Buyer. Total match PO Total. Provide confidence scores.`;
    } else if (type === 'timesheet') {
        basePrompt = `You are a Payroll AI. Analyze this Timesheet and generate INVOICE data. Line Items = calculated total hours/days per person. Provide confidence scores.`;
    }

    // Inject Learning
    const adaptivePrompt = await LearningEngine.buildAdaptivePrompt('invoice_summary', basePrompt);

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

    trackCost(type, DEFAULT_MODEL, response.usageMetadata);

    const result = parseJSON(response.text);

    // Calculate avg confidence
    const scores = Object.values(result.confidence_scores) as number[];
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    return {
        data: result.data,
        confidence_scores: result.confidence_scores,
        average_confidence: avg,
        extracted_text: result.extracted_text
    };

  } catch (error) {
    console.error("Financial Document Processing Error:", error);
    throw error;
  }
};
