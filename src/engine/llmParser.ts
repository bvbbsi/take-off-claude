import type { ParseResult, PromptParser } from '../types';
import { ruleBasedParser } from './promptParser';

const TIMEOUT_MS = 8000;

/**
 * Valfri LLM-parser (SPEC §8.3). Anropar proxy-servern i server/ som håller API-nyckeln.
 * Faller tillbaka på den regelbaserade parsern vid fel eller timeout.
 */
export const llmParser: PromptParser = {
  async parse(text: string): Promise<ParseResult> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ParseResult;
      if (!data || typeof data !== 'object' || !data.requirements) throw new Error('Ogiltigt svar');
      return { requirements: data.requirements, filledFields: data.filledFields ?? [], unparsedHints: data.unparsedHints ?? [] };
    } catch (err) {
      console.warn('LLM-parser misslyckades, faller tillbaka på regelbaserad parser:', err);
      return ruleBasedParser.parse(text);
    } finally {
      clearTimeout(timer);
    }
  },
};

export function getParser(): PromptParser {
  return import.meta.env.VITE_USE_LLM_PARSER === 'true' ? llmParser : ruleBasedParser;
}
