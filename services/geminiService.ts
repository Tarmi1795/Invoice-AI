
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { InvoiceData, ReconResult, QPReportData } from "../types";
import { logUsage } from "./supabaseClient";

// Initialize the client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Pricing Constants (per 1M tokens) - Based on Gemini Flash
const PRICE_INPUT_PER_1M = 0.075;
const PRICE_OUTPUT_PER_1M = 0.30;

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
        ourReference: { type: Type.STRING }
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

// Generic Schema for ITP Parsing (simpler)
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

// Reconciliation Schema
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

type DocType = 'invoice' | 'po' | 'timesheet' | 'itp';

export const processDocument = async (base64Data: string, mimeType: string, type: DocType): Promise<any> => {
  try {
    const modelId = 'gemini-3-flash-preview';
    let prompt = "";
    let schema = INVOICE_SCHEMA;

    if (type === 'invoice') {
        prompt = `You are an expert Invoice Auditor AI. 
        
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

        4. Format everything as JSON.`;
    } else if (type === 'po') {
        prompt = `You are a Procurement AI. Analyze this PO and convert to PROFORMA INVOICE data. Vendor=Supplier, Client=Buyer. Total match PO Total.`;
    } else if (type === 'timesheet') {
        prompt = `You are a Payroll AI. Analyze this Timesheet and generate INVOICE data. Line Items = calculated total hours/days per person.`;
    } else if (type === 'itp') {
        prompt = `You are an Inspection Engineer AI. Parse this ITP (Inspection Test Plan) or Inspection Report. Extract all inspection activities, dates, references, and statuses into a list.`;
        schema = ITP_SCHEMA;
    }

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        role: 'user',
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.1,
        maxOutputTokens: 20000, 
      },
    });

    // --- Usage Tracking ---
    if (response.usageMetadata) {
        const inputTokens = response.usageMetadata.promptTokenCount || 0;
        const outputTokens = response.usageMetadata.candidatesTokenCount || 0;
        
        const cost = (inputTokens / 1_000_000 * PRICE_INPUT_PER_1M) + 
                     (outputTokens / 1_000_000 * PRICE_OUTPUT_PER_1M);

        logUsage({
            module: type,
            model: modelId,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cost: cost
        });
    }
    // ----------------------

    let text = response.text;
    if (!text) throw new Error("No response text received from Gemini.");

    text = text.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(json)?/, "").replace(/```$/, "").trim();
    }

    try {
        return JSON.parse(text);
    } catch (parseError) {
        console.error("JSON Parse Error. Raw Text:", text);
        throw new Error("Failed to parse AI response. The document might be too large or the output was truncated.");
    }

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const reconcileDocuments = async (fileA: {data: string, type: string}, fileB: {data: string, type: string}): Promise<ReconResult> => {
    try {
        const modelId = 'gemini-3-flash-preview';
        
        const prompt = `You are an expert Forensic Accountant AI.
        
        TASK:
        Compare the transactions in FILE A against FILE B.
        
        RULES:
        1. Extract all financial transactions (Date, Description, Amount) from both files.
        2. Match transactions based on AMOUNT (exact matches or very close tolerance +/- 0.05).
        3. Secondary matching on Date (approximate match allowed) and Description (fuzzy match).
        4. Identify items that appear in File A but are MISSING in File B ("unmatched_in_a").
        5. Identify items that clearly correspond to each other (similar description/date) but have different amounts ("amount_mismatches").
        7. List all perfect matches ("matches").
        
        Output strictly in the requested JSON schema.`;

        const response = await ai.models.generateContent({
            model: modelId,
            contents: {
                role: 'user',
                parts: [
                    { text: "Here is FILE A:" },
                    { inlineData: { data: fileA.data, mimeType: fileA.type } },
                    { text: "Here is FILE B:" },
                    { inlineData: { data: fileB.data, mimeType: fileB.type } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: RECON_SCHEMA,
                temperature: 0.1,
                maxOutputTokens: 20000,
            }
        });

        // --- Usage Tracking ---
        if (response.usageMetadata) {
            const inputTokens = response.usageMetadata.promptTokenCount || 0;
            const outputTokens = response.usageMetadata.candidatesTokenCount || 0;
            
            const cost = (inputTokens / 1_000_000 * PRICE_INPUT_PER_1M) + 
                         (outputTokens / 1_000_000 * PRICE_OUTPUT_PER_1M);

            logUsage({
                module: 'reconciliation',
                model: modelId,
                input_tokens: inputTokens,
                output_tokens: outputTokens,
                cost: cost
            });
        }

        let text = response.text;
        if (!text) throw new Error("No response text received from Gemini.");
        text = text.trim();
        if (text.startsWith("```")) {
            text = text.replace(/^```(json)?/, "").replace(/```$/, "").trim();
        }

        return JSON.parse(text);

    } catch (error) {
        console.error("Reconciliation Error:", error);
        throw error;
    }
};

export const parseQPReport = async (base64Data: string, mimeType: string): Promise<QPReportData> => {
    try {
        const modelId = 'gemini-3-flash-preview';

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
            model: modelId,
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

        // --- Usage Tracking ---
        if (response.usageMetadata) {
            const inputTokens = response.usageMetadata.promptTokenCount || 0;
            const outputTokens = response.usageMetadata.candidatesTokenCount || 0;
            const cost = (inputTokens / 1_000_000 * PRICE_INPUT_PER_1M) + 
                         (outputTokens / 1_000_000 * PRICE_OUTPUT_PER_1M);
            logUsage({
                module: 'qp_report',
                model: modelId,
                input_tokens: inputTokens,
                output_tokens: outputTokens,
                cost: cost
            });
        }

        let text = response.text;
        if (!text) throw new Error("No response from Gemini");
        text = text.trim();
        if (text.startsWith("```")) {
            text = text.replace(/^```(json)?/, "").replace(/```$/, "").trim();
        }

        return JSON.parse(text);

    } catch (error) {
        console.error("QP Report Parse Error:", error);
        throw error;
    }
};
