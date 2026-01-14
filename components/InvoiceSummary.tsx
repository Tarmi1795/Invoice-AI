
import React, { useState, useEffect } from 'react';
import { InvoiceData, SummaryLine, InvoiceMetadata } from '../types';
import { CheckCircle2, Download, Pencil, Save, RefreshCw, BrainCircuit, Loader2, AlertTriangle, Zap, Check } from 'lucide-react';
import { numberToWords } from '../utils/currency';
import { DEFAULT_ELEMENTS } from '../utils/defaults';
import { generateInvoicePDF } from '../utils/pdfGenerator';
import { RateItem } from '../services/supabaseClient';
import { getSimilarity } from '../utils/fuzzy';

interface InvoiceSummaryProps {
  data: InvoiceData;
  onTrain?: (correctedData: InvoiceData) => Promise<void>;
  availableRates?: RateItem[]; // New prop for reactive editing
}

const formatCurrency = (amount: number) => {
    if (isNaN(amount)) return "0.00";
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Defined OUTSIDE the component to prevent re-mounting
const InputField = ({ label, value, onChange, placeholder, required }: { label: string, value?: string, onChange: (val: string) => void, placeholder?: string, required?: boolean }) => (
    <div className="mb-3">
      <label className={`block text-[10px] font-bold mb-1 uppercase tracking-wider flex items-center gap-1 ${required && !value ? 'text-orange-500' : 'text-zinc-500'}`}>
         {label}
         {required && !value && <AlertTriangle className="w-3 h-3" />}
      </label>
      <input 
        type="text" 
        value={value || ''} 
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full text-sm p-2.5 bg-zinc-950 text-zinc-200 border rounded-lg outline-none transition-all ${required && !value ? 'border-orange-500/50 focus:border-orange-500' : 'border-zinc-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500'}`}
      />
    </div>
);

const InvoiceSummary: React.FC<InvoiceSummaryProps> = ({ data: initialData, onTrain, availableRates = [] }) => {
  const [data, setData] = useState<InvoiceData>(initialData);
  const [isEditing, setIsEditing] = useState(false);
  const [amountInWords, setAmountInWords] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  
  // Reactive Editing State
  const [detectedRates, setDetectedRates] = useState<RateItem[]>([]);
  const [showRatePrompt, setShowRatePrompt] = useState(false);

  useEffect(() => { setData(initialData); }, [initialData]);

  // Recalculate Words whenever Total/Currency changes
  useEffect(() => {
    setAmountInWords(numberToWords(data.grandTotal, data.currency));
  }, [data.grandTotal, data.currency]);

  // --- REACTIVE EDITING: Watch Client Ref changes ---
  useEffect(() => {
    if (!isEditing || !data.metadata?.clientRef || availableRates.length === 0) {
        setShowRatePrompt(false);
        return;
    }

    const currentRef = data.metadata.clientRef.trim();
    if (currentRef.length < 3) return;

    // Fuzzy Check (>97%)
    const matches = availableRates
        .map(r => {
            const rateRef = r.reference_no.trim();
            const sim = getSimilarity(currentRef, rateRef);
            return { rate: r, score: sim };
        })
        .filter(m => m.score >= 0.97 || currentRef.toLowerCase().includes(m.rate.reference_no.toLowerCase()))
        .sort((a, b) => b.score - a.score); // Sort best match first

    if (matches.length > 0) {
        setDetectedRates(matches.map(m => m.rate));
        setShowRatePrompt(true);
    } else {
        setShowRatePrompt(false);
    }

  }, [data.metadata?.clientRef, isEditing, availableRates]);


  const applySpecificRate = (selectedRate: RateItem) => {
    const newSummary = data.summary.map(line => {
        const lineDesc = line.description.toLowerCase().trim();

        // Check if this specific rate matches the description roughly
        // OR fallback to applying it directly if it's the only logic we have
        let match = null;
        
        const rateDesc = selectedRate.description.toLowerCase().trim();
        const parts = rateDesc.split(/[-/]/).map(p => p.trim()).filter(p => p.length > 3);
        const genericWords = ['inspector', 'welding', 'piping', 'senior', 'junior', 'engineer'];
        
        // 1. Check Description Match
        const descriptionMatch = parts.some(part => !genericWords.includes(part) && lineDesc.includes(part));
        if (descriptionMatch || lineDesc.includes(rateDesc) || rateDesc.includes(lineDesc)) {
            match = selectedRate;
        }

        // 2. Forced Application (since user clicked this specific rate button)
        // If we haven't matched by description, we assume the user implies this rate applies to the lines.
        // However, to be safe, we only force apply if there are no other conflicting rates or if it's a general update.
        // For now, let's assume we update ALL lines that don't have a rate yet or matched the previous reference.
        if (!match) {
             match = selectedRate;
        }

        if (match) {
            const isOT = lineDesc.includes('overtime') || lineDesc.includes('ot') || lineDesc.includes('o.t');
            const appliedRate = (isOT && match.ot_rate && match.ot_rate > 0) ? match.ot_rate : match.rate;
            
            if (appliedRate > 0) {
                const qty = parseFloat(line.quantity.toString()) || 0;
                return {
                    ...line,
                    rate: appliedRate,
                    unit: match.unit || line.unit,
                    total: qty * appliedRate
                };
            }
        }
        return line;
    });

    const newGrandTotal = newSummary.reduce((acc, curr) => acc + (curr.total || 0), 0);
    let newCurrency = data.currency;
    if (selectedRate.currency) newCurrency = selectedRate.currency;

    setData(prev => ({
        ...prev,
        summary: newSummary,
        grandTotal: newGrandTotal,
        currency: newCurrency
    }));

    setShowRatePrompt(false);
  };

  const elements = data.elements || DEFAULT_ELEMENTS;

  const handleMetadataChange = (field: keyof InvoiceMetadata, value: string) => {
    setData(prev => ({ ...prev, metadata: { ...prev.metadata, [field]: value } }));
  };

  // --- FIXED RATE CALCULATION LOGIC ---
  const handleLineChange = (index: number, field: keyof SummaryLine, value: string | number) => {
    const newSummary = [...data.summary];
    const item = { ...newSummary[index] };

    // Update the specific field
    // @ts-ignore
    item[field] = value;

    // Logic: If Rate or Quantity changes, recalculate Total
    if (field === 'quantity' || field === 'rate') {
        const qty = parseFloat(item.quantity.toString()) || 0;
        const rate = parseFloat(item.rate.toString()) || 0;
        item.total = qty * rate;
    }

    newSummary[index] = item;

    // Recalculate Grand Total
    const newGrandTotal = newSummary.reduce((acc, curr) => acc + (curr.total || 0), 0);

    setData(prev => ({ 
        ...prev, 
        summary: newSummary, 
        grandTotal: newGrandTotal 
    }));
  };

  const getValue = (binding?: string, content?: string) => {
      if (binding) {
          if (binding === 'bankDetails.summary') {
              const b = data.bankDetails;
              return b ? `Account: ${b.accountName}\nBank: ${b.bankName}\nBranch: ${b.branch}\nAcc No: ${b.accountNo}\nSwift: ${b.swiftCode}\nIBAN: ${b.ibanUsd}` : '';
          }
          if (binding === 'amountInWords') {
              return amountInWords;
          }
          const parts = binding.split('.');
          let val: any = data;
          for (const p of parts) val = val?.[p];
          
          if (val !== undefined && val !== null) {
              // Auto format numbers
              if (typeof val === 'number' && (binding === 'grandTotal' || binding.includes('rate') || binding.includes('total'))) {
                  return formatCurrency(val);
              }
              return String(val);
          }
          return '';
      }
      return content || '';
  };

  const renderCanvas = () => (
      <div className="relative bg-white shadow-2xl mx-auto transform-gpu" style={{ width: '794px', height: '1123px' }}>
          {elements.map(el => (
              <div
                  key={el.id}
                  style={{
                      position: 'absolute',
                      left: el.x,
                      top: el.y,
                      width: el.width,
                      height: el.height,
                      backgroundColor: el.type === 'box' ? (el.style?.backgroundColor || '#f8f8f8') : 'transparent',
                      border: el.type === 'box' ? '1px solid #ddd' : 'none',
                      color: el.style?.color || '#000',
                      fontSize: el.style?.fontSize || 12,
                      fontWeight: el.style?.fontWeight || 'normal',
                      fontStyle: el.style?.fontStyle || 'normal',
                      textDecoration: el.style?.textDecoration || 'none',
                      textAlign: (el.style?.align as any) || 'left',
                      zIndex: el.type === 'box' ? 1 : 2, 
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center', 
                      alignItems: el.style?.align === 'center' ? 'center' : el.style?.align === 'right' ? 'flex-end' : 'flex-start',
                      whiteSpace: 'pre-wrap',
                      overflow: 'hidden',
                      lineHeight: 1.2
                  }}
              >
                  {el.type === 'image' && el.content ? (
                      <img src={el.content} alt="" className="w-full h-full object-contain" />
                  ) : el.type === 'table' ? (
                      <div className="w-full h-full border border-gray-200 text-xs">
                          <div className="bg-gray-100 flex font-bold p-1 text-black">
                              <div className="flex-1">Description</div>
                              <div className="w-16 text-center">Qty</div>
                              <div className="w-16 text-right">Rate</div>
                              <div className="w-16 text-right">Total</div>
                          </div>
                          {data.summary.slice(0, 5).map((line, i) => (
                              <div key={i} className="flex p-1 border-t border-gray-100 text-black items-center">
                                  <div className="flex-1 truncate">{line.description}</div>
                                  <div className="w-16 text-center">{line.quantity} {line.unit}</div>
                                  <div className="w-16 text-right">{formatCurrency(line.rate)}</div>
                                  <div className="w-16 text-right font-bold">{formatCurrency(line.total)}</div>
                              </div>
                          ))}
                          {data.summary.length > 5 && <div className="p-1 text-center text-gray-400 italic">... {data.summary.length - 5} more items ...</div>}
                      </div>
                  ) : (
                      getValue(el.binding, el.content)
                  )}
              </div>
          ))}
      </div>
  );

  const generatePdf = async () => {
    setIsGeneratingPdf(true);
    try {
        const doc = await generateInvoicePDF(data);
        const fileName = `${(data.metadata?.invoiceNumber || "Invoice").replace(/[^a-z0-9]/gi, '_')}.pdf`;
        doc.save(fileName);
    } catch (e) {
        alert("Error generating PDF. Please check console.");
        console.error(e);
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  const handleVerifyAndTrain = async () => {
      setIsTraining(true);
      try {
          if (onTrain) {
              await onTrain(data);
          }
          setIsEditing(false);
      } catch (e) {
          alert("Failed to save training data.");
      } finally {
          setIsTraining(false);
      }
  };

  if (isEditing) {
      return (
        <div className="w-full bg-zinc-900 rounded-xl shadow-lg border border-zinc-800 p-6 animate-fadeIn">
            <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Pencil className="w-5 h-5 text-orange-500" />
                        Edit & Train Data
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">Corrections made here will teach the AI for future imports.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-zinc-400 hover:text-white transition-colors">
                        Cancel
                    </button>
                    <button 
                        onClick={handleVerifyAndTrain} 
                        disabled={isTraining}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700 transition-colors shadow-lg shadow-green-900/20 disabled:opacity-50"
                    >
                        {isTraining ? <Loader2 className="w-4 h-4 animate-spin"/> : <BrainCircuit className="w-4 h-4" />} 
                        Verify & Train AI
                    </button>
                </div>
            </div>

            {/* Smart Rate Detection Banner - Enhanced for Selection */}
            {showRatePrompt && detectedRates.length > 0 && (
                <div className="mb-6 p-4 bg-blue-900/20 border border-blue-900/50 rounded-lg animate-fadeIn">
                    <div className="flex items-center gap-2 text-blue-400 text-sm mb-3">
                        <Zap className="w-4 h-4" />
                        <span><strong>{detectedRates.length}</strong> Match(es) found for <strong>{data.metadata?.clientRef}</strong>. Select correct rate:</span>
                    </div>
                    
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                        {detectedRates.map((rate, idx) => (
                            <div key={idx} className="flex justify-between items-center p-2 bg-zinc-900/80 border border-zinc-800 rounded hover:border-blue-500 transition-colors">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-white">{rate.reference_no}</span>
                                    <span className="text-xs text-zinc-400">{rate.description} - {rate.rate} {rate.currency}</span>
                                </div>
                                <button 
                                    onClick={() => applySpecificRate(rate)}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow transition-colors flex items-center gap-1"
                                >
                                    <Check className="w-3 h-3" /> Apply
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Header Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                 <InputField label="Invoice No" value={data.metadata?.invoiceNumber} onChange={(v) => handleMetadataChange('invoiceNumber', v)} />
                 <InputField label="Date" value={data.metadata?.date} onChange={(v) => handleMetadataChange('date', v)} />
                 
                 {/* IMPORTANT: Client Ref / ITP Input */}
                 <div className="relative">
                     <InputField 
                        label="Client Ref / ITP No (AI Key)" 
                        value={data.metadata?.clientRef} 
                        onChange={(v) => handleMetadataChange('clientRef', v)} 
                        placeholder="e.g. COMP1-ITP-001"
                        required
                     />
                     <div className="absolute right-2 top-8 text-orange-500 pointer-events-none">
                        <BrainCircuit className="w-4 h-4" />
                     </div>
                 </div>
            </div>

             <div className="space-y-4 mt-6">
                <div className="flex justify-between items-end">
                    <h3 className="font-bold text-sm text-zinc-400 uppercase tracking-wider">Line Items (Rates & Totals)</h3>
                    <div className="text-right">
                         <span className="text-xs text-zinc-500 uppercase mr-2">Calculated Total:</span>
                         <span className="text-lg font-bold text-white">{formatCurrency(data.grandTotal)} <span className="text-xs text-zinc-500">{data.currency}</span></span>
                    </div>
                </div>
                
                <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 p-3 bg-zinc-900 border-b border-zinc-800 text-[10px] font-bold text-zinc-500 uppercase">
                        <div className="col-span-6">Description</div>
                        <div className="col-span-2 text-right">Qty</div>
                        <div className="col-span-2 text-right">Rate</div>
                        <div className="col-span-2 text-right">Total</div>
                    </div>
                    {data.summary.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 p-3 border-b border-zinc-800/50 hover:bg-zinc-900 transition-colors items-center">
                            <div className="col-span-6">
                                <input 
                                    className="w-full bg-transparent border-none text-sm text-zinc-300 focus:text-white outline-none" 
                                    value={item.description} 
                                    onChange={e => handleLineChange(idx, 'description', e.target.value)} 
                                />
                            </div>
                            <div className="col-span-2">
                                <input 
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm text-right text-white focus:border-orange-500 outline-none" 
                                    type="number" 
                                    value={item.quantity} 
                                    onChange={e => handleLineChange(idx, 'quantity', e.target.value)} 
                                />
                            </div>
                            <div className="col-span-2">
                                <input 
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm text-right text-orange-400 font-mono focus:border-orange-500 outline-none" 
                                    type="number" 
                                    value={item.rate} 
                                    onChange={e => handleLineChange(idx, 'rate', e.target.value)} 
                                />
                            </div>
                            <div className="col-span-2 text-right font-mono text-sm text-white font-bold">
                                {formatCurrency(item.total)}
                            </div>
                        </div>
                    ))}
                </div>
             </div>
        </div>
      );
  }

  return (
    <div className="w-full flex flex-col items-center py-8">
      {/* Action Bar */}
      <div className="w-[794px] mb-4 flex justify-between items-center">
          <div className="flex flex-col">
              <div className="font-bold text-zinc-300 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" /> Invoice Preview
              </div>
              {data.metadata?.clientRef && (
                  <span className="text-xs text-orange-500 flex items-center gap-1 mt-1 ml-7">
                      <BrainCircuit className="w-3 h-3" /> Ref: {data.metadata.clientRef}
                  </span>
              )}
          </div>
          <div className="flex gap-2">
              <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700 rounded-lg shadow-sm flex items-center text-sm font-medium transition-all">
                  <Pencil className="w-4 h-4 mr-2" /> Edit & Train
              </button>
              <button 
                  onClick={generatePdf} 
                  disabled={isGeneratingPdf}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg shadow-lg shadow-orange-900/20 flex items-center text-sm font-medium disabled:opacity-50 transition-all"
              >
                  {isGeneratingPdf ? <RefreshCw className="w-4 h-4 mr-2 animate-spin"/> : <Download className="w-4 h-4 mr-2" />}
                  Download PDF
              </button>
          </div>
      </div>

      {/* Canvas Render */}
      <div className="overflow-hidden border border-zinc-800 rounded shadow-2xl">
          {renderCanvas()}
      </div>
    </div>
  );
};

export default InvoiceSummary;
