import { CharacterInventory, EquipmentItem, HunterQuestProgress } from '../types';

export const HUNTER_FISH_TARGET = 30;
export const TRIBE_HEADDRESS: EquipmentItem = {
  id: 'tribe_headdress', name: 'Cocar da Tribo', slot: 'helmet',
  stats: { damageReduction: 0.05, attackSpeed: 0.05, maxHp: 15, projectileSpeed: 0.15 },
};

export function getHunterQuest(inventory: CharacterInventory): HunterQuestProgress {
  const source = inventory.hunterQuest;
  const completed = source?.completed === true || inventory.items.some(item => item.id === TRIBE_HEADDRESS.id);
  const fish = typeof source?.fish === 'number' && Number.isFinite(source.fish)
    ? Math.max(0, Math.min(HUNTER_FISH_TARGET, Math.floor(source.fish))) : 0;
  return { accepted: completed || source?.accepted === true, fish: completed ? 0 : fish, completed };
}

export function acceptHunterQuest(inventory: CharacterInventory): CharacterInventory {
  return { ...inventory, hunterQuest: { ...getHunterQuest(inventory), accepted: true } };
}

export function collectHunterFish(inventory: CharacterInventory): CharacterInventory {
  const quest = getHunterQuest(inventory);
  if (!quest.accepted || quest.completed || quest.fish >= HUNTER_FISH_TARGET) return inventory;
  return { ...inventory, hunterQuest: { ...quest, fish: quest.fish + 1 } };
}

/** Food consumption, completion and unique reward form one save update. */
export function deliverHunterFish(inventory: CharacterInventory): CharacterInventory {
  const quest = getHunterQuest(inventory);
  if (!quest.accepted || quest.completed || quest.fish < HUNTER_FISH_TARGET) return inventory;
  return { ...inventory, hunterQuest: { accepted: true, fish: 0, completed: true },
    items: [...inventory.items, { ...TRIBE_HEADDRESS, stats: { ...TRIBE_HEADDRESS.stats } }] };
}

export function canDropHunterFish(quest: HunterQuestProgress, enemy: {
  isAquatic: boolean; isElite: boolean; isBoss: boolean;
}, inRiver: boolean): boolean {
  return quest.accepted && !quest.completed && quest.fish < HUNTER_FISH_TARGET
    && enemy.isAquatic && !enemy.isElite && !enemy.isBoss && inRiver;
}
