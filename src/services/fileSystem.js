
import fs from "fs/promises";
import path from "path";
import { loggerGlobal } from "../logging/loggerManager.js";

// Guarda un archivo desde un buffer, creando directorios si no existen
export const saveFileFromBuffer = async (filePath, buffer) => {
  try {
    // Crear directorios si no existen
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    // Guardar el archivo
    await fs.writeFile(filePath, buffer);
  } catch (error) {
    loggerGlobal.error(`Error guardando archivo ${filePath}:`, error);
    throw new Error(`No se pudo guardar el archivo: ${error.message}`);
  }
};