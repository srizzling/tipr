import type { GameData } from '../data/types';
import { combinedBoxes, topSpeed, vehicleLevel, type Build } from './build';
import { buildVerdict } from './verdict';

const nameOf = (list: { id: string; name: string }[], id: string | null) => list.find((x) => x.id === id)?.name;

/** Title and description used for link previews and the page <title> of a shared build. */
export function buildSummary(build: Build, data: GameData): { title: string; description: string } {
  const cls = data.vehicleClasses.find((c) => c.id === build.classId);
  const style = nameOf(data.racerStyles, build.styleId);
  const abilities = [...build.abilities, build.crashAbility]
    .map((id) => nameOf(data.abilities, id))
    .filter((n): n is string => !!n);
  const parts = build.parts.map((p) => nameOf(data.parts, p.id)).filter((n): n is string => !!n);

  const title = [style, cls?.name, 'build'].filter(Boolean).join(' ') + ' · This Is Pod Racing';
  const facts = [
    cls ? `${cls.name}, level ${vehicleLevel(build.tuning)}, ${topSpeed(cls.baseSpeed, combinedBoxes(build.tuning, build.bonus), cls.id === 'podracer')} km/h` : null,
    style ? `${style} rank ${build.styleRank}` : null,
    abilities.length ? `Abilities: ${abilities.join(', ')}` : null,
    parts.length ? `Parts: ${parts.join(', ')}` : null,
  ].filter(Boolean);
  const { title: joke } = buildVerdict(build, data);
  return { title, description: `${joke}. ${facts.join('. ')}.` };
}
