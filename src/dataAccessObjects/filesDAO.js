import { loggerGlobal } from "../logging/loggerManager.js";
import { dbConnectionProvider } from "../config/db/dbConnectionManager.js";

const getFileByCode = async (codeFile) => {
  try {
    const queryFile = `
      SELECT 
        f.id,
        f.code,
        f.file_name,
        f.route_rule_id,
        sl.type AS "securityLevel",
        dt.name AS "documentType"
      FROM file AS f
      JOIN security_level sl ON f.security_level_id = sl.id
      JOIN document_type dt ON f.document_type_id = dt.id
      WHERE f.code = $1 AND f.status = TRUE AND is_backup = FALSE
    `;

    const values = [codeFile];

    const result = await dbConnectionProvider.firstOrDefault(
      queryFile,
      values
    );
    return result;
  } catch (error) {
    loggerGlobal.error("Error al obtener el archivo", {
      error: error.message,
      stack: error.stack,
      codeFile,
    });
    throw new Error(`Error al obtener el archivo: ${error.message}`);
  }
};

const getFilesByCodes = async (codes) => {
  try {
    if (!Array.isArray(codes) || codes.length === 0) {
      return [];
    }

    // Crear placeholders para PostgreSQL: $1, $2, $3, etc.
    const placeholders = codes.map((_, index) => `$${index + 1}`).join(',');

    const queryFiles = `
      SELECT
        f.id,
        f.code,
        f.file_name,
        f.route_rule_id,
        f.company_id,
        sl.type AS "securityLevel"
      FROM file AS f
      JOIN security_level sl ON f.security_level_id = sl.id
      WHERE f.code IN (${placeholders}) AND f.status = TRUE AND is_backup = FALSE
    `;

    const result = await dbConnectionProvider.getAll(
      queryFiles,
      codes
    );

    return result || [];
  } catch (error) {
    loggerGlobal.error("Error al obtener archivos por códigos", {
      error: error.message,
      stack: error.stack,
      codes,
    });
    throw new Error(`Error al obtener archivos: ${error.message}`);
  }
};

// Consulta parametrizada para obtener archivo por md5 y route_rule_id
const getFileByMd5AndRouteRuleId = async (md5, routeRuleId) => {
  try {
    // Consulta parametrizada para evitar inyección SQL
    const queryFile = `
            SELECT 
            file_name AS "fileName", 
            code AS "codeFile", 
            dt.name AS "documentType", 
            document_emission_date AS "emissionDate", 
            document_expiration_date AS "expirationDate",
            sl.type AS "securityLevel"
            FROM file AS f
            JOIN document_type dt ON f.document_type_id = dt.id
            JOIN security_level sl ON f.security_level_id = sl.id
            WHERE f.route_rule_id = $1 AND f.file_hash_md5 = $2 AND f.status = TRUE
        `;

    const values = [routeRuleId, md5];

    // Ejecución de la consulta
    const resultFile = await dbConnectionProvider.getAll(
      queryFile,
      values
    );

    // Retornar resultado o null si no se encuentra
    return resultFile;
  } catch (err) {
    loggerGlobal.error(`Error al obtener el archivo`, err);
    throw new Error("Error al obtener el archivo, intenta nuevamente");
  }
};

// Consulta parametrizada para obtener archivos por md5 y route_rule_id
const getFilesByMd5AndRouteRuleIds = async (md5Hashes, routeRuleIds) => {
  try {
    const queryFiles = `
      SELECT 
        f.id,
        file_name AS "fileName", 
        code AS "codeFile", 
        dt.name AS "documentType", 
        document_emission_date AS "emissionDate", 
        document_expiration_date AS "expirationDate",
        sl.type AS "securityLevel",
        f.route_rule_id AS "routeRuleId",
        f.file_hash_md5 AS "md5"
      FROM file AS f
      JOIN document_type dt ON f.document_type_id = dt.id
      JOIN security_level sl ON f.security_level_id = sl.id
      WHERE f.file_hash_md5 = ANY($1::text[]) 
        AND f.route_rule_id = ANY($2::int[]) 
        AND f.status = TRUE
    `;

    const values = [md5Hashes, routeRuleIds];
    const resultFiles = await dbConnectionProvider.getAll(queryFiles, values);

    return resultFiles || [];
  } catch (err) {
    loggerGlobal.error(`Error al obtener los archivos`, err);
    throw new Error("Error al obtener los archivos, intenta nuevamente");
  }
};

const getUnusedFiles = async () => {
  try {
    // Calculamos la fecha límite: 10 minutos atrás
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000); // 10 minutos en ms

    const query = `
      SELECT 
        fi.id, 
        fi.code, 
        slv.type, 
        fi.creation_date
      FROM "file" as fi
      JOIN security_level as slv ON fi.security_level_id = slv.id
      WHERE fi.status = TRUE 
        AND fi.is_used = FALSE
        AND fi.is_queued = FALSE
        AND fi.creation_date > $1
    `;

    const files = await dbConnectionProvider.getAll(query, [tenMinutesAgo]);

    const filesCodigos = files
      .map((file) => file.code)
      .filter(Boolean);

    return files || [];
  } catch (error) {
    loggerGlobal.error("Error en getUnusedFiles:", error.message);
    throw new Error(
      "Error al obtener los archivos sin usar. Por favor, intente de nuevo."
    );
  }
};

const getFilesExpired = async () => {
  try {
    const query = `
      SELECT fi.id, fi.code, s.type, fi.creation_date
      FROM "file" as fi 
      JOIN security_level as s ON fi.security_level_id = s.id 
      WHERE
      (
      (fi.document_expiration_date IS NOT NULL AND fi.document_expiration_date <= CURRENT_DATE) 
      OR
      (fi.document_expiration_date IS NULL AND fi.creation_date + INTERVAL '1 year' <= CURRENT_DATE)
      )
      AND fi.is_backup = FALSE
      AND fi.status = TRUE
      ORDER BY 
        COALESCE(fi.document_expiration_date, fi.creation_date + INTERVAL '1 year') ASC
      LIMIT 50;
    `;

    const filesExpired = await dbConnectionProvider.getAll(query);

    return filesExpired || [];
  } catch (error) {
    loggerGlobal.error("Error en getFilesExpired:", error.message);
    throw new Error(
      "Error al obtener los archivos sin usar. Por favor, intente de nuevo."
    );
  }
};

const insertFile = async (
  companyId,
  documentTypeId,
  channelId,
  securityLevelId,
  extensionId,
  codeFile,
  isUsed,
  routeRuleId,
  fileName,
  documentEmissionDate,
  documentExpirationDate,
  hasVariants,
  sizeBytes,
  fileHashMd5,
  t
) => {
  try {
    // Construcción del objeto con los valores para la inserción
    const values = {
      company_id: companyId,
      document_type_id: documentTypeId,
      channel_id: channelId,
      security_level_id: securityLevelId,
      extension_id: extensionId,
      code: codeFile,
      is_used: isUsed,
      route_rule_id: routeRuleId,
      file_name: fileName,
      has_variants: hasVariants,
      size_bytes: sizeBytes,
      file_hash_md5: fileHashMd5,
      document_emission_date: documentEmissionDate,
      document_expiration_date: documentExpirationDate,
      creation_date: new Date(),
      modification_date: null,
      deactivation_date: null,
      status: true,
    };

    // Validar que todos los campos requeridos estén presentes
    const requiredFields = [
      "document_type_id",
      "channel_id",
      "security_level_id",
      "extension_id",
      "code",
      "route_rule_id",
      "file_name",
      "size_bytes",
      "file_hash_md5",
    ];

    for (const field of requiredFields) {
      if (values[field] === null || values[field] === undefined) {
        throw new Error(`Campo requerido faltante: ${field}`);
      }
    }

    // Ejecución de la consulta de inserción
    const result = await dbConnectionProvider.insertOne("file", values, t);

    return result;
  } catch (error) {
    loggerGlobal.error("Error al insertar archivo en base de datos", {
      error: error.message,
      stack: error.stack,
      codeFile,
      fileName,
    });
    throw new Error(`Error al insertar archivo: ${error.message}`);
  }
};

const insertFileVariant = async (main_file_id, variant_file_id, resolution, device_type, is_main, t) => {
  try {
    const values = {
      main_file_id,
      variant_file_id,
      resolution,
      device_type,
      is_main,
      creation_date: new Date(),
      status: true,
    };

    const result = await dbConnectionProvider.insertOne("file_variant", values, t);

    return result;
  } catch (error) {
    loggerGlobal.error("Error al insertar variante en base de datos", {
      error: error.message,
      stack: error.stack,
      file_id,
      variant_file_id,
      resolution,
      device_type,
      is_main,
    });
    throw new Error(`Error al insertar variante: ${error.message}`);
  }
}

const changeStatusFile = async (codeFile, isActive) => {
  try {

    const result = await dbConnectionProvider.updateOne(
      "file",
      { is_used: isActive },
      null,
      { code: codeFile }
    );

    return result;
  } catch (error) {
    loggerGlobal.error("Error al cambiar el estado en el archivo", {
      error: error.message,
      stack: error.stack,
      codeFile,
      isActive,
    });
    throw new Error(`Error al cambiar el estado en el archivo: ${error.message}`);
  }
};

const changeIsBackupFile = async (codeFile, isBackup, tx = null) => {
  try {

    const values = {
      route_rule_id: null,
      is_backup: isBackup,
      modification_date: new Date(),
    }

    const result = await dbConnectionProvider.updateOne(
      "file",
      values,
      tx,
      { code: codeFile }
    );

    return result;
  } catch (error) {
    loggerGlobal.error("Error al colocar el archivo como un backup", {
      error: error.message,
      stack: error.stack,
      codeFile,
      isBackup,
    });
    throw new Error(`Error al colocar el archivo como un backup: ${error.message}`);
  }
};

// Servicio para determinar si algun archivo del arreglo es privado para indicar que no puede traer nada porque el archivo es privado
const existSomePrivateFile = async (codes, securityLevelType = 'private') => {
  try {
    // Asegurar que codes sea un array
    const codesArray = Array.isArray(codes) ? codes : [codes];

    const queryFile = `
      SELECT 
        f.id,
        f.code,
        f.company_id
      FROM file AS f
      JOIN security_level AS sl ON f.security_level_id = sl.id
      WHERE f.code = ANY($1) AND sl.type = $2 AND f.company_id IS NOT NULL
    `;

    const values = [codesArray, securityLevelType];

    const result = await dbConnectionProvider.getAll(
      queryFile,
      values
    );
    return result;
  } catch (error) {
    loggerGlobal.error("Error al obtener el archivo", {
      error: error.message,
      stack: error.stack,
      codes,
    });
    throw new Error(`Error al obtener el archivo: ${error.message}`);
  }
};

const updateFile = async ({ fileName, oldCode, fileSize, md5, extensionId }, t) => {
  try {
    const result = await dbConnectionProvider.updateOne(
      "file",
      { file_name: fileName, size_bytes: fileSize, file_hash_md5: md5, extension_id: extensionId },
      t,
      { code: oldCode }
    );

    return result;
  } catch (error) {
    loggerGlobal.error("Error al actualizar el archivo", {
      error: error.message,
      stack: error.stack,
      oldCode,
      fileName,
      fileSize,
      md5,
    });
    throw new Error(`Error al actualizar el archivo: ${error.message}`);
  }
};

const changeStatusFilesAsQueued = async (fileIds, status) => {
  if (!fileIds.length) return 0;

  const query = `
    UPDATE file
    SET is_queued = ${status},
        modification_date = NOW()
    WHERE id = ANY($1::bigint[])
  `;

  await dbConnectionProvider.executeQuery(query, [fileIds]);
};

const deleteFilesUnused = async (arrayIdsToRemove, t) => {
  try {
    if (!arrayIdsToRemove.length) {
      loggerGlobal.info("No hay archivos para eliminar");
      return;
    }

    // Eliminar metadatos primero (dependencia de file)
    const deleteMetadataQuery = `
      DELETE FROM metadata
      WHERE file_id IN (${arrayIdsToRemove.join(", ")});
    `;
    await dbConnectionProvider.executeQuery(deleteMetadataQuery, [], t, false);

    // Eliminar los archivos variantes que estan asociados a un archivo
    const deleteVariantsQuery = `
      DELETE FROM file_variant
      WHERE main_file_id IN (${arrayIdsToRemove.join(", ")}) OR variant_file_id IN (${arrayIdsToRemove.join(", ")});
    `;
    await dbConnectionProvider.executeQuery(deleteVariantsQuery, [], t, false);

    // Eliminar registros de archivos
    const deleteFilesQuery = `
      DELETE FROM file
      WHERE id IN (${arrayIdsToRemove.join(", ")});
    `;
    await dbConnectionProvider.executeQuery(deleteFilesQuery, [], t, false);

    loggerGlobal.info("Archivos eliminados correctamente.");
  } catch (error) {
    loggerGlobal.error("Error en deleteFilesUnused:", error.message);
    throw new Error(
      "Error al eliminar los archivos y datos relacionados: " + error.message
    );
  }
};

const getFileByName = async (fileName) => {
  try {
    const query = `
      SELECT 
        f.id,
        f.file_name AS "fileName",
        c.company_code AS "companyCode",
        sl.type
      FROM file AS f
      JOIN security_level AS sl ON f.security_level_id = sl.id
      LEFT JOIN company AS c ON f.company_id = c.id
      WHERE f.file_name ILIKE '%${fileName}%' AND f.is_backup = TRUE
    `;

    const result = await dbConnectionProvider.firstOrDefault(
      query
    );
    return result;

  } catch (error) {
    loggerGlobal.error("Error al obtener el archivo que esta en el backup", {
      error: error.message,
      stack: error.stack,
      fileName,
    });
    throw new Error(`Error al obtener el archivo que esta en el backup: ${error.message}`);
  }
}

const filesDAO = {
  getFileByMd5AndRouteRuleId,
  getFilesByMd5AndRouteRuleIds,
  insertFile,
  changeStatusFile,
  insertFileVariant,
  existSomePrivateFile,
  getFileByCode,
  getFilesByCodes,
  updateFile,
  getUnusedFiles,
  deleteFilesUnused,
  changeStatusFilesAsQueued,
  getFilesExpired,
  changeIsBackupFile,
  getFileByName
};

export { filesDAO };
