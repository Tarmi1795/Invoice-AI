
export interface SummaryLine {
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  total: number;
  lineText: string;
}

export interface InvoiceMetadata {
  documentTitle?: string; // e.g. "Pro forma invoice:" or "Tax Invoice"
  vendorName?: string;
  vendorAddress?: string;
  vendorPhone?: string;
  vendorFax?: string;
  vendorEmail?: string;
  clientName?: string;
  clientAddress?: string;
  invoiceNumber?: string;
  date?: string;
  clientRef?: string;
  contractNo?: string;
  projectName?: string;
  scopeOfWork?: string;
  paymentTerms?: string;
  // New fields
  workOrder?: string;
  department?: string;
  ourReference?: string;
}

export interface BankDetails {
  accountName?: string;
  bankName?: string;
  branch?: string;
  accountNo?: string;
  swiftCode?: string;
  ibanQar?: string;
  ibanUsd?: string;
  currency?: string;
}

export interface ElementStyle {
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  align?: 'left' | 'center' | 'right';
  backgroundColor?: string;
  color?: string;
}

export type ElementType = 'image' | 'text' | 'box' | 'table';

export interface TemplateElement {
  id: string;
  type: ElementType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  binding?: string;
  style?: ElementStyle;
}

export interface InvoiceData {
  metadata?: InvoiceMetadata;
  summary: SummaryLine[];
  grandTotal: number;
  currency: string;
  bankDetails?: BankDetails;
  originalFileName?: string;
  layout?: string[]; // Array of section keys defining order
  elements?: TemplateElement[];
}

export interface ProcessingState {
  status: 'idle' | 'processing' | 'success' | 'error';
  message?: string;
}

export interface TemplateData {
  id?: string;
  name: string;
  metadata: Partial<InvoiceMetadata>;
  bankDetails: Partial<BankDetails>;
  layout?: string[]; // e.g. ['header', 'vendor', 'client', 'lines', 'bank', 'footer']
  elements?: TemplateElement[];
}
