
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { InvoiceData } from "../types";

// Initialize the client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
        clientRef: { type: Type.STRING },
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
      },
    });

    let text = response.text;
    if (!text) throw new Error("No response text received from Gemini.");

    text = text.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(json)?/, "").replace(/```$/, "").trim();
    }

    return JSON.parse(text);

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
