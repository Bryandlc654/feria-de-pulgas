import { initDatabase } from './db';

async function main() {
  console.log('🔄 Initializing MySQL schema...');
  const success = await initDatabase();
  if (success) {
    console.log('✅ Base de datos configurada correctamente.');
  } else {
    console.log('⚠️ Revisa tus credenciales en el archivo .env');
  }
  process.exit(0);
}

main();
