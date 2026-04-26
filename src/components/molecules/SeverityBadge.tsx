import { Badge } from "@/components/ui/badge";
import { SeverityIcon } from "@/components/atoms/SeverityIcon";
import { SEVERITY_LABEL, type Severity } from "@/lib/severity";

interface SeverityBadgeProps {
  readonly severity: Severity;
  readonly compact?: boolean;
}

// Combined icon + label badge keyed off semantic severity tokens.
// Compose from this instead of building Badge variants by hand —
// keeps icon ↔ color coupling intact and survives grayscale / a11y.
export function SeverityBadge({ severity, compact = false }: SeverityBadgeProps) {
  return (
    <Badge variant={severity} aria-label={`${SEVERITY_LABEL[severity]} severity`}>
      <SeverityIcon severity={severity} className="size-3" />
      {!compact && SEVERITY_LABEL[severity]}
    </Badge>
  );
}
