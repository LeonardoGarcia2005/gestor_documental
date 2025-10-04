import { dbConnectionProvider } from "../config/db/dbConnectionManager.js";
import { loggerGlobal } from "../logging/loggerManager.js";

const existDocumentType = async (documentType) => {
  try {
    const queryDocumentType = `
      SELECT id, TRUE as exists
      FROM document_type
      WHERE status = TRUE
      AND name = $1
      LIMIT 1;
    `;

    const values = [documentType];

    const resultDocumentType = await dbConnectionProvider.firstOrDefault(
      queryDocumentType,
      values
    );

    // Si no encuentra nada
    if (!resultDocumentType) {
      return { exists: false, id: null };
    }

    return { exists: true, id: resultDocumentType.id };
  } catch (err) {
    loggerGlobal.error(`Error al obtener el tipo de documento`, err);
    throw new Error("Error al obtener el tipo de documento");
  }
};

const documentTypeDAO = {
  existDocumentType,
};

export { documentTypeDAO };
