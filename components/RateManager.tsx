import React, { useState, useEffect } from 'react';
import { Upload, Database, Search, FileDown, Plus, Trash2, Edit2, Save, X, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { fetchRates, insertRates, updateRate, deleteRate, deleteAllRates, RateItem } from '../services/supabaseClient';

const RateManager: React.FC = () => {
    const [rates, setRates] = useState<RateItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('');
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRate, setEditingRate] = useState<RateItem | null>(null);
    const [modalForm, setModalForm] = useState<Partial<RateItem>>({
        reference_no: '',
        description: '',
        unit: 'Day',
        rate: 0,
        ot_rate: 0,
        currency: 'USD'
    });

    useEffect(() => {
        loadRates();
    }, []);

    const loadRates = async () => {
        setLoading(true);
        const data = await fetchRates();
        setRates(data);
        setLoading(false);
    };

    // --- CRUD Handlers ---

    const handleEdit = (rate: RateItem) => {
        setEditingRate(rate);
        setModalForm({ ...rate });
        setIsModalOpen(true);
    };

    const handleAddNew = () => {
        setEditingRate(null);
        setModalForm({
            reference_no: '',
            description: '',
            unit: 'Day',
            rate: 0,
            ot_rate: 0,
            currency: 'USD'
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this rate?')) return;
        try {
            await deleteRate(id);
            loadRates();
        } catch (e) {
            alert('Failed to delete rate.');
        }
    };

    const handleClearAll = async () => {
        const confirmMsg = "⚠️ WARNING: This will delete ALL rates from the database.\n\nType 'DELETE' to confirm.";
        const userInput = prompt(confirmMsg);
        if (userInput === 'DELETE') {
            try {
                setLoading(true);
                await deleteAllRates();
                await loadRates();
                alert('All rates cleared successfully.');
            } catch (e) {
                alert('Failed to clear rates.');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!modalForm.reference_no || !modalForm.description) {
            alert('Reference No and Description are required.');
            return;
        }

        const payload = {
            reference_no: modalForm.reference_no,
            description: modalForm.description,
            unit: modalForm.unit || 'Day',
            rate: Number(modalForm.rate),
            ot_rate: Number(modalForm.ot_rate),
            currency: modalForm.currency || 'USD'
        } as RateItem;

        try {
            if (editingRate && editingRate.id) {
                await updateRate({ ...payload, id: editingRate.id });
            } else {
                await insertRates([payload]);
            }
            setIsModalOpen(false);
            loadRates();
        } catch (err) {
            console.error(err);
            alert('Failed to save rate. Please check if your database schema has "ot_rate" column.');
        }
    };

    const handleDownloadTemplate = () => {
        const headers = ["ITP No", "LOCATION", "INSPECTOR", "DESIGNATION", "Unit", "Daily/Hourly Rate", "OT Rate"];
        const sampleRow = ["COMP1-TPIS-ITP-0001", "USA", "JOHN DOE", "SENIOR INSPECTOR", "Day", "$500.00", "$50.00"];
        
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), sampleRow.join(',')].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "rate_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- CSV Import ---

    const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const text = evt.target?.result as string;
            const lines = text.split('\n');
            const newRates: RateItem[] = [];
            
            const header = lines[0].toLowerCase();
            const isITPFormat = header.includes('itp no') || header.includes('inspector');
            const startIndex = 1; 

            for (let i = startIndex; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                // Regex split to handle commas inside quotes if present, though simple split is usually enough for this specific file
                const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ''));
                
                if (isITPFormat) {
                    if (cols.length < 6) continue;
                    
                    // CSV MAPPING:
                    // 0: ITP No
                    // 1: LOCATION
                    // 2: INSPECTOR
                    // 3: DESIGNATION
                    // 4: Unit (Day/Hour)
                    // 5: Daily/Hourly Rate
                    // 6: OT Rate

                    const rawUnit = cols[4];
                    const rawRate = cols[5];
                    const rawOT = cols[6] || '0';

                    let currency = 'USD';
                    if (rawRate.includes('€') || rawRate.includes('EUR')) currency = 'EUR';
                    else if (rawRate.includes('£') || rawRate.includes('GBP')) currency = 'GBP';
                    else if (rawRate.includes('QAR')) currency = 'QAR';
                    
                    const cleanNum = (s: string) => parseFloat(s.replace(/[^0-9.]/g, '')) || 0;

                    newRates.push({
                        reference_no: cols[0],
                        description: `${cols[3]} - ${cols[2]}`.replace(/ - $/, ''), // Designation - Inspector
                        unit: rawUnit || 'Day', 
                        rate: cleanNum(rawRate),
                        ot_rate: cleanNum(rawOT),
                        currency: currency
                    });
                } else {
                    // Fallback generic format
                    if (cols.length < 4) continue;
                    newRates.push({
                        reference_no: cols[0],
                        description: cols[1],
                        unit: cols[2],
                        rate: parseFloat(cols[3]) || 0,
                        ot_rate: 0,
                        currency: cols[4] || 'USD'
                    });
                }
            }

            if (newRates.length > 0) {
                try {
                    await insertRates(newRates);
                    alert(`Successfully imported ${newRates.length} rates.`);
                    loadRates();
                } catch (err) {
                    console.error(err);
                    alert('Error importing rates. Ensure DB schema has "ot_rate" column.');
                }
            }
        };
        reader.readAsText(file);
    };

    const filteredRates = rates.filter(r => 
        r.reference_no.toLowerCase().includes(filter.toLowerCase()) || 
        r.description.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="p-6 max-w-6xl mx-auto animate-fadeIn relative">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Database className="w-8 h-8 text-orange-500" />
                        ITP Rate Manager
                    </h1>
                    <p className="text-zinc-400 text-sm mt-2">Manage standard rates and ITP inspector details.</p>
                </div>
                <div className="flex gap-3">
                     <button 
                        onClick={handleAddNew}
                        className="flex items-center px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg hover:border-orange-500 hover:text-orange-500 transition-all shadow-lg"
                    >
                        <Plus className="w-4 h-4 mr-2" /> Add Rate
                    </button>
                    <button 
                        onClick={handleDownloadTemplate}
                        className="flex items-center px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg hover:border-blue-500 hover:text-blue-500 transition-all shadow-lg"
                        title="Download blank CSV template"
                    >
                        <FileSpreadsheet className="w-4 h-4 mr-2" /> Template
                    </button>
                    <label className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 cursor-pointer shadow-lg shadow-orange-900/20 transition-all hover:translate-y-[-1px]">
                        <Upload className="w-4 h-4 mr-2" />
                        Import CSV
                        <input type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
                    </label>
                    <button 
                        onClick={handleClearAll}
                        className="flex items-center px-4 py-2 bg-red-900/20 border border-red-900/50 text-red-400 rounded-lg hover:bg-red-900/40 hover:text-red-200 transition-all"
                        title="Delete all rates"
                    >
                        <Trash2 className="w-4 h-4 mr-2" /> Clear All
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-zinc-900 rounded-t-xl border-t border-x border-zinc-800 p-4 flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                    <input 
                        type="text" 
                        placeholder="Search by ITP No, Designation, or Inspector..." 
                        className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg focus:ring-1 focus:ring-orange-500 outline-none placeholder-zinc-600"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-zinc-900 rounded-b-xl shadow-lg border border-zinc-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-950 text-zinc-500 font-semibold uppercase text-xs border-b border-zinc-800">
                            <tr>
                                <th className="px-6 py-4">ITP No / Ref</th>
                                <th className="px-6 py-4">Designation / Description</th>
                                <th className="px-6 py-4">Unit</th>
                                <th className="px-6 py-4 text-right">Rate</th>
                                <th className="px-6 py-4 text-right">OT Rate</th>
                                <th className="px-6 py-4 text-right">Curr</th>
                                <th className="px-6 py-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {loading ? (
                                <tr><td colSpan={7} className="p-8 text-center text-zinc-500">Loading rates...</td></tr>
                            ) : filteredRates.length === 0 ? (
                                <tr><td colSpan={7} className="p-8 text-center text-zinc-500">No rates found. Add one or upload CSV.</td></tr>
                            ) : (
                                filteredRates.map((rate, idx) => (
                                    <tr key={rate.id || idx} className="hover:bg-zinc-800/50 transition-colors group">
                                        <td className="px-6 py-4 font-medium text-orange-500 font-mono">{rate.reference_no}</td>
                                        <td className="px-6 py-4 text-zinc-300">{rate.description}</td>
                                        <td className="px-6 py-4 text-zinc-500">{rate.unit}</td>
                                        <td className="px-6 py-4 text-right font-mono text-zinc-200">{rate.rate.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-right font-mono text-zinc-400">{rate.ot_rate ? rate.ot_rate.toFixed(2) : '-'}</td>
                                        <td className="px-6 py-4 text-right text-zinc-600">{rate.currency}</td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEdit(rate)} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                <button onClick={() => handleDelete(rate.id!)} className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div className="mt-4 text-xs text-zinc-600">
                * Format: <strong>ITP No, LOCATION, INSPECTOR, DESIGNATION, Unit, Daily/Hourly Rate, OT Rate</strong>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-zinc-900 w-full max-w-md rounded-xl shadow-2xl border border-zinc-800 overflow-hidden transform transition-all scale-100">
                        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                {editingRate ? <Edit2 className="w-5 h-5 text-orange-500" /> : <Plus className="w-5 h-5 text-green-500" />}
                                {editingRate ? 'Edit Rate' : 'Add New Rate'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Reference No / ITP No</label>
                                <input 
                                    className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                                    value={modalForm.reference_no}
                                    onChange={e => setModalForm({...modalForm, reference_no: e.target.value})}
                                    placeholder="e.g. COMP1-ITP-001"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Description / Inspector</label>
                                <input 
                                    className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                                    value={modalForm.description}
                                    onChange={e => setModalForm({...modalForm, description: e.target.value})}
                                    placeholder="e.g. Senior Welding Inspector"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Unit</label>
                                    <input 
                                        className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:border-orange-500 outline-none"
                                        value={modalForm.unit}
                                        onChange={e => setModalForm({...modalForm, unit: e.target.value})}
                                        placeholder="Day / Hour"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Currency</label>
                                    <select 
                                        className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:border-orange-500 outline-none"
                                        value={modalForm.currency}
                                        onChange={e => setModalForm({...modalForm, currency: e.target.value})}
                                    >
                                        <option value="USD">USD ($)</option>
                                        <option value="EUR">EUR (€)</option>
                                        <option value="GBP">GBP (£)</option>
                                        <option value="QAR">QAR</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Rate Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-zinc-500 font-bold">$</span>
                                        <input 
                                            type="number" step="0.01"
                                            className="w-full pl-7 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-mono focus:border-orange-500 outline-none"
                                            value={modalForm.rate}
                                            onChange={e => setModalForm({...modalForm, rate: parseFloat(e.target.value)})}
                                            placeholder="0.00"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">OT Rate</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-zinc-500 font-bold">$</span>
                                        <input 
                                            type="number" step="0.01"
                                            className="w-full pl-7 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-mono focus:border-orange-500 outline-none"
                                            value={modalForm.ot_rate}
                                            onChange={e => setModalForm({...modalForm, ot_rate: parseFloat(e.target.value)})}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-medium transition-colors">Cancel</button>
                                <button type="submit" className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium shadow-lg shadow-orange-900/20 transition-all flex justify-center items-center gap-2">
                                    <Save className="w-4 h-4" /> Save Rate
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RateManager;