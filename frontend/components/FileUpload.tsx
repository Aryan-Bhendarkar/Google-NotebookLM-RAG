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
      // We assume backend is running on localhost:8000
      const response = await fetch("http://localhost:8000/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to upload document");
      }

      const data = await response.json();
      onUploadSuccess(data.document_id, data.collection_name, data.filename);
      
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
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
    <div className="w-full max-w-2xl mx-auto mt-12 px-4">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold tracking-tight mb-3 glow-text">Knowledge Base</h2>
        <p className="text-muted-foreground text-lg">Upload a document to start a conversation.</p>
      </div>

      <motion.div
        whileHover={!isUploading ? { scale: 1.02 } : {}}
        whileTap={!isUploading ? { scale: 0.98 } : {}}
        {...getRootProps()}
        className={`relative overflow-hidden glass-panel rounded-2xl p-12 cursor-pointer border-2 border-dashed transition-all duration-300
          ${isDragActive ? "border-primary bg-primary/5" : "border-white/10"}
          ${isDragReject ? "border-destructive bg-destructive/5" : ""}
          ${isUploading ? "opacity-70 cursor-not-allowed" : "hover:border-primary/50"}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center justify-center gap-4 relative z-10">
          <AnimatePresence mode="wait">
            {isUploading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="p-4 rounded-full bg-primary/20 text-primary"
              >
                <Loader2 className="w-10 h-10 animate-spin" />
              </motion.div>
            ) : (
              <motion.div
                key="upload"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`p-4 rounded-full ${isDragActive ? 'bg-primary/20 text-primary' : 'bg-white/5 text-muted-foreground'}`}
              >
                <UploadCloud className="w-10 h-10" />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="text-center space-y-2">
            {isUploading ? (
              <>
                <p className="text-xl font-medium">Processing Document...</p>
                <p className="text-sm text-primary animate-pulse">Chunking & embedding with Google Gemini...</p>
              </>
            ) : (
              <>
                <p className="text-xl font-medium">
                  {isDragActive ? "Drop document here" : "Click or drag to upload"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Supports PDF and TXT files up to 10MB
                </p>
              </>
            )}
          </div>
        </div>
        
        {/* Decorative background glow */}
        {isDragActive && (
          <div className="absolute inset-0 bg-primary/10 blur-[100px] pointer-events-none" />
        )}
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-6 p-4 glass-panel border-destructive/30 bg-destructive/10 text-destructive rounded-xl flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
