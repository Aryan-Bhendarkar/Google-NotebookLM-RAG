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
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border shadow-lg ${
        isUser 
          ? "bg-secondary border-white/10 text-foreground" 
          : "bg-primary/20 border-primary/30 text-primary"
      }`}>
        {isUser ? <User className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
      </div>

      {/* Message Content */}
      <div className={`flex flex-col max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
        <div className={`px-5 py-4 rounded-2xl ${
          isUser 
            ? "bg-secondary text-foreground rounded-tr-sm border border-white/5 shadow-md" 
            : "glass-panel rounded-tl-sm"
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none 
              prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content || (isStreaming ? "●" : "")}
              </ReactMarkdown>
            </div>
          )}
        </div>
        
        {!isUser && isStreaming && !content && (
          <span className="text-xs text-muted-foreground mt-2 ml-2 flex items-center gap-1">
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
