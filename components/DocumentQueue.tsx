
import React, { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, Loader2, AlertCircle, Eye, ArrowRight, Layout, Check, X, Download } from 'lucide-react';
import { processFinancialDocument } from '../services/ai/invoice';
import { InvoiceData, TemplateData } from '../types';
import { listTemplates, fetchRates, RateItem } from '../services/supabaseClient';
import { DEFAULT_TEMPLATE } from '../utils/defaults';
import InvoiceSummary from './InvoiceSummary';
import { generateInvoicePDF } from '../utils/pdfGenerator';
import JSZip from 'jszip';

interface QueueItem {
    id: string;
    file: File;
    status: 'pending' | 'processing' | 'success' | 'error';
    result?: InvoiceData;
    message?: string;
}

interface DocumentQueueProps {
    type: 'invoice' | 'po' | 'timesheet';
    title: string;
    description: string;
}

interface SuggestionMatch {
    queueId: string;
    aiRef: string;
    matchedRates: RateItem[];
    invoiceNumber: string;
    originalData: InvoiceData;
}

const DocumentQueue: React.FC<DocumentQueueProps> = ({ type, title, description }) => {
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [isZipping, setIsZipping] = useState(false);
    
    // Template & Rate State
    const [templates, setTemplates] = useState<TemplateData[]>([]);
    const [allRates, setAllRates] = useState<RateItem[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

    // Suggestion Modal State
    const [activeSuggestion, setActiveSuggestion] = useState<SuggestionMatch | null>(null);

    useEffect(() => {
        const load = async () => {
            const tmpls = await listTemplates();
            setTemplates(tmpls);
            if(tmpls.length > 0) setSelectedTemplateId(tmpls[0].id || '');

            const rates = await fetchRates();
            setAllRates(rates);
        };
        load();
    }, []);

    const processQueueItem = async (item: QueueItem) => {
        try {
            const reader = new FileReader();
            reader.readAsDataURL(item.file);
            
            await new Promise((resolve) => { reader.onload = resolve; });
            
            const base64String = reader.result as string;
            const base64Content = base64String.split(',')[1];
            
            // AI Processing - using new decoupled function
            const aiData = await processFinancialDocument(base64Content, item.file.type, type);
            
            // Get Selected Template
            const activeTemplate = templates.find(t => t.id === selectedTemplateId) || DEFAULT_TEMPLATE;

            let finalData = aiData;
            let matchedRates: RateItem[] = [];

            // --- RATE MATCHING LOGIC (For Timesheets) ---
            if (type === 'timesheet' && aiData.metadata?.clientRef) {
                const docRef = aiData.metadata.clientRef.trim().toLowerCase();
                
                // Find all rates belonging to this Client Reference / Contract
                matchedRates = allRates.filter(r => 
                    r.reference_no.trim().toLowerCase() === docRef || 
                    docRef.includes(r.reference_no.trim().toLowerCase())
                );

                if (matchedRates.length > 0) {
                   // Instead of auto-applying, we trigger the suggestion modal
                   setActiveSuggestion({
                       queueId: item.id,
                       aiRef: aiData.metadata.clientRef,
                       matchedRates: matchedRates,
                       invoiceNumber: aiData.metadata.invoiceNumber || '',
                       originalData: aiData
                   });
                }
            }

            // Merge Logic (Initial Merge)
            const mergedData: InvoiceData = {
                ...finalData,
                layout: activeTemplate.layout,
                elements: activeTemplate.elements, 
                metadata: {
                    ...finalData.metadata,
                    documentTitle: type === 'po' ? 'Pro forma invoice:' : (activeTemplate.metadata.documentTitle || "Pro forma invoice:"),
                    vendorName: activeTemplate.metadata.vendorName,
                    vendorAddress: activeTemplate.metadata.vendorAddress,
                    vendorPhone: activeTemplate.metadata.vendorPhone,
                    vendorFax: activeTemplate.metadata.vendorFax,
                    vendorEmail: activeTemplate.metadata.vendorEmail,
                    clientName: finalData.metadata?.clientName || activeTemplate.metadata.clientName,
                    paymentTerms: finalData.metadata?.paymentTerms || activeTemplate.metadata.paymentTerms,
                    scopeOfWork: finalData.metadata?.scopeOfWork || activeTemplate.metadata.scopeOfWork,
                    currency: finalData.currency || activeTemplate.metadata.currency || 'USD'
                },
                currency: finalData.currency || activeTemplate.metadata.currency || 'USD',
                bankDetails: { ...finalData.bankDetails, ...activeTemplate.bankDetails },
                originalFileName: item.file.name
            };

            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success', result: mergedData } : q));
        } catch (err) {
            console.error(err);
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', message: 'Analysis failed' } : q));
        }
    };

    const handleApplySuggestion = () => {
        if (!activeSuggestion) return;
        
        const { queueId, matchedRates, invoiceNumber, originalData } = activeSuggestion;
        
        // Apply Rates Logic
        const newSummary = originalData.summary.map(line => {
            const match = matchedRates.find(r => 
                line.description.toLowerCase().includes(r.description.toLowerCase())
            );

            if (match) {
                const isOT = line.description.toLowerCase().includes('overtime') || 
                                line.description.toLowerCase().includes('ot') ||
                                line.description.toLowerCase().includes('o.t');
                
                const appliedRate = (isOT && match.ot_rate && match.ot_rate > 0) ? match.ot_rate : match.rate;
                
                return {
                    ...line,
                    rate: appliedRate,
                    unit: match.unit || line.unit,
                    total: line.quantity * appliedRate
                };
            }
            return line;
        });

        const newGrandTotal = newSummary.reduce((acc, curr) => acc + curr.total, 0);
        let newCurrency = originalData.currency;
        if (matchedRates[0].currency) newCurrency = matchedRates[0].currency;

        // Update Queue Item
        setQueue(prev => prev.map(q => {
            if (q.id === queueId && q.result) {
                return {
                    ...q,
                    result: {
                        ...q.result,
                        summary: newSummary,
                        grandTotal: newGrandTotal,
                        currency: newCurrency,
                        metadata: {
                            ...q.result.metadata,
                            invoiceNumber: invoiceNumber // Apply user input invoice number
                        }
                    }
                };
            }
            return q;
        }));

        setActiveSuggestion(null);
    };

    const handleSkipSuggestion = () => {
        setActiveSuggestion(null);
    };

    const addFiles = useCallback((files: FileList | null) => {
        if (!files) return;
        const newItems: QueueItem[] = Array.from(files).map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            status: 'pending'
        }));

        setQueue(prev => [...prev, ...newItems]);

        newItems.forEach(item => {
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing' } : q));
            processQueueItem(item);
        });
    }, [type, selectedTemplateId, templates, allRates]);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
        else if (e.type === 'dragleave') setDragActive(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
    };

    const handleBatchDownload = async () => {
        const successfulItems = queue.filter(item => item.status === 'success' && item.result);
        if (successfulItems.length === 0) {
            alert("No processed files available to download.");
            return;
        }

        setIsZipping(true);
        try {
            const zip = new JSZip();
            
            // Generate PDFs sequentially
            for (const item of successfulItems) {
                if (!item.result) continue;
                
                // Use the utility to generate PDF object
                const doc = await generateInvoicePDF(item.result);
                
                // Get PDF as ArrayBuffer
                const pdfBlob = doc.output('arraybuffer');
                
                // Filename
                let filename = item.result.metadata?.invoiceNumber || item.file.name.split('.')[0];
                filename = filename.replace(/[^a-z0-9]/gi, '_') + '.pdf';
                
                zip.file(filename, pdfBlob);
            }

            // Generate ZIP
            const content = await zip.generateAsync({ type: "blob" });
            
            // Trigger download
            const link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            link.download = `${type}_batch_${new Date().toISOString().slice(0,10)}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error("Batch download failed:", error);
            alert("Failed to create batch download zip.");
        } finally {
            setIsZipping(false);
        }
    };

    const selectedItem = queue.find(q => q.id === selectedItemId);

    if (selectedItem?.result) {
        return (
            <div className="animate-fadeIn">
                <button 
                    onClick={() => setSelectedItemId(null)}
                    className="mb-4 flex items-center text-sm font-medium text-zinc-400 hover:text-orange-500 transition-colors"
                >
                    <ArrowRight className="w-4 h-4 mr-1 rotate-180" /> Back to Queue
                </button>
                <InvoiceSummary data={selectedItem.result} />
            </div>
        );
    }

    const successfulCount = queue.filter(q => q.status === 'success').length;

    return (
        <div className="space-y-8 animate-fadeIn relative">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-white">{title}</h1>
                    <p className="text-zinc-400 mt-2">{description}</p>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                    {/* Template Selector */}
                    <div className="w-64">
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Use Template</label>
                        <div className="relative">
                            <select 
                                value={selectedTemplateId}
                                onChange={(e) => setSelectedTemplateId(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:ring-2 focus:ring-orange-500 appearance-none outline-none"
                            >
                                <option value="">Default Template</option>
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                            <Layout className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Upload Area */}
            <div 
                className={`
                    relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer group
                    ${dragActive 
                        ? 'border-orange-500 bg-orange-500/10' 
                        : 'border-zinc-700 bg-zinc-900 hover:bg-zinc-800 hover:border-orange-500/50'
                    }
                `}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-upload')?.click()}
            >
                <input id="file-upload" type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} accept=".pdf,.jpg,.png" />
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors ${dragActive ? 'bg-orange-500/20' : 'bg-zinc-800 group-hover:bg-zinc-700'}`}>
                    <Upload className={`w-8 h-8 transition-colors ${dragActive ? 'text-orange-500' : 'text-zinc-500 group-hover:text-orange-500'}`} />
                </div>
                <h3 className="text-lg font-semibold text-zinc-200 group-hover:text-white">Upload Documents</h3>
                <p className="text-sm text-zinc-500 mt-1">Drag & drop multiple files or click to browse</p>
            </div>

            {/* Queue List */}
            {queue.length > 0 && (
                <div className="bg-zinc-900 rounded-2xl shadow-lg border border-zinc-800 overflow-hidden">
                    <div className="p-4 bg-zinc-900/50 border-b border-zinc-800 font-semibold text-zinc-400 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <span>Document Queue ({queue.length})</span>
                            <span className="text-xs font-normal text-orange-500 uppercase tracking-wider animate-pulse">Live Processing</span>
                        </div>
                        {successfulCount > 0 && (
                            <button 
                                onClick={handleBatchDownload}
                                disabled={isZipping}
                                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg border border-zinc-700 transition-all disabled:opacity-50"
                            >
                                {isZipping ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                Download All ({successfulCount})
                            </button>
                        )}
                    </div>
                    <div className="divide-y divide-zinc-800">
                        {queue.map(item => (
                            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg ${
                                        item.status === 'success' ? 'bg-green-500/20 text-green-400' : 
                                        item.status === 'error' ? 'bg-red-500/20 text-red-400' : 
                                        'bg-blue-500/20 text-blue-400'
                                    }`}>
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-zinc-200">{item.file.name}</p>
                                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{item.status}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {item.status === 'processing' && <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />}
                                    {item.status === 'success' && (
                                        <button 
                                            onClick={() => setSelectedItemId(item.id)}
                                            className="flex items-center px-3 py-1.5 bg-orange-500/10 text-orange-500 text-sm font-medium rounded-lg hover:bg-orange-500 hover:text-white transition-all"
                                        >
                                            <Eye className="w-4 h-4 mr-2" /> View Result
                                        </button>
                                    )}
                                    {item.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Suggested ITP Modal */}
            {activeSuggestion && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-zinc-900 w-full max-w-lg rounded-xl shadow-2xl border border-zinc-800 overflow-hidden">
                        <div className="p-6 border-b border-zinc-800 bg-zinc-950">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Check className="w-5 h-5 text-green-500" />
                                Suggested ITP Found
                            </h2>
                            <p className="text-sm text-zinc-400 mt-1">
                                We found a matching ITP reference in your Rate Manager.
                            </p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="p-3 bg-zinc-800 rounded-lg border border-zinc-700">
                                <div className="text-xs text-zinc-500 uppercase font-bold">Matched ITP / Reference</div>
                                <div className="text-white font-mono mt-1 text-lg">{activeSuggestion.matchedRates[0].reference_no}</div>
                                <div className="text-xs text-orange-400 mt-1">
                                    {activeSuggestion.matchedRates.length} matched rates available
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Invoice Number</label>
                                <input 
                                    className="w-full p-3 bg-zinc-950 border border-zinc-700 rounded-lg text-white focus:border-orange-500 outline-none transition-all"
                                    value={activeSuggestion.invoiceNumber}
                                    onChange={(e) => setActiveSuggestion({...activeSuggestion, invoiceNumber: e.target.value})}
                                    placeholder="Enter or confirm invoice number..."
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex gap-3">
                            <button 
                                onClick={handleSkipSuggestion}
                                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg font-medium transition-colors"
                            >
                                Skip
                            </button>
                            <button 
                                onClick={handleApplySuggestion}
                                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium shadow-lg shadow-green-900/20 transition-all"
                            >
                                Apply Rates & Invoice #
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DocumentQueue;
