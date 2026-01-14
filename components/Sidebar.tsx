
import React from 'react';
import { FileText, ShoppingCart, Clock, LayoutTemplate, Database, ScanLine, Activity, ArrowRightLeft, Microscope } from 'lucide-react';
import GlitchLogo from './GlitchLogo';

interface SidebarProps {
    activeModule: string;
    onModuleChange: (module: any) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeModule, onModuleChange }) => {
    const menuItems = [
        { id: 'invoice', label: 'Invoice Summarizer', icon: FileText },
        { id: 'po', label: 'PO to Proforma', icon: ShoppingCart },
        { id: 'timesheet', label: 'Timesheet to Invoice', icon: Clock },
        { id: 'reconciliation', label: 'Reconciliation', icon: ArrowRightLeft },
        { id: 'qp', label: 'QP Report Parser', icon: Microscope },
        { id: 'itp', label: 'ITP Parser', icon: ScanLine },
        { id: 'rates', label: 'Rate Manager', icon: Database },
        { id: 'templates', label: 'Template Engine', icon: LayoutTemplate },
        { id: 'cost', label: 'Cost History', icon: Activity },
    ];

    return (
        <div className="w-64 bg-zinc-900 border-r border-zinc-800 text-zinc-300 h-screen fixed left-0 top-0 flex flex-col shadow-2xl z-50">
            <div className="p-6 border-b border-zinc-800 flex flex-col items-center gap-4">
                
                {/* Glitch Logo Component */}
                <GlitchLogo />

                <div className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.2em] relative z-20">
                    VELOSI AI Agent 
                </div>
            </div>
            
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {menuItems.map((item) => (
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
            </nav>

            <div className="p-4 border-t border-zinc-800">
                <div className="p-4 bg-zinc-800/50 border border-zinc-800 rounded-xl">
                    <h4 className="text-xs font-semibold text-zinc-500 uppercase mb-2">System Status</h4>
                    <div className="flex items-center gap-2 text-xs text-green-400">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                        Supabase Connected
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
