import type { Part } from '../data/types';

/**
 * The game gives Faults no category, so we group them by the system they affect.
 * Rules are checked in order and the first match wins.
 */
export const FAULT_GROUPS = [
  'Race start',
  'Afterburner',
  'Ramjet',
  'Abilities & Energy',
  'Malfunctions',
  'Boosts',
  'Status effects',
  'Landing & air',
  'Speed, handling & damage',
  'Podracer',
  'Other',
] as const;
export type FaultGroup = (typeof FAULT_GROUPS)[number];

const RULES: [FaultGroup, RegExp][] = [
  ['Race start', /\bat race start\b|\bperfect start\b/i],
  ['Afterburner', /\bafterburner\b/i],
  ['Ramjet', /\bramjet\b|\bredlining\b/i],
  ['Malfunctions', /\bmalfunction\b/i],
  ['Abilities & Energy', /\babilit(y|ies)\b|\benergy\b/i],
  ['Boosts', /\bslipstreaming\b|\bsurg(e|ing)\b|\bovercharged\b/i],
  ['Landing & air', /\blanding\b|\bairborne\b/i],
  ['Status effects', /\b(burning|frozen|corroded|concussed|choked|disrupted)\b/i],
  ['Speed, handling & damage', /\bcrash\b|\bcollision|\bimpact\b|\bdamage\b|\bsteering\b|\bcornering\b|\btop speed\b|\bdrag\b/i],
  ['Podracer', /\bpodracers?\b/i],
];

export function faultGroup(fault: Pick<Part, 'text'>): FaultGroup {
  return RULES.find(([, re]) => re.test(fault.text))?.[0] ?? 'Other';
}
