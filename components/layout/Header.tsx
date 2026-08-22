import { ScanLine } from "lucide-react";

export function Header() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScanLine
            className="w-5 h-5 text-ink"
            strokeWidth={1.75}
          />

          <div>
            <div className="text-sm font-semibold tracking-wide leading-none">
              METROSCAN
            </div>

            <div className="text-xs text-ink-muted leading-none mt-1">
              Legal Metrology Compliance &amp; Inspection System
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-6 text-sm text-ink-muted">
          <span className="text-ink font-medium border-b-2 border-ink pb-3 -mb-3">
            Scanner
          </span>

          <span className="opacity-40 cursor-not-allowed">
            Inspections
          </span>

          <span className="opacity-40 cursor-not-allowed">
            Dashboard
          </span>

          <span className="opacity-40 cursor-not-allowed">
            Rules
          </span>
        </nav>
      </div>
    </header>
  );
}