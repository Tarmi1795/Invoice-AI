
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
  currency?: string; // Added for template defaults
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
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
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

export interface UsageLog {
  id?: string;
  created_at?: string;
  module: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost: number;
}

// Reconciliation Types
export interface ReconItem {
  date: string;
  description: string;
  amount: number;
  reference?: string;
  reason?: string; // For mismatches
}

export interface ReconResult {
  summary: {
    total_records_file_a: number;
    total_records_file_b: number;
    total_unmatched_a: number;
    total_unmatched_b: number;
    total_mismatched_amounts: number;
  };
  unmatched_in_a: ReconItem[];
  unmatched_in_b: ReconItem[];
  amount_mismatches: Array<{
    item_a: ReconItem;
    item_b: ReconItem;
    variance: number;
  }>;
  matches: ReconItem[];
}

export interface QPReportData {
  vendor: string;
  country: string;
  date_start: string;
  date_end: string;
  designation: string;
  travel: string;
  hours: string;
  distance: string;
}
