import { filesDAO } from "../../dataAccessObjects/filesDAO.js";
import { fileParameterValueDAO } from "../../dataAccessObjects/fileParameterValueDAO.js";
import { loggerGlobal } from "../../logging/loggerManager.js";
import { routeRuleDAO } from "../../dataAccessObjects/routeRuleDAO.js";
import { buildRoutePathWithParameters } from "../../middlewares/applyRouteRuleMiddleware.js";

export const getPrivateFiles = async (req, res) => {
    const { companyCode } = req.securityContext;
    const { codes } = req.query;

    // Convertir string separado por comas a array
    const codeArray = codes.split(',').map(code => code.trim());

    const filesProcessed = await Promise.all(
        codeArray.map(async (code) => {
            try {
                // Obtener metadata del archivo
                const fileData = await filesDAO.getFileByCode(code);

                if (!fileData) {
                    throw new Error(`Archivo no encontrado: ${code}`);
                }

                // Construir la ruta completa del archivo
                const filePath = await fileParameterValueDAO.buildFilePathFromCode(code);

                // Obtener ruta simplificada para el archivo a guardar temporalmente en public
                const routeParameters = await routeRuleDAO.getRouteRuleBasic(
                    fileData.securityLevel
                );

                const valuesToBuildRoute = {
                    companyCode,
                    documentType: fileData.documentType,
                    storage: 'temp'
                }

                const { routePath } = buildRoutePathWithParameters(routeParameters, valuesToBuildRoute);

                return {
                    id: fileData.id,
                    file_name: fileData.file_name,
                    url: filePath,
                };
            } catch (error) {
                loggerGlobal.error(`Error procesando archivo ${code}:`, error);
                // Retornar null para filtrar después
                return null;
            }
        }
        )
    );

    // Filtrar los que fallaron (null)
    const successfulFiles = filesProcessed.filter(f => f !== null);

    // Retornar solo el array
    return res.json(successfulFiles);
};