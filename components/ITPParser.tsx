
import React, { useState, useCallback } from 'react';
import { Upload, ScanLine, Loader2, AlertCircle, CheckCircle2, FilePlus, BrainCircuit, ArrowLeft, X, FileDown } from 'lucide-react';
import { parseITP } from '../services/ai/itp';
import { ITPData, ConfidenceAwareResult } from '../types';
import { insertRates, upsertRates, RateItem } from '../services/supabaseClient';
import { SmartReviewDashboard } from './SmartReviewDashboard';

interface ITPItem {
    id: string;
    file: File;
    status: 'pending' | 'processing' | 'success' | 'error';
    result?: ConfidenceAwareResult<ITPData>;
    errorMsg?: string;
    isApproved?: boolean;
}

const ITPParser: React.FC = () => {
    const [queue, setQueue] = useState<ITPItem[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [reviewItem, setReviewItem] = useState<ITPItem | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    const processItem = async (item: ITPItem) => {
        try {
            // 1. Read file as Base64 (Native PDF Support)
            const reader = new FileReader();
            reader.readAsDataURL(item.file);
            
            await new Promise((resolve, reject) => { 
                reader.onload = resolve; 
                reader.onerror = reject;
            });
            
            const base64String = reader.result as string;
            // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
            const base64Content = base64String.split(',')[1];
            
            // 2. AI Parsing with visual context
            const result = await parseITP(base64Content, item.file.type);
            
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success', result: result } : q));
        } catch (err: any) {
            console.error(err);
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', errorMsg: err.message || 'Processing failed' } : q));
        }
    };

    const addFiles = useCallback((files: FileList | null) => {
        if (!files) return;
        const newItems: ITPItem[] = Array.from(files).map(file => ({
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

    const handleVerify = async (verifiedData: ITPData) => {
        if (!reviewItem) return;

        try {
            // Logic to transform ITP Data -> Rate Manager Item
            const rateVal = parseFloat(verifiedData.rate.replace(/[^0-9.]/g, '')) || 0;
            const otRateVal = parseFloat(verifiedData.otRate.replace(/[^0-9.]/g, '')) || 0;
            
            // Heuristic for Unit
            const unit = verifiedData.duration?.toLowerCase().includes('hour') ? 'Hour' : 'Day';

            // Heuristic for Currency (basic check)
            let currency = 'USD';
            if (verifiedData.itpBudget?.includes('QAR')) currency = 'QAR';
            if (verifiedData.itpBudget?.includes('EUR')) currency = 'EUR';

            const newRate: RateItem = {
                reference_no: verifiedData.itpNo,
                description: `${verifiedData.designation} - ${verifiedData.inspectorName} (${verifiedData.location})`,
                unit: unit,
                rate: rateVal,
                ot_rate: otRateVal,
                currency: currency
            };

            // Using upsertRates to OVERWRITE if ITP number exists
            await upsertRates([newRate]);
            
            // Update local queue state
            setQueue(prev => prev.map(q => {
                if (q.id === reviewItem.id && q.result) {
                    return { 
                        ...q, 
                        isApproved: true,
                        result: {
                            ...q.result,
                            data: verifiedData,
                            average_confidence: 1.0 // Verified by human
                        }
                    };
                }
                return q;
            }));
            
            setReviewItem(null);
        } catch (e) {
            console.error(e);
            alert("Failed to save to Rate Manager. Please check your database connection or constraints.");
        }
    };

    const handleExportCSV = () => {
        const successfulItems = queue.filter(item => item.status === 'success' && item.result?.data);
        if (successfulItems.length === 0) {
            alert("No parsed data to export.");
            return;
        }

        setIsExporting(true);
        try {
            const headers = [
                "Filename",
                "ITP No",
                "Inspector",
                "Designation",
                "Location",
                "End Date",
                "Budget",
                "Duration",
                "Rate",
                "OT Rate",
                "PO Number",
                "Revision",
                "Confidence"
            ];

            const escape = (val: string) => `"${(val || '').toString().replace(/"/g, '""')}"`;

            const rows = successfulItems.map(item => {
                const data = item.result!.data;
                return [
                    escape(item.file.name),
                    escape(data.itpNo),
                    escape(data.inspectorName),
                    escape(data.designation),
                    escape(data.location),
                    escape(data.itpEndDate),
                    escape(data.itpBudget),
                    escape(data.duration),
                    escape(data.rate),
                    escape(data.otRate),
                    escape(data.poNumber),
                    escape(data.revision),
                    escape(((item.result!.average_confidence || 0) * 100).toFixed(0) + '%')
                ];
            });

            const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `itp_export_${new Date().toISOString().slice(0,10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
            alert("Export failed");
        } finally {
            setIsExporting(false);
        }
    };

    // --- Render Review Mode ---
    if (reviewItem && reviewItem.result) {
        return (
            <div className="max-w-4xl mx-auto space-y-4 animate-fadeIn">
                 <button 
                    onClick={() => setReviewItem(null)}
                    className="text-zinc-400 hover:text-white mb-4 text-sm flex items-center gap-1"
                 >
                    <ArrowLeft className="w-4 h-4" /> Back to Queue
                 </button>
                 
                 <SmartReviewDashboard 
                    moduleId="itp_parser"
                    result={reviewItem.result}
                    onVerify={handleVerify}
                    onCancel={() => setReviewItem(null)}
                    fieldLabels={{
                        itpNo: "ITP Number (Ref)",
                        location: "Location",
                        inspectorName: "Inspector Name",
                        designation: "Designation / Role",
                        rate: "Rate Amount",
                        otRate: "Overtime Rate",
                        itpEndDate: "End Date",
                        itpBudget: "Budget / Currency Context",
                        duration: "Duration / Unit",
                        revision: "Revision",
                        poNumber: "PO Number"
                    }}
                 />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fadeIn">
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                    <ScanLine className="w-8 h-8 text-orange-500" /> ITP Parser (Instructions to Proceed)
                </h1>
                <p className="text-zinc-400 mt-2">
                    Upload ITP/Instruction PDFs. 
                    <span className="text-orange-500 font-bold ml-1">Review & Verify</span> to add them to the Rate Manager automatically.
                </p>
            </div>

            <div 
                className={`
                    relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer group
                    ${dragActive 
                        ? 'border-orange-500 bg-orange-500/10' 
                        : 'border-zinc-700 bg-zinc-900 hover:bg-zinc-800 hover:border-orange-500/50'
                    }
                `}
                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                onClick={() => document.getElementById('itp-upload')?.click()}
            >
                <input id="itp-upload" type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} accept=".pdf" />
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors ${dragActive ? 'bg-orange-500/20' : 'bg-zinc-800 group-hover:bg-zinc-700'}`}>
                    <Upload className={`w-8 h-8 transition-colors ${dragActive ? 'text-orange-500' : 'text-zinc-500 group-hover:text-orange-500'}`} />
                </div>
                <h3 className="text-lg font-semibold text-zinc-200">Upload ITP PDF Documents</h3>
            </div>

            {queue.length > 0 && (
                <div className="bg-zinc-900 rounded-2xl shadow-lg border border-zinc-800 overflow-hidden">
                     <div className="p-4 bg-zinc-950/50 border-b border-zinc-800 font-semibold text-zinc-400 flex justify-between items-center">
                        <span>Results Queue</span>
                        <button 
                            onClick={handleExportCSV}
                            disabled={isExporting}
                            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg border border-zinc-700 transition-all disabled:opacity-50"
                        >
                            {isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
                            Export All to CSV
                        </button>
                    </div>
                    <div className="divide-y divide-zinc-800">
                        {queue.map(item => (
                            <div key={item.id} className="p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-3">
                                        {item.status === 'processing' && <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />}
                                        {item.status === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                                        {item.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                                        <span className="font-medium text-white">{item.file.name}</span>
                                    </div>
                                    
                                    {item.status === 'success' && !item.isApproved && (
                                        <button 
                                            onClick={() => setReviewItem(item)}
                                            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-orange-600 hover:text-white text-zinc-300 text-sm font-bold rounded-lg transition-all border border-zinc-700 hover:border-orange-500"
                                        >
                                            <BrainCircuit className="w-4 h-4" />
                                            Review & Add to Rates
                                        </button>
                                    )}
                                    
                                    {item.isApproved && (
                                        <span className="flex items-center gap-1 px-3 py-1 bg-green-900/20 text-green-400 text-xs font-bold rounded border border-green-900/50">
                                            <CheckCircle2 className="w-3 h-3" /> Added to Database
                                        </span>
                                    )}
                                </div>

                                {item.status === 'error' && (
                                    <div className="p-3 bg-red-900/20 text-red-400 rounded text-sm">
                                        {item.errorMsg}
                                    </div>
                                )}

                                {item.status === 'success' && item.result?.data && (
                                    <div className="overflow-x-auto border border-zinc-800 rounded-lg opacity-80">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-zinc-950 text-zinc-500 uppercase font-semibold">
                                                <tr>
                                                    <th className="px-4 py-2">ITP No</th>
                                                    <th className="px-4 py-2">Inspector</th>
                                                    <th className="px-4 py-2">Designation</th>
                                                    <th className="px-4 py-2 text-right">Rate</th>
                                                    <th className="px-4 py-2 text-right">OT Rate</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-zinc-900 text-zinc-300">
                                                <tr>
                                                    <td className="px-4 py-3 font-mono text-orange-400">{item.result.data.itpNo || 'N/A'}</td>
                                                    <td className="px-4 py-3 font-bold">{item.result.data.inspectorName || 'N/A'}</td>
                                                    <td className="px-4 py-3">{item.result.data.designation || 'N/A'}</td>
                                                    <td className="px-4 py-3 text-right font-mono">{item.result.data.rate || '0.00'}</td>
                                                    <td className="px-4 py-3 text-right font-mono">{item.result.data.otRate || '0.00'}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ITPParser;
