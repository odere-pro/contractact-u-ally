"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  UI_LANGUAGES,
  UI_LANGUAGE_LABEL,
  UI_LANGUAGE_SHORT,
  type UiLanguage,
} from "@/lib/translation/types";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  readonly current: UiLanguage;
  readonly pending: UiLanguage | null;
  readonly disabled?: boolean;
  readonly onChange: (lang: UiLanguage) => void;
}

// Three pill buttons (EN / NL / SV). Active language gets the filled
// `default` variant; others stay outline. While a translation is in
// flight for a target, that target shows a spinner and the whole group
// is non-interactive so users can't queue overlapping requests.
export function LanguageSwitcher({
  current,
  pending,
  disabled = false,
  onChange,
}: LanguageSwitcherProps) {
  return (
    <div
      role="group"
      aria-label="Translate contract"
      data-testid="language-switcher"
      className="flex items-center gap-1"
    >
      {UI_LANGUAGES.map((lang) => {
        const isActive = current === lang;
        const isPending = pending === lang;
        return (
          <Button
            key={lang}
            type="button"
            size="sm"
            variant={isActive ? "default" : "outline"}
            aria-pressed={isActive}
            aria-label={`Translate to ${UI_LANGUAGE_LABEL[lang]}`}
            disabled={disabled || pending !== null}
            onClick={() => {
              if (isActive) return;
              onChange(lang);
            }}
            className={cn("font-mono text-xs tracking-wider", isActive && "shadow-sm")}
          >
            {isPending ? (
              <Loader2 aria-hidden className="size-3.5 animate-spin" />
            ) : (
              UI_LANGUAGE_SHORT[lang]
            )}
          </Button>
        );
      })}
    </div>
  );
}
