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
    <main className="flex flex-col min-h-screen relative overflow-hidden bg-background">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-1/4 w-100 h-100 bg-white/5 rounded-full blur-[60px] pointer-events-none -translate-y-1/2 opacity-30" />
      <div className="absolute bottom-0 right-1/4 w-100 h-100 bg-white/5 rounded-full blur-[80px] pointer-events-none translate-y-1/3 opacity-20" />
      
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
