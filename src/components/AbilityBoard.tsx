import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  ABILITY_SLOTS,
  addAbility,
  findAbilitySlot,
  placeAbility,
  setAbilitySlot,
  type AbilitySlot,
  type Build,
} from '../lib/build';
import type { Ability } from '../data/types';
import { AbilityGlyph } from './ui';

interface Props {
  build: Build;
  abilities: Ability[];
  onChange: (build: Build) => void;
  /** Open the searchable picker for a slot (the non-drag way to fill it). */
  onOpenPicker: (slot: AbilitySlot) => void;
}

interface DragData {
  abilityId: string;
  from: AbilitySlot | null;
}

const slotKey = (s: AbilitySlot) => `slot-${s}`;

/**
 * Ability slots plus a library you can drag from. Drag a library chip into a slot, drag between slots to swap,
 * or drag a slot onto the library to clear it. Mouse and touch (long press) drag; keyboard and screen-reader
 * users use the slot picker or the library's tap-to-add instead.
 */
export default function AbilityBoard({ build, abilities, onChange, onOpenPicker }: Props) {
  const byId = useMemo(() => new Map(abilities.map((a) => [a.id, a])), [abilities]);
  const isCrash = (id: string) => byId.get(id)?.crash ?? false;
  const [active, setActive] = useState<DragData | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const onDragStart = (e: DragStartEvent) => setActive((e.active.data.current as DragData) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const drag = e.active.data.current as DragData | undefined;
    const target = e.over?.data.current as { slot?: AbilitySlot; library?: boolean } | undefined;
    if (!drag || !target) return;
    if (target.library) {
      if (drag.from !== null) onChange(setAbilitySlot(build, drag.from, null));
    } else if (target.slot !== undefined) {
      onChange(placeAbility(build, target.slot, drag.abilityId, isCrash));
    }
  };

  const slots: { slot: AbilitySlot; label: string }[] = [
    ...Array.from({ length: ABILITY_SLOTS }, (_, i) => ({ slot: i as AbilitySlot, label: `Ability ${i + 1}` })),
    { slot: 'crash', label: 'Crash Ability' },
  ];
  const activeAbility = active ? byId.get(active.abilityId) : undefined;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
      <div className="abilities">
        {slots.map(({ slot, label }) => {
          const id = slot === 'crash' ? build.crashAbility : build.abilities[slot];
          return (
            <Slot
              key={slotKey(slot)}
              slot={slot}
              label={label}
              ability={id ? byId.get(id) : undefined}
              dragging={activeAbility}
              onOpen={() => onOpenPicker(slot)}
            />
          );
        })}
      </div>
      <Library
        build={build}
        abilities={abilities}
        dragging={!!active && active.from !== null}
        onAdd={(id) => onChange(addAbility(build, id, isCrash))}
      />
      <DragOverlay dropAnimation={null}>
        {activeAbility && <div className="chip drag-ghost">{activeAbility.name}</div>}
      </DragOverlay>
    </DndContext>
  );
}

function Slot({
  slot,
  label,
  ability,
  dragging,
  onOpen,
}: {
  slot: AbilitySlot;
  label: string;
  ability?: Ability;
  dragging?: Ability;
  onOpen: () => void;
}) {
  const drag = useDraggable({
    id: slotKey(slot),
    data: { abilityId: ability?.id, from: slot } satisfies Partial<DragData>,
    disabled: !ability,
  });
  const drop = useDroppable({ id: `drop-${slotKey(slot)}`, data: { slot } });
  const compatible = !dragging || dragging.crash === (slot === 'crash');
  const state = dragging ? (compatible ? (drop.isOver ? 'over' : 'can') : 'no') : '';

  return (
    <button
      ref={(el) => {
        drag.setNodeRef(el);
        drop.setNodeRef(el);
      }}
      {...drag.listeners}
      className={`ability ${slot === 'crash' ? 'wide' : ''} ${ability ? 'filled' : ''} ${state} ${drag.isDragging ? 'lifted' : ''}`}
      onClick={onOpen}
      aria-label={ability ? `${label}: ${ability.name}. Choose another ability` : `${label}: empty. Choose an ability`}
    >
      <span className="orb">{ability && <AbilityGlyph ability={ability} />}</span>
      <span>
        <b>{ability?.name ?? ''}</b>
        <small>{label}</small>
      </span>
    </button>
  );
}

function Library({
  build,
  abilities,
  dragging,
  onAdd,
}: {
  build: Build;
  abilities: Ability[];
  /** A slot's ability is being dragged: show the library as a drop target that clears it. */
  dragging: boolean;
  onAdd: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const { setNodeRef, isOver } = useDroppable({ id: 'library', data: { library: true } });

  const families = useMemo(() => {
    const map = new Map<string, Ability[]>();
    for (const a of abilities) {
      if (q && !`${a.name} ${a.text}`.toLowerCase().includes(q.toLowerCase())) continue;
      map.set(a.family, [...(map.get(a.family) ?? []), a]);
    }
    return [...map.entries()]
      .map(([family, list]) => ({ family, list: list.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name)) }))
      .sort((a, b) => Number(a.list[0].crash) - Number(b.list[0].crash) || a.family.localeCompare(b.family));
  }, [abilities, q]);

  return (
    <details className={`library ${dragging ? 'drop-clear' : ''} ${isOver ? 'over' : ''}`} ref={setNodeRef} open>
      <summary>Ability library</summary>
      <p className="hint">
        {dragging ? 'Drop here to clear the slot.' : 'Drag an ability into a slot, or tap one to add it to the next free slot.'}
      </p>
      <input
        className="field"
        placeholder="Search abilities…"
        value={q}
        aria-label="Search the ability library"
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="families">
        {families.map(({ family, list }) => (
          <div className="family" key={family}>
            <h3>{list[0].crash ? `${list[0].name} (crash)` : (abilities.find((a) => a.id === family)?.name ?? family)}</h3>
            <div className="chips-row">
              {list.map((a) => (
                <LibraryChip key={a.id} ability={a} used={findAbilitySlot(build, a.id) !== null} onAdd={onAdd} />
              ))}
            </div>
          </div>
        ))}
        {families.length === 0 && <p className="hint">Nothing matches.</p>}
      </div>
    </details>
  );
}

function LibraryChip({ ability, used, onAdd }: { ability: Ability; used: boolean; onAdd: (id: string) => void }) {
  const drag = useDraggable({
    id: `lib-${ability.id}`,
    data: { abilityId: ability.id, from: null } satisfies DragData,
  });
  return (
    <button
      ref={drag.setNodeRef}
      {...drag.listeners}
      className={`chip ${used ? 'used' : ''} ${drag.isDragging ? 'lifted' : ''}`}
      title={`${ability.text} (${ability.cost} cr)`}
      onClick={() => onAdd(ability.id)}
    >
      <AbilityGlyph ability={ability} size={16} /> <small>T{ability.tier}</small> {ability.name}
    </button>
  );
}
