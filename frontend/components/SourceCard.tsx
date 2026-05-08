import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SourceCardProps {
  pageNumber: string | number;
  content: string;
  relevanceScore: number;
}

export function SourceCard({ pageNumber, content, relevanceScore }: SourceCardProps) {
  // Color code the relevance score
  const scoreColor = 
    relevanceScore > 0.8 ? "text-green-400 border-green-400/20 bg-green-400/10" :
    relevanceScore > 0.6 ? "text-yellow-400 border-yellow-400/20 bg-yellow-400/10" :
    "text-muted-foreground border-white/10 bg-white/5";

  return (
    <div className="glass-panel p-4 rounded-xl flex flex-col gap-2 hover:bg-white/5 transition-colors cursor-default text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary">
          <FileText className="w-4 h-4" />
          <span className="text-xs font-semibold tracking-wider uppercase">Page {pageNumber}</span>
        </div>
        <Badge variant="outline" className={`text-[10px] ${scoreColor}`}>
          {(relevanceScore * 100).toFixed(0)}% Match
        </Badge>
      </div>
      
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
        &quot;{content.trim()}&quot;
      </p>
    </div>
  );
}
