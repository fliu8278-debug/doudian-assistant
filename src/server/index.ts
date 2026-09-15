import { startServer } from './app';

const started = await startServer();
console.log(`Doudian tool listening on ${started.url}`);
