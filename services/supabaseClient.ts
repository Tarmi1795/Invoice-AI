
import { createClient } from '@supabase/supabase-js';
import { TemplateData, UsageLog, TrainingExample, ModuleId } from '../types';

const supabaseUrl = 'https://zmpnigavsyggfhdfdeht.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptcG5pZ2F2c3lnZ2ZoZGZkZWh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMjY5NzEsImV4cCI6MjA4MzcwMjk3MX0.yU_yJ2ke8vg2C6JACykkIyW4sl0X2JyDGGRCHN5MeIM';

export const supabase = createClient(supabaseUrl, supabaseKey);

/*
=== SQL SETUP FOR SELF-LEARNING MODULE ===
Please refer to SUPABASE_SETUP.md for the SQL query.
*/

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

/**
 * Inserts new rates or updates existing ones if the reference_no matches.
 * REQUIRES: A unique constraint on 'reference_no' column in the database.
 */
export const upsertRates = async (rates: RateItem[]) => {
    const { error } = await supabase.from('rates').upsert(rates, { onConflict: 'reference_no' });
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
    const { error } = await supabase.from('rates').delete().neq('reference_no', '__DELETE_ALL_GUARD__');
    if (error) throw error;
};

// --- Usage & Cost Tracking ---

export const logUsage = async (log: UsageLog) => {
    try {
        // If table doesn't exist, this will fail silently in the UI but log to console
        const { error } = await supabase.from('usage_logs').insert(log);
        if (error) console.warn('Failed to log usage:', error.message);
    } catch (e) {
        console.warn('Usage logging skipped (likely no table)');
    }
};

export const fetchUsageLogs = async (days: number = 30): Promise<UsageLog[]> => {
    try {
        const date = new Date();
        date.setDate(date.getDate() - days);
        
        const { data, error } = await supabase
            .from('usage_logs')
            .select('*')
            .gte('created_at', date.toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (e) {
        console.warn('Failed to fetch usage logs');
        return [];
    }
};

// --- Self-Learning / Training Data ---

/**
 * Fetches similar past verified examples to help the AI context.
 */
export const getLearningExamples = async (moduleId: ModuleId, limit: number = 3): Promise<TrainingExample[]> => {
    try {
        const { data, error } = await supabase
            .from('training_data')
            .select('*')
            .eq('module_id', moduleId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.warn('Error fetching training examples:', error.message);
            return [];
        }
        
        return (data || []) as TrainingExample[];
    } catch (e) {
        console.warn('Training data fetch failed (likely table missing)');
        return [];
    }
};

/**
 * Saves a "Golden Record" - a human-verified input/output pair
 * used to teach the AI in future prompts.
 */
export const saveLearningExample = async (moduleId: ModuleId, input: string, output: any, userId?: string) => {
    try {
        const { error } = await supabase
            .from('training_data')
            .insert({
                module_id: moduleId,
                input_context: input,
                output_json: output,
                user_id: userId || 'anon'
            });

        if (error) throw error;
        console.log("Learning example saved successfully");
    } catch (e) {
        console.error("Failed to save learning example:", e);
        throw e;
    }
};
