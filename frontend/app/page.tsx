"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { FileUpload } from "@/components/FileUpload";
import { ChatInterface } from "@/components/ChatInterface";
import { motion, AnimatePresence } from "framer-motion";

interface DocumentInfo {
  id: string;
  collectionName: string;
  filename: string;
}

export default function Home() {
  const [activeDoc, setActiveDoc] = useState<DocumentInfo | null>(null);

  return (
    <main className="flex flex-col min-h-screen relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 opacity-50" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none translate-y-1/3 opacity-30" />
      
      <Header />

      <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full pt-8">
        <AnimatePresence mode="wait">
          {!activeDoc ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="w-full"
            >
              <FileUpload 
                onUploadSuccess={(id, collectionName, filename) => 
                  setActiveDoc({ id, collectionName, filename })
                } 
              />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
              className="w-full"
            >
              <ChatInterface 
                documentId={activeDoc.id}
                collectionName={activeDoc.collectionName}
                filename={activeDoc.filename}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
