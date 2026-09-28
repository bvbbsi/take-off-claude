import { REGION_GROUPS, TOWNS } from '../config/towns';
import type { ElArea, FacilityType, ParseResult, PromptParser, Requirements } from '../types';
import { CURRENT_YEAR } from './requirements';

/**
 * Regelbaserad prompttolkning (SPEC §8.2). Hanterar svenska och engelska med regex
 * och nyckelordslistor. Ingen nyckel eller nätverk krävs.
 */

// Ordgräns som fungerar med å/ä/ö (JS \b gör inte det).
const L = '\\p{L}';
const word = (src: string, flags = 'iu') => new RegExp(`(?<![${L}])(?:${src})(?![${L}])`, flags);

const num = (s: string) => parseFloat(s.replace(/\s/g, '').replace(',', '.'));

const FACILITY_KEYWORDS: [FacilityType, RegExp][] = [
  ['bess', word('batteri\\p{L}*|bess|energilager\\p{L}*|battery|batteries|energy storage')],
  ['datacenter', word('datacenter|datacentr\\p{L}*|data ?center\\p{L}*|data ?centre\\p{L}*|serverhall\\p{L}*|server hall')],
  ['vatgas', word('vätgas\\p{L}*|elektrolys\\p{L}*|hydrogen|electroly\\p{L}*')],
  ['industri', word('fabrik\\p{L}*|industri\\p{L}*|produktion\\p{L}*|factory|industry|industrial|manufacturing')],
  ['logistik', word('lager|lagerbyggnad|logistik\\p{L}*|terminal\\p{L}*|warehouse|logistics')],
];

const NORTH = word('norra sverige|norrland|i norr|north(?:ern)? sweden|the north');
const MIDDLE = word('mälardalen|mellersta sverige|mellersta|central sweden|stockholm(?:sområdet)?');
const SOUTH = word('södra sverige|skåne|southern sweden|south sweden');

interface Hit {
  field: keyof Requirements;
}

type Out = Partial<Requirements>;

function parseSegment(seg: string, out: Out, filled: Set<keyof Requirements>, baseYear: number): Hit[] {
  const hits: Hit[] = [];
  const set = <K extends keyof Requirements>(k: K, v: Requirements[K]) => {
    (out as Record<string, unknown>)[k] = v;
    filled.add(k);
    hits.push({ field: k });
  };
  const text = seg.toLowerCase();

  // Effekt
  const mw = text.match(/(\d+(?:[.,]\d+)?)\s*(?:mw|megawatt)(?![\p{L}])/iu);
  if (mw) set('powerMW', num(mw[1]));
  const gw = text.match(/(\d+(?:[.,]\d+)?)\s*(?:gw|gigawatt)(?![\p{L}])/iu);
  if (gw && !mw) set('powerMW', num(gw[1]) * 1000);

  // Yta
  const areaRange = text.match(/(\d+(?:[.,]\d+)?)\s*(?:-|–|till|to)\s*(\d+(?:[.,]\d+)?)\s*(?:ha|hektar|hectares?)(?![\p{L}])/iu);
  const haMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:ha|hektar|hectares?)(?![\p{L}])/iu);
  const m2Match = text.match(/(\d[\d\s]*(?:[.,]\d+)?)\s*(?:m2|m²|kvm|kvadratmeter|sqm|square met(?:er|re)s?)(?![\p{L}])/iu);
  const isMax = word('max|maximalt|högst|at most|up to|upp till|som mest').test(text);
  if (areaRange) {
    set('minAreaHa', num(areaRange[1]));
    set('maxAreaHa', num(areaRange[2]));
  } else if (haMatch || m2Match) {
    const ha = haMatch ? num(haMatch[1]) : num(m2Match![1]) / 10_000;
    if (isMax) set('maxAreaHa', ha);
    else set('minAreaHa', ha);
  }

  // Anläggningstyp
  for (const [type, re] of FACILITY_KEYWORDS) {
    if (re.test(text)) {
      set('facilityType', type);
      break;
    }
  }

  // Elområden
  const areas = new Set<ElArea>((out.preferredElAreas as ElArea[] | undefined) ?? []);
  const regions = new Set<string>(out.preferredRegions ?? []);
  const before = areas.size;
  const beforeRegions = regions.size;
  for (const m of text.matchAll(/(?<![\p{L}])se\s?([1-4])(?![\p{L}\d])/giu)) areas.add(`SE${m[1]}` as ElArea);
  for (const m of text.matchAll(/(?:elområde(?:na)?|price area|bidding zone)\s*([1-4])(?:\s*(?:-|–|och|and|,|eller|or)\s*([1-4]))?/giu)) {
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) areas.add(`SE${i}` as ElArea);
  }
  if (NORTH.test(text)) {
    areas.add('SE1');
    areas.add('SE2');
  }
  if (MIDDLE.test(text)) {
    areas.add('SE3');
    if (/mälardalen/i.test(text)) REGION_GROUPS['Mälardalen'].forEach((r) => regions.add(r));
    if (/stockholm/i.test(text)) REGION_GROUPS['Stockholm'].forEach((r) => regions.add(r));
  }
  if (SOUTH.test(text)) {
    areas.add('SE4');
    if (/skåne/i.test(text)) REGION_GROUPS['Skåne'].forEach((r) => regions.add(r));
  }
  // Ortnamn → län
  for (const t of TOWNS) {
    if (t.name === 'Stockholm') continue;
    if (word(t.name.toLowerCase()).test(text)) regions.add(t.county);
  }
  if (areas.size > before) set('preferredElAreas', [...areas].sort());
  if (regions.size > beforeRegions) set('preferredRegions', [...regions].sort((a, b) => a.localeCompare(b, 'sv')));

  // Anslutningsår
  const within = text.match(/(?:inom|within|in)\s*(\d{1,2}|ett|två|tre|fyra|fem|one|two|three|four|five)\s*(?:år|years?)/iu);
  const WORDS: Record<string, number> = { ett: 1, två: 2, tre: 3, fyra: 4, fem: 5, one: 1, two: 2, three: 3, four: 4, five: 5 };
  if (within) {
    const n = WORDS[within[1]] ?? Number(within[1]);
    set('targetConnectionYear', baseYear + n);
  } else {
    const y = text.match(/(?:(före|innan|before|senast|by|till|år|anslutning|connection|i|in)\s+)?(20[2-4]\d)(?!\d)/iu);
    if (y) {
      const year = Number(y[2]);
      const beforeWord = y[1] && /^(före|innan|before)$/i.test(y[1]);
      set('targetConnectionYear', beforeWord ? year - 1 : year);
    }
  }

  // Lastklass
  if (word('tung|tunga|tungt|kraftiga laster|heavy|heavy loads?').test(text)) set('loadClass', 'tung');
  else if (word('lätt|lätta|light|lightweight').test(text)) set('loadClass', 'latt');
  else if (word('medeltung|medel ?last|medium load').test(text)) set('loadClass', 'medel');

  // Övrigt
  if (word('järnväg|spår|stickspår|rail|railway|railroad').test(text)) set('needsRail', true);
  if (word('fjärrvärme|restvärme|spillvärme|district heating|waste heat|heat recovery').test(text)) set('wantsDistrictHeating', true);
  if (word('fiber|fibre|fiberanslutning').test(text)) set('needsFiber', true);
  if (word('detaljplan klar|klar detaljplan|planlagd|planlagt|detaljplanerad|detaljplanerat|zoned|zoning in place').test(text)) {
    set('acceptedPlanStatus', ['detaljplan_klar']);
  }

  // Budget för markarbeten
  const budget = text.match(/(\d+(?:[.,]\d+)?)\s*(?:msek|mkr|miljoner(?:\s*kr(?:onor)?)?|million(?:\s*sek)?|m\s?sek)(?![\p{L}])/iu);
  if (budget) set('maxEarthworksBudgetMSEK', num(budget[1]));

  // Markrisk
  if (word('låg risk|låg markrisk|stabil mark|stabila markförhållanden|berg|på berg|low risk|stable ground|bedrock|solid rock').test(text)) {
    set('groundRiskTolerance', 'lag');
  } else if (word('hög risk(?:tolerans)?|risk ok|high risk(?: tolerance)?').test(text)) {
    set('groundRiskTolerance', 'hog');
  }

  // Avstånd till station
  const dist = text.match(/(\d+(?:[.,]\d+)?)\s*km\s*(?:från|till|from|to)?\s*(?:närmaste\s*)?(?:station|ställverk|substation|nätstation|elnät|grid)/iu)
    ?? text.match(/(?:station|substation|ställverk)\s*(?:inom|within)\s*(\d+(?:[.,]\d+)?)\s*km/iu);
  if (dist) set('maxDistanceToSubstationKm', num(dist[1]));

  return hits;
}

const FILLER = word('gärna|helst|och|samt|med|behöver|jag|vi|söker|letar|efter|en|ett|plats|tomt|please|need|looking|for|a|an|the|with|and|i|we|preferably');

export function parsePrompt(text: string, opts: { baseYear?: number } = {}): ParseResult {
  const baseYear = opts.baseYear ?? CURRENT_YEAR;
  const out: Out = {};
  const filled = new Set<keyof Requirements>();
  const unparsedHints: string[] = [];
  const segments = text.split(/(?<!\d)[.,](?!\d)|[;\n!?]+/u).map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    const hits = parseSegment(seg, out, filled, baseYear);
    if (hits.length === 0) {
      const residue = seg.replace(new RegExp(FILLER.source, 'giu'), '').trim();
      if (residue.length > 2) unparsedHints.push(seg);
    }
  }
  return { requirements: out, filledFields: [...filled], unparsedHints };
}

export const ruleBasedParser: PromptParser = {
  async parse(text: string) {
    return parsePrompt(text);
  },
};
