
import { TemplateData, TemplateElement } from '../types';

// A4 at 96 DPI is approx 794px x 1123px
const PAGE_WIDTH = 794;

// Simple SVG placeholder converted to Base64 to ensure it always renders without network/CORS issues
const DEFAULT_LOGO_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAyCAYAAACqNX6+AAAACXBIWXMAAAsTAAALEwEAmpwYAAAFEElEQVR4nO2bXWwUVRTHf3d2W/pB+lGkFColFNoCgYJtUYkGokRjDD6o0cQHjT6Q6JMx+uCDRokPfTA+EOMGg6gJMWqMKVqg0hYCpS2lFCo/CqW0293ZnXFm2u52u9vubbczE/b/NJN7587s/Obec889M3cWERFqjZ7aDkC9I4UESZCGEiRBGo4WpL09j81bV9HZ2U5vb4i1a310dLTXdmw1xXCC9Pb2c+LEBWpra/n112sMD49QUxPgyJETtR1fTTCcIA0N39PfP0RdXQ1r1/oAuHbtOsPDwzUcYU0wnCCBQIBAIIBSipMnL3L+/E9EIhF8vrbajq8mGE6QlpZmbty4ycDAGJ9/3kFbWzOdnW21HVtNMZwgAN3dndzobOfrr3by22+j1Nf7azuummM4QRoaGti6tYfTp3/n6NE+enp6aWjw13ZsNcVwggB0d3dSVxeiv7+X3t5eWlu9tR1XzTGsIPF4nJ0795FMphgcHKCnp7O2Y6sphhWkqamJcDjMxYu/c+DAFtra2mo7tppjSEF27/6YkZERPvroA7q7u9m0qaG2Y6sxRBSklFJKqUQKJ51ASomU0pXv4+M/8tlnR9m/v5f+/l4CgcA/v4dCIQD27PmYcDjM6tU+Vq/2uXIeHx/nyy9P0d3dTUtLM01NTa78F0IIQfYdOM7o4H/ge5y8+ANgEASIRqOk02m3kywIIUT/gW8YHfzX1c1O/vIDYBAECAaDJJNJtxMshBCir2+I0cF/XN3s5M/fAQZBAP/q1cTjcbcTLIQQ4sCBI4wO/u3qZic//wAYBAG8q1YRi8XcTrAQQoj29nZG/7ns6mYnP/0AGAQBvCtXEo1G3U6wEEKItrY2RgevuLrZyY/fAQZBgMrKSqLRqNsJFkIIsWnTJkYHr7i62cn33wIGQQBvVRWRSMTtBAshhFi/fj2jgyOuDnbS9+1XwCAI4F2xglA47HaChRBCrFmzhtHBEVcHOznx9VeAQRDAu3w5oVDQ7QQLIYRYuXIlI4Mjrg528u2XgEEQwLtsGSFXE0wIIcTy5csZGRx2dbCTb74EDAIPXm8ZwWA1yWTS7SQLIYRYunQpI4PDrm528vXXgEHgwVNWRigUJJlMup1gIYQQS5YsYWRwJNfNTk68/BIwCDx4ysqIhoIkk0m3EyyEEEJ7vYwM/uPqZicn/ngJGAQePEuXEg0FSSaTbidYCCGE5/FlyC+XXN3s5PhLwCDw4CktJRYKkEwm3U6wEEIIz+LFWCcuuLrZyfGXgEHgwbNwIdFggGQy6XaChRBCeBctwvrlgqubnRx7CRgEHjz5+cQC1SQSjtsJCiGE8CxcSPKzC65udnLsRWAQePDk5xOrDpBMJtxOsBBCiMWLF5P87KKrm50cexEwCDx48vKIVQdIJpNuJ1gIIcTChQtJfnrR1c1Ovv4CMAg8eHJziFZWkEwm3U6wEEKI+fPnY31yoaubnRx9HhgEHjy5OcSqKkgmE24nWAghxLx580h+fMnVzU6+OgIYBB48uTnEqipIJBNuJ1gIIcScOXNIfnLF1c1OvvociP95N56cHGLVASSdcTdBCCGEt3AhyU8vuLrZyeEXgUHgwZOTQywYIJlMup1gIYQQc+bMIfnxZVcHf3L4BcAg8ODJzsYfCJBMJt1OsBBCCM/s2Vg/X3F18CeHXwQMAg+e7Gz8gQDJZNLtBAshhJg1axbJTy67OvjJkRcBg8CDJysLfzBAMpl0O8FCCCGSySSJRALo/xP0F5R8Pz1hJ+9rAAAAAElFTkSuQmCC";

export const DEFAULT_LAYOUT = ['header', 'vendor', 'client', 'lines', 'bank', 'footer'];

export const DEFAULT_ELEMENTS: TemplateElement[] = [
  // --- Header Area (Vendor) ---
  {
      id: 'el_logo_img',
      type: 'image',
      label: 'Logo',
      x: 630, y: 30, width: 120, height: 60,
      content: DEFAULT_LOGO_BASE64,
      style: { align: 'right' }
  },
  {
      id: 'el_vendor_info',
      type: 'text',
      label: 'Vendor Details',
      x: 40, y: 30, width: 500, height: 70,
      content: "VELOSI CERTIFICATION L.L.C.\nAhmad Bin Ali Business Cntr, 1st F. New Salata, C-Ring Road,\nP.O. Box: 3408, Doha, Qatar\nTel no (+) 44352850, Fax no (+) 44352819\nEmail: velosi@qatar.net.qa",
      style: { fontSize: 9, fontWeight: 'normal' }
  },

  // --- Document Title ---
  {
      id: 'el_doc_title',
      type: 'text',
      label: 'Document Title',
      x: 0, y: 110, width: PAGE_WIDTH, height: 30,
      content: 'Invoice:', // Static "Invoice:"
      style: { fontSize: 16, fontWeight: 'bold', align: 'center' }
  },

  // --- Client Box (Left) ---
  {
      id: 'el_client_box',
      type: 'box',
      label: 'Client Box',
      x: 40, y: 140, width: 340, height: 160,
      style: { backgroundColor: '#e5e5e5' } // Light gray background
  },
  {
      id: 'el_client_content',
      type: 'text',
      label: 'Client Details',
      x: 50, y: 150, width: 320, height: 140,
      binding: 'metadata.clientAddress', 
      style: { fontSize: 10 }
  },
  {
      id: 'el_client_name_overlay',
      type: 'text',
      label: 'Client Name',
      x: 50, y: 150, width: 320, height: 20,
      binding: 'metadata.clientName',
      style: { fontSize: 10, fontWeight: 'bold' }
  },

  // --- Metadata Box (Right) ---
  {
      id: 'el_meta_box',
      type: 'box',
      label: 'Metadata Box',
      x: 400, y: 140, width: 354, height: 160,
      style: { backgroundColor: '#e5e5e5' }
  },
  // Labels
  { id: 'lbl_doc', type: 'text', label: 'Lbl Doc', x: 410, y: 150, width: 100, height: 15, content: 'Document no:', style: { fontSize: 9, fontWeight: 'bold' } },
  { id: 'lbl_date', type: 'text', label: 'Lbl Date', x: 410, y: 165, width: 100, height: 15, content: 'Date:', style: { fontSize: 9, fontWeight: 'bold' } },
  { id: 'lbl_ref', type: 'text', label: 'Lbl Ref', x: 410, y: 180, width: 100, height: 15, content: 'Our Reference:', style: { fontSize: 9, fontWeight: 'bold' } },
  { id: 'lbl_wo', type: 'text', label: 'Lbl WO', x: 410, y: 195, width: 100, height: 15, content: 'Work order:', style: { fontSize: 9, fontWeight: 'bold' } },
  { id: 'lbl_cont', type: 'text', label: 'Lbl Contract', x: 410, y: 210, width: 100, height: 15, content: 'Contract Nº:', style: { fontSize: 9, fontWeight: 'bold' } },
  { id: 'lbl_proj', type: 'text', label: 'Lbl Proj', x: 410, y: 225, width: 100, height: 15, content: 'Project name:', style: { fontSize: 9, fontWeight: 'bold' } },
  { id: 'lbl_curr', type: 'text', label: 'Lbl Curr', x: 410, y: 240, width: 100, height: 15, content: 'Currency:', style: { fontSize: 9, fontWeight: 'bold' } },
  { id: 'lbl_dept', type: 'text', label: 'Lbl Dept', x: 410, y: 255, width: 100, height: 15, content: 'Department:', style: { fontSize: 9, fontWeight: 'bold' } },

  // Values
  { id: 'val_doc', type: 'text', label: 'Val Doc', x: 520, y: 150, width: 200, height: 15, binding: 'metadata.invoiceNumber', style: { fontSize: 9 } },
  { id: 'val_date', type: 'text', label: 'Val Date', x: 520, y: 165, width: 200, height: 15, binding: 'metadata.date', style: { fontSize: 9 } },
  { id: 'val_ref', type: 'text', label: 'Val Ref', x: 520, y: 180, width: 200, height: 15, binding: 'metadata.ourReference', style: { fontSize: 9 } },
  { id: 'val_wo', type: 'text', label: 'Val WO', x: 520, y: 195, width: 200, height: 15, binding: 'metadata.workOrder', style: { fontSize: 9 } },
  { id: 'val_cont', type: 'text', label: 'Val Contract', x: 520, y: 210, width: 200, height: 15, binding: 'metadata.contractNo', style: { fontSize: 9 } },
  { id: 'val_proj', type: 'text', label: 'Val Proj', x: 520, y: 225, width: 200, height: 15, binding: 'metadata.projectName', style: { fontSize: 9 } },
  { id: 'val_curr', type: 'text', label: 'Val Curr', x: 520, y: 240, width: 200, height: 15, binding: 'currency', style: { fontSize: 9 } },
  { id: 'val_dept', type: 'text', label: 'Val Dept', x: 520, y: 255, width: 200, height: 15, binding: 'metadata.department', style: { fontSize: 9 } },


  // --- Table ---
  {
      id: 'el_table',
      type: 'table',
      label: 'Line Items',
      x: 40, y: 320, width: 714, height: 350,
      style: { fontSize: 10 }
  },

  // --- Total in Words ---
  {
      id: 'el_words_box',
      type: 'box',
      label: 'Words Box',
      x: 40, y: 680, width: 714, height: 30,
      style: { backgroundColor: '#f0f0f0' }
  },
  {
      id: 'el_words',
      type: 'text',
      label: 'Amount in Words',
      x: 50, y: 685, width: 700, height: 20,
      binding: 'amountInWords',
      style: { fontSize: 10, fontWeight: 'bold' }
  },

  // --- Footer / Bank Details ---
  {
      id: 'el_footer_box',
      type: 'box',
      label: 'Footer Box',
      x: 40, y: 720, width: 714, height: 200, // increased height
      style: { backgroundColor: '#ffffff' }
  },
  {
      id: 'el_payment_terms',
      type: 'text',
      label: 'Payment Terms',
      x: 40, y: 725, width: 714, height: 20,
      binding: 'metadata.paymentTerms',
      style: { fontSize: 10 }
  },
  {
      id: 'el_bank_static',
      type: 'text',
      label: 'Bank Details Static',
      x: 40, y: 750, width: 714, height: 150,
      content: "Bank Transfer: Pls remit the amount due to:\nACCOUNT NAME: VELOSI CERTIFICATION LLC\nBANK: BNP PARIBAS\nBRANCH: Al Fardan Office Tower, P.O. Box 2636\nACCOUNT NO: 06691 093293 001 60\nCURRENCY: Qatar Riyal/US Dollar\nIBAN NO (QAR): QA06BNPA000669109329300160QAR\nIBAN NO (USD): QA88BNPA000669109329300160USD\nSWIFT CODE: BNPAQAQA",
      style: { fontSize: 9, fontWeight: 'normal' }
  },
  
  // --- Signature ---
  {
      id: 'el_sig_line',
      type: 'text',
      label: 'Signature Line',
      x: 550, y: 1000, width: 200, height: 20,
      content: '__________________________',
      style: { align: 'center' }
  },
  {
      id: 'el_sig_text',
      type: 'text',
      label: 'Signature Text',
      x: 550, y: 1020, width: 200, height: 20,
      content: 'Authorized Signature',
      style: { fontSize: 10, align: 'center' }
  }
];

export const DEFAULT_TEMPLATE: TemplateData = {
  name: "Velosi Standard Invoice",
  elements: DEFAULT_ELEMENTS,
  layout: DEFAULT_LAYOUT,
  metadata: {
    documentTitle: "Invoice:",
    vendorName: "VELOSI CERTIFICATION L.L.C.",
    vendorAddress: "Ahmad Bin Ali Business Cntr, 1st F. New Salata, C-Ring Road,\nP.O. Box: 3408, Doha, Qatar",
    vendorPhone: "(+) 44352850",
    vendorFax: "(+) 44352819",
    vendorEmail: "velosi@qatar.net.qa",
    clientName: "QatarEnergy LNG",
    clientAddress: "P.O. Box: 22666\nPalm Tower, West Bay\n22666, Doha\nDoha, Qatar\nTel: +974 4473-6000 ; Fax: +974 4473-",
    invoiceNumber: "3126000114",
    date: "09/01/2026",
    ourReference: "5216309119",
    workOrder: "4500407643 / SES#6100968891",
    contractNo: "LTC/C/NFE/4935-A-20",
    projectName: "NFPS COMP2",
    department: "VSS",
    paymentTerms: "Payment terms: 60 days upon submission of Invoice"
  },
  bankDetails: {
    accountName: "VELOSI CERTIFICATION LLC",
    bankName: "BNP PARIBAS",
    branch: "Al Fardan Office Tower, P.O. Box 2636",
    accountNo: "06691 093293 001 60",
    swiftCode: "BNPAQAQA",
    ibanQar: "QA06BNPA000669109329300160QAR",
    ibanUsd: "QA88BNPA000669109329300160USD",
    currency: "Qatar Riyal/US Dollar"
  }
};

export const getTemplate = (): TemplateData => {
  const saved = localStorage.getItem('invoice_template');
  if (saved) {
    const parsed = JSON.parse(saved);
    // Backward compatibility check
    if (!parsed.elements) {
        return DEFAULT_TEMPLATE;
    }
    return parsed;
  }
  return DEFAULT_TEMPLATE;
};

export const saveTemplateToStorage = (template: TemplateData) => {
  localStorage.setItem('invoice_template', JSON.stringify(template));
};
