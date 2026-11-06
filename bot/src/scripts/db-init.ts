import { paths } from '../config';
import { getDb } from '../db';

getDb();

console.log(`Banco: ${paths.db}`);
console.log('Fila ativa. Envie o prompt no canal de implementações.');
