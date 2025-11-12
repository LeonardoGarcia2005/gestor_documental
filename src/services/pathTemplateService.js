import { pathTemplateDAO } from "../dataAccessObjects/pathTemplateDAO.js";
import { dynamicPathBuilder } from "./dynamicPathBuilder.js";
import { loggerGlobal } from "../logging/loggerManager.js";

/**
 * Construye las condiciones de match para buscar el template correcto
 * @param {object} context - Contexto de la solicitud
 * @returns {object} - Condiciones de match
 */
const buildMatchConditions = (context) => {
  const { securityLevel, hasCompany, isForVariants } = context;

  // Validar valores requeridos
  if (!securityLevel) {
    throw new Error("securityLevel es requerido para determinar el template");
  }

  if (hasCompany === undefined || hasCompany === null) {
    throw new Error("hasCompany es requerido para determinar el template");
  }

  // Convertir a los tipos esperados en match_conditions
  const securityLevelType = securityLevel.toLowerCase();
  const companyRequired = Boolean(hasCompany);
  const isForVariantsValue = Boolean(isForVariants);

  return {
    security_level_type: securityLevelType,
    company_required: companyRequired,
    is_for_variants: isForVariantsValue
  };
};

/**
 * Obtiene el template de ruta según las condiciones
 * @param {object} context - Contexto con securityLevel, hasCompany, isForVariants
 * @returns {object} - Template encontrado o error
 */
const getTemplateForContext = async (context) => {
  try {
    const matchConditions = buildMatchConditions(context);

    loggerGlobal.info(
      `Buscando template con condiciones: ${JSON.stringify(matchConditions)}`
    );

    const result = await pathTemplateDAO.getTemplateByConditions(matchConditions);

    if (!result.exists) {
      throw new Error(
        `No se encontró un template para las condiciones: ${JSON.stringify(matchConditions)}`
      );
    }

    return result.template;
  } catch (error) {
    loggerGlobal.error("Error al obtener template", error);
    throw error;
  }
};

/**
 * Construye la ruta completa para un archivo
 * @param {object} context - Contexto completo con todos los valores
 * @returns {object} - { path, templateId, templateName, parameters }
 */
const buildRouteForFile = async (context) => {
  try {
    // Obtener template según condiciones
    const template = await getTemplateForContext(context);

    // Construir ruta desde el template
    const { path, parameters } = await dynamicPathBuilder.buildPathFromTemplate(
      template.template,
      context
    );

    loggerGlobal.info(
      `Ruta construida: ${path} para template: ${template.name}`
    );

    return {
      path,
      templateId: template.id,
      templateName: template.name,
      parameters
    };
  } catch (error) {
    loggerGlobal.error("Error al construir ruta para archivo", error);
    throw error;
  }
};

/**
 * Construye rutas para múltiples archivos
 * Útil cuando cada archivo puede tener parámetros diferentes (ej: diferentes resoluciones)
 * @param {array} filesContext - Array de contextos, uno por archivo
 * @returns {array} - Array de rutas construidas
 */
const buildRoutesForMultipleFiles = async (filesContext) => {
  try {
    const routes = await Promise.all(
      filesContext.map(context => buildRouteForFile(context))
    );

    return routes;
  } catch (error) {
    loggerGlobal.error("Error al construir rutas para múltiples archivos", error);
    throw error;
  }
};

const pathTemplateService = {
  buildMatchConditions,
  getTemplateForContext,
  buildRouteForFile,
  buildRoutesForMultipleFiles
};

export { pathTemplateService };
