# Sitefinder – platsanalys för mark, effekt och markkalkyl (MVP)

> ⚠ **MOCK-DATA – endast för demonstration.** Tidig screening – ersätter inte geoteknisk undersökning.

Webbverktyg som rekommenderar 10 platser i Sverige för effektintensiva etableringar (datacenter, BESS,
industri, logistik, vätgas) utifrån elnätskapacitet, markförhållanden, planförutsättningar, massor/logistik
och en grov markkalkyl med grundläggningsförslag.

## Kom igång

```bash
npm install
npm run dev            # startar appen på http://localhost:5173
npm test               # Vitest: parser, grundläggningsregler, massbalans, rankning
npm run generate:mock  # återskapar identisk mock-data i src/data/mock/ (seedad)
npm run build          # typkontroll + produktionsbygge
```

## Funktioner

- **Karta** (MapLibre + OpenFreeMap Positron, fallback OSM-raster) med tänd/släckbara lager: topp 10,
  övriga och uteslutna platser, stationer, jordarter, brunnar, täkter, restriktioner, planområden och elområden.
  Legend och popups per lager. Vald plats visar linjer till närmaste station och täkt samt ett avståndsband.
- **Behovsinmatning** i tre lägen: prompt, stegvis formulär (8 steg) och kombination (standard) där prompten
  förifyller formuläret och bara saknade frågor lyfts fram. Alla krav visas som redigerbara chips.
- **Rekommendationsmotor** (`src/engine/scoring.ts`): hårda filter → fem delpoäng → viktning per anläggningstyp
  → topp 10 med deterministiska motiveringar och varningar.
- **Detaljvy** med flikarna Översikt (radardiagram), Effekt, Mark & kalkyl (P10/P50/P90, massbalans,
  kostnadsfördelning) och Grundläggning. Varje flik avslutas med en källruta (source + confidence).
- **Enhetsprisredigerare** – ändringar räknar om markkalkyl och rankning direkt.
- Responsiv layout: på mobil är kartan helskärm, inmatning/resultat en bottom sheet och detaljvyn en modal.

## Struktur

```
scripts/generate-mock-data.ts   deterministisk mock-generator (seedrandom)
src/types/                      domäntyper (SPEC §5)
src/engine/                     requirements, promptParser, scoring, groundModel, earthworks, foundation (+ tester)
src/config/                     unitPrices, weights, towns
src/components/                 map/, input/, results/, calc/, common/
src/store/                      Zustand-store och rankningshook
server/                         valfri LLM-proxy (Express) för prompttolkning
```

## Valfri LLM-parser (§8.3)

```bash
cp .env.example .env        # sätt VITE_USE_LLM_PARSER=true och ANTHROPIC_API_KEY=...
cd server && npm install && npm start   # proxy på :8787, Vite proxar /api dit
```

Nyckeln läses bara av servern. Vid fel eller timeout faller klienten tillbaka på den regelbaserade parsern.
Modell väljs med `ANTHROPIC_MODEL` (standard `claude-opus-5`).

## Framtida datakällor

Alla lager bär `source` och `confidence`. Riktiga källor (SGU, Lantmäteriet, Svk, nätbolag, kommuner)
kopplas på genom att ersätta importerna i `src/data/index.ts` per lager – se SPEC §13.
