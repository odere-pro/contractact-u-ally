import "server-only";

import type { ClauseEvent, SummaryEvent } from "@/lib/catalog/types";
import type { TranslateItem, UiLanguage } from "@/lib/translation/types";

// Detect Anthropic billing/credit/quota failures so the pipeline can
// degrade to mocked data instead of returning a hard error to the UI.
// Matches the SDK's `BadRequestError` ("credit balance is too low") plus
// the broader family of quota/billing 4xx responses.
export function isAnthropicCreditError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;

  const status = (err as { status?: unknown }).status;
  const message = (err as { message?: unknown }).message;
  const messageText = typeof message === "string" ? message.toLowerCase() : "";

  const looksLikeCreditMessage =
    messageText.includes("credit balance is too low") ||
    messageText.includes("insufficient_quota") ||
    messageText.includes("quota") ||
    messageText.includes("billing");

  if (looksLikeCreditMessage) return true;

  // Some SDK shapes nest the provider error under `error.error.message`.
  const nested = (err as { error?: { error?: { message?: unknown } } }).error?.error?.message;
  if (typeof nested === "string") {
    const nestedText = nested.toLowerCase();
    if (
      nestedText.includes("credit balance is too low") ||
      nestedText.includes("insufficient_quota") ||
      nestedText.includes("quota") ||
      nestedText.includes("billing")
    ) {
      return true;
    }
  }

  // Fall back to status-based hints. 402 is the canonical "Payment Required".
  return status === 402;
}

// Fixed mock clauses + summary so the UI keeps rendering when Claude is
// unreachable (no credits, no key, transient outage). Realistic enough to
// exercise illegal / exploitative / compliant rendering paths.
const MOCK_CLAUSES: readonly ClauseEvent[] = [
  {
    type: "clause",
    id: "mock-trial-period",
    title: "Trial period (proeftijd)",
    status: "illegal",
    originalText: "The employee will serve a trial period of six (6) months from the start date.",
    explanation:
      "Dutch law caps the trial period at two months for an indefinite-term contract. A six-month proeftijd is void by operation of law — the trial period simply does not apply.",
    citation: {
      article: "BW 7:652",
      label: "Trial period cap",
      source: "nl-labor-law.json",
    },
    action:
      "Treat the trial period as absent. The employer cannot terminate without notice on this basis.",
    permitConflict: null,
    riskMappings: [{ risk: "red", path: "trial-period", category: "contract-terms" }],
  },
  {
    type: "clause",
    id: "mock-non-compete",
    title: "Non-compete clause",
    status: "exploitative",
    originalText:
      "Employee shall not work for any competitor within the EU for two years after termination.",
    explanation:
      "A two-year EU-wide non-compete is unusually broad and likely unenforceable in court. Dutch courts routinely narrow scope and duration; insist on written justification of compelling business interest.",
    citation: {
      article: "BW 7:653",
      label: "Non-compete clause must be in writing",
      source: "nl-labor-law.json",
    },
    action:
      "Ask the employer to narrow the scope (geography + duration) and document the business interest in writing.",
    permitConflict: null,
    riskMappings: [{ risk: "amber", path: "non-compete", category: "post-termination" }],
  },
  {
    type: "clause",
    id: "mock-salary",
    title: "Gross monthly salary",
    status: "compliant",
    originalText: "Gross monthly salary: EUR 3,200, paid on the 25th of each month.",
    explanation:
      "Salary is stated in EUR with a clear payment date. This satisfies the mandatory disclosure for a Dutch employment contract.",
    citation: null,
    action: null,
    permitConflict: null,
    riskMappings: [{ risk: "green", path: "salary", category: "mandatory" }],
  },
  {
    type: "clause",
    id: "mock-working-hours",
    title: "Working hours",
    status: "compliant",
    originalText: "Standard working week: 40 hours, Monday through Friday.",
    explanation: "Working hours are clearly stated and within the legal weekly maximum.",
    citation: null,
    action: null,
    permitConflict: null,
    riskMappings: [{ risk: "green", path: "working-hours", category: "mandatory" }],
  },
  {
    type: "clause",
    id: "mock-notice-period",
    title: "Notice period",
    status: "compliant",
    originalText: "Either party may terminate this contract with one (1) month's written notice.",
    explanation:
      "A one-month notice period meets the statutory minimum for an indefinite-term contract in the first five years of service.",
    citation: null,
    action: null,
    permitConflict: null,
    riskMappings: [{ risk: "green", path: "notice-period", category: "mandatory" }],
  },
];

const MOCK_SUMMARY: SummaryEvent = {
  type: "summary",
  jurisdiction: "nl",
  contractType: "Dutch indefinite-term employment contract",
  detectedLanguage: "en",
  totalClauses: MOCK_CLAUSES.length,
  illegalCount: 1,
  exploitativeCount: 1,
  permitConflictCount: 0,
  uncheckedCount: 0,
  compliantCount: 3,
};

/**
 * NDJSON lines (with trailing "\n") for the analyze stage when Anthropic
 * is unreachable. The first line is an `ocr_text` replacement so the
 * client swaps the real OCR'd contract for the synthetic one whose text
 * contains every mock clause's snippet verbatim — without that swap,
 * the contract pane has no `<mark>` to scroll a card click toward when
 * mock kicks in mid-stream (e.g. credit exhausted with a real OCR
 * already on screen).
 */
export function mockAnalyzeNdjsonLines(): readonly string[] {
  const ocr = mockOcrResult();
  const ocrLine = JSON.stringify({ type: "ocr_text", text: ocr.text, pages: ocr.pages }) + "\n";
  return [
    ocrLine,
    ...MOCK_CLAUSES.map((c) => JSON.stringify(c) + "\n"),
    JSON.stringify(MOCK_SUMMARY) + "\n",
  ];
}

// Synthetic OCR text used in mock-only mode. Must contain every mock
// clause's `originalText` verbatim so `splitWithHighlights` produces a
// `<mark>` for each card — without that, clicking a clause card has no
// scroll target in the contract preview. Body is intentionally long
// enough that the contract pane scrolls in the demo, so reviewers can
// see clause→snippet auto-scroll behaviour without uploading a real
// document.
const MOCK_OCR_TEXT = [
  "EMPLOYMENT CONTRACT",
  "Indefinite-term, governed by Dutch labour law.",
  "",
  "Between:",
  'NorthSea Logistics B.V., a private company with limited liability, having its registered office at Hoofdweg 12, 1043 AA Amsterdam, the Netherlands, registered with the Dutch Chamber of Commerce under number 12345678 (the "Employer");',
  "",
  "and",
  "",
  'Jane Doe, residing at Keizersgracht 200, 1016 EG Amsterdam, the Netherlands (the "Employee").',
  "",
  "The parties agree as follows.",
  "",
  "1. Position and duties",
  "The Employee is hired as a Senior Operations Coordinator. Duties include planning shipments, supervising warehouse staff, and reporting to the Operations Manager. The Employee shall perform any reasonable additional duties consistent with this role.",
  "",
  "2. Trial period",
  "The employee will serve a trial period of six (6) months from the start date.",
  "During the trial period either party may terminate the contract with immediate effect, without observing a notice period and without giving reasons.",
  "",
  "3. Compensation",
  "Gross monthly salary: EUR 3,200, paid on the 25th of each month.",
  "The Employee is entitled to an annual holiday allowance equal to 8% of gross annual salary, paid in May. Salary review takes place each January at the Employer's discretion.",
  "",
  "4. Working hours",
  "Standard working week: 40 hours, Monday through Friday.",
  "Daily working hours run from 09:00 to 17:30, with a 30-minute unpaid lunch break. The Employee may be required to perform reasonable overtime, compensated through time off in lieu within the same calendar quarter.",
  "",
  "5. Place of work",
  "The Employee's primary place of work is the Employer's premises in Amsterdam. The Employer may, on reasonable notice, require the Employee to work from another location within the Netherlands for short assignments not exceeding ten consecutive working days.",
  "",
  "6. Holidays",
  "The Employee is entitled to 25 paid holidays per calendar year, accrued pro rata. Unused holidays may be carried over to the following year up to a maximum of five days.",
  "",
  "7. Sickness and incapacity",
  "In the event of illness, the Employee shall notify the Employer before 09:00 on the first day of absence. During incapacity for work the Employer pays 100% of salary for the first 52 weeks and 70% for the second 52 weeks, in accordance with Dutch law.",
  "",
  "8. Notice period",
  "Either party may terminate this contract with one (1) month's written notice.",
  "Notice must be given by registered letter and takes effect from the first day of the calendar month following receipt.",
  "",
  "9. Non-compete",
  "Employee shall not work for any competitor within the EU for two years after termination.",
  'For purposes of this clause, "competitor" means any undertaking active in international freight forwarding or supply-chain consultancy. Breach triggers an immediate penalty of EUR 25,000 per occurrence plus EUR 1,000 per day the breach continues.',
  "",
  "10. Confidentiality",
  "The Employee shall keep confidential all information concerning the Employer, its clients, and its commercial relationships, both during and after employment. This obligation survives termination indefinitely.",
  "",
  "11. Intellectual property",
  "All inventions, software, designs, and other works created by the Employee in the course of employment vest exclusively in the Employer. The Employee waives any moral rights to the maximum extent permitted by law.",
  "",
  "12. Personal data",
  "The Employer processes the Employee's personal data in line with the GDPR and the Employer's privacy notice, a copy of which has been provided to the Employee.",
  "",
  "13. Governing law and forum",
  "This contract is governed exclusively by the laws of the Netherlands. The competent court of Amsterdam has exclusive jurisdiction over any dispute arising out of or in connection with this contract.",
  "",
  "14. Entire agreement",
  "This document constitutes the entire agreement between the parties with respect to its subject matter and supersedes all prior negotiations, representations, and agreements, whether written or oral.",
  "",
  "Signed in duplicate. Each party retains an executed counterpart.",
].join("\n");

/**
 * True when there's no Anthropic API key configured, meaning the analyze
 * stage will fall back to mock NDJSON anyway. The pre-flight check lets
 * the pipeline skip real OCR and substitute a synthetic contract whose
 * text contains the mock clause snippets verbatim, so clause-card →
 * contract-pane scroll/highlight still works in mock mode.
 */
export function isMockOnlyMode(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return !key || key.trim() === "";
}

export interface MockOcrResult {
  readonly text: string;
  readonly pages: number;
}

export function mockOcrResult(): MockOcrResult {
  return { text: MOCK_OCR_TEXT, pages: 1 };
}

// Pre-canned NL/SV translations for the mock contract. Keyed by the
// same id format the translate API uses (`ocr` for the contract body,
// `c:<clauseId>:<field>` for each clause field). The translated OCR
// must contain every translated `originalText` verbatim, otherwise
// `splitWithHighlights` can't anchor a highlight when the user toggles
// language. Only the ids that actually need a translation are listed —
// missing ids fall back to the source text in `getMockTranslations`.
const MOCK_TRANSLATIONS: Record<Exclude<UiLanguage, "en">, Record<string, string>> = {
  nl: {
    ocr: [
      "ARBEIDSOVEREENKOMST",
      "Onbepaalde tijd, beheerst door Nederlands arbeidsrecht.",
      "",
      "Tussen:",
      'NorthSea Logistics B.V., een besloten vennootschap met beperkte aansprakelijkheid, statutair gevestigd aan de Hoofdweg 12, 1043 AA Amsterdam, Nederland, ingeschreven bij de Nederlandse Kamer van Koophandel onder nummer 12345678 (de "Werkgever");',
      "",
      "en",
      "",
      'Jane Doe, woonachtig aan de Keizersgracht 200, 1016 EG Amsterdam, Nederland (de "Werknemer").',
      "",
      "Partijen komen het volgende overeen.",
      "",
      "1. Functie en taken",
      "De Werknemer wordt aangenomen als Senior Operations Coordinator. De taken omvatten het plannen van zendingen, het aansturen van magazijnmedewerkers en het rapporteren aan de Operations Manager. De Werknemer verricht alle redelijke aanvullende taken die verenigbaar zijn met deze functie.",
      "",
      "2. Proeftijd",
      "De werknemer doorloopt een proeftijd van zes (6) maanden vanaf de begindatum.",
      "Tijdens de proeftijd kan elk van partijen de overeenkomst met onmiddellijke ingang opzeggen, zonder opzegtermijn en zonder opgaaf van redenen.",
      "",
      "3. Beloning",
      "Bruto maandsalaris: EUR 3.200, betaalbaar op de 25e van elke maand.",
      "De Werknemer heeft recht op een jaarlijkse vakantietoeslag van 8% van het bruto jaarsalaris, uit te keren in mei. Een salarisbeoordeling vindt elk jaar in januari plaats, ter beoordeling van de Werkgever.",
      "",
      "4. Werktijden",
      "Standaard werkweek: 40 uur, maandag tot en met vrijdag.",
      "Dagelijkse werktijden lopen van 09:00 tot 17:30, met een onbetaalde lunchpauze van 30 minuten. De Werknemer kan worden verplicht redelijke overuren te maken, te compenseren met tijd-voor-tijd binnen hetzelfde kalenderkwartaal.",
      "",
      "5. Plaats van tewerkstelling",
      "De primaire werkplek van de Werknemer is het kantoor van de Werkgever in Amsterdam. De Werkgever kan, met redelijke kennisgeving, van de Werknemer verlangen dat deze tijdelijk vanuit een andere locatie binnen Nederland werkt voor opdrachten van maximaal tien aaneengesloten werkdagen.",
      "",
      "6. Vakantie",
      "De Werknemer heeft recht op 25 betaalde vakantiedagen per kalenderjaar, naar rato opgebouwd. Niet-opgenomen vakantiedagen kunnen tot maximaal vijf dagen worden meegenomen naar het volgende jaar.",
      "",
      "7. Ziekte en arbeidsongeschiktheid",
      "Bij ziekte stelt de Werknemer de Werkgever vóór 09:00 uur op de eerste dag van afwezigheid op de hoogte. Tijdens arbeidsongeschiktheid betaalt de Werkgever 100% van het loon gedurende de eerste 52 weken en 70% gedurende de tweede 52 weken, conform Nederlands recht.",
      "",
      "8. Opzegtermijn",
      "Beide partijen kunnen deze overeenkomst beëindigen met een schriftelijke opzegtermijn van één (1) maand.",
      "Opzegging dient per aangetekend schrijven te geschieden en gaat in op de eerste dag van de kalendermaand volgend op ontvangst.",
      "",
      "9. Concurrentiebeding",
      "De werknemer mag binnen de EU twee jaar na beëindiging niet voor enige concurrent werken.",
      'Voor de toepassing van deze bepaling betekent "concurrent" iedere onderneming die actief is in internationale expeditie of supply-chainadvies. Schending leidt tot een onmiddellijke boete van EUR 25.000 per overtreding, vermeerderd met EUR 1.000 voor elke dag dat de overtreding voortduurt.',
      "",
      "10. Geheimhouding",
      "De Werknemer houdt alle informatie betreffende de Werkgever, zijn klanten en zijn zakelijke relaties geheim, zowel tijdens als na de dienstbetrekking. Deze verplichting blijft na beëindiging onbeperkt van kracht.",
      "",
      "11. Intellectuele eigendom",
      "Alle uitvindingen, software, ontwerpen en andere werken die door de Werknemer in de uitoefening van de dienstbetrekking worden gecreëerd, komen uitsluitend toe aan de Werkgever. De Werknemer doet voor zover wettelijk toegestaan afstand van zijn persoonlijkheidsrechten.",
      "",
      "12. Persoonsgegevens",
      "De Werkgever verwerkt de persoonsgegevens van de Werknemer in overeenstemming met de AVG en de privacyverklaring van de Werkgever, waarvan een exemplaar aan de Werknemer is verstrekt.",
      "",
      "13. Toepasselijk recht en forum",
      "Op deze overeenkomst is uitsluitend Nederlands recht van toepassing. De rechtbank Amsterdam is bij uitsluiting bevoegd kennis te nemen van geschillen die voortvloeien uit of verband houden met deze overeenkomst.",
      "",
      "14. Volledige overeenkomst",
      "Dit document vormt de volledige overeenkomst tussen partijen met betrekking tot het onderwerp daarvan en treedt in de plaats van alle eerdere onderhandelingen, verklaringen en afspraken, zowel schriftelijk als mondeling.",
      "",
      "In tweevoud ondertekend. Elke partij ontvangt een ondertekend exemplaar.",
    ].join("\n"),

    "c:mock-trial-period:title": "Proeftijd",
    "c:mock-trial-period:original":
      "De werknemer doorloopt een proeftijd van zes (6) maanden vanaf de begindatum.",
    "c:mock-trial-period:explanation":
      "De Nederlandse wet beperkt de proeftijd voor een arbeidsovereenkomst voor onbepaalde tijd tot maximaal twee maanden. Een proeftijd van zes maanden is van rechtswege nietig — er geldt simpelweg geen proeftijd.",
    "c:mock-trial-period:action":
      "Behandel de proeftijd als afwezig. De werkgever kan op deze grond niet zonder opzegtermijn beëindigen.",

    "c:mock-non-compete:title": "Concurrentiebeding",
    "c:mock-non-compete:original":
      "De werknemer mag binnen de EU twee jaar na beëindiging niet voor enige concurrent werken.",
    "c:mock-non-compete:explanation":
      "Een twee jaar durend, EU-breed concurrentiebeding is ongebruikelijk ruim en in een procedure waarschijnlijk niet afdwingbaar. Nederlandse rechters beperken doorgaans de reikwijdte en duur; eis een schriftelijke onderbouwing van een zwaarwegend bedrijfsbelang.",
    "c:mock-non-compete:action":
      "Vraag de werkgever de reikwijdte (geografie + duur) te beperken en het bedrijfsbelang schriftelijk vast te leggen.",

    "c:mock-salary:title": "Bruto maandsalaris",
    "c:mock-salary:original": "Bruto maandsalaris: EUR 3.200, betaalbaar op de 25e van elke maand.",
    "c:mock-salary:explanation":
      "Het salaris is uitgedrukt in EUR met een duidelijke betaaldatum. Hiermee wordt voldaan aan de verplichte vermelding voor een Nederlandse arbeidsovereenkomst.",

    "c:mock-working-hours:title": "Werktijden",
    "c:mock-working-hours:original": "Standaard werkweek: 40 uur, maandag tot en met vrijdag.",
    "c:mock-working-hours:explanation":
      "De werktijden zijn helder vastgelegd en blijven binnen het wettelijke maximum per week.",

    "c:mock-notice-period:title": "Opzegtermijn",
    "c:mock-notice-period:original":
      "Beide partijen kunnen deze overeenkomst beëindigen met een schriftelijke opzegtermijn van één (1) maand.",
    "c:mock-notice-period:explanation":
      "Een opzegtermijn van één maand voldoet aan het wettelijke minimum voor een arbeidsovereenkomst voor onbepaalde tijd in de eerste vijf dienstjaren.",
  },

  sv: {
    ocr: [
      "ANSTÄLLNINGSAVTAL",
      "Tillsvidare, regleras av nederländsk arbetsrätt.",
      "",
      "Mellan:",
      'NorthSea Logistics B.V., ett privat aktiebolag med begränsat ansvar, med säte på Hoofdweg 12, 1043 AA Amsterdam, Nederländerna, registrerat hos den nederländska handelskammaren under nummer 12345678 ("Arbetsgivaren");',
      "",
      "och",
      "",
      'Jane Doe, bosatt på Keizersgracht 200, 1016 EG Amsterdam, Nederländerna ("Arbetstagaren").',
      "",
      "Parterna är överens om följande.",
      "",
      "1. Befattning och arbetsuppgifter",
      "Arbetstagaren anställs som Senior Operations Coordinator. Arbetsuppgifterna omfattar planering av sändningar, arbetsledning av lagerpersonal och rapportering till Operations Manager. Arbetstagaren ska utföra rimliga ytterligare uppgifter som är förenliga med befattningen.",
      "",
      "2. Provanställning",
      "Arbetstagaren tjänstgör under en provanställning på sex (6) månader från startdatumet.",
      "Under provanställningen får endera parten säga upp avtalet med omedelbar verkan, utan att iaktta uppsägningstid och utan att ange skäl.",
      "",
      "3. Ersättning",
      "Bruttomånadslön: 3 200 EUR, utbetalas den 25:e varje månad.",
      "Arbetstagaren har rätt till en årlig semesterersättning motsvarande 8 % av bruttoårslönen, utbetalad i maj. Lönerevision sker varje januari efter Arbetsgivarens bedömning.",
      "",
      "4. Arbetstid",
      "Standardarbetsvecka: 40 timmar, måndag till fredag.",
      "Den dagliga arbetstiden är 09:00–17:30 med 30 minuters obetald lunchrast. Arbetstagaren kan åläggas att utföra rimlig övertid, kompenserad genom ledighet inom samma kalenderkvartal.",
      "",
      "5. Arbetsplats",
      "Arbetstagarens primära arbetsplats är Arbetsgivarens lokaler i Amsterdam. Arbetsgivaren får, efter rimlig underrättelse, kräva att Arbetstagaren utför arbete från en annan plats inom Nederländerna under kortare uppdrag på högst tio på varandra följande arbetsdagar.",
      "",
      "6. Semester",
      "Arbetstagaren har rätt till 25 betalda semesterdagar per kalenderår, intjänade pro rata. Outtagna semesterdagar får sparas till nästa år, dock högst fem dagar.",
      "",
      "7. Sjukdom och arbetsoförmåga",
      "Vid sjukdom ska Arbetstagaren meddela Arbetsgivaren före kl. 09:00 första dagen av frånvaron. Vid arbetsoförmåga betalar Arbetsgivaren 100 % av lönen under de första 52 veckorna och 70 % under de andra 52 veckorna, i enlighet med nederländsk lag.",
      "",
      "8. Uppsägningstid",
      "Endera parten får säga upp detta avtal med en (1) månads skriftligt varsel.",
      "Uppsägning ska ske med rekommenderat brev och får verkan från den första dagen i den kalendermånad som följer mottagandet.",
      "",
      "9. Konkurrensklausul",
      "Arbetstagaren får inte arbeta för någon konkurrent inom EU under två år efter anställningens upphörande.",
      'I denna klausul avses med "konkurrent" varje företag som är verksamt inom internationell godsspedition eller leveranskedjekonsultation. Brott medför ett omedelbart vite på 25 000 EUR per överträdelse plus 1 000 EUR per dag som överträdelsen fortgår.',
      "",
      "10. Sekretess",
      "Arbetstagaren ska iaktta sekretess avseende all information om Arbetsgivaren, dess kunder och affärsförbindelser, både under och efter anställningen. Skyldigheten gäller utan tidsbegränsning efter anställningens upphörande.",
      "",
      "11. Immateriella rättigheter",
      "Alla uppfinningar, programvara, formgivningar och andra verk som Arbetstagaren skapar inom ramen för anställningen tillkommer uteslutande Arbetsgivaren. Arbetstagaren avstår från ideella rättigheter i den utsträckning lagen tillåter.",
      "",
      "12. Personuppgifter",
      "Arbetsgivaren behandlar Arbetstagarens personuppgifter i enlighet med GDPR och Arbetsgivarens integritetsmeddelande, av vilket en kopia har lämnats till Arbetstagaren.",
      "",
      "13. Tillämplig lag och forum",
      "Detta avtal regleras uteslutande av nederländsk lag. Domstolen i Amsterdam är ensam behörig att pröva tvister som uppstår ur eller har samband med detta avtal.",
      "",
      "14. Hela avtalet",
      "Detta dokument utgör hela avtalet mellan parterna avseende dess innehåll och ersätter alla tidigare förhandlingar, utfästelser och överenskommelser, vare sig skriftliga eller muntliga.",
      "",
      "Undertecknat i två exemplar. Varje part behåller ett undertecknat exemplar.",
    ].join("\n"),

    "c:mock-trial-period:title": "Provanställning",
    "c:mock-trial-period:original":
      "Arbetstagaren tjänstgör under en provanställning på sex (6) månader från startdatumet.",
    "c:mock-trial-period:explanation":
      "Nederländsk lag begränsar provanställningen vid ett tillsvidareavtal till högst två månader. En sex månaders provanställning är ogiltig enligt lag — provanställning gäller helt enkelt inte.",
    "c:mock-trial-period:action":
      "Behandla provanställningen som obefintlig. Arbetsgivaren kan inte säga upp utan varsel på denna grund.",

    "c:mock-non-compete:title": "Konkurrensklausul",
    "c:mock-non-compete:original":
      "Arbetstagaren får inte arbeta för någon konkurrent inom EU under två år efter anställningens upphörande.",
    "c:mock-non-compete:explanation":
      "En tvåårig konkurrensklausul som omfattar hela EU är ovanligt vidsträckt och sannolikt inte verkställbar i domstol. Nederländska domstolar begränsar ofta omfattning och varaktighet; kräv skriftlig motivering av ett starkt affärsintresse.",
    "c:mock-non-compete:action":
      "Be arbetsgivaren begränsa omfattningen (geografi + varaktighet) och dokumentera affärsintresset skriftligt.",

    "c:mock-salary:title": "Bruttomånadslön",
    "c:mock-salary:original": "Bruttomånadslön: 3 200 EUR, utbetalas den 25:e varje månad.",
    "c:mock-salary:explanation":
      "Lönen anges i EUR med ett tydligt betalningsdatum. Detta uppfyller den obligatoriska upplysningsplikten för ett nederländskt anställningsavtal.",

    "c:mock-working-hours:title": "Arbetstid",
    "c:mock-working-hours:original": "Standardarbetsvecka: 40 timmar, måndag till fredag.",
    "c:mock-working-hours:explanation":
      "Arbetstiderna är tydligt angivna och inom det lagstadgade veckomaximum.",

    "c:mock-notice-period:title": "Uppsägningstid",
    "c:mock-notice-period:original":
      "Endera parten får säga upp detta avtal med en (1) månads skriftligt varsel.",
    "c:mock-notice-period:explanation":
      "En uppsägningstid på en månad uppfyller den lagstadgade miniminivån för ett tillsvidareavtal under de första fem anställningsåren.",
  },
};

/**
 * Returns canned NL/SV translations for the mock contract. Any id we
 * don't have a mock for falls back to the source text — so a real-OCR
 * contract that happens to hit this code path (e.g. Anthropic credit
 * exhausted mid-flow with a non-mock OCR already on screen) at least
 * survives the round trip.
 *
 * The translate API is only allowed to mock when both the language is
 * NL/SV and the request actually contains mock-clause ids; otherwise
 * the source-text passthrough already implemented in the route is the
 * safer fallback.
 */
export function getMockTranslations(
  target: UiLanguage,
  items: readonly TranslateItem[],
): readonly TranslateItem[] {
  if (target === "en") return items;
  const dict = MOCK_TRANSLATIONS[target];
  return items.map((item) => ({ id: item.id, text: dict[item.id] ?? item.text }));
}

/**
 * True when at least one inbound item id has a canned translation in the
 * mock dictionary (for either NL or SV — both share the same key set).
 * Lets a chained provider distinguish "real contract, no mock data" (skip)
 * from "the analyze stage already swapped in mock clauses, translate them"
 * (handle). When no id matches, the provider should bow out so the chain
 * can return a clear 503 instead of silently passing English back.
 */
export function mockHasAnyMatch(items: readonly TranslateItem[]): boolean {
  if (items.length === 0) return false;
  // NL and SV dictionaries share identical key sets — checking either one
  // is sufficient. Pick NL for stability.
  const dict = MOCK_TRANSLATIONS.nl;
  for (const item of items) {
    if (item.id in dict) return true;
  }
  return false;
}
