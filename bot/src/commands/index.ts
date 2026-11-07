import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
} from 'discord.js';
import * as implementar from './implementar';
import * as planejar from './planejar';
import * as fila from './fila';
import * as minhasImplementacoes from './minhas-implementacoes';
import * as ultimasImplementacoes from './ultimas-implementacoes';
import * as prompt from './prompt';
import * as reprocessar from './reprocessar';

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commands: Command[] = [
  implementar,
  planejar,
  fila,
  minhasImplementacoes,
  ultimasImplementacoes,
  prompt,
  reprocessar,
];

export const commandMap = new Map(commands.map((command) => [command.data.name, command]));
