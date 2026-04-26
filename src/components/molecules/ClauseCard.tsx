"use client";

import { type KeyboardEvent, type MouseEvent } from "react";
import { ArrowLeftToLine, ChevronDown, Mic, Square } from "lucide-react";

import { SeverityIcon } from "@/components/atoms/SeverityIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ClauseEvent } from "@/lib/catalog/types";
import type { UseVoiceReturn } from "@/hooks/useVoice";
import { SEVERITY_LABEL, severityClassnames, severityOf } from "@/lib/severity";
import { cn } from "@/lib/utils";

interface ClauseCardProps {
  readonly clause: ClauseEvent;
  readonly featured?: boolean;
  readonly onSelect?: (id: string) => void;
  readonly onShowWhy?: (clause: ClauseEvent) => void;
  readonly voice?: UseVoiceReturn;
}

const VOICE_ENABLED = process.env.NEXT_PUBLIC_VOICE_ENABLED === "true";

// Expansion is driven by `featured` — the parent owns which card is
// active so selecting one collapses the others. The whole card and the
// "Show in contract" button both call onSelect, so a click anywhere on
// the row both expands the card and anchors the contract pane to the
// matching highlight.
export function ClauseCard({
  clause,
  featured = false,
  onSelect,
  onShowWhy,
  voice,
}: ClauseCardProps) {
  const severity = severityOf(clause);
  const classes = severityClassnames(severity);
  const expanded = featured;
  const bodyId = `clause-card-body-${clause.id}`;
  const tinted = expanded || featured;

  const handleToggle = () => {
    onSelect?.(clause.id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleToggle();
    }
  };

  const handleGoToClause = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onSelect?.(clause.id);
  };

  return (
    <Card
      data-testid={`clause-card-${clause.id}`}
      data-severity={severity}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      aria-controls={bodyId}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      style={{
        transition:
          "box-shadow var(--duration-normal) var(--ease-out-expo), background-color var(--duration-normal) var(--ease-out-expo)",
      }}
      className={cn(
        // Override Card's default `gap-4 py-4` so the tint reaches the
        // top and bottom edges instead of leaving a white strip.
        "relative cursor-pointer gap-0 overflow-hidden py-0 outline-none",
        "border border-l-4 border-[color:var(--color-border)]",
        classes.leftBar,
        // Default bg matches the surrounding pane, so collapsed cards
        // read as a clean stack. Severity tint reveals on expand or
        // when the parent flags this card as featured (e.g. matches the
        // active selection in the contract pane).
        tinted ? classes.tint : "bg-card",
        "focus-visible:ring-ring/60 focus-visible:ring-2",
        featured && "shadow-md",
      )}
    >
      <div className="flex w-full items-start gap-3 px-4 py-3.5">
        <SeverityIcon severity={severity} className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase",
                classes.badge,
              )}
            >
              {SEVERITY_LABEL[severity]}
            </span>
            <span className="text-muted-foreground/80 font-mono text-[10px] tracking-wide uppercase">
              {clause.id}
            </span>
          </div>
          <h3 className="text-foreground mt-1 text-base leading-snug font-semibold tracking-tight">
            {clause.title}
          </h3>
        </div>
        {onSelect && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid={`clause-card-goto-${clause.id}`}
            aria-label={`Show clause ${clause.id} in the contract`}
            onClick={handleGoToClause}
            className="mt-0.5 h-8 shrink-0 gap-1.5 px-2.5 text-xs"
          >
            <ArrowLeftToLine aria-hidden className="size-3.5" />
            <span className="hidden sm:inline">Show in contract</span>
          </Button>
        )}
        <ChevronDown
          aria-hidden
          className={cn("text-foreground/60 mt-1 size-5 shrink-0", expanded && "rotate-180")}
          style={{ transition: "transform var(--duration-fast) var(--ease-out-expo)" }}
        />
      </div>
      {expanded && (
        <CardContent
          id={bodyId}
          className="border-border/60 flex flex-col gap-4 border-t px-4 pt-4 pb-4"
        >
          {clause.originalText && (
            <figure className="bg-muted/40 border-border rounded-md border border-l-2 px-3 py-2.5">
              <figcaption className="text-muted-foreground mb-1.5 text-xs font-semibold tracking-widest uppercase">
                Original clause
              </figcaption>
              <blockquote className="text-foreground/80 text-[0.9375rem] leading-relaxed">
                {clause.originalText}
              </blockquote>
            </figure>
          )}
          <section className="flex flex-col gap-2">
            <h4 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
              Plain-language explanation
            </h4>
            <p className="text-foreground text-[0.9375rem] leading-relaxed">{clause.explanation}</p>
          </section>
          {clause.action && (
            <section className="border-info/40 bg-info-soft flex flex-col gap-2 rounded-md border px-3 py-2.5">
              <h4 className="text-info text-xs font-semibold tracking-widest uppercase">
                What to do
              </h4>
              <p className="text-foreground text-[0.9375rem] leading-relaxed">{clause.action}</p>
            </section>
          )}
          {(onShowWhy || (VOICE_ENABLED && voice)) && (
            <div className="flex flex-wrap items-center gap-2">
              {VOICE_ENABLED && voice ? (
                <AskQuestionButton clauseId={clause.id} voice={voice} />
              ) : (
                onShowWhy && (
                  <Button
                    size="default"
                    variant="outline"
                    data-testid={`clause-card-ask-${clause.id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onShowWhy(clause);
                    }}
                  >
                    Ask a question
                  </Button>
                )
              )}
            </div>
          )}
          {VOICE_ENABLED && voice && voice.activeClauseId === clause.id && (
            <VoiceSession voice={voice} />
          )}
        </CardContent>
      )}
    </Card>
  );
}

function AskQuestionButton({ clauseId, voice }: { clauseId: string; voice: UseVoiceReturn }) {
  const isActive = voice.activeClauseId === clauseId;
  const isListening = isActive && voice.voiceState === "listening";
  const isProcessing = isActive && voice.voiceState === "processing";
  const isResponse = isActive && voice.voiceState === "response";
  const isBusyElsewhere =
    !isActive && (voice.voiceState === "listening" || voice.voiceState === "processing");

  const label = isListening
    ? "Stop"
    : isProcessing
      ? "Processing…"
      : isResponse
        ? "Ask again"
        : isBusyElsewhere
          ? "Recording…"
          : "Ask a question";

  const Icon = isListening ? Square : Mic;

  return (
    <Button
      size="default"
      variant={isListening ? "destructive" : "outline"}
      data-testid={`clause-card-ask-${clauseId}`}
      disabled={isProcessing || isBusyElsewhere}
      aria-label={
        isListening
          ? "Stop recording your question"
          : isProcessing
            ? "Processing your question"
            : `Ask a voice question about clause ${clauseId}`
      }
      onClick={(event) => {
        event.stopPropagation();
        if (isListening) {
          void voice.stopAndProcess();
        } else {
          void voice.startListening(clauseId);
        }
      }}
    >
      <Icon aria-hidden className="size-4" />
      {label}
    </Button>
  );
}

function VoiceSession({ voice }: { voice: UseVoiceReturn }) {
  const { voiceState, transcript, answer, modelState, dismiss } = voice;

  if (voiceState === "listening") {
    return (
      <p className="text-muted-foreground text-xs italic" role="status">
        Listening… speak your question, then press Stop.
      </p>
    );
  }

  if (voiceState === "processing") {
    return (
      <p className="text-muted-foreground text-xs italic" role="status">
        Transcribing and reasoning…
      </p>
    );
  }

  if (voiceState === "error") {
    return (
      <p className="text-destructive text-xs" role="alert">
        Sorry — we couldn&apos;t process that. Please try again.
      </p>
    );
  }

  if (voiceState === "response" && answer) {
    return (
      <section
        role="region"
        aria-label="Voice answer"
        className="border-border bg-card/60 rounded-md border p-3 text-sm leading-relaxed"
        onClick={(event) => event.stopPropagation()}
      >
        {transcript && (
          <p className="text-muted-foreground mb-2 text-xs italic">&ldquo;{transcript}&rdquo;</p>
        )}
        <p className="text-foreground">{answer}</p>
        <div className="mt-2 flex items-center justify-between">
          {modelState === "building" ? (
            <span className="text-muted-foreground text-xs">Voice model still warming up…</span>
          ) : (
            <span />
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              dismiss();
            }}
          >
            Dismiss
          </Button>
        </div>
      </section>
    );
  }

  return null;
}
