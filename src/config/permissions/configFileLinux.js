import { exec } from "child_process";
import { promisify } from "util";
import os from "os";
import { loggerGlobal } from "../../logging/loggerManager.js";

const execPromise = promisify(exec);

// Detectar el sistema operativo
export const IS_WINDOWS = os.platform() === 'win32';
export const IS_LINUX = os.platform() === 'linux';

// Configuración de permisos por defecto
export const DEFAULT_DIR_PERMISSIONS = 0o755;  // rwxr-xr-x
export const DEFAULT_FILE_PERMISSIONS = 0o644; // rw-r--r--

// Configuración del usuario del sistema (solo para Linux)
export const SYSTEM_USER = process.env.FILE_SYSTEM_USER || 'pangea';
export const SYSTEM_GROUP = process.env.FILE_SYSTEM_GROUP || 'pangea';

// Cache para UID y GID
let PANGEA_UID = null;
let PANGEA_GID = null;

// Inicializa los IDs del usuario pangea (solo Linux)
export const initUserIds = async () => {
  if (IS_WINDOWS) {
    loggerGlobal.info('Sistema Windows detectado - omitiendo inicialización de UID/GID');
    return;
  }

  if (PANGEA_UID !== null && PANGEA_GID !== null) return;
  
  try {
    const { stdout: uidOut } = await execPromise(`id -u ${SYSTEM_USER}`);
    PANGEA_UID = parseInt(uidOut.trim());
    
    const { stdout: gidOut } = await execPromise(`id -g ${SYSTEM_USER}`);
    PANGEA_GID = parseInt(gidOut.trim());
    
    loggerGlobal.info(`Usuario ${SYSTEM_USER} - UID: ${PANGEA_UID}, GID: ${PANGEA_GID}`);
  } catch (error) {
    loggerGlobal.error(`Error obteniendo IDs del usuario ${SYSTEM_USER}:`, error);
    throw new Error(`No se pudo obtener información del usuario ${SYSTEM_USER}`);
  }
};

// Cambia el propietario de un archivo o directorio (solo Linux)
export const changeOwnership = async (filePath) => {
  // En Windows, no hacer nada
  if (IS_WINDOWS) {
    loggerGlobal.debug(`Windows detectado - omitiendo cambio de propietario para: ${filePath}`);
    return true;
  }

  try {
    await initUserIds();
    
    await execPromise(`chown ${SYSTEM_USER}:${SYSTEM_GROUP} "${filePath}"`);
    loggerGlobal.info(`Propietario cambiado a ${SYSTEM_USER}:${SYSTEM_GROUP} para: ${filePath}`);
    
    return true;
  } catch (error) {
    loggerGlobal.error(`Error cambiando propietario de ${filePath}: ${error.message}`);
    throw new Error(`No se pudo cambiar propietario: ${error.message}`);
  }
};

// Cambia el propietario de forma recursiva (solo Linux)
export const changeOwnershipRecursive = async (dirPath) => {
  // En Windows, no hacer nada
  if (IS_WINDOWS) {
    loggerGlobal.debug(`Windows detectado - omitiendo cambio recursivo de propietario para: ${dirPath}`);
    return true;
  }

  try {
    await initUserIds();
    
    await execPromise(`chown -R ${SYSTEM_USER}:${SYSTEM_GROUP} "${dirPath}"`);
    loggerGlobal.info(`Propietario cambiado recursivamente a ${SYSTEM_USER}:${SYSTEM_GROUP} para: ${dirPath}`);
    
    return true;
  } catch (error) {
    loggerGlobal.error(`Error cambiando propietario recursivo de ${dirPath}: ${error.message}`);
    throw new Error(`No se pudo cambiar propietario recursivo: ${error.message}`);
  }
};

// Constantes de permisos disponibles
export const PERMISSIONS = {
  DIR_DEFAULT: DEFAULT_DIR_PERMISSIONS,
  FILE_DEFAULT: DEFAULT_FILE_PERMISSIONS,
  DIR_PUBLIC: 0o755,      // rwxr-xr-x
  DIR_PRIVATE: 0o700,     // rwx------
  DIR_SHARED: 0o775,      // rwxrwxr-x (para compartir con grupo)
  FILE_PUBLIC: 0o644,     // rw-r--r--
  FILE_PRIVATE: 0o600,    // rw-------
  FILE_SHARED: 0o664,     // rw-rw-r-- (para compartir con grupo)
  FILE_EXECUTABLE: 0o755, // rwxr-xr-x
};

// Configuración del usuario
export const USER_CONFIG = {
  user: SYSTEM_USER,
  group: SYSTEM_GROUP,
  uid: PANGEA_UID,
  gid: PANGEA_GID
};