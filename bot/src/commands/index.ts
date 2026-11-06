import type { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import * as implementar from './implementar';
import * as fila from './fila';
import * as minhasImplementacoes from './minhas-implementacoes';
import * as ultimasImplementacoes from './ultimas-implementacoes';

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commands: Command[] = [
  implementar,
  fila,
  minhasImplementacoes,
  ultimasImplementacoes,
];

export const commandMap = new Map(commands.map((command) => [command.data.name, command]));
