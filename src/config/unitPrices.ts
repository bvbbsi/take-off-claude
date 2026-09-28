// Mock-enhetspriser (SPEC §10.4). Redigerbara i UI – ändringar räknar om kalkylen direkt.
export type UnitPriceKey =
  | 'etablering' | 'avtackning' | 'jordschakt' | 'bergschakt' | 'krossning' | 'fyllning'
  | 'inkopFyll' | 'transport' | 'transportFast' | 'mottagningRen' | 'mottagningLera'
  | 'plattaMark' | 'plattaForstarkt' | 'palar' | 'palningEtablering' | 'kcPelare'
  | 'lanshallning' | 'geoteknikMin' | 'geoteknikMax';

export interface UnitPriceDef {
  key: UnitPriceKey;
  post: string;
  unit: string;
  p50: number;
  comment?: string;
}

export const UNIT_PRICE_DEFS: UnitPriceDef[] = [
  { key: 'etablering', post: 'Etablering markarbeten', unit: 'st', p50: 1_500_000, comment: 'Skalas × (1 + areaHa/50)' },
  { key: 'avtackning', post: 'Avtäckning matjord', unit: 'm³', p50: 70 },
  { key: 'jordschakt', post: 'Jordschakt inkl. lastning', unit: 'm³', p50: 140 },
  { key: 'bergschakt', post: 'Bergschakt (sprängning inkl. lastning)', unit: 'm³ fast', p50: 420 },
  { key: 'krossning', post: 'Krossning på plats', unit: 'ton', p50: 55 },
  { key: 'fyllning', post: 'Fyllning och packning', unit: 'm³', p50: 110 },
  { key: 'inkopFyll', post: 'Inköpt fyllnadsmaterial', unit: 'ton', p50: 120, comment: 'Plus transport' },
  { key: 'transport', post: 'Transport', unit: 'ton·km', p50: 2.8, comment: 'Plus fast avgift per ton' },
  { key: 'transportFast', post: 'Transport, fast avgift', unit: 'ton', p50: 35 },
  { key: 'mottagningRen', post: 'Mottagningsavgift rena massor', unit: 'ton', p50: 60 },
  { key: 'mottagningLera', post: 'Mottagningsavgift lera/torv', unit: 'ton', p50: 110 },
  { key: 'plattaMark', post: 'Platta på mark (grundläggningsdel)', unit: 'm² byggyta', p50: 900 },
  { key: 'plattaForstarkt', post: 'Förstärkt platta/plintar på berg', unit: 'm² byggyta', p50: 1_100 },
  { key: 'palar', post: 'Betongpålar, spetsburna', unit: 'lm', p50: 1_100 },
  { key: 'palningEtablering', post: 'Pålning, etablering', unit: 'st', p50: 400_000 },
  { key: 'kcPelare', post: 'KC-pelare', unit: 'lm', p50: 180 },
  { key: 'lanshallning', post: 'Länshållning/tätning', unit: 'm² schaktyta', p50: 150 },
  { key: 'geoteknikMin', post: 'Geoteknisk undersökning, min', unit: 'st', p50: 250_000, comment: 'Beroende på yta och komplexitet' },
  { key: 'geoteknikMax', post: 'Geoteknisk undersökning, max', unit: 'st', p50: 1_500_000 },
];

export type UnitPrices = Record<UnitPriceKey, number>;

export const DEFAULT_UNIT_PRICES: UnitPrices = Object.fromEntries(
  UNIT_PRICE_DEFS.map((d) => [d.key, d.p50]),
) as UnitPrices;
