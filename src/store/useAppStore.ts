import { create } from 'zustand';
import { DEFAULT_UNIT_PRICES, type UnitPriceKey, type UnitPrices } from '../config/unitPrices';
import { buildRequirements, changeFacilityType, defaultRequirements } from '../engine/requirements';
import type { FacilityType, ParseResult, RequirementField, Requirements } from '../types';

export type InputMode = 'kombination' | 'prompt' | 'formular';
export type DetailTab = 'oversikt' | 'effekt' | 'mark' | 'grundlaggning';

export type LayerId =
  | 'top' | 'others' | 'excluded' | 'substations' | 'soils' | 'wells' | 'quarries'
  | 'restrictions' | 'planning' | 'elAreas';

export const LAYER_DEFAULTS: Record<LayerId, boolean> = {
  top: true,
  others: true,
  excluded: false,
  substations: true,
  soils: false,
  wells: false,
  quarries: false,
  restrictions: true,
  planning: false,
  elAreas: true,
};

interface AppState {
  mode: InputMode;
  promptText: string;
  requirements: Requirements;
  /** Fält som prompten fyllde i (märks "från din beskrivning"). */
  fromPrompt: RequirementField[];
  unparsedHints: string[];
  parsed: boolean;
  /** Ökar vid varje tolkning – används för att frysa listan med saknade frågor. */
  parseId: number;
  parsing: boolean;
  searched: boolean;
  searchId: number;
  unitPrices: UnitPrices;
  layers: Record<LayerId, boolean>;
  selectedSiteId: string | null;
  detailTab: DetailTab;
  priceEditorOpen: boolean;
  mobileSheetOpen: boolean;

  setMode: (m: InputMode) => void;
  setPromptText: (t: string) => void;
  applyParse: (r: ParseResult) => void;
  setParsing: (v: boolean) => void;
  setField: <K extends RequirementField>(field: K, value: Requirements[K]) => void;
  clearField: (field: RequirementField) => void;
  setFacilityType: (t: FacilityType) => void;
  search: () => void;
  resetAll: () => void;
  setUnitPrice: (k: UnitPriceKey, v: number) => void;
  resetUnitPrices: () => void;
  toggleLayer: (id: LayerId) => void;
  selectSite: (id: string | null, tab?: DetailTab) => void;
  setDetailTab: (t: DetailTab) => void;
  setPriceEditorOpen: (v: boolean) => void;
  setMobileSheetOpen: (v: boolean) => void;
}

const markFilled = (req: Requirements, field: keyof Requirements): Requirements['_filledFields'] =>
  req._filledFields.includes(field) ? req._filledFields : [...req._filledFields, field];

export const useAppStore = create<AppState>((set) => ({
  mode: 'kombination',
  promptText: '',
  requirements: defaultRequirements('datacenter'),
  fromPrompt: [],
  unparsedHints: [],
  parsed: false,
  parseId: 0,
  parsing: false,
  searched: false,
  searchId: 0,
  unitPrices: { ...DEFAULT_UNIT_PRICES },
  layers: { ...LAYER_DEFAULTS },
  selectedSiteId: null,
  detailTab: 'oversikt',
  priceEditorOpen: false,
  mobileSheetOpen: true,

  setMode: (mode) => set({ mode }),
  setPromptText: (promptText) => set({ promptText }),
  setParsing: (parsing) => set({ parsing }),

  applyParse: (r) =>
    set((s) => {
      // Fält som användaren redan fyllt i manuellt behålls om prompten inte anger dem.
      const manual: Partial<Requirements> = {};
      for (const f of s.requirements._filledFields) {
        if (!r.filledFields.includes(f) && !s.fromPrompt.includes(f as RequirementField)) {
          (manual as Record<string, unknown>)[f] = s.requirements[f];
        }
      }
      const manualFields = Object.keys(manual) as (keyof Requirements)[];
      const requirements = buildRequirements({ ...manual, ...r.requirements }, [...manualFields, ...r.filledFields]);
      return {
        requirements,
        fromPrompt: r.filledFields.filter((f): f is RequirementField => f !== '_filledFields'),
        unparsedHints: r.unparsedHints,
        parsed: true,
        parseId: s.parseId + 1,
      };
    }),

  setField: (field, value) =>
    set((s) => ({
      requirements: { ...s.requirements, [field]: value, _filledFields: markFilled(s.requirements, field) },
      fromPrompt: s.fromPrompt.filter((f) => f !== field),
    })),

  clearField: (field) =>
    set((s) => {
      const defaults = defaultRequirements(s.requirements.facilityType);
      if (field === 'facilityType') {
        const next = changeFacilityType(s.requirements, 'datacenter');
        return {
          requirements: { ...next, _filledFields: next._filledFields.filter((f) => f !== 'facilityType') },
          fromPrompt: s.fromPrompt.filter((f) => f !== field),
        };
      }
      return {
        requirements: {
          ...s.requirements,
          [field]: defaults[field],
          _filledFields: s.requirements._filledFields.filter((f) => f !== field),
        },
        fromPrompt: s.fromPrompt.filter((f) => f !== field),
      };
    }),

  setFacilityType: (t) =>
    set((s) => ({
      requirements: changeFacilityType(s.requirements, t),
      fromPrompt: s.fromPrompt.filter((f) => f !== 'facilityType'),
    })),

  search: () => set((s) => ({ searched: true, searchId: s.searchId + 1, selectedSiteId: null, mobileSheetOpen: true })),

  resetAll: () =>
    set({
      promptText: '',
      requirements: defaultRequirements('datacenter'),
      fromPrompt: [],
      unparsedHints: [],
      parsed: false,
      searched: false,
      selectedSiteId: null,
    }),

  setUnitPrice: (k, v) => set((s) => ({ unitPrices: { ...s.unitPrices, [k]: v } })),
  resetUnitPrices: () => set({ unitPrices: { ...DEFAULT_UNIT_PRICES } }),
  toggleLayer: (id) => set((s) => ({ layers: { ...s.layers, [id]: !s.layers[id] } })),
  selectSite: (id, tab) => set((s) => ({ selectedSiteId: id, detailTab: tab ?? (id !== s.selectedSiteId ? 'oversikt' : s.detailTab) })),
  setDetailTab: (detailTab) => set({ detailTab }),
  setPriceEditorOpen: (priceEditorOpen) => set({ priceEditorOpen }),
  setMobileSheetOpen: (mobileSheetOpen) => set({ mobileSheetOpen }),
}));
