
import React, { useEffect, useState } from 'react';
import { getAllProfiles, updateUserProfile } from '../services/supabaseClient';
import { UserProfile, ModuleId } from '../types';
import { Loader2, Shield, Save, Search, User as UserIcon, Check, X, DollarSign } from 'lucide-react';

const MODULE_OPTIONS: {id: ModuleId, label: string}[] = [
    { id: 'invoice', label: 'Invoice' },
    { id: 'po', label: 'Purchase Orders' },
    { id: 'timesheet', label: 'Timesheets' },
    { id: 'reconciliation', label: 'Reconciliation' },
    { id: 'general', label: 'Universal Parser' },
    { id: 'qp', label: 'QP Report' },
    { id: 'itp', label: 'ITP Parser' },
    { id: 'rates', label: 'Rate Manager' },
    { id: 'templates', label: 'Templates' },
    { id: 'cost', label: 'Cost Tracker' },
    { id: 'admin', label: 'Admin Panel' }
];

const AdminPanel: React.FC = () => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<UserProfile>>({});
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await getAllProfiles();
            setUsers(data);
        } catch (e) {
            console.error(e);
            alert("Failed to load users");
        } finally {
            setLoading(false);
        }
    };

    const startEdit = (user: UserProfile) => {
        setEditingId(user.id);
        setEditForm({
            role: user.role,
            monthly_limit: user.monthly_limit,
            allowed_modules: [...user.allowed_modules]
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({});
    };

    const handleSave = async (id: string) => {
        try {
            await updateUserProfile(id, editForm);
            setEditingId(null);
            loadUsers();
        } catch (e) {
            alert("Failed to update user");
        }
    };

    const toggleModule = (modId: string) => {
        const current = editForm.allowed_modules || [];
        if (current.includes(modId)) {
            setEditForm({ ...editForm, allowed_modules: current.filter(m => m !== modId) });
        } else {
            setEditForm({ ...editForm, allowed_modules: [...current, modId] });
        }
    };

    const filteredUsers = users.filter(u => u.email?.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="p-8 max-w-7xl mx-auto animate-fadeIn">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Shield className="w-8 h-8 text-orange-500" /> Admin Control Panel
                    </h1>
                    <p className="text-zinc-400 mt-2">Manage user permissions, budget limits, and module access.</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                    <input 
                        type="text" 
                        placeholder="Search users..." 
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white focus:border-orange-500 outline-none w-64"
                    />
                </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-950 text-zinc-500 font-semibold uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">User</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4 text-center">Limit ($)</th>
                                <th className="px-6 py-4 text-center">Usage ($)</th>
                                <th className="px-6 py-4">Module Access</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {loading ? (
                                <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-orange-500"/></td></tr>
                            ) : filteredUsers.map(user => {
                                const isEditing = editingId === user.id;

                                return (
                                    <tr key={user.id} className={isEditing ? 'bg-zinc-800/50' : 'hover:bg-zinc-800/30'}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
                                                    <UserIcon className="w-4 h-4 text-zinc-400" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-white font-medium">{user.email}</span>
                                                    <span className="text-xs text-zinc-500 truncate max-w-[150px]">{user.id}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {isEditing ? (
                                                <select 
                                                    value={editForm.role} 
                                                    onChange={e => setEditForm({...editForm, role: e.target.value as any})}
                                                    className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-white outline-none"
                                                >
                                                    <option value="user">User</option>
                                                    <option value="admin">Admin</option>
                                                </select>
                                            ) : (
                                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${user.role === 'admin' ? 'bg-purple-900/30 border-purple-900/50 text-purple-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                                                    {user.role}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {isEditing ? (
                                                <div className="flex items-center justify-center gap-1">
                                                    <span className="text-zinc-500">$</span>
                                                    <input 
                                                        type="number" 
                                                        value={editForm.monthly_limit}
                                                        onChange={e => setEditForm({...editForm, monthly_limit: parseFloat(e.target.value)})}
                                                        className="w-16 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-white text-center outline-none"
                                                    />
                                                </div>
                                            ) : (
                                                <span className="font-mono text-white">${user.monthly_limit.toFixed(2)}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`font-mono font-bold ${user.current_usage > user.monthly_limit ? 'text-red-500' : 'text-green-500'}`}>
                                                    ${user.current_usage.toFixed(4)}
                                                </span>
                                                <div className="w-16 h-1 bg-zinc-800 rounded-full mt-1 overflow-hidden">
                                                    <div 
                                                        className={`h-full ${user.current_usage > user.monthly_limit ? 'bg-red-500' : 'bg-green-500'}`} 
                                                        style={{width: `${Math.min(100, (user.current_usage / user.monthly_limit) * 100)}%`}}
                                                    ></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {isEditing ? (
                                                <div className="flex flex-wrap gap-1 max-w-xs">
                                                    {MODULE_OPTIONS.map(mod => (
                                                        <button 
                                                            key={mod.id}
                                                            onClick={() => toggleModule(mod.id)}
                                                            className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                                                                editForm.allowed_modules?.includes(mod.id) 
                                                                ? 'bg-orange-600 border-orange-500 text-white' 
                                                                : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-white'
                                                            }`}
                                                        >
                                                            {mod.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap gap-1 max-w-xs">
                                                    {user.allowed_modules && user.allowed_modules.slice(0, 4).map(m => (
                                                        <span key={m} className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded border border-zinc-700">
                                                            {m}
                                                        </span>
                                                    ))}
                                                    {(user.allowed_modules?.length || 0) > 4 && (
                                                        <span className="text-[10px] text-zinc-600">+{user.allowed_modules.length - 4} more</span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {isEditing ? (
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => handleSave(user.id)} className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700"><Check className="w-4 h-4" /></button>
                                                    <button onClick={cancelEdit} className="p-1.5 bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600"><X className="w-4 h-4" /></button>
                                                </div>
                                            ) : (
                                                <button onClick={() => startEdit(user)} className="px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800 border border-zinc-700 rounded hover:text-white hover:border-orange-500 transition-colors">
                                                    Manage
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;
