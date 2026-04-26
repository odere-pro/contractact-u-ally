import { AlertTriangle, CheckCircle2, CircleDashed, CircleDot } from "lucide-react";
import type { ComponentType } from "react";

import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/severity";

const ICON: Record<Severity, ComponentType<{ className?: string }>> = {
  critical: AlertTriangle,
  medium: CircleDot,
  low: CircleDashed,
  ok: CheckCircle2,
};

interface SeverityIconProps {
  readonly severity: Severity;
  readonly className?: string;
}

// Icon-only severity glyph. Always paired with a text label by the
// parent — never used as the sole signifier of severity.
export function SeverityIcon({ severity, className }: SeverityIconProps) {
  const Icon = ICON[severity];
  return <Icon aria-hidden className={cn("size-4", className)} />;
}
