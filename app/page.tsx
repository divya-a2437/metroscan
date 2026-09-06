import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="max-w-350 mx-auto px-6 py-16">
      <div className="max-w-xl">
        <h1 className="text-2xl font-semibold text-ink mb-2">
          Legal Metrology Compliance Screening
        </h1>
        <p className="text-sm text-ink-muted mb-6 leading-relaxed">
          Upload package images to extract label declarations and screen
          them against Legal Metrology (Packaged Commodities) Rules, 2011
          requirements. This is a prototype decision-support tool — results
          require human verification.
        </p>
        <Link
          href="/scanner"
          className="inline-flex items-center gap-2 bg-ink text-white text-sm font-medium px-4 py-2 rounded hover:bg-ink/90 transition-colors"
        >
          Start Scan <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}