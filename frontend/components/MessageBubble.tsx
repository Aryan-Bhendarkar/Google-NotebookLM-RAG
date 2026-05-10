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

      {/* Message content */}
      <div className={`flex flex-col max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        <div className={`px-5 py-4 ${
          isUser
            ? "bg-white/10 text-white rounded-2xl rounded-tr-sm border border-white/5"
            : "bg-transparent text-white/90 rounded-2xl"
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{content}</p>
          ) : (
            <div className="
              prose prose-invert max-w-none
              prose-p:leading-relaxed prose-p:text-[15px] prose-p:text-white/90 prose-p:my-2
              prose-headings:text-white prose-headings:font-semibold prose-headings:mt-5 prose-headings:mb-2
              prose-h2:text-base prose-h3:text-sm
              prose-strong:text-white prose-strong:font-semibold
              prose-em:text-white/80
              prose-ul:pl-5 prose-ul:my-3 prose-ul:space-y-1
              prose-ol:pl-5 prose-ol:my-3 prose-ol:space-y-1
              prose-li:text-[15px] prose-li:text-white/90 prose-li:my-0.5
              prose-li:marker:text-white/40
              prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl prose-pre:my-3
              prose-code:text-white/90 prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-[13px] prose-code:before:content-none prose-code:after:content-none
              prose-blockquote:border-l-2 prose-blockquote:border-white/20 prose-blockquote:text-white/60 prose-blockquote:pl-4 prose-blockquote:italic
              prose-a:text-white prose-a:underline hover:prose-a:text-white/80
              prose-hr:border-white/10
            ">
              {/* Always render ReactMarkdown — ChatInterface throttles updates to 150ms so this is safe during streaming */}
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content || (isStreaming ? "●" : "")}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Streaming indicator shown only when content is still empty */}
        {!isUser && isStreaming && !content && (
          <span className="text-xs text-white/40 mt-2 ml-2 flex items-center gap-1">
            <span className="animate-pulse">Thinking</span>
            <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
          </span>
        )}
      </div>
    </div>
  );
}
