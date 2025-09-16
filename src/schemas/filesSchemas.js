import Joi from "joi";

// Schema base para archivos
const baseFileSchema = {
  channel: Joi.string()
    .valid("web", "whatsapp", "api", "email")
    .required(),

  documentType: Joi.string()
    .valid(
      "videotutorial",
      "banner", 
      "servicio",
      "legal",
      "contable",
      "rrhh",
      "marketing",
      "ventas",
      "operaciones"
    )
    .required(),

  hasCompany: Joi.boolean().required(),

  securityLevel: Joi.string()
    .valid("public", "private")
    .required(),

  emissionDate: Joi.date()
    .iso()
    .optional(),

  expirationDate: Joi.date()
    .iso()
    .optional()
    .greater(Joi.ref("emissionDate")),

  metadata: Joi.alternatives()
    .try(
      Joi.array().items(
        Joi.object({
          clave: Joi.string().required(),
          valor: Joi.string().required(),
        })
      ),
      Joi.string() // JSON string
    )
    .optional()
    .custom((value, helpers) => {
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch (error) {
          return helpers.error("any.invalid", {
            message: "Formato de 'metadata' inválido.",
          });
        }
      }
      return value;
    }),
};

// Schema para archivo único
export const createSingleFileSchema = Joi.object({
  ...baseFileSchema,  
});

// Schema para múltiples archivos con resoluciones
export const createMultipleFilesSchema = Joi.object({
  ...baseFileSchema,
  
  // Para múltiples archivos, especificar las resoluciones esperadas
  resolutions: Joi.array()
    .items(
      Joi.object({
        deviceType: Joi.string()
          .valid("desktop", "tablet", "mobile", "tv")
          .required(),
        resolution: Joi.string()
          .valid("1920x1080", "1366x768", "768x1024", "375x667", "3840x2160")
          .required(),
        isOriginal: Joi.boolean().default(false)
      })
    )
    .min(1)
    .max(10)
    .optional()
    .custom((value, helpers) => {
      if (!value) return value;
      
      // Validar que solo haya un original
      const originals = value.filter(r => r.isOriginal);
      if (originals.length > 1) {
        return helpers.error("any.invalid", {
          message: "Solo puede haber una resolución marcada como original"
        });
      }
      
      // Si no hay original, marcar el primero como original
      if (originals.length === 0 && value.length > 0) {
        value[0].isOriginal = true;
      }
      
      return value;
    }),
    
  // Alternativamente, permitir especificar por campos separados
  deviceTypes: Joi.alternatives()
    .try(
      Joi.string().valid("desktop", "tablet", "phone", "tv"),
      Joi.array().items(Joi.string().valid("desktop", "tablet", "phone", "tv"))
    )
    .optional(),
    
/*   resolutionValues: Joi.alternatives()
    .try(
      Joi.string().regex(/^[0-9]{1,4}x[0-9]{1,4}$/),
      Joi.array().items(Joi.string().regex(/^[0-9]{1,4}x[0-9]{1,4}$/))
    )
    .optional() */
});