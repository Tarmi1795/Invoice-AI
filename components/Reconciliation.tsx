
import React, { useState, useCallback } from 'react';
import { Upload, FileDiff, CheckCircle2, AlertTriangle, ArrowRightLeft, FileText, Loader2, X } from 'lucide-react';
import { reconcileDocuments } from '../services/geminiService';
import { ReconResult } from '../types';

interface FileState {
    file: File | null;
    base64: string | null;
}

const Reconciliation: React.FC = () => {
    const [fileA, setFileA] = useState<FileState>({ file: null, base64: null });
    const [fileB, setFileB] = useState<FileState>({ file: null, base64: null });
    const [result, setResult] = useState<ReconResult | null>(null);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, side: 'A' | 'B') => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const base64 = (ev.target?.result as string).split(',')[1];
            if (side === 'A') setFileA({ file, base64 });
            else setFileB({ file, base64 });
        };
        reader.readAsDataURL(file);
    };

    const handleReconcile = async () => {
        if (!fileA.base64 || !fileB.base64 || !fileA.file || !fileB.file) {
            setError("Please upload both files first.");
            return;
        }
        
        setError(null);
        setProcessing(true);
        setResult(null);

        try {
            const res = await reconcileDocuments(
                { data: fileA.base64, type: fileA.file.type },
                { data: fileB.base64, type: fileB.file.type }
            );
            setResult(res);
        } catch (err) {
            console.error(err);
            setError("Reconciliation failed. Please ensure files are readable (PDF/Excel/Image) and try again.");
        } finally {
            setProcessing(false);
        }
    };

    const reset = () => {
        setFileA({ file: null, base64: null });
        setFileB({ file: null, base64: null });
        setResult(null);
        setError(null);
    };

    const UploadZone = ({ side, fileState }: { side: 'A' | 'B', fileState: FileState }) => (
        <div className={`
            flex-1 border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-all
            ${fileState.file ? 'border-green-500/50 bg-green-500/5' : 'border-zinc-700 bg-zinc-900 hover:border-orange-500/50 hover:bg-zinc-800'}
        `}>
            {fileState.file ? (
                <div className="text-center">
                    <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <FileText className="w-6 h-6 text-green-500" />
                    </div>
                    <p className="font-bold text-zinc-200 truncate max-w-[200px]">{fileState.file.name}</p>
                    <p className="text-xs text-zinc-500 mt-1">{(fileState.file.size / 1024).toFixed(2)} KB</p>
                    <button 
                        onClick={() => side === 'A' ? setFileA({file:null, base64:null}) : setFileB({file:null, base64:null})}
                        className="mt-3 text-xs text-red-400 hover:text-red-300 flex items-center justify-center gap-1"
                    >
                        <X className="w-3 h-3" /> Remove
                    </button>
                </div>
            ) : (
                <label className="cursor-pointer text-center w-full h-full flex flex-col items-center justify-center">
                    <input type="file" className="hidden" accept=".pdf,.xlsx,.csv,.jpg,.png" onChange={(e) => handleFileChange(e, side)} />
                    <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mb-3">
                        <Upload className="w-6 h-6 text-zinc-500" />
                    </div>
                    <span className="font-bold text-zinc-400">Upload File {side}</span>
                    <span className="text-xs text-zinc-600 mt-1">PDF, Excel, CSV, Image</span>
                </label>
            )}
        </div>
    );

    return (
        <div className="p-8 max-w-6xl mx-auto animate-fadeIn">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <ArrowRightLeft className="w-8 h-8 text-orange-500" />
                        Smart Reconciliation
                    </h1>
                    <p className="text-zinc-400 text-sm mt-2">Compare two financial documents (Bank Statement vs Ledger) and find discrepancies automatically.</p>
                </div>
                {result && (
                    <button onClick={reset} className="px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors">
                        Start New Reconciliation
                    </button>
                )}
            </div>

            {!result && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 mb-8">
                    <div className="flex flex-col md:flex-row gap-8">
                        <UploadZone side="A" fileState={fileA} />
                        <div className="flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
                                <span className="text-zinc-500 font-bold text-sm">VS</span>
                            </div>
                        </div>
                        <UploadZone side="B" fileState={fileB} />
                    </div>

                    <div className="mt-8 flex justify-center">
                        <button 
                            onClick={handleReconcile}
                            disabled={processing || !fileA.file || !fileB.file}
                            className={`
                                flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-lg transition-all shadow-xl
                                ${processing 
                                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                                    : 'bg-orange-600 text-white hover:bg-orange-700 shadow-orange-900/20 hover:scale-105'
                                }
                            `}
                        >
                            {processing ? (
                                <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing Discrepancies...</>
                            ) : (
                                <><FileDiff className="w-5 h-5" /> Reconcile Files</>
                            )}
                        </button>
                    </div>
                    {error && (
                        <div className="mt-4 p-4 bg-red-900/20 border border-red-900/50 rounded-xl text-red-400 flex items-center justify-center gap-2">
                            <AlertTriangle className="w-5 h-5" /> {error}
                        </div>
                    )}
                </div>
            )}

            {result && (
                <div className="space-y-6">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                            <p className="text-xs font-bold text-zinc-500 uppercase">Total in File A</p>
                            <p className="text-2xl font-bold text-white">{result.summary.total_records_file_a}</p>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                            <p className="text-xs font-bold text-zinc-500 uppercase">Total in File B</p>
                            <p className="text-2xl font-bold text-white">{result.summary.total_records_file_b}</p>
                        </div>
                        <div className="bg-red-900/10 border border-red-900/30 p-4 rounded-xl">
                            <p className="text-xs font-bold text-red-400 uppercase">Unmatched</p>
                            <p className="text-2xl font-bold text-red-500">{result.summary.total_unmatched_a + result.summary.total_unmatched_b}</p>
                        </div>
                        <div className="bg-green-900/10 border border-green-900/30 p-4 rounded-xl">
                            <p className="text-xs font-bold text-green-400 uppercase">Matched</p>
                            <p className="text-2xl font-bold text-green-500">{result.matches.length}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Unmatched A */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                            <div className="p-4 bg-zinc-950/50 border-b border-zinc-800 flex justify-between items-center">
                                <span className="font-bold text-red-400 flex items-center gap-2"><X className="w-4 h-4" /> Missing in File B (Present in A)</span>
                                <span className="text-xs bg-red-900/30 text-red-400 px-2 py-1 rounded">{result.unmatched_in_a.length}</span>
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-zinc-500 uppercase bg-zinc-950/30 sticky top-0">
                                        <tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Desc</th><th className="px-4 py-2 text-right">Amt</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800">
                                        {result.unmatched_in_a.map((item, i) => (
                                            <tr key={i} className="hover:bg-zinc-800/30">
                                                <td className="px-4 py-2 text-zinc-400 whitespace-nowrap">{item.date}</td>
                                                <td className="px-4 py-2 text-zinc-300 truncate max-w-[150px]" title={item.description}>{item.description}</td>
                                                <td className="px-4 py-2 text-right font-mono text-zinc-300">{item.amount.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                        {result.unmatched_in_a.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-zinc-600 italic">No unmatched items.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Unmatched B */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                            <div className="p-4 bg-zinc-950/50 border-b border-zinc-800 flex justify-between items-center">
                                <span className="font-bold text-red-400 flex items-center gap-2"><X className="w-4 h-4" /> Missing in File A (Present in B)</span>
                                <span className="text-xs bg-red-900/30 text-red-400 px-2 py-1 rounded">{result.unmatched_in_b.length}</span>
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-zinc-500 uppercase bg-zinc-950/30 sticky top-0">
                                        <tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Desc</th><th className="px-4 py-2 text-right">Amt</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800">
                                        {result.unmatched_in_b.map((item, i) => (
                                            <tr key={i} className="hover:bg-zinc-800/30">
                                                <td className="px-4 py-2 text-zinc-400 whitespace-nowrap">{item.date}</td>
                                                <td className="px-4 py-2 text-zinc-300 truncate max-w-[150px]" title={item.description}>{item.description}</td>
                                                <td className="px-4 py-2 text-right font-mono text-zinc-300">{item.amount.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                        {result.unmatched_in_b.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-zinc-600 italic">No unmatched items.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Variance Table */}
                    {result.amount_mismatches.length > 0 && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                             <div className="p-4 bg-yellow-900/10 border-b border-yellow-900/30 flex justify-between items-center">
                                <span className="font-bold text-yellow-500 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Amount Mismatches (Same Item, Diff Amount)</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-zinc-500 uppercase bg-zinc-950">
                                        <tr>
                                            <th className="px-6 py-3">Matched Description</th>
                                            <th className="px-6 py-3 text-right">Amount A</th>
                                            <th className="px-6 py-3 text-right">Amount B</th>
                                            <th className="px-6 py-3 text-right">Variance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800">
                                        {result.amount_mismatches.map((row, i) => (
                                            <tr key={i} className="hover:bg-zinc-800/30">
                                                <td className="px-6 py-3 text-zinc-300">{row.item_a.description}</td>
                                                <td className="px-6 py-3 text-right font-mono text-zinc-400">{row.item_a.amount.toLocaleString()}</td>
                                                <td className="px-6 py-3 text-right font-mono text-zinc-400">{row.item_b.amount.toLocaleString()}</td>
                                                <td className="px-6 py-3 text-right font-mono text-yellow-500 font-bold">{row.variance.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Matches Table */}
                     <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                             <div className="p-4 bg-zinc-950/50 border-b border-zinc-800 flex justify-between items-center">
                                <span className="font-bold text-green-500 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Matched Items</span>
                                <span className="text-xs bg-green-900/20 text-green-500 px-2 py-1 rounded">{result.matches.length}</span>
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-zinc-500 uppercase bg-zinc-950/30 sticky top-0">
                                        <tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Desc</th><th className="px-4 py-2 text-right">Amt</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800">
                                        {result.matches.map((item, i) => (
                                            <tr key={i} className="hover:bg-zinc-800/30 border-l-2 border-transparent hover:border-green-500/50">
                                                <td className="px-4 py-2 text-zinc-400 whitespace-nowrap">{item.date}</td>
                                                <td className="px-4 py-2 text-zinc-500 truncate max-w-[200px]" title={item.description}>{item.description}</td>
                                                <td className="px-4 py-2 text-right font-mono text-zinc-500">{item.amount.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                </div>
            )}
        </div>
    );
};

export default Reconciliation;
