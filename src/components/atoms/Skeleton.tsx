import { cn } from "@/lib/utils";

interface SkeletonProps {
  readonly className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div data-testid="skeleton" className={cn("bg-muted/60 animate-pulse rounded-md", className)} />
  );
}
