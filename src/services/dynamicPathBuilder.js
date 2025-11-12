import { parameterTransformerDAO } from "../dataAccessObjects/parameterTransformerDAO.js";
import { loggerGlobal } from "../logging/loggerManager.js";

/**
 * Cache para los transformadores de parámetros
 * Se carga una vez y se reutiliza
 */
let transformersCache = null;

/**
 * Obtiene los transformadores desde la BD (con cache)
 */
const getTransformers = async () => {
  if (transformersCache) {
    return transformersCache;
  }

  try {
    const transformers = await parameterTransformerDAO.getAllTransformers();

    // Convertir a un mapa para acceso rápido
    transformersCache = transformers.reduce((acc, transformer) => {
      acc[transformer.parameter_key] = transformer;
      return acc;
    }, {});

    loggerGlobal.info(`Transformadores cargados: ${Object.keys(transformersCache).length}`);
    return transformersCache;
  } catch (error) {
    loggerGlobal.error("Error al cargar transformadores de parámetros", error);
    throw new Error("Error al cargar transformadores de parámetros");
  }
};

/**
 * Invalida el cache de transformadores (útil si se actualizan en BD)
 */
const invalidateCache = () => {
  transformersCache = null;
  loggerGlobal.info("Cache de transformadores invalidado");
};

/**
 * Transforma un parámetro según su configuración en BD
 * @param {string} parameterKey - Clave del parámetro (ej: "{security}", "{companyCode}")
 * @param {object} context - Contexto con los valores dinámicos
 * @returns {string|null} - Valor transformado
 */
const transformParameter = async (parameterKey, context) => {
  const transformers = await getTransformers();
  const transformer = transformers[parameterKey];

  if (!transformer) {
    loggerGlobal.warn(`Parámetro no configurado en BD: ${parameterKey}`);
    return null;
  }

  // Si tiene default_value y no es dinámico, retornar el default
  if (!transformer.is_dynamic && transformer.default_value) {
    return transformer.default_value;
  }

  // Si es dinámico, obtener valor del contexto
  const contextProperty = transformer.context_property;
  let value = context[contextProperty];

  // Transformaciones especiales según el parámetro
  if (parameterKey === "{security}") {
    value = context.securityLevel?.toLowerCase() === "public" ? "publico" : "privado";
  } else if (parameterKey === "{companyCode}") {
    value = !context.hasCompany ? "sin_empresa" : (context.companyCode || null);
  }

  // Si no hay valor y hay default, usar default
  if (!value && transformer.default_value) {
    return transformer.default_value;
  }

  return value || null;
};

/**
 * Construye una ruta reemplazando los parámetros del template
 * @param {string} template - Template de ruta (ej: "{base_path}/{security}/{companyCode}")
 * @param {object} context - Contexto con valores
 * @returns {object} - { path, parameters }
 */
const buildPathFromTemplate = async (template, context) => {
  try {
    // Extraer todos los parámetros del template
    const parameterKeys = template.match(/\{[^}]+\}/g) || [];
    const transformers = await getTransformers();

    let resolvedPath = template;
    const parameters = {};

    // Reemplazar cada parámetro
    for (const paramKey of parameterKeys) {
      const value = await transformParameter(paramKey, context);

      if (value === null) {
        const transformer = transformers[paramKey];
        if (transformer && transformer.is_dynamic) {
          throw new Error(`Parámetro requerido sin valor: ${paramKey}`);
        }
      }

      // Reemplazar en el template
      resolvedPath = resolvedPath.replace(paramKey, value || '');
      parameters[paramKey] = value;
    }

    // Limpiar slashes múltiples y espacios
    resolvedPath = resolvedPath.replace(/\/+/g, '/').trim();

    return {
      path: resolvedPath,
      parameters
    };
  } catch (error) {
    loggerGlobal.error("Error al construir ruta desde template", error);
    throw error;
  }
};

const dynamicPathBuilder = {
  getTransformers,
  transformParameter,
  buildPathFromTemplate,
  invalidateCache
};

export { dynamicPathBuilder };
