import type {
  CandidateSite, MockDataset, PlanningArea, Quarry, SoilPolygon, Substation, TerrainCell, Well,
} from '../types';
import sites from './mock/sites.json';
import substations from './mock/substations.json';
import wells from './mock/wells.json';
import soils from './mock/soils.json';
import terrain from './mock/terrain.json';
import quarries from './mock/quarries.json';
import planning from './mock/planning.json';

// Samlat dataset. När riktiga källor kopplas på (§13) ersätts importerna här per lager.
export const dataset: MockDataset = {
  sites: sites as CandidateSite[],
  substations: substations as Substation[],
  wells: wells as Well[],
  soils: soils as SoilPolygon[],
  terrain: terrain as TerrainCell[],
  quarries: quarries as Quarry[],
  planning: planning as PlanningArea[],
};
