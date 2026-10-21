import type { GameData } from '../data/types';
import { defaultCard, type CardContent } from './og-card';

export const NO_STYLE = 'none';

/** Card id used in /og/<id>.png, shared by the page generator and the Pages Function. */
export const cardId = (classId: string, styleId: string | null) => `${classId}-${styleId ?? NO_STYLE}`;

/** One card per vehicle class and racer style (plus "no style"), and a default. */
export function allCards(data: GameData): { id: string; card: CardContent }[] {
  const cards = [{ id: 'default', card: defaultCard }];
  for (const cls of data.vehicleClasses) {
    cards.push({
      id: cardId(cls.id, null),
      card: {
        label: 'Vehicle',
        heading: cls.name,
        sub: cls.maneuveringName,
        panelLabel: 'Racer style',
        panelTitle: 'Any style',
        lines: cls.traits.map((t) => t.name),
      },
    });
    for (const style of data.racerStyles) {
      cards.push({
        id: cardId(cls.id, style.id),
        card: {
          label: 'Vehicle',
          heading: cls.name,
          sub: cls.maneuveringName,
          panelLabel: 'Racer style',
          panelTitle: style.name,
          lines: (style.ranks.length ? style.ranks.flatMap((r) => r.traits) : style.multiplayer).map((t) => t.name),
        },
      });
    }
  }
  return cards;
}
