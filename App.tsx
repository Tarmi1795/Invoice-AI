import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import DocumentQueue from './components/DocumentQueue';
import TemplateEditor from './components/TemplateEditor';
import RateManager from './components/RateManager';
import ITPParser from './components/ITPParser';

type Module = 'invoice' | 'po' | 'timesheet' | 'templates' | 'rates' | 'itp';

const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState<Module>('invoice');

  const renderModule = () => {
    switch (activeModule) {
        case 'invoice':
            return <DocumentQueue type="invoice" title="Invoice Summarizer" description="Upload multiple invoices to generate concise summaries." />;
        case 'po':
            return <DocumentQueue type="po" title="PO to Proforma" description="Convert Purchase Orders into Proforma Invoices automatically." />;
        case 'timesheet':
            return <DocumentQueue type="timesheet" title="Timesheet to Invoice" description="Turn Timesheet logs into billable invoices." />;
        case 'itp':
            return <ITPParser />;
        case 'rates':
            return <RateManager />;
        case 'templates':
            return <TemplateEditor />;
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

export default App;