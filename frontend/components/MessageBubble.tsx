import { User, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export function MessageBubble({ role, content, isStreaming }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={`flex gap-4 w-full ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border shadow-sm ${
        isUser 
          ? "bg-white/10 border-white/10 text-white" 
          : "bg-white text-black border-white/20"
      }`}>
        {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
      </div>

      {/* Message Content */}
      <div className={`flex flex-col max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        <div className={`px-5 py-4 ${
          isUser 
            ? "bg-white/10 text-white rounded-2xl rounded-tr-sm border border-white/5" 
            : "bg-transparent text-white/90 rounded-2xl"
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{content}</p>
          ) : isStreaming ? (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-white/90">
              {content || "●"}
            </p>
          ) : (
            <div className="prose prose-invert max-w-none
              prose-p:leading-relaxed prose-p:text-[15px] prose-p:text-white/90
              prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl
              prose-a:text-white prose-a:underline hover:prose-a:text-white/80
              prose-headings:text-white prose-headings:font-medium
              prose-strong:text-white prose-strong:font-semibold
              prose-code:text-white/90 prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        
        {!isUser && isStreaming && !content && (
          <span className="text-xs text-white/40 mt-2 ml-2 flex items-center gap-1">
            <span className="animate-pulse">Thinking</span>
            <span className="animate-bounce delay-100">.</span>
            <span className="animate-bounce delay-200">.</span>
            <span className="animate-bounce delay-300">.</span>
          </span>
        )}
      </div>
    </div>
  );
}
