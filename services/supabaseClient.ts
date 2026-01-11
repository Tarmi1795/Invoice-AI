import { createClient } from '@supabase/supabase-js';
import { TemplateData } from '../types';

const supabaseUrl = 'https://zmpnigavsyggfhdfdeht.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptcG5pZ2F2c3lnZ2ZoZGZkZWh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMjY5NzEsImV4cCI6MjA4MzcwMjk3MX0.yU_yJ2ke8vg2C6JACykkIyW4sl0X2JyDGGRCHN5MeIM';

export const supabase = createClient(supabaseUrl, supabaseKey);

// --- Templates ---
export const listTemplates = async (): Promise<TemplateData[]> => {
    try {
        const { data, error } = await supabase
            .from('templates')
            .select('*')
            .order('updated_at', { ascending: false });
            
        if (error) throw error;
        
        return (data || []).map((row: any) => ({
            id: row.id,
            name: row.name,
            ...row.data
        }));
    } catch (e) {
        console.warn('Supabase fetch failed, returning local default');
        const local = localStorage.getItem('invoice_template');
        return local ? [JSON.parse(local)] : [];
    }
};

export const saveTemplate = async (template: TemplateData): Promise<TemplateData> => {
    const { id, name, ...templateData } = template;
    
    try {
        const payload = {
            name: name || 'Untitled Template',
            data: templateData,
            updated_at: new Date().toISOString()
        };

        let result;
        if (id) {
            result = await supabase.from('templates').update(payload).eq('id', id).select().single();
        } else {
            result = await supabase.from('templates').insert(payload).select().single();
        }

        if (result.error) throw result.error;
        
        return {
            id: result.data.id,
            name: result.data.name,
            ...result.data.data
        };
    } catch (e) {
        console.error('Supabase save error', e);
        throw e;
    }
};

export const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from('templates').delete().eq('id', id);
    if (error) throw error;
};

// --- Rates ---
export interface RateItem {
    id?: string;
    reference_no: string;
    description: string;
    unit: string;
    rate: number;
    ot_rate?: number;
    currency: string;
}

export const fetchRates = async (): Promise<RateItem[]> => {
    const { data, error } = await supabase
        .from('rates')
        .select('*')
        .order('reference_no', { ascending: true });
    
    if (error) {
        console.error('Error fetching rates', error);
        return [];
    }
    return data || [];
};

export const insertRates = async (rates: RateItem[]) => {
    const { error } = await supabase.from('rates').insert(rates);
    if (error) throw error;
};

export const updateRate = async (rate: RateItem) => {
    if (!rate.id) throw new Error("Rate ID is required for update");
    const { id, ...updates } = rate;
    const { error } = await supabase.from('rates').update(updates).eq('id', id);
    if (error) throw error;
};

export const deleteRate = async (id: string) => {
    const { error } = await supabase.from('rates').delete().eq('id', id);
    if (error) throw error;
};

export const deleteAllRates = async () => {
    // Matches everything where reference_no is not a dummy value
    // This effectively deletes all rows
    const { error } = await supabase.from('rates').delete().neq('reference_no', '__DELETE_ALL_GUARD__');
    if (error) throw error;
};