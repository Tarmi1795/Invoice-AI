
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Save, Plus, Trash2, Grip, Type, Image as ImageIcon, Table, Square, Undo, Redo, AlignLeft, AlignCenter, AlignRight, Bold, Upload, RefreshCw, ChevronDown, Eye } from 'lucide-react';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { TemplateData, TemplateElement, ElementType } from '../types';
import { listTemplates, saveTemplate, deleteTemplate } from '../services/supabaseClient';
import { DEFAULT_TEMPLATE, DEFAULT_ELEMENTS } from '../utils/defaults';

// Canvas Constants (A4 @ 96 DPI)
const CANVAS_WIDTH = 794;
const CANVAS_HEIGHT = 1123;
const SNAP_GRID = 10;
const PX_TO_MM = 0.2645;

const COMMON_BINDINGS = [
    { label: 'Vendor Name', value: 'metadata.vendorName' },
    { label: 'Vendor Address', value: 'metadata.vendorAddress' },
    { label: 'Vendor Phone', value: 'metadata.vendorPhone' },
    { label: 'Vendor Email', value: 'metadata.vendorEmail' },
    { label: 'Client Name', value: 'metadata.clientName' },
    { label: 'Client Address', value: 'metadata.clientAddress' },
    { label: 'Invoice Number', value: 'metadata.invoiceNumber' },
    { label: 'Date', value: 'metadata.date' },
    { label: 'Document Title', value: 'metadata.documentTitle' },
    { label: 'Our Reference', value: 'metadata.ourReference' },
    { label: 'Work Order', value: 'metadata.workOrder' },
    { label: 'Contract No', value: 'metadata.contractNo' },
    { label: 'Project Name', value: 'metadata.projectName' },
    { label: 'Department', value: 'metadata.department' },
    { label: 'Grand Total', value: 'grandTotal' },
    { label: 'Total In Words', value: 'amountInWords' },
    { label: 'Bank Details Block', value: 'bankDetails.summary' },
];

const MOCK_DATA: any = {
    metadata: { 
        vendorName: 'VELOSI CERTIFICATION L.L.C.', 
        vendorAddress: 'Ahmad Bin Ali Business Cntr, 1st F. New Salata, C-Ring Road,\nP.O. Box: 3408, Doha, Qatar',
        vendorPhone: '(+) 44352850',
        vendorEmail: 'velosi@qatar.net.qa',
        clientName: 'QatarEnergy LNG', 
        clientAddress: 'PO Box 22666, Doha, Qatar',
        invoiceNumber: '3126000114', 
        date: '09/01/2026',
        documentTitle: 'Invoice:',
        paymentTerms: '60 days upon submission of Invoice',
        ourReference: '5216309119',
        workOrder: '4500407643 / SES#6100968891',
        contractNo: 'LTC/C/NFE/4935-A-20',
        projectName: 'NFPS COMP2',
        department: 'VSS'
    },
    grandTotal: 15420.50,
    amountInWords: 'FIFTEEN THOUSAND FOUR HUNDRED TWENTY AND 50/100 ONLY',
    currency: 'USD',
    bankDetails: {
        accountName: 'VELOSI CERTIFICATION LLC',
        bankName: 'BNP PARIBAS',
        branch: 'Al Fardan Office Tower, P.O. Box 2636',
        accountNo: '06691 093293 001 60',
        swiftCode: 'BNPAQAQA',
        ibanUsd: 'QA88BNPA000669109329300160USD'
    }
};

const TemplateEditor: React.FC = () => {
  const [templates, setTemplates] = useState<TemplateData[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<TemplateData>(DEFAULT_TEMPLATE);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.7);
  const [loading, setLoading] = useState(false);
  
  // History State
  const [history, setHistory] = useState<TemplateData[]>([DEFAULT_TEMPLATE]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Drag & Resize State
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    isResizing: boolean;
    handle: string | null;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    initialW: number;
    initialH: number;
  }>({
    isDragging: false,
    isResizing: false,
    handle: null,
    startX: 0, startY: 0,
    initialX: 0, initialY: 0, initialW: 0, initialH: 0
  });

  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  // Keyboard Shortcuts (Undo/Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            undo();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            e.preventDefault();
            redo();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, historyIndex]);

  const loadTemplates = async () => {
      const data = await listTemplates();
      setTemplates(data);
      if (data.length > 0 && !currentTemplate.id && data[0].elements) {
          setCurrentTemplate(data[0]);
          setHistory([data[0]]);
          setHistoryIndex(0);
      } else if (!currentTemplate.elements) {
          setCurrentTemplate(DEFAULT_TEMPLATE);
          setHistory([DEFAULT_TEMPLATE]);
          setHistoryIndex(0);
      }
  };

  // --- History Management ---
  const addToHistory = (newState: TemplateData) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newState);
      if (newHistory.length > 50) newHistory.shift();
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
  };

  const updateCurrentTemplate = (updater: (prev: TemplateData) => TemplateData) => {
      setCurrentTemplate(prev => {
          const newState = updater(prev);
          addToHistory(newState);
          return newState;
      });
  };

  const undo = () => {
      if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setCurrentTemplate(history[newIndex]);
      }
  };

  const redo = () => {
      if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          setCurrentTemplate(history[newIndex]);
      }
  };

  const handleCreateNew = () => {
      const newTmpl = {
          ...DEFAULT_TEMPLATE,
          id: undefined,
          name: "New Custom Template",
          elements: [...DEFAULT_ELEMENTS]
      };
      setCurrentTemplate(newTmpl);
      setHistory([newTmpl]);
      setHistoryIndex(0);
      setSelectedElementId(null);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
        const saved = await saveTemplate(currentTemplate);
        setCurrentTemplate(saved);
        await loadTemplates();
        alert('Template saved successfully!');
    } catch (e) {
        alert('Failed to save template.');
    } finally {
        setLoading(false);
    }
  };

  const handleDeleteTemplate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this template? This cannot be undone.")) return;

    try {
        await deleteTemplate(id);
        if (currentTemplate.id === id) {
            const remaining = templates.filter(t => t.id !== id);
            if (remaining.length > 0) {
                setCurrentTemplate(remaining[0]);
                setHistory([remaining[0]]);
            } else {
                handleCreateNew();
            }
        }
        await loadTemplates();
    } catch (error) {
        console.error("Delete failed", error);
        alert("Failed to delete template.");
    }
  };

  // --- PDF Preview Logic ---
  const getDataUrl = (url: string): Promise<string> => {
      return new Promise((resolve) => {
          if (!url) { resolve(''); return; }
          if (url.startsWith('data:')) { resolve(url); return; }
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
          img.onerror = () => resolve('');
      });
  };

  const handlePreviewPdf = async () => {
      try {
        const doc = new jsPDF('p', 'mm', 'a4');
        const elements = currentTemplate.elements || [];
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
                const tableRows = [
                    ["Service Item 1", "1.00 Day", "500.00", "500.00"],
                    ["Service Item 2", "1.00 Day", "500.00", "500.00"],
                ];
                autoTable(doc, {
                    head: [tableColumn],
                    body: tableRows,
                    startY: y,
                    margin: { left: x },
                    tableWidth: w,
                    theme: 'plain',
                    styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
                    headStyles: { fillColor: [240, 240, 240], fontStyle: 'bold', textColor: 50 },
                    columnStyles: { 0: { cellWidth: 'auto' }, 3: { halign: 'right' } },
                });
            }
        }
        doc.save(`${currentTemplate.name || 'template'}_preview.pdf`);
      } catch (e) {
          alert("Error generating PDF preview.");
          console.error(e);
      }
  };


  // --- Element Manipulation ---

  const addElement = (type: ElementType) => {
    const newEl: TemplateElement = {
      id: `el_${Date.now()}`,
      type,
      label: `New ${type}`,
      x: 50, y: 50, // Default to top left
      width: type === 'table' ? 600 : 200,
      height: type === 'table' ? 200 : 50,
      content: type === 'text' ? 'Double click to edit' : undefined,
      style: { fontSize: 12, color: '#000000', align: 'left' }
    };
    
    updateCurrentTemplate(prev => ({ ...prev, elements: [...(prev.elements || []), newEl] }));
    setSelectedElementId(newEl.id);
  };

  const updateElement = (id: string, updates: Partial<TemplateElement>) => {
    updateCurrentTemplate(prev => ({
      ...prev,
      elements: (prev.elements || []).map(el => el.id === id ? { ...el, ...updates } : el)
    }));
  };

  const deleteElement = (id: string) => {
    updateCurrentTemplate(prev => ({
      ...prev,
      elements: (prev.elements || []).filter(el => el.id !== id)
    }));
    setSelectedElementId(null);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
      if (e.target.files && e.target.files[0]) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              if (ev.target?.result) {
                  updateElement(id, { content: ev.target.result as string });
              }
          };
          reader.readAsDataURL(e.target.files[0]);
      }
  };

  // --- Mouse Interaction Logic ---

  const getMouseCoords = (e: React.MouseEvent) => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      return {
          x: (e.clientX - rect.left) / zoom,
          y: (e.clientY - rect.top) / zoom
      };
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
      // Only deselect if we clicked the background canvas directly
      if (e.target === canvasRef.current) {
          setSelectedElementId(null);
      }
  };

  const handleMouseDown = (e: React.MouseEvent, id: string, handle: string | null = null) => {
      e.stopPropagation(); // Stop bubbling to canvas
      const el = (currentTemplate.elements || []).find(e => e.id === id);
      if (!el) return;

      setSelectedElementId(id);
      const coords = getMouseCoords(e);

      setDragState({
          isDragging: !handle,
          isResizing: !!handle,
          handle,
          startX: coords.x,
          startY: coords.y,
          initialX: el.x,
          initialY: el.y,
          initialW: el.width,
          initialH: el.height
      });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!dragState.isDragging && !dragState.isResizing) return;
      if (!selectedElementId) return;

      const coords = getMouseCoords(e);
      const deltaX = coords.x - dragState.startX;
      const deltaY = coords.y - dragState.startY;

      // Snap to grid
      const snap = (val: number) => Math.round(val / SNAP_GRID) * SNAP_GRID;

      if (dragState.isDragging) {
          setCurrentTemplate(prev => ({
            ...prev,
            elements: (prev.elements || []).map(el => el.id === selectedElementId ? {
                ...el,
                x: snap(dragState.initialX + deltaX),
                y: snap(dragState.initialY + deltaY)
            } : el)
          }));
      } else if (dragState.isResizing && dragState.handle) {
          let newW = dragState.initialW;
          let newH = dragState.initialH;
          
          if (dragState.handle.includes('e')) newW = snap(dragState.initialW + deltaX);
          if (dragState.handle.includes('s')) newH = snap(dragState.initialH + deltaY);
          
          if (newW < 20) newW = 20;
          if (newH < 20) newH = 20;

          setCurrentTemplate(prev => ({
            ...prev,
            elements: (prev.elements || []).map(el => el.id === selectedElementId ? {
                ...el,
                width: newW,
                height: newH
            } : el)
          }));
      }
  };

  const handleMouseUp = () => {
      if (dragState.isDragging || dragState.isResizing) {
          // Commit final position to history
          addToHistory(currentTemplate);
      }
      setDragState(prev => ({ ...prev, isDragging: false, isResizing: false }));
  };

  const selectedElement = (currentTemplate.elements || []).find(el => el.id === selectedElementId);

  // --- Render Helpers ---

  const ResizeHandle = ({ id, position }: { id: string, position: string }) => {
      const cursorMap: any = { 'se': 'nwse-resize' };
      return (
          <div
              onMouseDown={(e) => handleMouseDown(e, id, position)}
              className="absolute w-3 h-3 bg-orange-500 border border-white rounded-full z-20 hover:scale-125 transition-transform"
              style={{ 
                  cursor: cursorMap[position],
                  right: -5, bottom: -5
              }}
          />
      );
  };

  const getValue = (binding?: string, content?: string) => {
      if (binding) {
          if(binding === 'bankDetails.summary') {
             const b = MOCK_DATA.bankDetails;
             return `Account: ${b.accountName}\nBank: ${b.bankName}\nBranch: ${b.branch}\nAcc No: ${b.accountNo}\nSwift: ${b.swiftCode}`;
          }
          const parts = binding.split('.');
          let val: any = MOCK_DATA;
          for (const p of parts) val = val?.[p];
          return val || `{${binding}}`;
      }
      return content || '';
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-hidden" onMouseUp={handleMouseUp} onMouseMove={handleMouseMove}>
      
      {/* Top Bar */}
      <div className="h-16 bg-zinc-900 border-b border-zinc-800 flex justify-between items-center px-6 z-10 shadow-sm">
         <div className="flex items-center gap-4">
             <div className="p-2 bg-orange-500/10 rounded-lg"><Grip className="w-5 h-5 text-orange-500" /></div>
             <input 
                value={currentTemplate.name} 
                onChange={(e) => setCurrentTemplate(prev => ({...prev, name: e.target.value}))}
                className="font-bold text-zinc-200 text-lg bg-transparent border border-transparent hover:border-zinc-700 focus:border-orange-500 rounded px-2 outline-none transition-all"
                placeholder="Template Name"
             />
         </div>
         <div className="flex items-center gap-3">
             <div className="flex items-center gap-1 mr-4 bg-zinc-800 rounded-lg p-1 border border-zinc-700">
                 <button onClick={undo} disabled={historyIndex <= 0} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded disabled:opacity-30"><Undo className="w-4 h-4" /></button>
                 <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded disabled:opacity-30"><Redo className="w-4 h-4" /></button>
             </div>

             <div className="flex items-center gap-2 mr-4 bg-zinc-800 rounded-lg p-1 border border-zinc-700">
                 <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="px-2 py-1 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-700 rounded">-</button>
                 <span className="text-xs text-zinc-300 w-10 text-center">{Math.round(zoom * 100)}%</span>
                 <button onClick={() => setZoom(z => Math.min(1.5, z + 0.1))} className="px-2 py-1 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-700 rounded">+</button>
             </div>
             
             <button onClick={handlePreviewPdf} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-white border border-zinc-700 rounded-lg hover:bg-zinc-700 hover:text-orange-400 transition-all shadow-lg mr-2">
                 <Eye className="w-4 h-4" /> Preview
             </button>

             <button onClick={handleSave} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all shadow-lg shadow-orange-900/20">
                 {loading ? <RefreshCw className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                 Save
             </button>
         </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
          
          {/* Left Sidebar: Component Library */}
          <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col z-10">
              <div className="p-4 border-b border-zinc-800 font-bold text-zinc-500 text-xs uppercase tracking-wider">Component Library</div>
              <div className="p-4 grid grid-cols-2 gap-3">
                  {[
                    { id: 'text', label: 'Text', icon: Type },
                    { id: 'image', label: 'Image', icon: ImageIcon },
                    { id: 'box', label: 'Box', icon: Square },
                    { id: 'table', label: 'Table', icon: Table }
                  ].map((item) => (
                    <button 
                        key={item.id}
                        onClick={() => addElement(item.id as ElementType)} 
                        className="flex flex-col items-center justify-center p-4 border border-zinc-800 bg-zinc-800/50 rounded-xl hover:border-orange-500 hover:bg-zinc-800 hover:text-orange-500 text-zinc-400 transition-all group"
                    >
                        <item.icon className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-medium">{item.label}</span>
                    </button>
                  ))}
              </div>

              <div className="p-4 border-t border-zinc-800 mt-auto">
                 <div className="text-xs text-zinc-500 mb-2 font-bold uppercase">SAVED TEMPLATES</div>
                 <div className="space-y-1 max-h-48 overflow-y-auto mb-3 custom-scrollbar">
                     {templates.map(t => (
                         <div 
                            key={t.id} 
                            onClick={() => { setCurrentTemplate(t); setHistory([t]); setHistoryIndex(0); }} 
                            className={`cursor-pointer text-sm p-2 rounded truncate transition-colors flex justify-between items-center group
                                ${currentTemplate.id === t.id ? 'bg-zinc-800 text-white border-l-2 border-orange-500' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}
                            `}
                         >
                             <span className="truncate flex-1">{t.name}</span>
                             <button 
                                onClick={(e) => handleDeleteTemplate(e, t.id!)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-900/50 hover:text-red-400 rounded transition-all"
                                title="Delete Template"
                             >
                                <Trash2 className="w-3 h-3" />
                             </button>
                         </div>
                     ))}
                 </div>
                 <button onClick={handleCreateNew} className="w-full mt-2 flex items-center justify-center gap-2 p-2 border border-dashed border-zinc-700 rounded text-xs text-zinc-500 hover:bg-zinc-800 hover:text-orange-500 hover:border-orange-500 transition-all">
                     <Plus className="w-3 h-3" /> New Template
                 </button>
              </div>
          </div>

          {/* Center: Canvas */}
          <div className="flex-1 bg-zinc-950 overflow-auto flex justify-center p-8 relative" onClick={handleCanvasClick}>
              <div 
                ref={canvasRef}
                className="bg-white shadow-2xl relative text-black"
                style={{ 
                    width: CANVAS_WIDTH * zoom, 
                    height: CANVAS_HEIGHT * zoom,
                    backgroundImage: 'linear-gradient(#f0f0f0 1px, transparent 1px), linear-gradient(90deg, #f0f0f0 1px, transparent 1px)',
                    backgroundSize: `${SNAP_GRID * zoom}px ${SNAP_GRID * zoom}px`,
                    transform: 'translateZ(0)' // GPU acceleration
                }}
              >
                  {/* Elements Render */}
                  {(currentTemplate.elements || []).map(el => (
                      <div
                          key={el.id}
                          onMouseDown={(e) => handleMouseDown(e, el.id)}
                          className={`absolute group select-none transition-shadow cursor-move
                              ${selectedElementId === el.id ? 'ring-2 ring-orange-500 z-10' : 'hover:ring-1 hover:ring-orange-300'}`}
                          style={{
                              left: el.x * zoom,
                              top: el.y * zoom,
                              width: el.width * zoom,
                              height: el.height * zoom,
                              backgroundColor: el.type === 'box' ? (el.style?.backgroundColor || '#f8f8f8') : 'transparent',
                              border: el.type === 'box' ? '1px solid #ddd' : 'none',
                              color: el.style?.color || '#000000',
                              fontSize: (el.style?.fontSize || 12) * zoom,
                              fontWeight: el.style?.fontWeight,
                              textAlign: el.style?.align || 'left',
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: el.style?.align === 'center' ? 'center' : el.style?.align === 'right' ? 'flex-end' : 'flex-start',
                              whiteSpace: 'pre-wrap'
                          }}
                      >
                          {/* Floating Action Toolbar (Only when selected) */}
                          {selectedElementId === el.id && (
                              <div className="absolute -top-12 left-0 bg-zinc-800 border border-zinc-700 text-white p-1 rounded-lg flex gap-1 shadow-xl z-50 animate-fadeIn" onMouseDown={e => e.stopPropagation()}>
                                  <button onClick={() => deleteElement(el.id)} className="p-1.5 hover:bg-red-900/50 hover:text-red-400 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                                  {el.type === 'text' && (
                                    <>
                                        <div className="w-px bg-zinc-700 mx-1"></div>
                                        <button onClick={() => updateElement(el.id, { style: { ...el.style, fontWeight: el.style?.fontWeight === 'bold' ? 'normal' : 'bold' } })} className={`p-1.5 rounded transition-colors ${el.style?.fontWeight === 'bold' ? 'bg-orange-500/20 text-orange-400' : 'hover:bg-zinc-700'}`}><Bold className="w-4 h-4" /></button>
                                        <button onClick={() => updateElement(el.id, { style: { ...el.style, align: 'left' } })} className={`p-1.5 rounded transition-colors ${el.style?.align === 'left' ? 'bg-orange-500/20 text-orange-400' : 'hover:bg-zinc-700'}`}><AlignLeft className="w-4 h-4" /></button>
                                        <button onClick={() => updateElement(el.id, { style: { ...el.style, align: 'center' } })} className={`p-1.5 rounded transition-colors ${el.style?.align === 'center' ? 'bg-orange-500/20 text-orange-400' : 'hover:bg-zinc-700'}`}><AlignCenter className="w-4 h-4" /></button>
                                        <button onClick={() => updateElement(el.id, { style: { ...el.style, align: 'right' } })} className={`p-1.5 rounded transition-colors ${el.style?.align === 'right' ? 'bg-orange-500/20 text-orange-400' : 'hover:bg-zinc-700'}`}><AlignRight className="w-4 h-4" /></button>
                                    </>
                                  )}
                              </div>
                          )}

                          {/* Content Render */}
                          {el.type === 'image' ? (
                              el.content ? 
                                <img src={el.content} alt="" className="w-full h-full object-contain pointer-events-none" /> : 
                                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400 text-xs">
                                    <ImageIcon className="w-6 h-6 mb-1" /> No Image
                                </div>
                          ) : el.type === 'table' ? (
                              <div className="w-full h-full border border-gray-300 bg-white">
                                  <div className="bg-gray-100 p-1 text-[10px] font-bold border-b border-gray-300 flex justify-between px-2 text-black">
                                      <span>DESC</span><span>TOTAL</span>
                                  </div>
                                  <div className="p-2 space-y-1">
                                    {[1,2].map(i => (
                                        <div key={i} className="flex justify-between text-[10px] text-gray-600 border-b border-gray-50 pb-1">
                                            <span>Service Item {i}</span>
                                            <span>500.00</span>
                                        </div>
                                    ))}
                                    <div className="text-[10px] text-right font-bold text-black pt-1">Total: 1000.00</div>
                                  </div>
                              </div>
                          ) : (
                              <div className="w-full px-1 leading-tight">{getValue(el.binding, el.content)}</div>
                          )}
                          
                          {/* Handles */}
                          {selectedElementId === el.id && <ResizeHandle id={el.id} position="se" />}
                      </div>
                  ))}
              </div>
          </div>

          {/* Right Sidebar: Properties */}
          {selectedElement && (
              <div className="w-72 bg-zinc-900 border-l border-zinc-800 p-6 overflow-y-auto z-10 animate-fadeIn">
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-800">
                     <span className="font-bold text-zinc-300">Properties</span>
                     <button onClick={() => deleteElement(selectedElement.id)} className="text-red-400 hover:bg-red-900/30 p-2 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  
                  {/* Position */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                      <div><label className="text-[10px] font-bold text-zinc-500 uppercase">X Position</label><input type="number" className="w-full p-2 mt-1 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:border-orange-500 outline-none" value={selectedElement.x} onChange={(e) => updateElement(selectedElement.id, { x: parseInt(e.target.value) })} /></div>
                      <div><label className="text-[10px] font-bold text-zinc-500 uppercase">Y Position</label><input type="number" className="w-full p-2 mt-1 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:border-orange-500 outline-none" value={selectedElement.y} onChange={(e) => updateElement(selectedElement.id, { y: parseInt(e.target.value) })} /></div>
                      <div><label className="text-[10px] font-bold text-zinc-500 uppercase">Width</label><input type="number" className="w-full p-2 mt-1 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:border-orange-500 outline-none" value={selectedElement.width} onChange={(e) => updateElement(selectedElement.id, { width: parseInt(e.target.value) })} /></div>
                      <div><label className="text-[10px] font-bold text-zinc-500 uppercase">Height</label><input type="number" className="w-full p-2 mt-1 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:border-orange-500 outline-none" value={selectedElement.height} onChange={(e) => updateElement(selectedElement.id, { height: parseInt(e.target.value) })} /></div>
                  </div>

                  {/* Data Binding */}
                  {selectedElement.type === 'text' && (
                      <div className="mb-6">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-2">Data Source (Binding)</label>
                          <div className="flex flex-col gap-2">
                             <div className="relative">
                                 <select 
                                     className="w-full p-2 pr-8 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-200 appearance-none focus:border-orange-500 outline-none"
                                     value={COMMON_BINDINGS.some(b => b.value === selectedElement.binding) ? selectedElement.binding : ''}
                                     onChange={(e) => updateElement(selectedElement.id, { binding: e.target.value })}
                                 >
                                      <option value="">Static Text (No Binding)</option>
                                      {COMMON_BINDINGS.map(b => (
                                          <option key={b.value} value={b.value}>{b.label}</option>
                                      ))}
                                      <option value="custom">Custom Path...</option>
                                 </select>
                                 <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-2 top-2.5 pointer-events-none" />
                             </div>
                             
                             {(selectedElement.binding === 'custom' || (selectedElement.binding && !COMMON_BINDINGS.some(b => b.value === selectedElement.binding))) && (
                                 <input
                                    type="text"
                                    className="w-full p-2 text-sm bg-yellow-900/20 border border-yellow-700/50 rounded text-yellow-200 placeholder-yellow-700"
                                    placeholder="e.g. metadata.customField"
                                    value={selectedElement.binding === 'custom' ? '' : selectedElement.binding}
                                    onChange={(e) => updateElement(selectedElement.id, { binding: e.target.value })}
                                 />
                             )}
                          </div>
                          
                          {!selectedElement.binding && (
                              <textarea 
                                  className="w-full p-2 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 h-24 mt-2 focus:border-orange-500 outline-none resize-none"
                                  value={selectedElement.content || ''}
                                  onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                                  placeholder="Enter static text..."
                              />
                          )}
                      </div>
                  )}

                  {/* Image Upload */}
                  {selectedElement.type === 'image' && (
                      <div className="mb-6">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-2">Image Source</label>
                          <input 
                              type="text" 
                              placeholder="Image URL..." 
                              className="w-full p-2 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-200 mb-2 focus:border-orange-500 outline-none"
                              value={selectedElement.content?.startsWith('data:') ? '(Uploaded Base64)' : selectedElement.content}
                              onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                          />
                          <div className="flex items-center justify-center w-full">
                              <label className="flex flex-col w-full h-24 border-2 border-dashed hover:bg-zinc-800/50 border-zinc-700 rounded cursor-pointer transition-colors">
                                  <div className="flex flex-col items-center justify-center pt-5">
                                      <Upload className="w-5 h-5 text-zinc-500 group-hover:text-orange-500" />
                                      <p className="pt-1 text-xs text-zinc-500 group-hover:text-zinc-300">Upload Local File</p>
                                  </div>
                                  <input type="file" className="opacity-0" accept="image/*" onChange={(e) => handleLogoUpload(e, selectedElement.id)} />
                              </label>
                          </div>
                      </div>
                  )}

                  {/* Styling */}
                  <div className="mb-6">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-2">Appearance</label>
                      <div className="flex items-center gap-3 mb-3">
                          <div className="w-full">
                              <label className="text-[10px] text-zinc-500">Font Size (px)</label>
                              <input type="number" className="w-full p-2 mt-1 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:border-orange-500 outline-none" value={selectedElement.style?.fontSize || 12} onChange={(e) => updateElement(selectedElement.id, { style: { ...selectedElement.style, fontSize: parseInt(e.target.value) } })} />
                          </div>
                          <div className="w-full">
                             <label className="text-[10px] text-zinc-500">Color</label>
                             <div className="flex items-center mt-1">
                                <input type="color" className="w-8 h-8 p-0 border-0 rounded cursor-pointer mr-2" value={selectedElement.style?.color || '#000000'} onChange={(e) => updateElement(selectedElement.id, { style: { ...selectedElement.style, color: e.target.value } })} />
                                <span className="text-xs text-zinc-400">{selectedElement.style?.color || '#000000'}</span>
                             </div>
                          </div>
                      </div>
                      {selectedElement.type === 'box' && (
                           <div>
                               <label className="text-[10px] text-zinc-500">Background Color</label>
                               <div className="flex items-center mt-1">
                                   <input type="color" className="w-8 h-8 p-0 border-0 rounded cursor-pointer mr-2" value={selectedElement.style?.backgroundColor || '#ffffff'} onChange={(e) => updateElement(selectedElement.id, { style: { ...selectedElement.style, backgroundColor: e.target.value } })} />
                                   <span className="text-xs text-zinc-400">{selectedElement.style?.backgroundColor || '#ffffff'}</span>
                               </div>
                           </div>
                      )}
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};

export default TemplateEditor;
