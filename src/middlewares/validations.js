export const validateSchema = (schema) => {
  return (req, res, next) => {
    try {
      const dataToValidate = {
        body: req.body,
        params: req.params,
        query: req.query,
      }

      const { error, value } = schema.validate(dataToValidate, {
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true,
      })

      if (error) {
        return res.status(400).json({
          message: 'Error de validación',
          errors: error.details.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        })
      }

      req.validated = value
      next()
    } catch (err) {
      console.error('Error en validación:', err)
      return res.status(500).json({
        message: 'Error interno en validación',
      })
    }
  }
}
