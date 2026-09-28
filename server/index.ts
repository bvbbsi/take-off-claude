/**
 * Valfri LLM-proxy för prompttolkning (SPEC §8.3).
 *
 *   cd server && npm install && npm start
 *
 * API-nyckeln läses från ANTHROPIC_API_KEY i ../.env och hamnar aldrig i klienten.
 * Klienten (VITE_USE_LLM_PARSER=true) anropar POST /api/parse via Vite-proxyn och
 * faller tillbaka på den regelbaserade parsern vid fel eller timeout.
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import express from 'express';
import { z } from 'zod';

const PORT = Number(process.env.PORT ?? 8787);
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5';
const CURRENT_YEAR = 2026;

// Alla fält är nullable: null = nämns inte i texten.
const RequirementsSchema = z.object({
  facilityType: z.enum(['datacenter', 'bess', 'industri', 'logistik', 'vatgas', 'ovrigt']).nullable(),
  powerMW: z.number().nullable(),
  minAreaHa: z.number().nullable(),
  maxAreaHa: z.number().nullable(),
  targetConnectionYear: z.number().int().nullable(),
  preferredElAreas: z.array(z.enum(['SE1', 'SE2', 'SE3', 'SE4'])).nullable(),
  preferredRegions: z.array(z.string()).nullable(),
  maxDistanceToSubstationKm: z.number().nullable(),
  groundRiskTolerance: z.enum(['lag', 'medel', 'hog']).nullable(),
  maxEarthworksBudgetMSEK: z.number().nullable(),
  loadClass: z.enum(['latt', 'medel', 'tung']).nullable(),
  acceptedPlanStatus: z.array(z.enum(['detaljplan_klar', 'planarbete_pagar', 'op_utpekad', 'oplanerad'])).nullable(),
  needsRail: z.boolean().nullable(),
  wantsDistrictHeating: z.boolean().nullable(),
  needsFiber: z.boolean().nullable(),
  unparsedHints: z.array(z.string()),
});

const SYSTEM = `Du tolkar en användares fritextbeskrivning (svenska eller engelska) av behov för en effektintensiv etablering i Sverige till ett strukturerat kravobjekt.
Sätt ett fält endast om texten uttryckligen eller tydligt anger det; annars null. Gissa inte.
- Ytor anges i hektar (1 ha = 10 000 m²). "minst X ha" → minAreaHa, "högst X ha" → maxAreaHa.
- Årtal: "senast 2029" → 2029, "före 2030" → 2029, "inom N år" → ${CURRENT_YEAR} + N.
- Geografi: "norra Sverige"/"Norrland" → ["SE1","SE2"]; "Mälardalen"/"Stockholm" → ["SE3"] och län i preferredRegions (t.ex. "Stockholms län"); "södra Sverige"/"Skåne" → ["SE4"]. Län skrivs på formen "Skåne län", "Norrbottens län".
- "stabil mark", "låg risk", "berg" → groundRiskTolerance "lag".
- "detaljplan klar"/"planlagd" → acceptedPlanStatus ["detaljplan_klar"].
- unparsedHints: delar av texten som du inte kunde koppla till något fält.`;

const client = new Anthropic();
const app = express();
app.use(express.json({ limit: '20kb' }));

app.post('/api/parse', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.slice(0, 4000) : '';
  if (!text.trim()) {
    res.status(400).json({ error: 'text saknas' });
    return;
  }
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: 'low', format: zodOutputFormat(RequirementsSchema) },
      system: SYSTEM,
      messages: [{ role: 'user', content: text }],
    });
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      res.status(502).json({ error: `Ingen tolkning (stop_reason: ${response.stop_reason})` });
      return;
    }
    const { unparsedHints, ...fields } = response.parsed_output;
    const requirements = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null));
    res.json({ requirements, filledFields: Object.keys(requirements), unparsedHints });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      res.status(500).json({ error: 'Ogiltig eller saknad ANTHROPIC_API_KEY' });
    } else if (err instanceof Anthropic.RateLimitError) {
      res.status(429).json({ error: 'Rate limit – försök igen senare' });
    } else if (err instanceof Anthropic.APIError) {
      res.status(502).json({ error: `API-fel ${err.status}` });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Internt fel' });
    }
  }
});

app.listen(PORT, () => console.log(`Sitefinder LLM-proxy på http://localhost:${PORT} (modell ${MODEL})`));
