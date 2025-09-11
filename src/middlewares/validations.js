export const validateSchema = (schema) => {
  return (req, res, next) => {
    try {
      console.log('Validando body:', req.body); // Debug
      
      // Solo validar el body directamente, no un objeto anidado
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        allowUnknown: true,  // Permitir campos adicionales como 'file'
        stripUnknown: false, // No eliminar campos desconocidos
      });

      if (error) {
        console.log('Errores encontrados:', error.details); // Debug
        return res.status(400).json({
          message: 'Error de validación',
          errors: error.details.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }

      // Actualizar el body con los valores validados
      req.body = { ...req.body, ...value };
      console.log('Validación exitosa:', req.body); // Debug
      next();
    } catch (err) {
      console.error('Error en validación:', err);
      return res.status(500).json({
        message: 'Error interno en validación',
      });
    }
  };
};