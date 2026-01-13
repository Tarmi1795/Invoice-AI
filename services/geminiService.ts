
// This file is deprecated. Logic has been moved to services/ai/*.ts
// Re-exporting for backward compatibility during refactor.

import { processFinancialDocument } from './ai/invoice';
import { parseITP } from './ai/itp';
import { reconcileDocuments } from './ai/reconciliation';
import { parseQPReport } from './ai/qp';

// Legacy wrapper to route 'itp' to the new parser
export const processDocument = async (base64Data: string, mimeType: string, type: 'invoice' | 'po' | 'timesheet' | 'itp'): Promise<any> => {
    if (type === 'itp') {
        return parseITP(base64Data, mimeType);
    }
    return processFinancialDocument(base64Data, mimeType, type);
};

export { reconcileDocuments, parseQPReport };
