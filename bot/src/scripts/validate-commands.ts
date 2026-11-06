import { commands } from '../commands';

for (const command of commands) {
  const json = command.data.toJSON();
  if (!json.name || !json.description) {
    throw new Error(`Comando inválido: ${JSON.stringify(json)}`);
  }
  console.log(`/${json.name} — ${json.description}`);
}

console.log(`\n${commands.length} comandos válidos.`);
