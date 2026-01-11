
import React, { useState, useEffect } from 'react';
import { InvoiceData, SummaryLine, BankDetails, InvoiceMetadata, TemplateElement } from '../types';
import { CheckCircle2, Download, Pencil, Save, RefreshCw } from 'lucide-react';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { numberToWords } from '../utils/currency';
import { DEFAULT_ELEMENTS } from '../utils/defaults';

interface InvoiceSummaryProps {
  data: InvoiceData;
}

const PX_TO_MM = 0.2645;

const getDataUrl = (url: string): Promise<string> => {
    return new Promise((resolve) => {
        if (!url) { resolve(''); return; }
        if (url.startsWith('data:')) {
            resolve(url);
            return;
        }
        // Fallback for external images if fetch fails due to CORS
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = url;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if(ctx) {
                ctx.drawImage(img, 0, 0);
                try { resolve(canvas.toDataURL('image/png')); } catch(err) { resolve(''); }
            } else { resolve(''); }
        };
        img.onerror = () => {
             console.warn('Failed to load image, returning empty');
             resolve('');
        };
    });
};

const InvoiceSummary: React.FC<InvoiceSummaryProps> = ({ data: initialData }) => {
  const [data, setData] = useState<InvoiceData>(initialData);
  const [isEditing, setIsEditing] = useState(false);
  const [amountInWords, setAmountInWords] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => { setData(initialData); }, [initialData]);

  useEffect(() => {
    setAmountInWords(numberToWords(data.grandTotal, data.currency));
  }, [data.grandTotal, data.currency]);

  const elements = data.elements || DEFAULT_ELEMENTS;

  const handleMetadataChange = (field: keyof InvoiceMetadata, value: string) => {
    setData(prev => ({ ...prev, metadata: { ...prev.metadata, [field]: value } }));
  };
  const handleLineChange = (index: number, field: keyof SummaryLine, value: string | number) => {
    const newSummary = [...data.summary];
    newSummary[index] = { ...newSummary[index], [field]: value };
    if (field === 'quantity' || field === 'rate') {
        const qty = Number(newSummary[index].quantity);
        const rate = Number(newSummary[index].rate);
        newSummary[index].total = qty * rate;
    }
    const newGrandTotal = newSummary.reduce((acc, curr) => acc + curr.total, 0);
    setData(prev => ({ ...prev, summary: newSummary, grandTotal: newGrandTotal }));
  };

  const InputField = ({ label, value, onChange }: any) => (
    <div className="mb-2">
      <label className="block text-xs font-bold text-zinc-500 mb-1 uppercase">{label}</label>
      <input 
        type="text" 
        value={value || ''} 
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm p-2 bg-zinc-800 text-zinc-200 border border-zinc-700 rounded focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
      />
    </div>
  );

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
          return val !== undefined && val !== null ? String(val) : '';
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
                          {data.summary.slice(0, 3).map((line, i) => (
                              <div key={i} className="flex p-1 border-t border-gray-100 text-black">
                                  <div className="flex-1 truncate">{line.description}</div>
                                  <div className="w-16 text-center">{line.quantity} {line.unit}</div>
                                  <div className="w-16 text-right">{line.rate.toFixed(2)}</div>
                                  <div className="w-16 text-right">{line.total.toFixed(2)}</div>
                              </div>
                          ))}
                          <div className="p-1 text-center text-gray-400 italic">... (Full table in PDF) ...</div>
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
        const doc = new jsPDF('p', 'mm', 'a4');
        const typeOrder = { 'box': 0, 'image': 1, 'table': 2, 'text': 3 };
        const sortedElements = [...elements].sort((a, b) => {
            const typeScore = (typeOrder[a.type] || 2) - (typeOrder[b.type] || 2);
            if (typeScore !== 0) return typeScore;
            return a.y - b.y;
        });

        for (const el of sortedElements) {
            const x = el.x * PX_TO_MM;
            const y = el.y * PX_TO_MM;
            const w = el.width * PX_TO_MM;
            const h = el.height * PX_TO_MM;

            if (el.type === 'box') {
                doc.setFillColor(el.style?.backgroundColor || '#ffffff');
                doc.setDrawColor(200, 200, 200);
                doc.rect(x, y, w, h, 'FD');
            } 
            else if (el.type === 'text') {
                const fontSize = Number(el.style?.fontSize || 12) * 0.75;
                doc.setFontSize(fontSize);
                doc.setFont("helvetica", el.style?.fontWeight === 'bold' ? 'bold' : 'normal');
                doc.setTextColor(el.style?.color || '#000000');
                
                const rawText = getValue(el.binding, el.content);
                const align = el.style?.align || 'left';
                const lines = doc.splitTextToSize(rawText, w);
                
                let textX = x;
                if (align === 'center') textX = x + (w / 2);
                if (align === 'right') textX = x + w;

                doc.text(lines, textX, y + fontSize/2 + 2, { align: align as any, baseline: 'top' });
            }
            else if (el.type === 'image' && el.content) {
                const imgData = await getDataUrl(el.content);
                if (imgData) {
                    try { doc.addImage(imgData, 'PNG', x, y, w, h); } catch (e) { console.warn('Image add failed', e); }
                }
            }
            else if (el.type === 'table') {
                const tableColumn = ["DESCRIPTION", "QTY", "RATE", "TOTAL"];
                const tableRows = data.summary.map(item => [
                    item.description,
                    `${item.quantity} ${item.unit}`,
                    Number(item.rate).toFixed(2),
                    Number(item.total).toFixed(2)
                ]);

                autoTable(doc, {
                    head: [tableColumn],
                    body: tableRows,
                    startY: y,
                    margin: { left: x },
                    tableWidth: w,
                    theme: 'plain',
                    styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
                    headStyles: { fillColor: [240, 240, 240], fontStyle: 'bold', textColor: 50, halign: 'left' },
                    columnStyles: { 
                        0: { cellWidth: 'auto', halign: 'left' }, 
                        1: { cellWidth: 25, halign: 'center' },
                        2: { cellWidth: 30, halign: 'right' },
                        3: { cellWidth: 30, halign: 'right' } 
                    },
                });
            }
        }

        const fileName = `${(data.metadata?.invoiceNumber || "Invoice").replace(/[^a-z0-9]/gi, '_')}.pdf`;
        doc.save(fileName);
    } catch (e) {
        alert("Error generating PDF. Please check console.");
        console.error(e);
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  if (isEditing) {
      return (
        <div className="w-full bg-zinc-900 rounded-xl shadow-lg border border-zinc-800 p-6 animate-fadeIn">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-zinc-200">Edit Data Values</h2>
                <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center hover:bg-green-700 transition-colors shadow-lg shadow-green-900/20">
                    <Save className="w-4 h-4 mr-2" /> Finish Editing
                </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
                 <InputField label="Invoice No" value={data.metadata?.invoiceNumber} onChange={(v: string) => handleMetadataChange('invoiceNumber', v)} />
                 <InputField label="Date" value={data.metadata?.date} onChange={(v: string) => handleMetadataChange('date', v)} />
            </div>
             <div className="space-y-3 mt-6">
                <h3 className="font-bold text-sm text-zinc-400 uppercase tracking-wider">Line Items</h3>
                {data.summary.map((item, idx) => (
                    <div key={idx} className="flex gap-2 border border-zinc-800 p-3 rounded-lg bg-zinc-900/50 hover:bg-zinc-800 transition-colors">
                        <input className="flex-1 bg-transparent border-none text-sm text-zinc-300 focus:text-white outline-none" value={item.description} onChange={e => handleLineChange(idx, 'description', e.target.value)} />
                        <input className="w-24 bg-transparent border-b border-zinc-700 text-sm text-right text-orange-400 font-mono outline-none focus:border-orange-500" type="number" value={item.rate} onChange={e => handleLineChange(idx, 'rate', e.target.value)} />
                    </div>
                ))}
             </div>
        </div>
      );
  }

  return (
    <div className="w-full flex flex-col items-center py-8">
      {/* Action Bar */}
      <div className="w-[794px] mb-4 flex justify-between items-center">
          <div className="font-bold text-zinc-300 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" /> Invoice Preview
          </div>
          <div className="flex gap-2">
              <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700 rounded-lg shadow-sm flex items-center text-sm font-medium transition-all">
                  <Pencil className="w-4 h-4 mr-2" /> Edit Data
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
