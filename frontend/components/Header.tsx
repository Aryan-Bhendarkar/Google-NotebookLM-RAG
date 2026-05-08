import { BookOpen } from "lucide-react";

export function Header() {
  return (
    <header className="w-full border-b border-white/5 bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 p-2 rounded-xl border border-white/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-medium tracking-tight text-white/90">
            NotebookLM<span className="text-white/50 font-normal ml-0.5">Clone</span>
          </h1>
        </div>
        
        <div className="text-sm text-white/40 flex items-center gap-4 font-medium tracking-wide text-[13px]">
          <span className="hidden sm:inline-block">AI Studio</span>
        </div>
      </div>
    </header>
  );
}
