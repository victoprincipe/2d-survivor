'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { CharacterConfig, EquipmentSlot, SavedGameData } from '@/game/types';
import { EQUIPMENT_SLOTS, emptyInventory } from '@/game/data/inventory';
import { InventoryTab } from './InventoryTab';

interface Props {
  character: CharacterConfig;
  savedData: SavedGameData;
  onUpdateSave: (save: SavedGameData) => void;
  onClose: () => void;
}

// Coordinates follow the supplied artwork. The illustrated items are decorative;
// actual ownership and attributes always come from the character's saved inventory.
const SLOT_POSITIONS: { slot: EquipmentSlot; left: string; top: string }[] = [
  { slot: 'helmet', left: '16.5%', top: '23%' },
  { slot: 'armor', left: '16.5%', top: '38%' },
  { slot: 'weapon', left: '16.5%', top: '52.3%' },
  { slot: 'boots', left: '16.5%', top: '66.8%' },
  { slot: 'gloves', left: '62.7%', top: '38%' },
];

export function EquipmentModal({ character, savedData, onUpdateSave, onClose }: Props) {
  const [showItems, setShowItems] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const drag = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const inventory = savedData.inventories?.[character.id] ?? emptyInventory();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <aside role="dialog" aria-modal="false" aria-label={`Equipamento de ${character.name}`}
      style={position ? { left: position.x, top: position.y, bottom: 'auto' } : undefined}
      onPointerDown={(event) => {
        if (event.button !== 0 || !event.isPrimary ||
            (event.target as HTMLElement).closest('button, input, select, [data-no-drag]')) return;
        const rect = event.currentTarget.getBoundingClientRect();
        drag.current = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
        event.currentTarget.setPointerCapture(event.pointerId);
        setIsDragging(true);
        event.preventDefault();
      }}
      onPointerMove={(event) => {
        const active = drag.current;
        if (!active || active.pointerId !== event.pointerId) return;
        const rect = event.currentTarget.getBoundingClientRect();
        setPosition({
          x: Math.max(8, Math.min(window.innerWidth - rect.width - 8, event.clientX - active.offsetX)),
          // Keep the external close button above the image inside the viewport.
          y: Math.max(52, Math.min(window.innerHeight - rect.height - 8, event.clientY - active.offsetY)),
        });
      }}
      onPointerUp={(event) => {
        if (drag.current?.pointerId !== event.pointerId) return;
        drag.current = null;
        setIsDragging(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { drag.current = null; setIsDragging(false); }}
      onLostPointerCapture={() => { drag.current = null; setIsDragging(false); }}
      className={`fixed bottom-3 left-3 z-50 touch-none select-none bg-transparent text-white drop-shadow-2xl ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}>
      <div className="relative w-[min(45vw,26dvh,240px)]">
        <button type="button" onClick={onClose} aria-label="Fechar equipamento"
          title="Fechar equipamento"
          className="absolute bottom-full right-0 mb-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-amber-600 bg-red-950 text-xs font-bold text-amber-100 shadow-lg hover:bg-red-900 focus-visible:outline-2 focus-visible:outline-amber-200">
          ✕
        </button>
        <Image src="/images/ui/equipment-panel-no-close.png" alt="Painel de equipamento com moldura de madeira e ouro na floresta"
          width={1024} height={1536} priority unoptimized draggable={false} className="block h-auto w-full" />
        <p className="absolute left-[26%] top-[9%] w-[48%] truncate text-center text-[clamp(10px,2dvh,18px)] font-bold text-amber-100 drop-shadow-lg">
          {character.name}
        </p>
        {SLOT_POSITIONS.map(({ slot, left, top }) => {
          const item = inventory.items.find((owned) => owned.id === inventory.equipped[slot] && owned.slot === slot);
          const label = `${EQUIPMENT_SLOTS[slot]}: ${item?.name ?? 'Espaço vazio'}`;
          return <button key={slot} type="button" aria-label={label} title={label} onClick={() => setShowItems(true)}
            style={{ left, top }} className="group absolute h-[13.5%] w-[21%] cursor-pointer rounded-lg border-2 border-transparent hover:border-amber-300 focus-visible:border-amber-300 focus-visible:outline-none">
            <span className="absolute inset-x-0 bottom-1 rounded bg-black/80 p-1 text-[clamp(8px,1.5dvh,13px)] text-amber-100 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">{label}</span>
          </button>;
        })}
        {showItems && (
          <div data-no-drag className="absolute bottom-full left-0 mb-14 max-h-[50dvh] w-[min(90vw,420px)] touch-auto cursor-auto overflow-y-auto rounded-xl border border-amber-700 bg-slate-950/95 p-3">
            <button type="button" onClick={() => setShowItems(false)} className="mb-3 rounded border border-amber-700 px-3 py-2 text-xs text-amber-200">← Voltar ao equipamento</button>
            <InventoryTab character={character} savedData={savedData} onUpdateSave={onUpdateSave} />
          </div>
        )}
      </div>
    </aside>
  );
}
