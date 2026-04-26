"use client";

import { badgeVariants } from "@/components/ui/badge";
import { PROFILE_LABEL, type Profile } from "@/lib/profileCopy";
import { cn } from "@/lib/utils";

interface ProfilePillProps {
  readonly profile: Profile;
  readonly active: boolean;
  readonly onSelect: (profile: Profile) => void;
}

// Profile lens pill — a single <button> styled like a Badge so keyboard
// + AT users can rotate through profiles. We borrow Badge's cva styles
// directly instead of nesting <button><Badge>; nesting an interactive
// element inside Badge's <span>/<div> would be invalid HTML.
export function ProfilePill({ profile, active, onSelect }: ProfilePillProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onSelect(profile)}
      className={cn(
        badgeVariants({ variant: active ? "default" : "outline" }),
        "transition-transform focus-visible:outline-2 focus-visible:outline-offset-2",
        !active && "opacity-70 hover:opacity-100",
      )}
    >
      {PROFILE_LABEL[profile]}
    </button>
  );
}
