"use client";

import { useState, useRef, useEffect } from "react";
import { Send, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageBubble } from "./MessageBubble";
import { SourceCard } from "./SourceCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface Source {
  page_number: string | number;
  content: string;
  relevance_score: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

interface ChatInterfaceProps {
  documentId: string;
  collectionName: string;
  filename: string;
}

export function ChatInterface({ documentId, collectionName, filename }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `I've successfully processed **${filename}**. What would you like to know about it?`
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userQuery = input.trim();
    setInput("");
    
    // Add user message
    const userMsgId = Date.now().toString();
    setMessages(prev => [...prev, { id: userMsgId, role: "user", content: userQuery }]);
    
    setIsLoading(true);
    
    // Add placeholder assistant message for streaming
    const assistantMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantMsgId, role: "assistant", content: "" }]);

    try {
      // In this basic version, we are not parsing SSE streaming from Python,
      // instead we wait for the full response. (For a true streaming UI, we'd use EventSource or fetch reader)
      // Since our FastAPI returns raw text for the stream, let's read it as a stream.
      
      const response = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userQuery,
          collection_name: collectionName,
          stream: true
        })
      });

      if (!response.ok) throw new Error("Failed to get response");
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      
      if (!reader) throw new Error("No reader available");

      let fullContent = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        
        // Update the assistant message with new content
        setMessages(prev => 
          prev.map(msg => 
            msg.id === assistantMsgId 
              ? { ...msg, content: fullContent } 
              : msg
          )
        );
      }
      
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => 
        prev.map(msg => 
          msg.id === assistantMsgId 
            ? { ...msg, content: "Sorry, I encountered an error while processing your request." } 
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex w-full max-w-6xl mx-auto h-[calc(100vh-120px)] gap-6 p-4">
      
      {/* Left sidebar - Document Info (Could hold sources later) */}
      <div className="hidden lg:flex flex-col w-64 flex-shrink-0 gap-4">
        <div className="glass-panel p-5 rounded-2xl">
          <div className="flex items-center gap-3 mb-4 text-primary">
            <FileText className="w-5 h-5" />
            <h3 className="font-semibold text-sm tracking-wide uppercase">Active Document</h3>
          </div>
          <p className="text-sm font-medium text-foreground truncate" title={filename}>
            {filename}
          </p>
          <div className="mt-4 pt-4 border-t border-white/10 text-xs text-muted-foreground">
            <p>ID: {documentId}</p>
            <p className="mt-1">Status: Indexed & Ready</p>
          </div>
        </div>
        
        <div className="glass-panel p-5 rounded-2xl flex-1 flex flex-col items-center justify-center text-center opacity-50">
          <p className="text-xs text-muted-foreground">Source citations will appear inline with messages.</p>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col glass-panel rounded-3xl overflow-hidden relative border border-white/10 shadow-2xl">
        
        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 scroll-smooth"
        >
          <div className="flex flex-col gap-8 pb-4">
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <MessageBubble 
                    role={msg.role} 
                    content={msg.content} 
                    isStreaming={isLoading && msg.id === messages[messages.length - 1].id && msg.role === 'assistant'}
                  />
                  
                  {/* Sources if any */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 pl-14 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {msg.sources.map((src, i) => (
                        <SourceCard 
                          key={i}
                          pageNumber={src.page_number}
                          content={src.content}
                          relevanceScore={src.relevance_score}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 bg-background/50 backdrop-blur-xl border-t border-white/10">
          <div className="relative flex items-end gap-2 max-w-4xl mx-auto">
            <div className="relative flex-1 bg-secondary rounded-2xl border border-white/10 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all shadow-inner">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question about the document..."
                className="w-full max-h-32 min-h-[56px] py-4 pl-4 pr-12 bg-transparent border-none resize-none focus:outline-none focus:ring-0 text-sm leading-relaxed"
                rows={1}
              />
            </div>
            
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={`absolute right-2 bottom-2 p-2 rounded-xl transition-all duration-300 flex items-center justify-center
                ${input.trim() && !isLoading 
                  ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(168,85,247,0.5)] hover:scale-105" 
                  : "bg-white/5 text-muted-foreground cursor-not-allowed"}
              `}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="text-center mt-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
              AI can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
