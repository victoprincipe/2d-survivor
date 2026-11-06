import { paths } from '../config';
import { getDb, isQueuePaused } from '../db';

getDb();

console.log(`Banco: ${paths.db}`);
console.log(`Fila começa pausada: ${isQueuePaused() ? 'sim' : 'não'}`);
console.log('Use /fila-retomar no Discord para liberar a fila.');
