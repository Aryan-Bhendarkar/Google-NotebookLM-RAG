import { BookOpen } from "lucide-react";

export function Header() {
  return (
    <header className="w-full border-b border-white/10 bg-background/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-primary/20 p-2 rounded-lg border border-primary/30">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight glow-text">
            NotebookLM<span className="text-primary font-bold">Clone</span>
          </h1>
        </div>
        
        <div className="text-sm text-muted-foreground flex items-center gap-4">
          <span className="hidden sm:inline-block">AI Document Assistant</span>
        </div>
      </div>
    </header>
  );
}
