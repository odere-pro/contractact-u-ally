"use client";

import { Badge } from "@/components/ui/badge";
import { PROFILE_LABEL, type Profile } from "@/lib/profileCopy";
import { cn } from "@/lib/utils";

interface ProfilePillProps {
  readonly profile: Profile;
  readonly active: boolean;
  readonly onSelect: (profile: Profile) => void;
}

// Profile lens pill — a real <button> wrapped in Badge styling so
// keyboard + AT users can rotate through profiles without entering a
// hidden radio group.
export function ProfilePill({ profile, active, onSelect }: ProfilePillProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onSelect(profile)}
      className={cn(
        "rounded-full transition-transform focus-visible:outline-2 focus-visible:outline-offset-2",
        active ? "scale-100" : "opacity-70 hover:opacity-100",
      )}
    >
      <Badge variant={active ? "default" : "outline"}>{PROFILE_LABEL[profile]}</Badge>
    </button>
  );
}
