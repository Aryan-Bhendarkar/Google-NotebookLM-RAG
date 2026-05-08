"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, FileText } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { SourceCard } from "./SourceCard";

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
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cancel any in-flight stream on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Auto-scroll only when a new message is added, not on every streaming chunk
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userQuery = input.trim();
    setInput("");

    const userMsgId = Date.now().toString();
    setMessages(prev => [...prev, { id: userMsgId, role: "user", content: userQuery }]);

    setIsLoading(true);

    const assistantMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantMsgId, role: "assistant", content: "" }]);

    abortControllerRef.current = new AbortController();

    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userQuery, collection_name: collectionName, stream: true }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error("Failed to get response");

      reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");

      if (!reader) throw new Error("No reader available");

      let fullContent = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullContent += decoder.decode(value, { stream: true });
        setMessages(prev =>
          prev.map(msg => msg.id === assistantMsgId ? { ...msg, content: fullContent } : msg)
        );
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") return;
      console.error("Chat error:", error);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMsgId
            ? { ...msg, content: "Sorry, I encountered an error while processing your request." }
            : msg
        )
      );
    } finally {
      reader?.cancel();
      setIsLoading(false);
    }
  }, [input, isLoading, collectionName]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex w-full max-w-7xl mx-auto h-[calc(100vh-100px)] gap-6 p-4 pt-6">
      
      {/* Left sidebar - Document Info (Could hold sources later) */}
      <div className="hidden lg:flex flex-col w-72 flex-shrink-0 gap-4">
        <div className="bg-white/[0.03] border border-white/5 p-6 rounded-2xl">
          <div className="flex items-center gap-2 mb-4 text-white/70">
            <FileText className="w-4 h-4" />
            <h3 className="font-medium text-xs tracking-wider uppercase">Active Document</h3>
          </div>
          <p className="text-sm font-medium text-white/90 truncate" title={filename}>
            {filename}
          </p>
          <div className="mt-5 pt-5 border-t border-white/10 text-xs text-white/40 space-y-1.5 flex flex-col">
            <p>ID: <span className="font-mono text-white/50">{documentId.substring(0, 8)}...</span></p>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
              <span className="text-white/60">Indexed & Ready</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white/[0.01] border border-white/5 p-6 rounded-2xl flex-1 flex flex-col items-center justify-center text-center opacity-60">
          <p className="text-xs text-white/40">Sources will appear inline with responses.</p>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden relative shadow-2xl">
        
        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6"
        >
          <div className="flex flex-col gap-8 pb-4 max-w-3xl mx-auto">
            {messages.map((msg) => (
              <div key={msg.id}>
                <MessageBubble
                  role={msg.role}
                  content={msg.content}
                  isStreaming={isLoading && msg.id === messages[messages.length - 1].id && msg.role === "assistant"}
                />
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
              </div>
            ))}
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 bg-background border-t border-white/5">
          <div className="relative flex items-end gap-3 max-w-3xl mx-auto">
            <div className="relative flex-1 bg-white/[0.04] rounded-2xl border border-white/10 focus-within:border-white/30 focus-within:bg-white/[0.06] transition-all shadow-inner">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question about your document..."
                className="w-full max-h-32 min-h-[56px] bg-transparent border-none focus:ring-0 outline-none resize-none py-4 px-5 text-sm placeholder:text-white/30"
                rows={1}
                disabled={isLoading}
              />
            </div>
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="h-[56px] w-[56px] flex-shrink-0 flex items-center justify-center rounded-2xl bg-white text-black hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <div className="text-center mt-3">
            <p className="text-[11px] text-white/30">AI can make mistakes. Always double-check important info.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
