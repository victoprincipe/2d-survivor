import { CharacterConfig, CharacterInventory, EquipmentItem, EquipmentSlot, EquipmentStats } from '../types';

export const GUARDIAN_BOW: EquipmentItem = {
  id: 'guardian_bow', name: 'Arco do Guardião', slot: 'weapon',
  stats: { attackSpeed: 0.1, bonusAmount: 1, critChance: 0.05 },
};
export const FOREST_ARMOR: EquipmentItem = { id: 'forest_armor', name: 'Armadura da Mata', slot: 'armor', stats: { armor: 3, maxHp: 20, recovery: 2, damageReduction: 0.05 } };
export const ANACONDA_GLOVES: EquipmentItem = { id: 'anaconda_gloves', name: 'Luvas da Sucuri', slot: 'gloves', stats: {} };
export function equipmentArtwork(id: string): string | undefined {
  if (id === ANACONDA_GLOVES.id) return '/sprites/equipment/anaconda-gloves.svg';
  if (id === FOREST_ARMOR.id) return '/sprites/equipment/forest-armor.png';
  return id === GUARDIAN_BOW.id ? '/sprites/equipment/guardian-bow.svg' : undefined;
}

/** Repeated claims keep the same inventory and never duplicate the quest item. */
export function claimGuardianBow(inventory: CharacterInventory): CharacterInventory {
  if (!inventory.forestQuizCompleted || inventory.items.some(item => item.id === GUARDIAN_BOW.id)) return inventory;
  return { ...inventory, items: [...inventory.items, { ...GUARDIAN_BOW, stats: { ...GUARDIAN_BOW.stats } }] };
}

export const EQUIPMENT_SLOTS: Record<EquipmentSlot, string> = {
  armor: 'Armadura', boots: 'Botas', gloves: 'Luvas', helmet: 'Capacete', weapon: 'Arma',
};
export const EQUIPMENT_STATS: Record<keyof EquipmentStats, { label: string; percent?: boolean }> = {
  damageReduction: { label: 'Redução de dano', percent: true },
  maxHp: { label: 'Vida máxima' }, armor: { label: 'Armadura' },
  might: { label: 'Dano', percent: true }, speed: { label: 'Velocidade', percent: true },
  recovery: { label: 'Regeneração/s' }, critChance: { label: 'Chance crítica', percent: true },
  attackSpeed: { label: 'Velocidade de ataque', percent: true }, bonusAmount: { label: 'Projétil extra' },
};
export const emptyInventory = (): CharacterInventory => ({ items: [], equipped: {} });
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Old saves start empty; invalid or duplicate items and incompatible equipment are discarded. */
export function normalizeInventories(value: unknown): Record<string, CharacterInventory> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, data]) => isRecord(data)).map(([id, data]) => {
    const inventory = emptyInventory();
    const source = data as Record<string, unknown>;
    inventory.forestQuizCompleted = source.forestQuizCompleted === true;
    for (const item of Array.isArray(source.items) ? source.items : []) {
      if (!isRecord(item) || typeof item.id !== 'string' || !item.id ||
          typeof item.name !== 'string' || typeof item.slot !== 'string' ||
          !Object.hasOwn(EQUIPMENT_SLOTS, item.slot) || inventory.items.some((owned) => owned.id === item.id)) continue;
      const stats: EquipmentStats = {};
      if (isRecord(item.stats)) {
        for (const key of Object.keys(EQUIPMENT_STATS) as (keyof EquipmentStats)[]) {
          const amount = item.stats[key];
          if (typeof amount === 'number' && Number.isFinite(amount) && amount >= 0) stats[key] = amount;
        }
      }
      inventory.items.push({ id: item.id, name: item.name, slot: item.slot as EquipmentSlot, stats });
    }
    if (inventory.items.some(item => item.id === GUARDIAN_BOW.id)) inventory.forestQuizCompleted = true;
    for (const slot of Object.keys(EQUIPMENT_SLOTS) as EquipmentSlot[]) {
      const equippedId = isRecord(source.equipped) ? source.equipped[slot] : undefined;
      if (inventory.items.some((item) => item.id === equippedId && item.slot === slot)) inventory.equipped[slot] = equippedId as string;
    }
    return [id, inventory];
  }));
}

export function getEquipmentBonuses(inventory: CharacterInventory): EquipmentStats {
  const total: EquipmentStats = {};
  for (const slot of Object.keys(EQUIPMENT_SLOTS) as EquipmentSlot[]) {
    const item = inventory.items.find((owned) => owned.id === inventory.equipped[slot] && owned.slot === slot);
    if (!item) continue;
    for (const key of Object.keys(EQUIPMENT_STATS) as (keyof EquipmentStats)[]) total[key] = (total[key] ?? 0) + (item.stats[key] ?? 0);
  }
  return total;
}

export function withEquipment(character: CharacterConfig, inventory: CharacterInventory): CharacterConfig {
  const statBonuses = { ...character.statBonuses };
  const equipment = getEquipmentBonuses(inventory);
  for (const key of Object.keys(equipment) as (keyof EquipmentStats)[]) statBonuses[key] = (statBonuses[key] ?? 0) + (equipment[key] ?? 0);
  return { ...character, statBonuses };
}

export function formatEquipmentStat(key: keyof EquipmentStats, value: number): string {
  const meta = EQUIPMENT_STATS[key];
  return `+${Number((value * (meta.percent ? 100 : 1)).toFixed(2)).toLocaleString('pt-BR')}${meta.percent ? '%' : ''} ${meta.label}`;
}
