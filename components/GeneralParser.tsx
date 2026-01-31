
import React, { useState, useCallback } from 'react';
import { Upload, Boxes, Loader2, AlertCircle, CheckCircle2, FileArchive, BrainCircuit, ArrowLeft, Download, Table, FileText } from 'lucide-react';
import { processGeneralDocument } from '../services/ai/general';
import { ConfidenceAwareResult, GeneralDocData } from '../types';
import { SmartReviewDashboard } from './SmartReviewDashboard';
import JSZip from 'jszip';

interface GeneralQueueItem {
    id: string;
    file: File;
    status: 'pending' | 'processing' | 'success' | 'error';
    result?: ConfidenceAwareResult<GeneralDocData>;
    errorMsg?: string;
}

const GeneralParser: React.FC = () => {
    const [queue, setQueue] = useState<GeneralQueueItem[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [reviewItem, setReviewItem] = useState<GeneralQueueItem | null>(null);
    const [isZipping, setIsZipping] = useState(false);

    const processItem = async (item: GeneralQueueItem) => {
        try {
            const reader = new FileReader();
            reader.readAsDataURL(item.file);
            await new Promise((resolve) => { reader.onload = resolve; });
            const base64Content = (reader.result as string).split(',')[1];
            
            const result = await processGeneralDocument(base64Content, item.file.type);
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success', result: result } : q));
        } catch (err: any) {
            console.error(err);
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', errorMsg: err.message || 'Processing failed' } : q));
        }
    };

    const addFiles = useCallback((files: FileList | null) => {
        if (!files) return;
        const newItems: GeneralQueueItem[] = Array.from(files).map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            status: 'pending'
        }));
        setQueue(prev => [...prev, ...newItems]);
        newItems.forEach(item => {
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing' } : q));
            processItem(item);
        });
    }, []);

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

    const handleVerify = (verifiedData: Record<string, any>) => {
        if (!reviewItem) return;
        
        // Transform the flat form back into GeneralDocData structure
        const { document_type, summary, ...dynamic_fields } = verifiedData;
        
        const newData: GeneralDocData = {
            document_type: document_type as string,
            summary: summary as string,
            dynamic_fields: dynamic_fields as Record<string, string | number>
        };

        setQueue(prev => prev.map(q => {
            if (q.id === reviewItem.id && q.result) {
                return {
                    ...q,
                    result: {
                        ...q.result,
                        data: newData,
                        average_confidence: 1.0,
                        confidence_scores: Object.keys(verifiedData).reduce((acc, key) => ({...acc, [key]: 1.0}), {})
                    }
                };
            }
            return q;
        }));
        setReviewItem(null);
    };

    const handleZipExport = async () => {
        const successItems = queue.filter(i => i.status === 'success' && i.result);
        if (successItems.length === 0) {
            alert("No processed files to export.");
            return;
        }

        setIsZipping(true);
        try {
            const zip = new JSZip();
            
            // Group by Document Type
            const grouped: Record<string, GeneralQueueItem[]> = {};
            successItems.forEach(item => {
                const type = (item.result?.data.document_type || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_');
                if (!grouped[type]) grouped[type] = [];
                grouped[type].push(item);
            });

            // Process each group into a separate CSV
            Object.keys(grouped).forEach(docType => {
                const items = grouped[docType];
                
                // 1. Identify all unique keys across this group to align columns
                const allKeys = new Set<string>();
                allKeys.add('filename'); // First column
                allKeys.add('summary');
                
                items.forEach(item => {
                   if (item.result?.data.dynamic_fields) {
                       Object.keys(item.result.data.dynamic_fields).forEach(k => allKeys.add(k));
                   }
                });
                
                const headers = Array.from(allKeys);
                const csvRows = [headers.join(',')];

                // 2. Map data to rows
                items.forEach(item => {
                    const row = headers.map(header => {
                        let val = '';
                        if (header === 'filename') val = item.file.name;
                        else if (header === 'summary') val = item.result?.data.summary || '';
                        else val = String(item.result?.data.dynamic_fields[header] || '');
                        
                        // Escape quotes for CSV
                        return `"${val.replace(/"/g, '""')}"`;
                    });
                    csvRows.push(row.join(','));
                });

                zip.file(`${docType}.csv`, csvRows.join('\n'));
            });

            const content = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            link.download = `universal_export_${new Date().toISOString().slice(0,10)}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (e) {
            console.error(e);
            alert("Failed to generate ZIP");
        } finally {
            setIsZipping(false);
        }
    };

    // Render Review Dashboard
    if (reviewItem && reviewItem.result) {
        // Flatten data for the generic dashboard
        const flatData = {
            document_type: reviewItem.result.data.document_type,
            summary: reviewItem.result.data.summary,
            ...reviewItem.result.data.dynamic_fields
        };

        // Create labels
        const labels: Record<string, string> = {
            document_type: "Document Type",
            summary: "Summary"
        };
        Object.keys(reviewItem.result.data.dynamic_fields).forEach(k => {
            labels[k] = k.replace(/_/g, ' ').toUpperCase();
        });

        // Adapt confidence scores
        const scores = {
            document_type: 0.9,
            summary: 0.9,
            ...reviewItem.result.confidence_scores
        };

        return (
            <div className="max-w-4xl mx-auto space-y-4 animate-fadeIn">
                 <button 
                    onClick={() => setReviewItem(null)}
                    className="text-zinc-400 hover:text-white mb-4 text-sm flex items-center gap-1"
                 >
                    <ArrowLeft className="w-4 h-4" /> Back to Queue
                 </button>
                 
                 <SmartReviewDashboard 
                    moduleId="general_parser"
                    // @ts-ignore - Adapting types dynamically
                    result={{
                        data: flatData,
                        confidence_scores: scores,
                        average_confidence: reviewItem.result.average_confidence,
                        extracted_text: reviewItem.result.extracted_text
                    }}
                    onVerify={handleVerify}
                    onCancel={() => setReviewItem(null)}
                    fieldLabels={labels}
                 />
            </div>
        );
    }

    const successfulCount = queue.filter(q => q.status === 'success').length;

    return (
        <div className="space-y-8 animate-fadeIn">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Boxes className="w-8 h-8 text-orange-500" /> Universal Document Parser
                    </h1>
                    <p className="text-zinc-400 mt-2">
                        Upload mixed documents (Invoices, Receipts, POs). The AI will auto-detect type, extract data, and organize them into CSVs.
                    </p>
                </div>
            </div>

            {/* Upload Zone */}
            <div 
                className={`
                    relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 cursor-pointer group
                    ${dragActive 
                        ? 'border-orange-500 bg-orange-500/10' 
                        : 'border-zinc-700 bg-zinc-900 hover:bg-zinc-800 hover:border-orange-500/50'
                    }
                `}
                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                onClick={() => document.getElementById('gen-upload')?.click()}
            >
                <input id="gen-upload" type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} accept=".pdf,.jpg,.png,.jpeg" />
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors ${dragActive ? 'bg-orange-500/20' : 'bg-zinc-800 group-hover:bg-zinc-700'}`}>
                    <Upload className={`w-8 h-8 transition-colors ${dragActive ? 'text-orange-500' : 'text-zinc-500 group-hover:text-orange-500'}`} />
                </div>
                <h3 className="text-lg font-semibold text-zinc-200">Upload Mixed Documents</h3>
                <p className="text-sm text-zinc-500 mt-1">PDF, JPG, PNG supported</p>
            </div>

            {/* Queue & Results */}
            {queue.length > 0 && (
                <div className="bg-zinc-900 rounded-2xl shadow-lg border border-zinc-800 overflow-hidden">
                    <div className="p-4 bg-zinc-950/50 border-b border-zinc-800 font-semibold text-zinc-400 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <span>Processing Queue ({successfulCount}/{queue.length})</span>
                            {queue.some(q => q.status === 'processing') && <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />}
                        </div>
                        {successfulCount > 0 && (
                            <button 
                                onClick={handleZipExport}
                                disabled={isZipping}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-green-900/20 disabled:opacity-50"
                            >
                                {isZipping ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileArchive className="w-4 h-4" />}
                                Download Organized ZIP
                            </button>
                        )}
                    </div>
                    
                    <div className="divide-y divide-zinc-800">
                        {queue.map(item => (
                            <div key={item.id} className="p-4 hover:bg-zinc-800/30 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${
                                            item.status === 'success' ? 'bg-green-500/20 text-green-400' : 
                                            item.status === 'error' ? 'bg-red-500/20 text-red-400' : 
                                            'bg-blue-500/20 text-blue-400'
                                        }`}>
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-white">{item.file.name}</p>
                                            {item.result && (
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-600 uppercase font-bold">
                                                        {item.result.data.document_type}
                                                    </span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${item.result.average_confidence > 0.8 ? 'text-green-500' : 'text-yellow-500'}`}>
                                                        {(item.result.average_confidence * 100).toFixed(0)}% Conf.
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-2">
                                        {item.status === 'success' && (
                                            <button 
                                                onClick={() => setReviewItem(item)}
                                                className="px-3 py-1.5 bg-zinc-800 hover:bg-orange-600 hover:text-white text-zinc-300 text-xs font-bold rounded-lg transition-all border border-zinc-700 hover:border-orange-500 flex items-center gap-2"
                                            >
                                                <BrainCircuit className="w-3 h-3" /> Train
                                            </button>
                                        )}
                                        {item.status === 'processing' && <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />}
                                    </div>
                                </div>

                                {/* Dynamic Mini Table Preview */}
                                {item.status === 'success' && item.result && (
                                    <div className="mt-3 bg-zinc-950 rounded border border-zinc-800 p-2 overflow-x-auto">
                                        <table className="w-full text-xs text-left">
                                            <tbody>
                                                <tr>
                                                    <td className="text-zinc-500 font-bold pr-2 py-1 align-top whitespace-nowrap">Summary:</td>
                                                    <td className="text-zinc-300 py-1">{item.result.data.summary}</td>
                                                </tr>
                                                <tr>
                                                    <td className="text-zinc-500 font-bold pr-2 py-1 align-top whitespace-nowrap">Extracted:</td>
                                                    <td className="text-zinc-400 py-1">
                                                        <div className="flex flex-wrap gap-2">
                                                            {Object.entries(item.result.data.dynamic_fields).slice(0, 6).map(([k, v]) => (
                                                                <span key={k} className="bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-[10px]">
                                                                    <span className="text-orange-500 mr-1">{k}:</span>
                                                                    <span className="text-zinc-300">{v}</span>
                                                                </span>
                                                            ))}
                                                            {Object.keys(item.result.data.dynamic_fields).length > 6 && (
                                                                <span className="text-[10px] text-zinc-600 self-center">...more</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                
                                {item.status === 'error' && (
                                    <p className="text-xs text-red-400 mt-2 bg-red-900/10 p-2 rounded">{item.errorMsg}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GeneralParser;
