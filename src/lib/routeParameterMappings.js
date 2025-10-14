import { loggerGlobal } from "../logging/loggerManager.js";

const PARAMETER_MAPPINGS = {
    // Parámetros básicos del sistema los cuales estan en la base de datos
    '{security}': (context) => 
      context.securityLevel?.toLowerCase() === 'public' ? 'publico' : 'privado',
    
    '{company}': (context) =>
      !context.hasCompany ? 'sin_empresa' : (context.companyCode || null),

    '{companyCode}': (context) => context.companyCode || null,
    
    '{document_type}': (context) => context.documentType || null,
    '{storage}': (context) => context.storage || null,
    '{processing_type}': (context) => context.processingType || null,
    
    // Parámetros de resolución
    '{device_type}': (context) => context.deviceType || null,
    '{resolution}': (context) => context.resolution || null,
    
    // Parámetros de archivo
    '{base_path}': (context) => context.basePath || null,

    // Parametros para el tipo de archivo
    '{file_type}': (context) => context.typeOfFile || null,
  };
  
  export const getParameterValue = (parameterKey, securityContext) => {
    const mapper = PARAMETER_MAPPINGS[parameterKey];
    if (!mapper) {
      loggerGlobal.warn(`Parámetro no configurado: ${parameterKey}`);
      return null;
    }
    return mapper(securityContext);
  };