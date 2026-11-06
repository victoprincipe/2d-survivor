import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
} from 'discord.js';
import * as sugerir from './sugerir';
import * as fila from './fila';
import * as minhasSugestoes from './minhas-sugestoes';
import * as filaPausar from './fila-pausar';
import * as filaRetomar from './fila-retomar';
import * as filaCancelar from './fila-cancelar';
import * as filaReprocessar from './fila-reprocessar';
import * as filaAprovar from './fila-aprovar';
import * as filaDescartar from './fila-descartar';
import * as filaRollback from './fila-rollback';

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commands: Command[] = [
  sugerir,
  fila,
  minhasSugestoes,
  filaPausar,
  filaRetomar,
  filaCancelar,
  filaReprocessar,
  filaAprovar,
  filaDescartar,
  filaRollback,
];

export const commandMap = new Map(commands.map((command) => [command.data.name, command]));
