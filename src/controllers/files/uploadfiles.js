export const handleFileUpload = async (req, res) => {
  try {
    const { routeRuleId, securityContext } = req;
    const files = req.files || [req.file];
    const isMultiple = Array.isArray(req.files);
    
    // Construir la ruta usando la regla determinada
    const filePath = await buildFilePathFromRule(routeRuleId, {
      company: securityContext?.companyCode,
      document_type: req.body.document_type,
      storage: req.body.storage_type
    });
    
    // Procesar archivo(s)
    const results = [];
    for (const file of files) {
      if (file) {
        const result = await processFileUpload(file, filePath, req.body);
        results.push(result);
      }
    }
    
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