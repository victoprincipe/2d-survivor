import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
} from 'discord.js';
import * as fila from './fila';
import * as minhasImplementacoes from './minhas-implementacoes';
import * as ultimasImplementacoes from './ultimas-implementacoes';
import * as reprocessar from './reprocessar';

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commands: Command[] = [
  fila,
  minhasImplementacoes,
  ultimasImplementacoes,
  reprocessar,
];

export const commandMap = new Map(commands.map((command) => [command.data.name, command]));
