export const handleFileUpload = async (req, res) => {
  try {
    const { securityContext, routePath } = req;
    
    return res.status(201).json({
      success: true,
      message: `${isMultiple ? 'Archivos' : 'Archivo'} subido(s) correctamente`,
      data: isMultiple ? results : results[0],
      route_rule_applied: routeRuleId
    });
    
  } catch (error) {
    return res.status(500).json({
      error: 'Error procesando archivo(s)',
      details: error.message
    });
  }
};