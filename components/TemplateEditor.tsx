
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Save, Plus, Trash2, Grip, Type, Image as ImageIcon, Table, Square, Undo, Redo, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline, Upload, RefreshCw, ChevronDown, Eye, Calculator, Settings, Copy } from 'lucide-react';
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
    { label: 'Client Reference (ITP No.)', value: 'metadata.clientRef' },
    { label: 'Invoice Number', value: 'metadata.invoiceNumber' },
    { label: 'Date', value: 'metadata.date' },
    { label: 'Document Title', value: 'metadata.documentTitle' },
    { label: 'Our Reference', value: 'metadata.ourReference' },
    { label: 'Work Order', value: 'metadata.workOrder' },
    { label: 'Contract No', value: 'metadata.contractNo' },
    { label: 'Project Name', value: 'metadata.projectName' },
    { label: 'Scope of Work', value: 'metadata.scopeOfWork' },
    { label: 'Department', value: 'metadata.department' },
    { label: 'Currency', value: 'metadata.currency' },
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
        department: 'VSS',
        scopeOfWork: 'Provision of Inspection Services',
        currency: 'USD'
    },
    summary: [
        { description: 'Senior Welding Inspector - Day Shift', quantity: 26, unit: 'Day', rate: 350.00, total: 9100.00 },
        { description: 'Overtime Hours', quantity: 10, unit: 'Hour', rate: 50.00, total: 500.00 },
        { description: 'Mobilization Fee', quantity: 1, unit: 'L/S', rate: 1000.00, total: 1000.00 }
    ],
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

const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const TemplateEditor: React.FC = () => {
  const [templates, setTemplates] = useState<TemplateData[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<TemplateData>(DEFAULT_TEMPLATE);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [zoom, setZoom] = useState(0.7);
  const [loading, setLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
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
    initialPositions: Record<string, { x: number, y: number, w: number, h: number }>;
  }>({
    isDragging: false,
    isResizing: false,
    handle: null,
    startX: 0, startY: 0,
    initialPositions: {}
  });

  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  // Keyboard Shortcuts
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
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedElementIds.length > 0) {
                 e.preventDefault();
                 deleteSelectedElements();
            }
        }
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
             e.preventDefault();
             moveSelectedElements(e.key, e.shiftKey ? 10 : 1);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, historyIndex, selectedElementIds, currentTemplate]);

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
      setSelectedElementIds([]);
  };

  const handleCloneTemplate = (e: React.MouseEvent, template: TemplateData) => {
    e.stopPropagation();
    const newTmpl = {
        ...template,
        id: undefined, // Ensure it's treated as new
        name: `${template.name} (Copy)`
    };
    setCurrentTemplate(newTmpl);
    setHistory([newTmpl]);
    setHistoryIndex(0);
    setSelectedElementIds([]);
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
                
                let fontStyle = 'normal';
                if (el.style?.fontWeight === 'bold' && el.style?.fontStyle === 'italic') fontStyle = 'bolditalic';
                else if (el.style?.fontWeight === 'bold') fontStyle = 'bold';
                else if (el.style?.fontStyle === 'italic') fontStyle = 'italic';

                doc.setFont("helvetica", fontStyle);
                doc.setTextColor(el.style?.color || '#000000');
                
                let rawText = getValue(el.binding, el.content);
                if (el.binding === 'grandTotal' || el.binding === 'rate' || el.binding === 'total') {
                     const num = parseFloat(rawText);
                     if (!isNaN(num)) rawText = formatCurrency(num);
                }

                const align = el.style?.align || 'left';
                const lines = doc.splitTextToSize(rawText, w);
                
                let textX = x;
                if (align === 'center') textX = x + (w / 2);
                if (align === 'right') textX = x + w;

                doc.text(lines, textX, y + fontSize/2 + 2, { align: align as any, baseline: 'top' });
                
                if (el.style?.textDecoration === 'underline') {
                    const textWidth = doc.getTextWidth(lines[0]);
                    let lineX = textX;
                    if (align === 'center') lineX -= textWidth / 2;
                    if (align === 'right') lineX -= textWidth;
                    doc.line(lineX, y + fontSize + 2, lineX + textWidth, y + fontSize + 2);
                }
            }
            else if (el.type === 'image' && el.content) {
                const imgData = await getDataUrl(el.content);
                if (imgData) {
                    try { doc.addImage(imgData, 'PNG', x, y, w, h); } catch (e) { console.warn('Image add failed', e); }
                }
            }
            else if (el.type === 'table') {
                const tableColumn = ["DESCRIPTION", "QTY", "RATE", "TOTAL"];
                const tableRows = (MOCK_DATA.summary || []).map((item: any) => [
                    item.description,
                    `${item.quantity} ${item.unit}`,
                    formatCurrency(item.rate),
                    formatCurrency(item.total)
                ]);
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
      }
  };

  const addElement = (type: ElementType) => {
    const newEl: TemplateElement = {
      id: `el_${Date.now()}`,
      type,
      label: `New ${type}`,
      x: 50, y: 50,
      width: type === 'table' ? 600 : 200,
      height: type === 'table' ? 200 : 50,
      content: type === 'text' ? 'Double click to edit' : undefined,
      style: { fontSize: 12, color: '#000000', align: 'left' }
    };
    updateCurrentTemplate(prev => ({ ...prev, elements: [...(prev.elements || []), newEl] }));
    setSelectedElementIds([newEl.id]);
  };

  const addTotalBlock = () => {
    const ts = Date.now();
    const lbl: TemplateElement = {
        id: `el_lbl_${ts}`,
        type: 'text',
        label: 'Total Label',
        x: 500, y: 650, width: 100, height: 20,
        content: 'Grand Total:',
        style: { fontSize: 12, fontWeight: 'bold', align: 'right' }
    };
    const val: TemplateElement = {
        id: `el_val_${ts}`,
        type: 'text',
        label: 'Total Value',
        x: 610, y: 650, width: 90, height: 20,
        binding: 'grandTotal',
        style: { fontSize: 12, fontWeight: 'bold', align: 'right' }
    };
    updateCurrentTemplate(prev => ({ ...prev, elements: [...(prev.elements || []), lbl, val] }));
    setSelectedElementIds([lbl.id, val.id]);
  };

  const updateElement = (id: string, updates: Partial<TemplateElement>) => {
    updateCurrentTemplate(prev => ({
      ...prev,
      elements: (prev.elements || []).map(el => el.id === id ? { ...el, ...updates } : el)
    }));
  };

  const deleteSelectedElements = () => {
    updateCurrentTemplate(prev => ({
      ...prev,
      elements: (prev.elements || []).filter(el => !selectedElementIds.includes(el.id))
    }));
    setSelectedElementIds([]);
  };

  const deleteElement = (id: string) => {
    updateCurrentTemplate(prev => ({
      ...prev,
      elements: (prev.elements || []).filter(el => el.id !== id)
    }));
    setSelectedElementIds(prev => prev.filter(pid => pid !== id));
  };

  const moveSelectedElements = (direction: string, amount: number) => {
      let dx = 0, dy = 0;
      if (direction === 'ArrowUp') dy = -amount;
      if (direction === 'ArrowDown') dy = amount;
      if (direction === 'ArrowLeft') dx = -amount;
      if (direction === 'ArrowRight') dx = amount;

      updateCurrentTemplate(prev => ({
          ...prev,
          elements: (prev.elements || []).map(el => {
              if (selectedElementIds.includes(el.id)) {
                  return { ...el, x: el.x + dx, y: el.y + dy };
              }
              return el;
          })
      }));
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

  const getMouseCoords = (e: React.MouseEvent) => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      return {
          x: (e.clientX - rect.left) / zoom,
          y: (e.clientY - rect.top) / zoom
      };
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
      if (e.target === canvasRef.current) {
          setSelectedElementIds([]);
      }
  };

  const handleMouseDown = (e: React.MouseEvent, id: string, handle: string | null = null) => {
      e.stopPropagation();
      let newSelection = [...selectedElementIds];
      if (e.ctrlKey || e.metaKey) {
          if (newSelection.includes(id)) {
              newSelection = newSelection.filter(sid => sid !== id);
          } else {
              newSelection.push(id);
          }
      } else {
          if (!newSelection.includes(id)) {
              newSelection = [id];
          }
      }
      setSelectedElementIds(newSelection);
      const coords = getMouseCoords(e);
      const initialPositions: any = {};
      (currentTemplate.elements || []).forEach(el => {
          if (newSelection.includes(el.id)) {
              initialPositions[el.id] = { x: el.x, y: el.y, w: el.width, h: el.height };
          }
      });
      setDragState({
          isDragging: !handle,
          isResizing: !!handle,
          handle,
          startX: coords.x,
          startY: coords.y,
          initialPositions
      });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!dragState.isDragging && !dragState.isResizing) return;
      if (selectedElementIds.length === 0) return;
      const coords = getMouseCoords(e);
      const deltaX = coords.x - dragState.startX;
      const deltaY = coords.y - dragState.startY;
      const snap = (val: number) => Math.round(val / SNAP_GRID) * SNAP_GRID;

      if (dragState.isDragging) {
          setCurrentTemplate(prev => ({
            ...prev,
            elements: (prev.elements || []).map(el => {
                const init = dragState.initialPositions[el.id];
                if (init) {
                    return { ...el, x: snap(init.x + deltaX), y: snap(init.y + deltaY) };
                }
                return el;
            })
          }));
      } else if (dragState.isResizing && dragState.handle) {
           const activeId = selectedElementIds[selectedElementIds.length - 1];
           const init = dragState.initialPositions[activeId];
           if (init) {
                let newW = init.w;
                let newH = init.h;
                if (dragState.handle.includes('e')) newW = snap(init.w + deltaX);
                if (dragState.handle.includes('s')) newH = snap(init.h + deltaY);
                if (newW < 20) newW = 20;
                if (newH < 20) newH = 20;
                updateElement(activeId, { width: newW, height: newH });
           }
      }
  };

  const handleMouseUp = () => {
      if (dragState.isDragging || dragState.isResizing) {
          addToHistory(currentTemplate);
      }
      setDragState(prev => ({ ...prev, isDragging: false, isResizing: false }));
  };

  const primarySelectedId = selectedElementIds[selectedElementIds.length - 1];
  const selectedElement = (currentTemplate.elements || []).find(el => el.id === primarySelectedId);
  const isMultiple = selectedElementIds.length > 1;

  const ResizeHandle = ({ id, position }: { id: string, position: string }) => {
      const cursorMap: any = { 'se': 'nwse-resize' };
      return (
          <div
              onMouseDown={(e) => handleMouseDown(e, id, position)}
              className="absolute w-3 h-3 bg-orange-500 border border-white rounded-full z-20 hover:scale-125 transition-transform"
              style={{ cursor: cursorMap[position], right: -5, bottom: -5 }}
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
          if (val !== undefined && val !== null) {
              if (typeof val === 'number' && (binding === 'grandTotal' || binding.includes('rate') || binding.includes('total'))) {
                  return formatCurrency(val);
              }
              return val;
          }
          return `{${binding}}`;
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
             <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded"><Settings className="w-4 h-4" /></button>
             <div className="w-px h-6 bg-zinc-700 mx-2"></div>
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
          {/* Left Sidebar */}
          <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col z-10">
              <div className="p-4 border-b border-zinc-800 font-bold text-zinc-500 text-xs uppercase tracking-wider">Component Library</div>
              <div className="p-4 grid grid-cols-2 gap-3">
                  {[
                    { id: 'text', label: 'Text', icon: Type },
                    { id: 'image', label: 'Image', icon: ImageIcon },
                    { id: 'box', label: 'Box', icon: Square },
                    { id: 'table', label: 'Table', icon: Table }
                  ].map((item) => (
                    <button key={item.id} onClick={() => addElement(item.id as ElementType)} className="flex flex-col items-center justify-center p-4 border border-zinc-800 bg-zinc-800/50 rounded-xl hover:border-orange-500 hover:bg-zinc-800 hover:text-orange-500 text-zinc-400 transition-all group">
                        <item.icon className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-medium">{item.label}</span>
                    </button>
                  ))}
                  <button onClick={addTotalBlock} className="col-span-2 flex flex-row items-center justify-center p-3 border border-zinc-800 bg-zinc-800/50 rounded-xl hover:border-green-500 hover:bg-zinc-800 hover:text-green-500 text-zinc-400 transition-all gap-2">
                       <Calculator className="w-4 h-4" />
                       <span className="text-xs font-medium">Add Total Block</span>
                  </button>
              </div>
              <div className="p-4 border-t border-zinc-800 mt-auto">
                 <div className="text-xs text-zinc-500 mb-2 font-bold uppercase">SAVED TEMPLATES</div>
                 <div className="space-y-1 max-h-48 overflow-y-auto mb-3 custom-scrollbar">
                     {templates.map(t => (
                         <div key={t.id} onClick={() => { setCurrentTemplate(t); setHistory([t]); setHistoryIndex(0); setSelectedElementIds([]); }} className={`cursor-pointer text-sm p-2 rounded truncate transition-colors flex justify-between items-center group ${currentTemplate.id === t.id ? 'bg-zinc-800 text-white border-l-2 border-orange-500' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
                             <span className="truncate flex-1">{t.name}</span>
                             <div className="flex items-center gap-1">
                                <button onClick={(e) => handleCloneTemplate(e, t)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 hover:text-white rounded transition-all" title="Duplicate"><Copy className="w-3 h-3" /></button>
                                <button onClick={(e) => handleDeleteTemplate(e, t.id!)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-900/50 hover:text-red-400 rounded transition-all" title="Delete"><Trash2 className="w-3 h-3" /></button>
                             </div>
                         </div>
                     ))}
                 </div>
                 <button onClick={handleCreateNew} className="w-full mt-2 flex items-center justify-center gap-2 p-2 border border-dashed border-zinc-700 rounded text-xs text-zinc-500 hover:bg-zinc-800 hover:text-orange-500 hover:border-orange-500 transition-all"><Plus className="w-3 h-3" /> New Template</button>
              </div>
          </div>

          {/* Center: Canvas */}
          <div className="flex-1 bg-zinc-950 overflow-auto flex justify-center p-8 relative" onClick={handleCanvasClick}>
              <div ref={canvasRef} className="bg-white shadow-2xl relative text-black" style={{ width: CANVAS_WIDTH * zoom, height: CANVAS_HEIGHT * zoom, backgroundImage: 'linear-gradient(#f0f0f0 1px, transparent 1px), linear-gradient(90deg, #f0f0f0 1px, transparent 1px)', backgroundSize: `${SNAP_GRID * zoom}px ${SNAP_GRID * zoom}px`, transform: 'translateZ(0)' }}>
                  {(currentTemplate.elements || []).map(el => (
                      <div key={el.id} onMouseDown={(e) => handleMouseDown(e, el.id)} className={`absolute group select-none transition-shadow cursor-move ${selectedElementIds.includes(el.id) ? 'ring-2 ring-orange-500 z-10' : 'hover:ring-1 hover:ring-orange-300'}`}
                          style={{
                              left: el.x * zoom, top: el.y * zoom, width: el.width * zoom, height: el.height * zoom,
                              backgroundColor: el.type === 'box' ? (el.style?.backgroundColor || '#f8f8f8') : 'transparent',
                              border: el.type === 'box' ? '1px solid #ddd' : 'none',
                              color: el.style?.color || '#000000',
                              fontSize: (el.style?.fontSize || 12) * zoom,
                              fontWeight: el.style?.fontWeight,
                              fontStyle: el.style?.fontStyle,
                              textDecoration: el.style?.textDecoration,
                              textAlign: el.style?.align || 'left',
                              overflow: 'hidden', display: 'flex', alignItems: 'center',
                              justifyContent: el.style?.align === 'center' ? 'center' : el.style?.align === 'right' ? 'flex-end' : 'flex-start',
                              whiteSpace: 'pre-wrap'
                          }}
                      >
                          {/* Floating Toolbar for primary selection */}
                          {primarySelectedId === el.id && (
                              <div className="absolute -top-12 left-0 bg-zinc-800 border border-zinc-700 text-white p-1 rounded-lg flex gap-1 shadow-xl z-50 animate-fadeIn" onMouseDown={e => e.stopPropagation()}>
                                  <button onClick={deleteSelectedElements} className="p-1.5 hover:bg-red-900/50 hover:text-red-400 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                              </div>
                          )}
                          {/* Content */}
                          {el.type === 'image' ? (
                              el.content ? <img src={el.content} alt="" className="w-full h-full object-contain pointer-events-none" /> : <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400 text-xs"><ImageIcon className="w-6 h-6 mb-1" /> No Image</div>
                          ) : el.type === 'table' ? (
                              <div className="w-full h-full border border-gray-300 bg-white">
                                  <div className="bg-gray-100 p-1 text-[10px] font-bold border-b border-gray-300 flex justify-between px-2 text-black"><span>DESC</span><span>TOTAL</span></div>
                                  <div className="p-2 space-y-1">{[1,2].map(i => (<div key={i} className="flex justify-between text-[10px] text-gray-600 border-b border-gray-50 pb-1"><span>Service Item {i}</span><span>500.00</span></div>))}<div className="text-[10px] text-right font-bold text-black pt-1">Total: 1,000.00</div></div>
                              </div>
                          ) : (<div className="w-full px-1 leading-tight">{getValue(el.binding, el.content)}</div>)}
                          {primarySelectedId === el.id && <ResizeHandle id={el.id} position="se" />}
                      </div>
                  ))}
              </div>
          </div>

          {/* Right Sidebar: Properties */}
          {selectedElement && !isMultiple && (
              <div className="w-72 bg-zinc-900 border-l border-zinc-800 p-6 overflow-y-auto z-10 animate-fadeIn">
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-800">
                     <span className="font-bold text-zinc-300">Properties</span>
                     <button onClick={deleteSelectedElements} className="text-red-400 hover:bg-red-900/30 p-2 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                      <div><label className="text-[10px] font-bold text-zinc-500 uppercase">X</label><input type="number" className="w-full p-2 mt-1 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 outline-none" value={selectedElement.x} onChange={(e) => updateElement(selectedElement.id, { x: parseInt(e.target.value) })} /></div>
                      <div><label className="text-[10px] font-bold text-zinc-500 uppercase">Y</label><input type="number" className="w-full p-2 mt-1 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 outline-none" value={selectedElement.y} onChange={(e) => updateElement(selectedElement.id, { y: parseInt(e.target.value) })} /></div>
                      <div><label className="text-[10px] font-bold text-zinc-500 uppercase">W</label><input type="number" className="w-full p-2 mt-1 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 outline-none" value={selectedElement.width} onChange={(e) => updateElement(selectedElement.id, { width: parseInt(e.target.value) })} /></div>
                      <div><label className="text-[10px] font-bold text-zinc-500 uppercase">H</label><input type="number" className="w-full p-2 mt-1 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 outline-none" value={selectedElement.height} onChange={(e) => updateElement(selectedElement.id, { height: parseInt(e.target.value) })} /></div>
                  </div>
                  {selectedElement.type === 'text' && (
                      <div className="mb-6">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-2">Data Source</label>
                          <div className="relative mb-2">
                             <select className="w-full p-2 pr-8 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-200 appearance-none outline-none" value={COMMON_BINDINGS.some(b => b.value === selectedElement.binding) ? selectedElement.binding : ''} onChange={(e) => updateElement(selectedElement.id, { binding: e.target.value })} >
                                  <option value="">Static Text</option>
                                  {COMMON_BINDINGS.map(b => (<option key={b.value} value={b.value}>{b.label}</option>))}
                                  <option value="custom">Custom...</option>
                             </select>
                             <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-2 top-2.5 pointer-events-none" />
                          </div>
                          {!selectedElement.binding && <textarea className="w-full p-2 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 h-24 outline-none resize-none" value={selectedElement.content || ''} onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })} placeholder="Enter static text..." />}
                      </div>
                  )}
                  {selectedElement.type === 'image' && (
                      <div className="mb-6">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-2">Image</label>
                          <input type="text" placeholder="URL..." className="w-full p-2 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-200 mb-2 outline-none" value={selectedElement.content?.startsWith('data:') ? '(Base64)' : selectedElement.content} onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })} />
                          <label className="flex flex-col w-full h-16 border-2 border-dashed hover:bg-zinc-800/50 border-zinc-700 rounded cursor-pointer transition-colors justify-center items-center"><Upload className="w-4 h-4 text-zinc-500" /><input type="file" className="opacity-0 w-0 h-0" accept="image/*" onChange={(e) => handleLogoUpload(e, selectedElement.id)} /></label>
                      </div>
                  )}
                  <div className="mb-6">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-2">Appearance</label>
                      <div className="flex items-center gap-2 mb-3">
                          <input type="number" className="w-16 p-1 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 outline-none" value={selectedElement.style?.fontSize || 12} onChange={(e) => updateElement(selectedElement.id, { style: { ...selectedElement.style, fontSize: parseInt(e.target.value) } })} />
                          <input type="color" className="w-8 h-8 p-0 border-0 rounded cursor-pointer" value={selectedElement.style?.color || '#000000'} onChange={(e) => updateElement(selectedElement.id, { style: { ...selectedElement.style, color: e.target.value } })} />
                      </div>
                      {selectedElement.type === 'text' && (
                        <div className="flex gap-1 mb-2">
                             <button onClick={() => updateElement(selectedElement.id, { style: { ...selectedElement.style, fontWeight: selectedElement.style?.fontWeight === 'bold' ? 'normal' : 'bold' } })} className={`p-1.5 rounded ${selectedElement.style?.fontWeight === 'bold' ? 'bg-orange-500/20 text-orange-400' : 'bg-zinc-800 hover:bg-zinc-700'}`}><Bold className="w-4 h-4" /></button>
                             <button onClick={() => updateElement(selectedElement.id, { style: { ...selectedElement.style, fontStyle: selectedElement.style?.fontStyle === 'italic' ? 'normal' : 'italic' } })} className={`p-1.5 rounded ${selectedElement.style?.fontStyle === 'italic' ? 'bg-orange-500/20 text-orange-400' : 'bg-zinc-800 hover:bg-zinc-700'}`}><Italic className="w-4 h-4" /></button>
                             <button onClick={() => updateElement(selectedElement.id, { style: { ...selectedElement.style, textDecoration: selectedElement.style?.textDecoration === 'underline' ? 'none' : 'underline' } })} className={`p-1.5 rounded ${selectedElement.style?.textDecoration === 'underline' ? 'bg-orange-500/20 text-orange-400' : 'bg-zinc-800 hover:bg-zinc-700'}`}><Underline className="w-4 h-4" /></button>
                        </div>
                      )}
                      <div className="flex gap-1">
                             <button onClick={() => updateElement(selectedElement.id, { style: { ...selectedElement.style, align: 'left' } })} className={`p-1.5 rounded ${selectedElement.style?.align === 'left' ? 'bg-orange-500/20 text-orange-400' : 'bg-zinc-800 hover:bg-zinc-700'}`}><AlignLeft className="w-4 h-4" /></button>
                             <button onClick={() => updateElement(selectedElement.id, { style: { ...selectedElement.style, align: 'center' } })} className={`p-1.5 rounded ${selectedElement.style?.align === 'center' ? 'bg-orange-500/20 text-orange-400' : 'bg-zinc-800 hover:bg-zinc-700'}`}><AlignCenter className="w-4 h-4" /></button>
                             <button onClick={() => updateElement(selectedElement.id, { style: { ...selectedElement.style, align: 'right' } })} className={`p-1.5 rounded ${selectedElement.style?.align === 'right' ? 'bg-orange-500/20 text-orange-400' : 'bg-zinc-800 hover:bg-zinc-700'}`}><AlignRight className="w-4 h-4" /></button>
                      </div>
                  </div>
              </div>
          )}
          {isMultiple && <div className="w-72 bg-zinc-900 border-l border-zinc-800 p-6 z-10 animate-fadeIn"><div className="flex items-center justify-between pb-4 border-b border-zinc-800"><span className="font-bold text-zinc-300">{selectedElementIds.length} items</span><button onClick={deleteSelectedElements} className="text-red-400 hover:bg-red-900/30 p-2 rounded"><Trash2 className="w-4 h-4" /></button></div></div>}
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
             <div className="bg-zinc-900 w-96 rounded-xl border border-zinc-800 p-6">
                 <h2 className="text-lg font-bold text-white mb-4">Template Settings</h2>
                 <div className="mb-4">
                     <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Default Currency</label>
                     <input className="w-full p-2 bg-zinc-950 border border-zinc-800 rounded text-white outline-none" value={currentTemplate.metadata.currency || ''} onChange={e => updateCurrentTemplate(prev => ({...prev, metadata: {...prev.metadata, currency: e.target.value}}))} placeholder="e.g. USD, QAR" />
                 </div>
                 <div className="mb-4">
                     <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Scope of Work Default</label>
                     <textarea className="w-full p-2 bg-zinc-950 border border-zinc-800 rounded text-white outline-none h-20" value={currentTemplate.metadata.scopeOfWork || ''} onChange={e => updateCurrentTemplate(prev => ({...prev, metadata: {...prev.metadata, scopeOfWork: e.target.value}}))} />
                 </div>
                 <button onClick={() => setIsSettingsOpen(false)} className="w-full py-2 bg-orange-600 text-white rounded-lg">Close</button>
             </div>
          </div>
      )}
    </div>
  );
};

export default TemplateEditor;
