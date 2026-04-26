import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — contract-u-ally",
  description:
    "How contract-u-ally handles uploaded employment contracts: in-memory processing, no persistence, third-party LLM disclosure.",
};

export default function PrivacyPage() {
  return (
    <main className="bg-background mx-auto max-w-2xl px-6 py-16">
      <nav className="text-muted-foreground mb-8 text-sm">
        <Link href="/" className="hover:text-foreground underline-offset-2 hover:underline">
          ← Back to upload
        </Link>
      </nav>
      <h1 className="text-foreground text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="text-muted-foreground mt-2 text-sm">Last updated: 2026-04-26</p>
      <dl className="mt-10 flex flex-col gap-8 text-sm">
        <div className="flex flex-col gap-2">
          <dt className="text-foreground text-base font-semibold">1. What we process</dt>
          <dd className="text-muted-foreground leading-relaxed">
            When you upload a contract, the file is parsed in memory on a serverless function and
            its text is sent to a third-party large-language-model provider for clause analysis. The
            PDF itself is never written to disk on our infrastructure.
          </dd>
        </div>
        <div className="flex flex-col gap-2">
          <dt className="text-foreground text-base font-semibold">2. What we store</dt>
          <dd className="text-muted-foreground leading-relaxed">
            We do not maintain a database of uploaded contracts or analysis results. A short summary
            of your last analysis is held in your browser&apos;s <code>localStorage</code> only,
            under a key you can clear at any time. The full contract text is never persisted by us.
          </dd>
        </div>
        <div className="flex flex-col gap-2">
          <dt className="text-foreground text-base font-semibold">3. Third parties</dt>
          <dd className="text-muted-foreground leading-relaxed">
            Document text is transmitted to our LLM provider for the duration of one analysis
            request. Our hosting provider (Vercel) processes request metadata and operational logs;
            those logs are configured to exclude contract content. We do not share your data with
            advertisers or analytics vendors.
          </dd>
        </div>
        <div className="flex flex-col gap-2">
          <dt className="text-foreground text-base font-semibold">4. Your rights</dt>
          <dd className="text-muted-foreground leading-relaxed">
            Because we do not retain your documents or identifiable account data, there is nothing
            for us to export or delete on request beyond clearing your browser storage. Contact us
            if you have questions about how a specific request was handled.
          </dd>
        </div>
        <div className="flex flex-col gap-2">
          <dt className="text-foreground text-base font-semibold">5. Disclaimer</dt>
          <dd className="text-muted-foreground leading-relaxed">
            Analysis output is informational and does not constitute legal advice. Consult a
            qualified lawyer before signing or rejecting any contract.
          </dd>
        </div>
      </dl>
    </main>
  );
}
