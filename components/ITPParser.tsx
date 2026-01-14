
import React, { useState, useCallback } from 'react';
import { Upload, ScanLine, FileDown, Loader2, AlertCircle, Download, BrainCircuit, Save, X } from 'lucide-react';
import { parseITP, ITPData } from '../services/ai/itp';
import { ConfidenceAwareResult } from '../types';
import { saveLearningExample } from '../services/supabaseClient';
import JSZip from 'jszip';

interface ITPItem {
    id: string;
    file: File;
    status: 'pending' | 'processing' | 'success' | 'error';
    result?: ConfidenceAwareResult<ITPData>;
}

const ITPParser: React.FC = () => {
    const [queue, setQueue] = useState<ITPItem[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [isZipping, setIsZipping] = useState(false);
    
    // Editing State
    const [editingItem, setEditingItem] = useState<ITPItem | null>(null);
    const [editText, setEditText] = useState('');
    const [isTraining, setIsTraining] = useState(false);

    const processItem = async (item: ITPItem) => {
        try {
            const reader = new FileReader();
            reader.readAsDataURL(item.file);
            await new Promise((resolve) => { reader.onload = resolve; });
            const base64Content = (reader.result as string).split(',')[1];
            
            const result = await parseITP(base64Content, item.file.type);
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success', result: result } : q));
        } catch (err) {
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error' } : q));
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

    const getCSVContent = (item: ITPItem): string | null => {
        if (!item.result?.data?.items) return null;
        
        const headers = ["Reference", "Activity", "Date", "Status"];
        const rows = item.result.data.items.map((row: any) => [
            `"${row.reference || ''}"`,
            `"${row.activity || ''}"`,
            `"${row.date || ''}"`,
            `"${row.status || ''}"`
        ]);
        
        return [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
    };

    const downloadCSV = (item: ITPItem) => {
        const csvContent = getCSVContent(item);
        if (!csvContent) return;
        
        const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${item.file.name}_parsed.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleBatchDownload = async () => {
        const successfulItems = queue.filter(item => item.status === 'success' && item.result);
        if (successfulItems.length === 0) {
            alert("No parsed files available to download.");
            return;
        }

        setIsZipping(true);
        try {
            const zip = new JSZip();
            
            for (const item of successfulItems) {
                const csvContent = getCSVContent(item);
                if (csvContent) {
                    const filename = `${item.file.name.split('.')[0]}_parsed.csv`;
                    zip.file(filename, csvContent);
                }
            }

            const content = await zip.generateAsync({ type: "blob" });
            
            const link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            link.download = `itp_batch_${new Date().toISOString().slice(0,10)}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error(e);
            alert("Failed to zip files.");
        } finally {
            setIsZipping(false);
        }
    };

    const openEditor = (item: ITPItem) => {
        setEditingItem(item);
        setEditText(JSON.stringify(item.result?.data, null, 2));
    };

    const handleSaveTraining = async () => {
        if (!editingItem || !editingItem.result) return;
        setIsTraining(true);
        try {
            const parsed = JSON.parse(editText);
            
            // 1. Save to Supabase
            if (editingItem.result.extracted_text) {
                await saveLearningExample('itp_parser', editingItem.result.extracted_text, parsed);
            }

            // 2. Update Local State
            setQueue(prev => prev.map(q => {
                if (q.id === editingItem.id) {
                    return {
                        ...q,
                        result: {
                            ...q.result!,
                            data: parsed,
                            average_confidence: 1.0 // User verified
                        }
                    };
                }
                return q;
            }));
            
            setEditingItem(null);
        } catch (e) {
            alert("Invalid JSON format. Please check syntax.");
        } finally {
            setIsTraining(false);
        }
    };

    const successfulCount = queue.filter(q => q.status === 'success').length;

    // --- Editor Modal ---
    if (editingItem) {
        return (
            <div className="max-w-4xl mx-auto p-4 bg-zinc-900 border border-zinc-800 rounded-xl animate-fadeIn">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2"><BrainCircuit className="w-6 h-6 text-orange-500" /> Review & Train ITP Parser</h3>
                    <button onClick={() => setEditingItem(null)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5"/></button>
                </div>
                <p className="text-sm text-zinc-400 mb-2">Edit the raw JSON below to correct any extraction errors. This will teach the AI for next time.</p>
                <textarea 
                    className="w-full h-96 bg-zinc-950 border border-zinc-700 text-zinc-300 font-mono text-sm p-4 rounded-lg outline-none focus:border-orange-500"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                />
                <div className="flex justify-end gap-3 mt-4">
                     <button onClick={() => setEditingItem(null)} className="px-4 py-2 text-zinc-400 hover:text-white">Cancel</button>
                     <button onClick={handleSaveTraining} disabled={isTraining} className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50">
                        {isTraining ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                        Verify & Train
                     </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fadeIn">
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                    <ScanLine className="w-8 h-8 text-orange-500" /> ITP Parser
                </h1>
                <p className="text-zinc-400 mt-2">Upload Inspection Test Plans (PDF) to extract activity data into CSV.</p>
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
                <h3 className="text-lg font-semibold text-zinc-200">Upload ITP Documents</h3>
            </div>

            {queue.length > 0 && (
                <div className="bg-zinc-900 rounded-2xl shadow-lg border border-zinc-800 overflow-hidden">
                    <div className="p-4 bg-zinc-900/50 border-b border-zinc-800 font-semibold text-zinc-400 flex justify-between items-center">
                        <span>Processing Queue ({queue.length})</span>
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
                                    <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400"><ScanLine className="w-5 h-5" /></div>
                                    <div>
                                        <p className="text-sm font-medium text-zinc-200">{item.file.name}</p>
                                        <p className="text-[10px] text-zinc-500 uppercase font-bold">{item.status}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {item.status === 'processing' && <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />}
                                    {item.status === 'success' && (
                                        <>
                                            <button onClick={() => openEditor(item)} className="flex items-center px-3 py-1.5 bg-zinc-800 text-zinc-300 text-sm font-medium rounded-lg hover:bg-orange-600 hover:text-white transition-colors">
                                                <BrainCircuit className="w-4 h-4 mr-2" /> Verify
                                            </button>
                                            <button onClick={() => downloadCSV(item)} className="flex items-center px-3 py-1.5 bg-green-500/20 text-green-400 text-sm font-medium rounded-lg hover:bg-green-500/30 transition-colors">
                                                <FileDown className="w-4 h-4 mr-2" /> CSV
                                            </button>
                                        </>
                                    )}
                                    {item.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ITPParser;
