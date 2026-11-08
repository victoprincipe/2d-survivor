import { MapId } from '../types';

export interface GameMap {
  id: MapId;
  name: string;
  description: string;
}

export const GAME_MAPS: GameMap[] = [
  {
    id: 'night_plain',
    name: 'Planície Noturna',
    description: 'Cenário atual, com o campo aberto da noite eterna.',
  },
  {
    id: 'amazon_forest',
    name: 'Floresta Amazônica',
    description: 'Selva com ciclo dinâmico de Dia, Pôr do Sol e Noite.',
  },
];

export const DEFAULT_MAP_ID: MapId = 'night_plain';
