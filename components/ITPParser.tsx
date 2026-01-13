
import React, { useState, useCallback } from 'react';
import { Upload, ScanLine, FileDown, Loader2, AlertCircle, Download } from 'lucide-react';
import { processDocument } from '../services/geminiService';
import JSZip from 'jszip';

interface ITPItem {
    id: string;
    file: File;
    status: 'pending' | 'processing' | 'success' | 'error';
    data?: any;
}

const ITPParser: React.FC = () => {
    const [queue, setQueue] = useState<ITPItem[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [isZipping, setIsZipping] = useState(false);

    const processItem = async (item: ITPItem) => {
        try {
            const reader = new FileReader();
            reader.readAsDataURL(item.file);
            await new Promise((resolve) => { reader.onload = resolve; });
            const base64Content = (reader.result as string).split(',')[1];
            
            const result = await processDocument(base64Content, item.file.type, 'itp');
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success', data: result } : q));
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
        if (!item.data?.items) return null;
        
        const headers = ["Reference", "Activity", "Date", "Status"];
        const rows = item.data.items.map((row: any) => [
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
        const successfulItems = queue.filter(item => item.status === 'success' && item.data);
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

    const successfulCount = queue.filter(q => q.status === 'success').length;

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
                                <div>
                                    {item.status === 'processing' && <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />}
                                    {item.status === 'success' && (
                                        <button onClick={() => downloadCSV(item)} className="flex items-center px-3 py-1.5 bg-green-500/20 text-green-400 text-sm font-medium rounded-lg hover:bg-green-500/30 transition-colors">
                                            <FileDown className="w-4 h-4 mr-2" /> Download CSV
                                        </button>
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
