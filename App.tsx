
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import DocumentQueue from './components/DocumentQueue';
import TemplateEditor from './components/TemplateEditor';
import RateManager from './components/RateManager';
import ITPParser from './components/ITPParser';
import CostTracker from './components/CostTracker';
import Reconciliation from './components/Reconciliation';
import QPReportParser from './components/QPReportParser';
import GeneralParser from './components/GeneralParser';
import LoginPage from './components/LoginPage';
import AdminPanel from './components/AdminPanel';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Loader2 } from 'lucide-react';
import { checkUsageLimit } from './services/ai/utils';

type Module = 'invoice' | 'po' | 'timesheet' | 'templates' | 'rates' | 'itp' | 'cost' | 'reconciliation' | 'qp' | 'general' | 'admin';

const MainContent: React.FC = () => {
  const { session, loading, hasModuleAccess, isAdmin } = useAuth();
  const [activeModule, setActiveModule] = useState<Module>('invoice');

  // Ensure active module is allowed, otherwise switch
  useEffect(() => {
     if (!loading && session && !isAdmin && !hasModuleAccess(activeModule) && activeModule !== 'admin') {
         // Default to invoice if current is forbidden, or find first allowed
         setActiveModule('invoice');
     }
  }, [session, loading, activeModule, isAdmin]);

  if (loading) {
      return (
          <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-orange-500">
              <Loader2 className="w-10 h-10 animate-spin" />
          </div>
      );
  }

  if (!session) {
      return <LoginPage />;
  }

  const renderModule = () => {
    // Basic permissions check
    if (!isAdmin && activeModule === 'admin') return <div className="text-red-500 p-8">Access Denied</div>;
    if (!isAdmin && !hasModuleAccess(activeModule)) return <div className="text-red-500 p-8">Module Restricted. Contact Admin.</div>;

    switch (activeModule) {
        case 'invoice':
            return <DocumentQueue type="invoice" title="Invoice Summarizer" description="Upload multiple invoices to generate concise summaries." />;
        case 'po':
            return <DocumentQueue type="po" title="PO to Proforma" description="Convert Purchase Orders into Proforma Invoices automatically." />;
        case 'timesheet':
            return <DocumentQueue type="timesheet" title="Timesheet to Invoice" description="Turn Timesheet logs into billable invoices." />;
        case 'reconciliation':
            return <Reconciliation />;
        case 'qp':
            return <QPReportParser />;
        case 'itp':
            return <ITPParser />;
        case 'general':
            return <GeneralParser />;
        case 'rates':
            return <RateManager />;
        case 'templates':
            return <TemplateEditor />;
        case 'cost':
            return <CostTracker />;
        case 'admin':
            return <AdminPanel />;
        default:
            return <div>Select a module</div>;
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 font-sans text-zinc-200">
      <Sidebar activeModule={activeModule} onModuleChange={setActiveModule} />
      
      <main className="flex-1 ml-64 p-8 h-screen overflow-y-auto bg-zinc-950">
        {renderModule()}
      </main>
    </div>
  );
};

const App: React.FC = () => {
    return (
        <AuthProvider>
            <MainContent />
        </AuthProvider>
    );
}

export default App;
