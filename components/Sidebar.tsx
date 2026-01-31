
import React from 'react';
import { FileText, ShoppingCart, Clock, LayoutTemplate, Database, ScanLine, Activity, ArrowRightLeft, Microscope, Boxes, LogOut, Shield } from 'lucide-react';
import GlitchLogo from './GlitchLogo';
import { useAuth } from '../context/AuthContext';
import { ModuleId } from '../types';

interface SidebarProps {
    activeModule: string;
    onModuleChange: (module: any) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeModule, onModuleChange }) => {
    const { hasModuleAccess, signOut, isAdmin, profile } = useAuth();

    const menuItems = [
        { id: 'invoice', label: 'Invoice Summarizer', icon: FileText },
        { id: 'po', label: 'PO to Proforma', icon: ShoppingCart },
        { id: 'timesheet', label: 'Timesheet to Invoice', icon: Clock },
        { id: 'reconciliation', label: 'Reconciliation', icon: ArrowRightLeft },
        { id: 'general', label: 'General / Universal', icon: Boxes },
        { id: 'qp', label: 'QP Report Parser', icon: Microscope },
        { id: 'itp', label: 'ITP Parser', icon: ScanLine },
        { id: 'rates', label: 'Rate Manager', icon: Database },
        { id: 'templates', label: 'Template Engine', icon: LayoutTemplate },
        { id: 'cost', label: 'Cost History', icon: Activity },
    ];

    // Filter items based on user profile
    const allowedItems = menuItems.filter(item => hasModuleAccess(item.id));

    return (
        <div className="w-64 bg-zinc-900 border-r border-zinc-800 text-zinc-300 h-screen fixed left-0 top-0 flex flex-col shadow-2xl z-50">
            <div className="p-6 border-b border-zinc-800 flex flex-col items-center gap-4">
                
                {/* Glitch Logo Component */}
                <GlitchLogo />

                <div className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.2em] relative z-20">
                    VELOSI AI Agent 
                </div>
            </div>
            
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
                {allowedItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onModuleChange(item.id)}
                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 group
                            ${activeModule === item.id 
                                ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/40 translate-x-1' 
                                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white hover:translate-x-1'
                            }
                        `}
                    >
                        <item.icon className={`w-5 h-5 transition-colors duration-300 ${activeModule === item.id ? 'text-white' : 'text-zinc-500 group-hover:text-orange-400'}`} />
                        <span className="font-medium text-sm">{item.label}</span>
                    </button>
                ))}

                {isAdmin && (
                    <>
                        <div className="my-2 border-t border-zinc-800/50"></div>
                        <button
                            onClick={() => onModuleChange('admin')}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 group
                                ${activeModule === 'admin' 
                                    ? 'bg-purple-900 text-white shadow-lg shadow-purple-900/40 translate-x-1' 
                                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white hover:translate-x-1'
                                }
                            `}
                        >
                            <Shield className="w-5 h-5" />
                            <span className="font-medium text-sm">Admin Panel</span>
                        </button>
                    </>
                )}
            </nav>

            <div className="p-4 border-t border-zinc-800 bg-zinc-900">
                <div className="flex flex-col gap-2">
                     <div className="flex items-center gap-3 px-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold text-xs">
                             {profile?.email?.[0].toUpperCase()}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                             <span className="text-xs font-bold text-white truncate w-32">{profile?.email}</span>
                             <span className="text-[10px] text-zinc-500 uppercase">{profile?.role}</span>
                        </div>
                     </div>
                     
                    {/* Usage Meter */}
                    <div className="px-2 mb-3">
                         <div className="flex justify-between text-[10px] mb-1 text-zinc-400">
                             <span>Monthly Limit</span>
                             <span>${profile?.current_usage?.toFixed(2)} / ${profile?.monthly_limit?.toFixed(2)}</span>
                         </div>
                         <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                             <div 
                                className={`h-full ${ (profile?.current_usage || 0) > (profile?.monthly_limit || 1) ? 'bg-red-500' : 'bg-green-500' }`} 
                                style={{width: `${Math.min(100, ((profile?.current_usage || 0) / (profile?.monthly_limit || 1)) * 100)}%`}}
                             ></div>
                         </div>
                    </div>

                    <button 
                        onClick={() => signOut()}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-600 transition-all text-xs font-medium"
                    >
                        <LogOut className="w-3 h-3" />
                        <span>Sign Out</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
