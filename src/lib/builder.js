import { configurationProvider } from '../config/configurationManager.js';

// Construye la URL completa para acceder a un archivo público de la carpeta que esta expuesta en el nginx
// Ejemplo: https://www.pangeatech.com.uy:5334/gestor-documental-dev/archivo.pdf
export const buildFileUrl = (filePath) => {
  const baseUrl = configurationProvider.baseUrl?.replace(/\/$/, '');

  if (!baseUrl) {
    throw new Error('BASE_URL no está configurada en las variables de entorno');
  }

  if (!filePath) {
    throw new Error('La ruta del archivo es requerida');
  }

  // Se toma el prefijo que se asigno en el nginx para poder llegar a las carpetas especificas
  const nginxLocation = configurationProvider.nginx?.publicLocation?.replace(/\/$/, '');

  if (!nginxLocation) {
    throw new Error('nginx.publicLocation no está configurada');
  }

  // Se obtiene la ruta de las carpetas como inicia en el gestor de archivos
  const systemBasePath = configurationProvider.uploads.pathPublicNginx?.replace(/\/$/, '');

  let fileName;

  // Quitar las carpetas que ya se resumen por el prefijo configurado en el nginx
  if (systemBasePath && filePath.startsWith(systemBasePath)) {
    fileName = filePath.slice(systemBasePath.length).replace(/^\/+/, '');
  } else {
    // Si ya es relativa o solo el nombre del archivo
    fileName = filePath.replace(/^\/+/, '');
  }

  if (!fileName) {
    throw new Error('No se pudo determinar el nombre del archivo');
  }

  // 5. Construir la URL completa: BASE_URL + nginx.publicLocation + fileName
  // Resultado: https://www.pangeatech.com.uy:5334/gestor-documental-dev/archivo.pdf
  return `${baseUrl}${nginxLocation}/${fileName}`;
};