"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import type { ClauseEvent } from "@/lib/catalog/types";
import { UI_LANGUAGES, type TranslateItem, type UiLanguage } from "@/lib/translation/types";

interface UseTranslatedAnalysisArgs {
  readonly ocrText: string;
  readonly clauses: readonly ClauseEvent[];
  /**
   * Translation only fires once the upstream stream has settled — otherwise
   * each new clause would invalidate the cache mid-render and queue a new
   * round trip. The caller passes `phase === "done"`.
   */
  readonly ready: boolean;
}

interface TranslatedSnapshot {
  readonly ocrText: string;
  readonly clauses: readonly ClauseEvent[];
}

export interface UseTranslatedAnalysisResult {
  readonly language: UiLanguage;
  readonly pending: UiLanguage | null;
  readonly error: string | null;
  readonly ocrText: string;
  readonly clauses: readonly ClauseEvent[];
  readonly setLanguage: (lang: UiLanguage) => void;
}

const responseSchema = z.object({
  translations: z.array(z.object({ id: z.string(), text: z.string() })),
});

// User-facing fallback copy. Hoisted so each branch reads the same string
// and so future i18n can replace these in one place. Keep terse — they
// land in an inline Alert next to the language switcher.
const TRANSLATION_NETWORK_ERROR = "Translation failed. Showing original text.";
const TRANSLATION_INVALID_ERROR = "Translation response invalid. Showing original text.";

// Field-id prefixes so we can re-hydrate the API response back into the
// per-clause shape without an out-of-band map. Field name is encoded in
// the id — every translatable string ships round-trip with its own key.
const ID = {
  ocr: "ocr",
  title: (clauseId: string) => `c:${clauseId}:title`,
  original: (clauseId: string) => `c:${clauseId}:original`,
  explanation: (clauseId: string) => `c:${clauseId}:explanation`,
  action: (clauseId: string) => `c:${clauseId}:action`,
} as const;

export function useTranslatedAnalysis({
  ocrText,
  clauses,
  ready,
}: UseTranslatedAnalysisArgs): UseTranslatedAnalysisResult {
  const [language, setLanguageState] = useState<UiLanguage>("en");
  const [pending, setPending] = useState<UiLanguage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<TranslatedSnapshot | null>(null);

  // Per-language cache, scoped to the current `ocrText`. When the user
  // uploads a new contract (or starts over) ocrText changes and we reset
  // the cache so stale translations never leak across documents.
  const cacheRef = useRef<{
    sourceKey: string;
    entries: Partial<Record<UiLanguage, TranslatedSnapshot>>;
  }>({ sourceKey: "", entries: {} });

  const requestIdRef = useRef(0);

  useEffect(() => {
    if (cacheRef.current.sourceKey !== ocrText) {
      cacheRef.current = { sourceKey: ocrText, entries: {} };
      // Source changed — drop any in-flight request and force-fall-back
      // to English. Otherwise the user could pick Dutch on contract A,
      // upload contract B, and briefly see contract A's Dutch text.
      requestIdRef.current += 1;
      setSnapshot(null);
      setPending(null);
      setError(null);
      setLanguageState("en");
    }
  }, [ocrText]);

  const setLanguage = useCallback(
    (next: UiLanguage): void => {
      if (!UI_LANGUAGES.includes(next)) return;
      if (next === language && pending === null) return;

      setError(null);

      if (next === "en") {
        setLanguageState("en");
        setSnapshot(null);
        setPending(null);
        return;
      }

      const cached = cacheRef.current.entries[next];
      if (cached) {
        setLanguageState(next);
        setSnapshot(cached);
        setPending(null);
        return;
      }

      if (!ready) {
        // Caller said the analysis is still streaming — defer the request
        // but remember the user's choice. We re-trigger from the effect
        // below once `ready` flips true.
        setLanguageState(next);
        setSnapshot(null);
        return;
      }

      void fetchTranslation(next);
    },
    // fetchTranslation closes over `clauses` + `ocrText`; explicit deps
    // here would require pulling it out of the function — keeping it inline
    // and listing the upstream values is simpler and equally correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language, pending, ready, ocrText, clauses],
  );

  // If the user picked NL/SV before the stream completed, fire the request
  // as soon as `ready` flips. The cache lookup short-circuits when
  // translation is already in hand.
  useEffect(() => {
    if (!ready) return;
    if (language === "en") return;
    if (snapshot !== null) return;
    if (pending !== null) return;
    const cached = cacheRef.current.entries[language];
    if (cached) {
      setSnapshot(cached);
      return;
    }
    void fetchTranslation(language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, language, snapshot, pending]);

  async function fetchTranslation(target: UiLanguage): Promise<void> {
    const items: TranslateItem[] = buildItems(ocrText, clauses);
    if (items.length === 0) {
      setLanguageState(target);
      setSnapshot({ ocrText, clauses });
      setPending(null);
      return;
    }

    const myRequestId = ++requestIdRef.current;
    setPending(target);
    setLanguageState(target);

    // Single shared exit when anything goes wrong: surface a message,
    // drop in-flight pending state, and re-fall-back to English so the
    // UI never strands the user on a half-translated view.
    const failToEnglish = (message: string): void => {
      setError(message);
      setPending(null);
      setSnapshot(null);
      setLanguageState("en");
    };

    let response: Response;
    try {
      response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLang: target, items }),
      });
    } catch (err) {
      if (requestIdRef.current !== myRequestId) return;
      console.warn("useTranslatedAnalysis: network error during translation", err);
      failToEnglish(TRANSLATION_NETWORK_ERROR);
      return;
    }

    if (requestIdRef.current !== myRequestId) return;

    if (!response.ok) {
      failToEnglish(TRANSLATION_NETWORK_ERROR);
      return;
    }

    let raw: unknown;
    try {
      raw = await response.json();
    } catch (err) {
      console.warn("useTranslatedAnalysis: invalid JSON in translate response", err);
      failToEnglish(TRANSLATION_INVALID_ERROR);
      return;
    }

    if (requestIdRef.current !== myRequestId) return;

    const parsed = responseSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn("useTranslatedAnalysis: translate response failed schema", parsed.error);
      failToEnglish(TRANSLATION_INVALID_ERROR);
      return;
    }

    const map = new Map(parsed.data.translations.map((t) => [t.id, t.text]));
    const next = applyTranslations(ocrText, clauses, map);

    cacheRef.current.entries[target] = next;
    setSnapshot(next);
    setPending(null);
  }

  return {
    language,
    pending,
    error,
    ocrText: snapshot?.ocrText ?? ocrText,
    clauses: snapshot?.clauses ?? clauses,
    setLanguage,
  };
}

function buildItems(ocrText: string, clauses: readonly ClauseEvent[]): TranslateItem[] {
  const items: TranslateItem[] = [];
  if (ocrText) items.push({ id: ID.ocr, text: ocrText });
  for (const clause of clauses) {
    if (clause.title) items.push({ id: ID.title(clause.id), text: clause.title });
    if (clause.originalText) {
      items.push({ id: ID.original(clause.id), text: clause.originalText });
    }
    if (clause.explanation) {
      items.push({ id: ID.explanation(clause.id), text: clause.explanation });
    }
    if (clause.action) items.push({ id: ID.action(clause.id), text: clause.action });
  }
  return items;
}

function applyTranslations(
  ocrText: string,
  clauses: readonly ClauseEvent[],
  map: ReadonlyMap<string, string>,
): TranslatedSnapshot {
  const nextOcr = map.get(ID.ocr) ?? ocrText;
  const nextClauses = clauses.map((clause) => ({
    ...clause,
    title: map.get(ID.title(clause.id)) ?? clause.title,
    originalText: map.get(ID.original(clause.id)) ?? clause.originalText,
    explanation: map.get(ID.explanation(clause.id)) ?? clause.explanation,
    action: clause.action ? (map.get(ID.action(clause.id)) ?? clause.action) : clause.action,
  }));
  return { ocrText: nextOcr, clauses: nextClauses };
}
