import Link from "next/link";
import { Logo } from "@/components/atoms/Logo";

export function AppHeader() {
  return (
    <header className="border-border/60 sticky top-0 z-10 flex h-20 items-center justify-between border-b bg-[var(--color-background)]/80 px-6 text-2xl backdrop-blur">
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
        <Logo size={48} />
        <span>contractact-u-ally</span>
      </Link>
      <span className="text-muted-foreground text-sm">Know what you signed.</span>
    </header>
  );
}
