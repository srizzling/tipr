export const STAT_IDS = [
  'afterburner',
  'ramjet',
  'cornering',
  'resilience',
  'battery',
  'maneuvering',
] as const;
export type StatId = (typeof STAT_IDS)[number];

export interface VehicleClass {
  id: string; // 'landspeeder'
  name: string;
  /** Class-specific name of the 'maneuvering' stat: Drift, Kinetic Burst, Knife Edge, Air Brake */
  maneuveringName: string;
  baseSpeed: number; // km/h
  traits: { name: string; text: string }[];
  purchasable: boolean;
}

export interface Trait {
  name: string;
  text: string;
}

export interface StyleRank {
  rank: 1 | 2 | 3;
  /** Human readable unlock requirement, e.g. 'Achieve 24 Takedowns'. Rank 1 is the style unlock itself. */
  unlock: string;
  /** Traits gained at this rank (not cumulative). */
  traits: Trait[];
}

export interface RacerStyle {
  id: string;
  name: string;
  startingAbilityId?: string;
  ranks: StyleRank[];
  /** Fixed multiplayer loadout (podracer pseudo-styles are multiplayer only). */
  multiplayer: Trait[];
  multiplayerOnly: boolean;
}

export interface Ability {
  id: string;
  name: string;
  family: string;
  tier: 1 | 2 | 3;
  /** Credits to install */
  cost: number;
  text: string;
  crash: boolean;
  upgradesFromId?: string;
}

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'experimental';

export interface Part {
  id: string;
  name: string;
  rarity: Rarity;
  /** Credits; null if not purchasable */
  price: number | null;
  text: string;
  /** Red drawback line shown under the effect (Fault parts / trade-offs), if any */
  downside?: string;
  fault: boolean;
  /** Events the player must complete to unlock the part; null if unknown */
  unlockEvents: number | null;
  /** Shared by tiered parts e.g. 'ramjet-power' for Ramjet Power I-IV */
  family?: string;
  tier?: number;
  source: string; // URL
}

export interface GlossaryTerm {
  id: string;
  name: string;
  text: string;
}

export interface GameData {
  vehicleClasses: VehicleClass[];
  racerStyles: RacerStyle[];
  abilities: Ability[];
  parts: Part[];
  glossary: GlossaryTerm[];
}
