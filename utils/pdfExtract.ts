
import * as pdfjsLib from 'pdfjs-dist';

// Fix for "Cannot set properties of undefined (setting 'workerSrc')"
const pdfjs: any = (pdfjsLib as any).default || pdfjsLib;

// Use cdnjs for the worker as it provides a reliable UMD build.
// Must match the version of pdfjs-dist used in index.html (3.11.174)
const WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export const extractTextFromPDF = async (file: File): Promise<string> => {
    // Ensure worker is configured
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        try {
            // Fetch the worker script and create a Blob URL to bypass Cross-Origin Worker restrictions
            const response = await fetch(WORKER_URL);
            if (!response.ok) throw new Error("Failed to fetch PDF worker script");
            
            const workerScript = await response.text();
            const blob = new Blob([workerScript], { type: 'text/javascript' });
            const blobUrl = URL.createObjectURL(blob);
            
            pdfjs.GlobalWorkerOptions.workerSrc = blobUrl;
        } catch (error) {
            console.warn("Failed to load PDF worker via Blob, falling back to direct CDN URL. This may fail due to CORS.", error);
            pdfjs.GlobalWorkerOptions.workerSrc = WORKER_URL;
        }
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        
        // Use the resolved pdfjs object which contains getDocument
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        let fullText = "";
        
        // Loop through all pages
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            
            // Join text items with space
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(" ");
            
            fullText += `--- PAGE ${i} ---\n${pageText}\n\n`;
        }

        return fullText;
    } catch (error) {
        console.error("PDF Text Extraction Failed:", error);
        throw new Error("Failed to extract text from PDF. The file might be corrupted or the PDF worker failed to initialize.");
    }
};
