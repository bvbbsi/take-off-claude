import type { ElArea } from '../types';

// Orter som mock-datan klustras kring (SPEC §6). `clayProne` markerar kustnära
// lerområden (Mälardalen, Uppsala, Göteborg, Skåne), `highland` Norrland/höglänta lägen.
export interface Town {
  name: string;
  lat: number;
  lng: number;
  elArea: ElArea;
  county: string;
  clayProne: boolean;
  highland: boolean;
  /** Storstadsregion med ansträngt nät (röda stationer, långa köer). */
  congested: boolean;
}

export const TOWNS: Town[] = [
  { name: 'Luleå', lat: 65.58, lng: 22.15, elArea: 'SE1', county: 'Norrbottens län', clayProne: false, highland: true, congested: false },
  { name: 'Boden', lat: 65.83, lng: 21.69, elArea: 'SE1', county: 'Norrbottens län', clayProne: false, highland: true, congested: false },
  { name: 'Piteå', lat: 65.32, lng: 21.48, elArea: 'SE1', county: 'Norrbottens län', clayProne: false, highland: true, congested: false },
  { name: 'Skellefteå', lat: 64.75, lng: 20.95, elArea: 'SE2', county: 'Västerbottens län', clayProne: false, highland: true, congested: false },
  { name: 'Umeå', lat: 63.83, lng: 20.26, elArea: 'SE2', county: 'Västerbottens län', clayProne: false, highland: true, congested: false },
  { name: 'Östersund', lat: 63.18, lng: 14.64, elArea: 'SE2', county: 'Jämtlands län', clayProne: false, highland: true, congested: false },
  { name: 'Sundsvall', lat: 62.39, lng: 17.31, elArea: 'SE2', county: 'Västernorrlands län', clayProne: false, highland: true, congested: false },
  { name: 'Gävle', lat: 60.67, lng: 17.14, elArea: 'SE3', county: 'Gävleborgs län', clayProne: false, highland: false, congested: false },
  { name: 'Borlänge', lat: 60.48, lng: 15.43, elArea: 'SE3', county: 'Dalarnas län', clayProne: false, highland: true, congested: false },
  { name: 'Avesta', lat: 60.14, lng: 16.17, elArea: 'SE3', county: 'Dalarnas län', clayProne: false, highland: false, congested: false },
  { name: 'Uppsala', lat: 59.86, lng: 17.64, elArea: 'SE3', county: 'Uppsala län', clayProne: true, highland: false, congested: true },
  { name: 'Västerås', lat: 59.61, lng: 16.55, elArea: 'SE3', county: 'Västmanlands län', clayProne: true, highland: false, congested: true },
  { name: 'Stockholm', lat: 59.33, lng: 18.07, elArea: 'SE3', county: 'Stockholms län', clayProne: true, highland: false, congested: true },
  { name: 'Eskilstuna', lat: 59.37, lng: 16.51, elArea: 'SE3', county: 'Södermanlands län', clayProne: true, highland: false, congested: true },
  { name: 'Örebro', lat: 59.27, lng: 15.21, elArea: 'SE3', county: 'Örebro län', clayProne: false, highland: false, congested: false },
  { name: 'Hallsberg', lat: 59.07, lng: 15.11, elArea: 'SE3', county: 'Örebro län', clayProne: false, highland: false, congested: false },
  { name: 'Karlstad', lat: 59.38, lng: 13.5, elArea: 'SE3', county: 'Värmlands län', clayProne: false, highland: false, congested: false },
  { name: 'Norrköping', lat: 58.59, lng: 16.19, elArea: 'SE3', county: 'Östergötlands län', clayProne: false, highland: false, congested: false },
  { name: 'Linköping', lat: 58.41, lng: 15.62, elArea: 'SE3', county: 'Östergötlands län', clayProne: false, highland: false, congested: false },
  { name: 'Trollhättan', lat: 58.28, lng: 12.29, elArea: 'SE3', county: 'Västra Götalands län', clayProne: true, highland: false, congested: false },
  { name: 'Göteborg', lat: 57.71, lng: 11.97, elArea: 'SE3', county: 'Västra Götalands län', clayProne: true, highland: false, congested: true },
  { name: 'Jönköping', lat: 57.78, lng: 14.16, elArea: 'SE3', county: 'Jönköpings län', clayProne: false, highland: true, congested: false },
  { name: 'Halmstad', lat: 56.67, lng: 12.86, elArea: 'SE4', county: 'Hallands län', clayProne: false, highland: false, congested: false },
  { name: 'Karlshamn', lat: 56.17, lng: 14.86, elArea: 'SE4', county: 'Blekinge län', clayProne: false, highland: false, congested: false },
  { name: 'Kalmar', lat: 56.66, lng: 16.36, elArea: 'SE3', county: 'Kalmar län', clayProne: false, highland: false, congested: false },
  { name: 'Helsingborg', lat: 56.05, lng: 12.69, elArea: 'SE4', county: 'Skåne län', clayProne: true, highland: false, congested: false },
  { name: 'Malmö', lat: 55.6, lng: 13.0, elArea: 'SE4', county: 'Skåne län', clayProne: true, highland: false, congested: false },
];

export const COUNTIES = Array.from(new Set(TOWNS.map((t) => t.county))).sort((a, b) => a.localeCompare(b, 'sv'));

export function countyOfMunicipality(municipality: string): string | undefined {
  return TOWNS.find((t) => t.name === municipality)?.county;
}

// Regionbegrepp som prompten kan nämna (§8.2).
export const REGION_GROUPS: Record<string, string[]> = {
  Mälardalen: ['Stockholms län', 'Uppsala län', 'Västmanlands län', 'Södermanlands län', 'Örebro län'],
  Stockholm: ['Stockholms län'],
  Skåne: ['Skåne län'],
};
