import Joi from "joi";

export const createNewFileSchema = Joi.object({
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
  });
  