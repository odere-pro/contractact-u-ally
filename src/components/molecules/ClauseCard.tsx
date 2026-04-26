"use client";

import { type KeyboardEvent, type MouseEvent } from "react";
import { ArrowLeftToLine, ChevronDown, Mic, Square } from "lucide-react";

import { SeverityIcon } from "@/components/atoms/SeverityIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
          {((VOICE_ENABLED && voice) || onShowWhy) && (
            // Sticky bar so the Q&A entry point stays visible when the
            // expanded card body is taller than the viewport. Negative
            // margins extend the bar to the card edges; backdrop blur
            // keeps content readable when scrolled behind it.
            <div className="border-border/60 bg-card/85 sticky bottom-0 -mx-4 -mb-4 flex flex-col gap-2 border-t px-4 pt-3 pb-4 backdrop-blur-sm">
              {VOICE_ENABLED && voice ? (
                <AskRow clauseId={clause.id} voice={voice} />
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
              {VOICE_ENABLED && voice && voice.activeClauseId === clause.id && (
                <SessionStatus voice={voice} />
              )}
            </div>
          )}
          {VOICE_ENABLED && voice && voice.activeClauseId === clause.id && (
            <QASession clauseTitle={clause.title} voice={voice} />
          )}
        </CardContent>
      )}
    </Card>
  );
}

// Single click-to-talk button. First click starts mic capture (Reson8
// STT runs server-side); second click stops, sends the audio, and the
// streaming Claude answer renders in the QASession dialog.
function AskRow({ clauseId, voice }: { clauseId: string; voice: UseVoiceReturn }) {
  const isActive = voice.activeClauseId === clauseId;
  const isListening = isActive && voice.voiceState === "listening";
  const isProcessing =
    isActive && (voice.voiceState === "processing" || voice.voiceState === "streaming");
  const isBusyElsewhere =
    !isActive &&
    (voice.voiceState === "listening" ||
      voice.voiceState === "processing" ||
      voice.voiceState === "streaming");

  const label = isListening
    ? "Stop & send"
    : isProcessing
      ? "Working…"
      : isBusyElsewhere
        ? "Recording…"
        : "Ask a question";

  const Icon = isListening ? Square : Mic;

  const toggleMic = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (isListening) {
      void voice.stopAndProcess();
    } else {
      void voice.startListening(clauseId);
    }
  };

  return (
    <Button
      type="button"
      size="default"
      variant={isListening ? "destructive" : "outline"}
      disabled={isProcessing || isBusyElsewhere}
      aria-label={
        isListening
          ? "Stop recording your question"
          : `Ask a voice question about clause ${clauseId}`
      }
      data-testid={`clause-card-ask-${clauseId}`}
      onClick={toggleMic}
      className="gap-2"
    >
      <Icon aria-hidden className="size-4" />
      {label}
    </Button>
  );
}

// Inline status row that lives just below the input. Only surfaces the
// transient states the dialog can't (listening + error) — `processing`
// and `streaming` are visualised inside the QASession dialog instead, so
// we don't duplicate the same message in two places.
function SessionStatus({ voice }: { voice: UseVoiceReturn }) {
  const { voiceState } = voice;

  if (voiceState === "listening") {
    return (
      <p className="text-muted-foreground text-xs italic" role="status">
        Listening… speak your question, then press Stop.
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

  return null;
}

// Modal popup that holds the full Q&A pair. Question appears immediately
// (text path) or once STT lands (voice path); the answer streams in
// token-by-token. Closing dismisses the session — the user can ask a
// new question to reopen.
function QASession({ clauseTitle, voice }: { clauseTitle: string; voice: UseVoiceReturn }) {
  const { voiceState, transcript, answer, modelState, dismiss } = voice;

  const open =
    voiceState === "processing" || voiceState === "streaming" || voiceState === "response";

  if (!open) return null;

  const showQuestion = transcript.trim().length > 0;
  const showAnswer = answer.length > 0;
  const isStreaming = voiceState === "streaming";

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent
        title={`Ask about: ${clauseTitle}`}
        description="Question and answer about this clause"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-1.5">
            <h4 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
              You
            </h4>
            {showQuestion ? (
              <p className="text-foreground text-sm leading-relaxed">{transcript}</p>
            ) : (
              <p className="text-muted-foreground text-sm italic">Transcribing…</p>
            )}
          </section>

          <section className="flex flex-col gap-1.5">
            <h4 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
              Answer
            </h4>
            {showAnswer ? (
              <p className="text-foreground text-sm leading-relaxed whitespace-pre-line">
                {answer}
                {isStreaming && (
                  <span
                    aria-hidden
                    className="bg-foreground ml-0.5 inline-block h-3.5 w-1.5 align-middle"
                    style={{ animation: "pulse 1s ease-in-out infinite" }}
                  />
                )}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm italic">
                {voiceState === "streaming" ? "Drafting…" : "Working on it…"}
              </p>
            )}
          </section>

          <div className="flex items-center justify-between pt-1">
            {modelState === "building" ? (
              <span className="text-muted-foreground text-xs">Voice model still warming up…</span>
            ) : (
              <span />
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                dismiss();
              }}
              data-testid="qa-session-close"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
