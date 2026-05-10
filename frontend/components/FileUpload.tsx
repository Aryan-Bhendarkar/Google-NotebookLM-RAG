"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, File, AlertCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FileUploadProps {
  onUploadSuccess: (documentId: string, collectionName: string, filename: string) => void;
}

export function FileUpload({ onUploadSuccess }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
      const response = await fetch(`${base}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to upload document");
      }

      const data = await response.json();
      onUploadSuccess(data.document_id, data.collection_name, data.filename);
      
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "An unexpected error occurred.");
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setIsUploading(false);
    }
  }, [onUploadSuccess]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt']
    },
    maxFiles: 1,
    disabled: isUploading
  });

  return (
    <div className="w-full max-w-3xl mx-auto mt-20 px-4">
      <div className="text-center mb-10">
        <h2 className="text-[2rem] font-semibold tracking-tight mb-3 text-white">Upload Knowledge Source</h2>
        <p className="text-white/50 text-[15px] font-medium tracking-wide">Provide documents to ground your AI assistant.</p>
      </div>

      <div
        {...getRootProps()}
        className={`relative overflow-hidden bg-white/[0.02] rounded-[24px] p-14 cursor-pointer border transition-all duration-300 group
          ${isDragActive ? "border-white/40 bg-white/[0.04]" : "border-white/10"}
          ${isDragReject ? "border-red-500/50 bg-red-500/5" : ""}
          ${isUploading ? "opacity-60 cursor-not-allowed" : "hover:border-white/20 hover:bg-white/[0.03]"}
        `}
      >
        <input {...getInputProps()} />
        
        <motion.div
           whileHover={!isUploading ? { scale: 1.01 } : {}}
           whileTap={!isUploading ? { scale: 0.99 } : {}}
           className="flex flex-col items-center justify-center gap-6 relative z-10 w-full h-full"
        >
          <AnimatePresence mode="wait">
            {isUploading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="p-5 rounded-2xl bg-white/10 text-white shadow-xl shadow-black/20"
              >
                <Loader2 className="w-8 h-8 animate-spin text-white" />
              </motion.div>
            ) : (
              <motion.div
                key="upload"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`p-5 rounded-2xl transition-colors duration-300 ${isDragActive ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50 group-hover:text-white/80 group-hover:bg-white/10'}`}
              >
                <UploadCloud className="w-8 h-8" />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="text-center space-y-2">
            {isUploading ? (
              <>
                <p className="text-lg font-medium text-white/90">Processing...</p>
                <p className="text-sm text-white/40 animate-pulse">Running chunking & embeddings.</p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium text-white/90">
                  {isDragActive ? "Drop here" : "Select or drop a file"}
                </p>
                <p className="text-sm text-white/40">
                  PDF or TXT up to 10MB
                </p>
              </>
            )}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-6 p-4 border border-red-500/20 bg-red-500/10 text-red-200 rounded-xl flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
