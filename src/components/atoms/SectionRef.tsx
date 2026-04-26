import { cn } from "@/lib/utils";

interface SectionRefProps {
  readonly id: string;
  readonly className?: string;
}

// Renders a clause reference like "§4.2" in the monospace font so
// numeric anchors line up across the rail and the simplified pane.
export function SectionRef({ id, className }: SectionRefProps) {
  return <span className={cn("text-muted-foreground font-mono text-xs", className)}>{id}</span>;
}
