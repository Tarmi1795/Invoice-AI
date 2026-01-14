
import React, { useState, useCallback } from 'react';
import { Upload, Microscope, FileDown, Loader2, AlertCircle, CheckCircle2, Table, Eye, Pencil } from 'lucide-react';
import { parseQPReport } from '../services/ai/qp';
import { QPReportData, ConfidenceAwareResult } from '../types';
import { SmartReviewDashboard } from './SmartReviewDashboard';

interface QPItem {
    id: string;
    file: File;
    status: 'pending' | 'processing' | 'success' | 'error';
    result?: ConfidenceAwareResult<QPReportData>;
    errorMsg?: string;
}

const QPReportParser: React.FC = () => {
    const [queue, setQueue] = useState<QPItem[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    
    // Review State
    const [reviewItem, setReviewItem] = useState<QPItem | null>(null);

    const processItem = async (item: QPItem) => {
        try {
            const reader = new FileReader();
            reader.readAsDataURL(item.file);
            await new Promise((resolve) => { reader.onload = resolve; });
            const base64Content = (reader.result as string).split(',')[1];
            
            const result = await parseQPReport(base64Content, item.file.type);
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success', result: result } : q));
        } catch (err) {
            console.error(err);
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', errorMsg: 'Failed to extract data' } : q));
        }
    };

    const addFiles = useCallback((files: FileList | null) => {
        if (!files) return;
        const newItems: QPItem[] = Array.from(files).map(file => ({
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

    const handleExportCSV = () => {
        const successfulItems = queue.filter(item => item.status === 'success' && item.result);
        if (successfulItems.length === 0) {
            alert("No data to export");
            return;
        }

        setIsExporting(true);
        try {
            const headers = [
                "Filename",
                "Vendor",
                "Country",
                "Start Date",
                "End Date",
                "Designation",
                "Travel (To/From)",
                "Hours",
                "Distance",
                "Confidence"
            ];

            const escape = (val: string) => `"${(val || '').toString().replace(/"/g, '""')}"`;

            const rows = successfulItems.map(item => [
                escape(item.file.name),
                escape(item.result?.data?.vendor || ''),
                escape(item.result?.data?.country || ''),
                escape(item.result?.data?.date_start || ''),
                escape(item.result?.data?.date_end || ''),
                escape(item.result?.data?.designation || ''),
                escape(item.result?.data?.travel || ''),
                escape(item.result?.data?.hours || ''),
                escape(item.result?.data?.distance || ''),
                escape(((item.result?.average_confidence || 0) * 100).toFixed(0) + '%')
            ]);

            const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `qp_report_export_${new Date().toISOString().slice(0,10)}.csv`);
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

    const handleVerify = (verifiedData: QPReportData) => {
        if (!reviewItem) return;
        setQueue(prev => prev.map(q => {
            if (q.id === reviewItem.id && q.result) {
                // Update with verified data and perfect confidence since user verified it
                return {
                    ...q,
                    result: {
                        ...q.result,
                        data: verifiedData,
                        average_confidence: 1.0,
                        confidence_scores: Object.keys(verifiedData).reduce((acc, key) => ({...acc, [key]: 1.0}), {} as any)
                    }
                };
            }
            return q;
        }));
        setReviewItem(null);
    };

    const successfulCount = queue.filter(q => q.status === 'success').length;

    // --- Render Review Mode ---
    if (reviewItem && reviewItem.result) {
        return (
            <div className="max-w-4xl mx-auto space-y-4">
                 <button 
                    onClick={() => setReviewItem(null)}
                    className="text-zinc-400 hover:text-white mb-4 text-sm flex items-center gap-1"
                 >
                    ← Back to List
                 </button>
                 <SmartReviewDashboard 
                    moduleId="qp_report"
                    result={reviewItem.result}
                    onVerify={handleVerify}
                    onCancel={() => setReviewItem(null)}
                    fieldLabels={{
                        vendor: "Vendor",
                        country: "Country",
                        date_start: "Start Date",
                        date_end: "End Date",
                        designation: "Inspector Designation",
                        travel: "Travel Details",
                        hours: "Hours",
                        distance: "Distance"
                    }}
                 />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fadeIn">
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Microscope className="w-8 h-8 text-orange-500" /> QP Report Parser
                </h1>
                <p className="text-zinc-400 mt-2">
                    Batch process QC Surveillance Reports to extract vendor, date, and logistics data.
                    <br/>
                    <span className="text-orange-500 text-xs font-bold uppercase tracking-wider">Now with Self-Learning</span>
                </p>
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
                onClick={() => document.getElementById('qp-upload')?.click()}
            >
                <input id="qp-upload" type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} accept=".pdf" />
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors ${dragActive ? 'bg-orange-500/20' : 'bg-zinc-800 group-hover:bg-zinc-700'}`}>
                    <Upload className={`w-8 h-8 transition-colors ${dragActive ? 'text-orange-500' : 'text-zinc-500 group-hover:text-orange-500'}`} />
                </div>
                <h3 className="text-lg font-semibold text-zinc-200">Upload QP Reports</h3>
                <p className="text-sm text-zinc-500 mt-1">Drag & drop multiple PDF files</p>
            </div>

            {/* Queue & Results */}
            {queue.length > 0 && (
                <div className="bg-zinc-900 rounded-2xl shadow-lg border border-zinc-800 overflow-hidden">
                    <div className="p-4 bg-zinc-950/50 border-b border-zinc-800 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <span className="font-semibold text-zinc-400">Processed Results ({successfulCount}/{queue.length})</span>
                            {queue.some(q => q.status === 'processing') && <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />}
                        </div>
                        {successfulCount > 0 && (
                            <button 
                                onClick={handleExportCSV}
                                disabled={isExporting}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-green-900/20 disabled:opacity-50"
                            >
                                <FileDown className="w-4 h-4" />
                                Export CSV
                            </button>
                        )}
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-zinc-500 uppercase bg-zinc-950/30">
                                <tr>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3">Filename</th>
                                    <th className="px-6 py-3">Vendor</th>
                                    <th className="px-6 py-3">Logistics</th>
                                    <th className="px-6 py-3 text-center">Confidence</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                                {queue.map((item) => (
                                    <tr key={item.id} className="hover:bg-zinc-800/50 group">
                                        <td className="px-6 py-4">
                                            {item.status === 'processing' && <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />}
                                            {item.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                            {item.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                                            {item.status === 'pending' && <span className="w-2 h-2 rounded-full bg-zinc-600 block"></span>}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-zinc-300 max-w-[200px] truncate" title={item.file.name}>
                                            {item.file.name}
                                        </td>
                                        <td className="px-6 py-4 text-zinc-400">
                                            {item.result?.data ? (
                                                <div className="flex flex-col">
                                                    <span className="text-white">{item.result.data.vendor}</span>
                                                    <span className="text-xs">{item.result.data.country}</span>
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-zinc-400">
                                            {item.result?.data ? (
                                                <div className="flex flex-col text-xs gap-1">
                                                    <span className="bg-zinc-800 px-1.5 py-0.5 rounded w-fit">{item.result.data.hours}</span>
                                                    <span className="bg-zinc-800 px-1.5 py-0.5 rounded w-fit">{item.result.data.distance}</span>
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {item.result ? (
                                                <div className="flex items-center justify-center gap-1">
                                                     <span className={`font-bold ${
                                                         item.result.average_confidence > 0.9 ? 'text-green-500' : 
                                                         item.result.average_confidence > 0.7 ? 'text-yellow-500' : 'text-red-500'
                                                     }`}>
                                                         {(item.result.average_confidence * 100).toFixed(0)}%
                                                     </span>
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {item.status === 'success' && (
                                                <button 
                                                    onClick={() => setReviewItem(item)}
                                                    className="px-3 py-1.5 bg-zinc-800 hover:bg-orange-600 hover:text-white text-zinc-300 rounded-lg text-xs font-medium transition-all"
                                                >
                                                    Review & Train
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QPReportParser;
