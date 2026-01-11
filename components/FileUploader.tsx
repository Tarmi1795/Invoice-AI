import React, { useCallback, useState } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect, disabled }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const validateAndSetFile = (file: File) => {
    // Basic validation for PDF or Images
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PDF or an Image (JPG, PNG).');
      return;
    }
    // Size limit (Gemini limit is high, but let's be reasonable for browser, e.g., 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB.');
      return;
    }

    setError(null);
    setSelectedFile(file);
    onFileSelect(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  }, [onFileSelect]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setError(null);
    // Reset the input value if needed, though simpler to just ignore
  };

  return (
    <div className="w-full">
      {!selectedFile ? (
        <div
          className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl transition-all duration-300 ease-in-out cursor-pointer overflow-hidden
            ${dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-white hover:bg-gray-50'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleChange}
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            disabled={disabled}
          />
          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
            <div className={`p-4 rounded-full mb-4 ${dragActive ? 'bg-indigo-100' : 'bg-gray-100'}`}>
              <Upload className={`w-8 h-8 ${dragActive ? 'text-indigo-600' : 'text-gray-500'}`} />
            </div>
            <p className="mb-2 text-sm font-semibold text-gray-700">
              <span className="text-indigo-600">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500">
              PDF, PNG, JPG (max 10MB)
            </p>
          </div>
        </div>
      ) : (
        <div className="relative flex items-center p-4 bg-white border border-indigo-200 rounded-xl shadow-sm">
          <div className="p-3 bg-indigo-100 rounded-lg mr-4">
            <FileText className="w-6 h-6 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {selectedFile.name}
            </p>
            <p className="text-xs text-gray-500">
              {(selectedFile.size / 1024).toFixed(2)} KB
            </p>
          </div>
          {!disabled && (
            <button
              onClick={clearFile}
              className="p-2 ml-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
      
      {error && (
        <div className="mt-3 flex items-center p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100 animate-fadeIn">
          <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
};

export default FileUploader;
