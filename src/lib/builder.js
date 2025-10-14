// Construye la URL completa para acceder a un archivo
export const buildFileUrl = (filePath) => {
  // Tomar el dominio configurado en el .env
  // (ej: https://www.pangeatech.com.uy:8888/gestor-archivos)
  const baseUrl = process.env.URL_GLOBAL?.replace(/\/$/, '') 
    || config.urlGlobal?.replace(/\/$/, '');

  if (!baseUrl) {
    throw new Error('URL_GLOBAL no está configurada en las variables de entorno');
  }

  if (!filePath) {
    throw new Error('La ruta del archivo es requerida');
  }

  // Tomar la ruta base que nginx ignora (del .env)
  // (ej: /mnt/gestion_archivos/publico)
  const systemBasePath = process.env.PATH_PUBLIC_NGINX?.replace(/\/$/, '');

  let relativePath;

  // Quitar la parte fija del sistema (/mnt/gestion_archivos/publico)
  if (systemBasePath && filePath.startsWith(systemBasePath)) {
    relativePath = filePath.slice(systemBasePath.length).replace(/^\/+/, '');
  } else {
    // Si ya es relativa
    relativePath = filePath.replace(/^\/+/, '');
  }

  if (!relativePath) {
    throw new Error('No se pudo determinar la ruta relativa del archivo');
  }

  // Unir dominio + ruta relativa
  return `${baseUrl}/${relativePath}`;
};

// Construye el nombre del archivo con token
export const buildFileNameWithToken = (fileName, token) => {
  const lastDotIndex = fileName.lastIndexOf('.');
  
  if (lastDotIndex === -1) {
    // Archivo sin extensión
    return `${token}&${fileName}`;
  }
  
  const nameWithoutExtension = fileName.substring(0, lastDotIndex);
  const extension = fileName.substring(lastDotIndex + 1);
  
  return `${token}&${nameWithoutExtension}.${extension}`;
};