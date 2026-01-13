
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { InvoiceData } from '../types';
import { numberToWords } from './currency';

const PX_TO_MM = 0.2645;

const getDataUrl = (url: string): Promise<string> => {
    return new Promise((resolve) => {
        if (!url) { resolve(''); return; }
        if (url.startsWith('data:')) {
            resolve(url);
            return;
        }
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
        img.onerror = () => {
             console.warn('Failed to load image, returning empty');
             resolve('');
        };
    });
};

const formatCurrency = (amount: number) => {
    if (isNaN(amount)) return "0.00";
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getValue = (data: InvoiceData, binding?: string, content?: string): string => {
    if (binding) {
        if (binding === 'bankDetails.summary') {
            const b = data.bankDetails;
            return b ? `Account: ${b.accountName}\nBank: ${b.bankName}\nBranch: ${b.branch}\nAcc No: ${b.accountNo}\nSwift: ${b.swiftCode}\nIBAN: ${b.ibanUsd}` : '';
        }
        if (binding === 'amountInWords') {
            return numberToWords(data.grandTotal, data.currency);
        }
        const parts = binding.split('.');
        let val: any = data;
        for (const p of parts) val = val?.[p];
        
        if (val !== undefined && val !== null) {
            // Auto format numbers
            if (typeof val === 'number' && (binding === 'grandTotal' || binding.includes('rate') || binding.includes('total'))) {
                return formatCurrency(val);
            }
            return String(val);
        }
        return '';
    }
    return content || '';
};

export const generateInvoicePDF = async (data: InvoiceData): Promise<jsPDF> => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const elements = data.elements || [];
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
            
            const rawText = getValue(data, el.binding, el.content);
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
            const tableRows = data.summary.map(item => [
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
                headStyles: { fillColor: [240, 240, 240], fontStyle: 'bold', textColor: 50, halign: 'left' },
                columnStyles: { 
                    0: { cellWidth: 'auto', halign: 'left' }, 
                    1: { cellWidth: 25, halign: 'center' },
                    2: { cellWidth: 30, halign: 'right' },
                    3: { cellWidth: 30, halign: 'right' } 
                },
            });
        }
    }

    return doc;
};
