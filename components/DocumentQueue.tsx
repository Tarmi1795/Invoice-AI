import React, { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, CheckCircle2, Loader2, X, AlertCircle, Eye, ArrowRight, Layout } from 'lucide-react';
import { processDocument } from '../services/geminiService';
import { InvoiceData, TemplateData } from '../types';
import { listTemplates } from '../services/supabaseClient';
import { DEFAULT_TEMPLATE } from '../utils/defaults';
import InvoiceSummary from './InvoiceSummary';

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

const DocumentQueue: React.FC<DocumentQueueProps> = ({ type, title, description }) => {
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    
    // Template State
    const [templates, setTemplates] = useState<TemplateData[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

    useEffect(() => {
        const load = async () => {
            const list = await listTemplates();
            setTemplates(list);
            if(list.length > 0) setSelectedTemplateId(list[0].id || '');
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
            
            // AI Processing
            const aiData = await processDocument(base64Content, item.file.type, type);
            
            // Get Selected Template
            const activeTemplate = templates.find(t => t.id === selectedTemplateId) || DEFAULT_TEMPLATE;

            // Merge Logic
            const mergedData: InvoiceData = {
                ...aiData,
                layout: activeTemplate.layout,
                metadata: {
                    ...aiData.metadata,
                    documentTitle: type === 'po' ? 'Pro forma invoice:' : (activeTemplate.metadata.documentTitle || "Pro forma invoice:"),
                    vendorName: activeTemplate.metadata.vendorName,
                    vendorAddress: activeTemplate.metadata.vendorAddress,
                    vendorPhone: activeTemplate.metadata.vendorPhone,
                    vendorFax: activeTemplate.metadata.vendorFax,
                    vendorEmail: activeTemplate.metadata.vendorEmail,
                    clientName: aiData.metadata?.clientName || activeTemplate.metadata.clientName,
                    paymentTerms: aiData.metadata?.paymentTerms || activeTemplate.metadata.paymentTerms
                },
                bankDetails: { ...aiData.bankDetails, ...activeTemplate.bankDetails },
                originalFileName: item.file.name
            };

            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success', result: mergedData } : q));
        } catch (err) {
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', message: 'Analysis failed' } : q));
        }
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
    }, [type, selectedTemplateId, templates]);

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

    return (
        <div className="space-y-8 animate-fadeIn">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-white">{title}</h1>
                    <p className="text-zinc-400 mt-2">{description}</p>
                </div>
                
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
                    <div className="p-4 bg-zinc-900/50 border-b border-zinc-800 font-semibold text-zinc-400 flex justify-between">
                        <span>Document Queue ({queue.length})</span>
                        <span className="text-xs font-normal text-orange-500 uppercase tracking-wider animate-pulse">Live Processing</span>
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
        </div>
    );
};

export default DocumentQueue;