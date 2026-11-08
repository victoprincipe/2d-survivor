'use client';

import { CharacterConfig, EquipmentSlot, EquipmentStats, SavedGameData } from '@/game/types';
import { emptyInventory, EQUIPMENT_SLOTS, formatEquipmentStat, getEquipmentBonuses } from '@/game/data/inventory';
import { saveGameData } from '@/game/data/persistence';

interface Props {
  character: CharacterConfig;
  savedData: SavedGameData;
  onUpdateSave: (save: SavedGameData) => void;

}

export function InventoryTab({ character, savedData, onUpdateSave }: Props) {
  const inventory = savedData.inventories?.[character.id] ?? emptyInventory();
  const bonuses = getEquipmentBonuses(inventory);
  const changeEquipment = (slot: EquipmentSlot, itemId?: string) => {
    if (itemId && !inventory.items.some((item) => item.id === itemId && item.slot === slot)) return;
    const equipped = { ...inventory.equipped };
    if (itemId) equipped[slot] = itemId;
    else delete equipped[slot];
    const next: SavedGameData = { ...savedData, inventories: { ...savedData.inventories, [character.id]: { ...inventory, equipped } } };
    saveGameData(next);
    onUpdateSave(next);
  };
  const renderStats = (stats: EquipmentStats) =>
    (Object.keys(stats) as (keyof EquipmentStats)[]).filter((key) => stats[key]).map((key) => (
      <li key={key}>{formatEquipmentStat(key, stats[key] ?? 0)}</li>
    ));

  return (
    <section className="stone-panel space-y-4 p-4 text-slate-200">
      <div>
        <h2 className="text-lg font-bold text-amber-300">Inventário de {character.name}</h2>
        <p className="mt-1 text-xs text-slate-400">Cada personagem possui seus próprios itens e equipamentos. Os atributos equipados são somados ao personagem ao iniciar a partida.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {(Object.keys(EQUIPMENT_SLOTS) as EquipmentSlot[]).map((slot) => {
          const item = inventory.items.find((owned) => owned.id === inventory.equipped[slot] && owned.slot === slot);
          return (
            <div key={slot} className={`rounded-lg border p-3 ${item ? 'border-amber-500/70 bg-amber-950/20' : 'border-dashed border-slate-600 bg-slate-950/50'}`}>
              <h3 className="text-xs font-bold uppercase tracking-wide text-amber-300">{EQUIPMENT_SLOTS[slot]}</h3>
              <p className="mt-2 text-sm">{item?.name ?? 'Espaço vazio'}</p>
              {item && <><ul className="mt-1 text-xs text-emerald-300">{renderStats(item.stats)}</ul>
                <button type="button" onClick={() => changeEquipment(slot)} className="mt-2 text-xs text-amber-200 underline">Desequipar</button></>}
            </div>
          );
        })}
      </div>
      <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3">
        <h3 className="text-sm font-bold text-emerald-300">Bônus dos equipamentos</h3>
        {Object.values(bonuses).some((value) => value > 0)
          ? <ul className="mt-2 text-xs text-emerald-200">{renderStats(bonuses)}</ul>
          : <p className="mt-1 text-xs text-slate-400">Nenhum bônus ativo. Equipe itens para aumentar seus atributos.</p>}
      </div>
      <div>
        <h3 className="text-sm font-bold">Itens de {character.name} ({inventory.items.length})</h3>
        {inventory.items.length === 0 ? <p className="mt-2 rounded-lg border border-slate-700 p-4 text-center text-xs text-slate-400">Inventário vazio. Novos itens serão adicionados futuramente.</p> :
          <div className="mt-2 grid gap-2 sm:grid-cols-2">{inventory.items.map((item) => {
            const equipped = inventory.equipped[item.slot] === item.id;
            return <div key={item.id} className="rounded-lg border border-slate-700 bg-slate-950/50 p-3">
              <p className="text-sm font-bold">{item.name}</p><p className="text-xs text-slate-400">{EQUIPMENT_SLOTS[item.slot]}</p>
              <ul className="my-2 text-xs text-emerald-300">{renderStats(item.stats)}</ul>
              <button type="button" disabled={equipped} onClick={() => changeEquipment(item.slot, item.id)} className="rounded border border-amber-700 px-3 py-1 text-xs text-amber-200 disabled:opacity-50">{equipped ? 'Equipado' : 'Equipar'}</button>
            </div>;
          })}</div>}
      </div>
    </section>
  );
}
