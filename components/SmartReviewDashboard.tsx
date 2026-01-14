
import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Save, BrainCircuit, RefreshCw } from 'lucide-react';
import { ModuleId, ConfidenceAwareResult } from '../types';
import { saveLearningExample } from '../services/supabaseClient';

interface SmartReviewDashboardProps<T> {
  moduleId: ModuleId;
  result: ConfidenceAwareResult<T>;
  onVerify: (verifiedData: T) => void;
  onCancel: () => void;
  fieldLabels: Record<keyof T, string>;
}

export function SmartReviewDashboard<T extends Record<string, any>>({ 
  moduleId, 
  result, 
  onVerify, 
  onCancel,
  fieldLabels 
}: SmartReviewDashboardProps<T>) {
  const [formData, setFormData] = useState<T>(result.data);
  const [isTraining, setIsTraining] = useState(false);

  const handleChange = (key: keyof T, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleVerifyAndTrain = async () => {
    setIsTraining(true);
    try {
      // 1. Save to Supabase Learning Memory if we have context
      if (result.extracted_text) {
         await saveLearningExample(moduleId, result.extracted_text, formData);
      }
      
      // 2. Complete verification
      onVerify(formData);
    } catch (e) {
      alert("Failed to save training data, but verification will proceed locally.");
      onVerify(formData);
    } finally {
      setIsTraining(false);
    }
  };

  const renderConfidenceBadge = (score: number) => {
    if (score >= 0.9) return <span className="text-[10px] bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded border border-green-900/50">High Confidence</span>;
    if (score >= 0.7) return <span className="text-[10px] bg-yellow-900/30 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-900/50">Review Needed</span>;
    return <span className="text-[10px] bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded border border-red-900/50 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Low Confidence</span>;
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden animate-fadeIn">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-950 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-orange-500" />
            AI Review & Train
          </h3>
          <p className="text-xs text-zinc-400">Verify the data below. Corrections will improve future accuracy.</p>
        </div>
        <div className="text-right">
             <div className="text-2xl font-bold text-white">{(result.average_confidence * 100).toFixed(0)}%</div>
             <div className="text-[10px] text-zinc-500 uppercase tracking-wider">AI Confidence</div>
        </div>
      </div>

      {/* Form Grid */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.keys(fieldLabels).map((key) => {
           const fieldKey = key as keyof T;
           const score = result.confidence_scores[fieldKey] || 0;
           const isLowConfidence = score < 0.8;
           
           return (
             <div key={key as string} className={`relative group ${isLowConfidence ? 'animate-pulse-slow' : ''}`}>
                <div className="flex justify-between items-center mb-1">
                   <label className={`text-xs font-bold uppercase ${isLowConfidence ? 'text-yellow-500' : 'text-zinc-500'}`}>
                      {fieldLabels[fieldKey]}
                   </label>
                   {renderConfidenceBadge(score)}
                </div>
                <input 
                  type="text"
                  value={formData[fieldKey]} 
                  onChange={(e) => handleChange(fieldKey, e.target.value)}
                  className={`
                    w-full p-3 bg-zinc-950 border rounded-lg text-sm text-white outline-none transition-all
                    ${isLowConfidence 
                      ? 'border-yellow-600/50 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500' 
                      : 'border-zinc-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500'
                    }
                  `}
                />
             </div>
           );
        })}
      </div>
      
      {/* Extracted Context Preview (Collapsed/Optional could be added here) */}
      
      {/* Actions */}
      <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex justify-end gap-3">
        <button 
          onClick={onCancel}
          className="px-4 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button 
          onClick={handleVerifyAndTrain}
          disabled={isTraining}
          className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-lg shadow-green-900/20 flex items-center gap-2 transition-all disabled:opacity-50"
        >
          {isTraining ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Verify & Train AI
        </button>
      </div>
    </div>
  );
}
