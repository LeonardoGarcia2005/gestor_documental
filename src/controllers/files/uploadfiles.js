export const handleFileUpload = async (req, res) => {
  try {
    const { securityContext, routePath } = req;
    const file = req.file;

  } catch (error) {
    loggerGlobal.error('Error en handleFileUpload:', error);
    return res.status(500).json({
      error: "Error procesando archivo(s)",
      details: error.message,
    });
  }
};