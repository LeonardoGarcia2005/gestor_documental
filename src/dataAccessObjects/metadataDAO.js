import { dbConnectionProvider } from "../db/dbConnectionManager.js";
import { loggerGlobal } from "../../globalServices/logging/loggerManager.js";

const insertMetadata = async (fileId, metadata, t) => {
  try {
    const metadataParser = JSON.parse(metadata);

    // Construir un array de valores para la inserción
    const values = metadataParser.map((entry) => ({
      file_id: fileId,
      parameter: entry.clave,
      value: entry.valor,
      status: true,
    }));

    // Realizar una sola consulta de inserción en bloque
    const result = await dbConnectionProvider.insertRange(
      "metadata",
      values,
      t
    );

    // Retornar el resultado de la operación
    return result;
  } catch (error) {
    // Registrar el error en los logs
    loggerGlobal.error("Error al insertar metadata", error);
    throw new Error("Error al insertar metadata: " + error.message);
  }
};

const getMetadataByFileId = async (fileId) => {
  try {
    // Consulta parametrizada para evitar inyección SQL
    const queryMetadata = `
            SELECT parameter, value 
                FROM metadata 
                WHERE status = TRUE
                AND file_id = ${fileId};
            `;

    // Ejecución de la consulta
    const resultMetadata = await dbConnectionProvider.getAll(queryMetadata);

    // Retornar resultado o null si no se encuentra
    return resultMetadata;
  } catch (err) {
    loggerGlobal.error(`Error al obtener la metadata`, err);
    throw new Error("Error al obtener la metadata");
  }
};

const metadataDAO = {
  insertMetadata,
  getMetadataByFileId,
};

export { metadataDAO };
