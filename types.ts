
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

// Updated ITP Data Schema
export interface ITPData {
    itpNo: string;
    location: string;
    inspectorName: string;
    itpEndDate: string;
    revision: string;
    itpBudget: string;
    designation: string;
    duration: string;
    rate: string;
    otRate: string;
    poNumber: string;
}

// General Parser Data Schema
export interface GeneralDocData {
  document_type: string;
  summary: string;
  // We use a flat structure for the 'data' to allow dynamic fields,
  // but in the raw API response we might use key-value pairs.
  // The UI will transform this into a flat object Record<string, any>
  dynamic_fields: Record<string, string | number>;
}

// Rate Manager Types
export interface RateItem {
  id?: string;
  reference_no: string;
  description: string;
  unit: string;
  rate: number;
  ot_rate: number;
  currency: string;
}

// --- Self-Learning / Training Types ---

export type ProcessingStatus = 'pending' | 'verified' | 'needs_review';

// Updated Module IDs for the system
export type ModuleId = 
  | 'invoice' 
  | 'po' 
  | 'timesheet' 
  | 'reconciliation' 
  | 'general' 
  | 'qp' 
  | 'itp' 
  | 'rates' 
  | 'templates' 
  | 'cost' 
  | 'admin'
  // Specific parser IDs used in training/learning engine
  | 'invoice_summary'
  | 'itp_parser'
  | 'qp_report'
  | 'general_parser';

export interface TrainingExample {
  id: string;
  module_id: ModuleId | string;
  input_context: string; // The raw text/content used for extraction
  output_json: any;      // The human-verified correct JSON
  user_id?: string;
  created_at?: string;
}

// Confidence wrapper for AI results
export type ConfidenceAwareResult<T> = {
  data: T;
  confidence_scores: Record<string, number>; // Flexible key type for dynamic fields
  average_confidence: number;
  extracted_text?: string; // The raw text extracted, used for training context
};

// --- Authentication Types ---

export interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'user';
  monthly_limit: number;
  current_usage: number;
  allowed_modules: string[];
}
