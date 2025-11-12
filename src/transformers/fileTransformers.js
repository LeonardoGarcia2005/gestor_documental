export const transformers = {
  // Para archivo unico
  single: (req) => {
    if (!req.file) {
      throw new ValidationError("Se requiere un archivo", "file");
    }

    return {
      ...req.body,
      file: req.file
    };
  },

  // Para variantes
  variants: (req) => {
    if (!req.files || req.files.length === 0) {
      throw new ValidationError("Se requieren archivos", "files");
    }

    // Parsear deviceTypes
    const deviceTypesArray = parseArrayField(req.body.deviceType);

    if (deviceTypesArray.length !== req.files.length) {
      throw new ValidationError(
        `La cantidad de deviceTypes (${deviceTypesArray.length}) debe coincidir con los archivos (${req.files.length})`,
        "deviceType"
      );
    }

    // Construir filesData
    const filesData = req.files.map((file, index) => ({
      file,
      deviceType: deviceTypesArray[index]
    }));

    // Remover deviceType del body y agregar filesData
    const { deviceType, ...restBody } = req.body;

    return {
      ...restBody,
      filesData
    };
  },

  // Para multiples archivos independientes (distintos)
  distinct: (req) => {
    if (!req.files || req.files.length === 0) {
      throw new ValidationError("Se requieren archivos", "files");
    }

    const filesCount = req.files.length;

    // Parsear campos que pueden venir como arrays o strings separados por comas
    const channels = parseArrayField(req.body.channel);
    const documentTypes = parseArrayField(req.body.documentType);
    const securityLevels = parseArrayField(req.body.securityLevel);
    const hasCompanies = parseArrayField(req.body.hasCompany);
    const typesOfFile = parseArrayField(req.body.typeOfFile);
    const emissionDates = parseArrayField(req.body.emissionDate);
    const expirationDates = parseArrayField(req.body.expirationDate);
    const metadatas = parseArrayField(req.body.metadata);

    // Validar longitudes
    const validationErrors = [];
    validationErrors.push(validateFieldLength('channel', channels, filesCount));
    validationErrors.push(validateFieldLength('documentType', documentTypes, filesCount));
    validationErrors.push(validateFieldLength('securityLevel', securityLevels, filesCount));
    validationErrors.push(validateFieldLength('hasCompany', hasCompanies, filesCount));
    validationErrors.push(validateFieldLength('typeOfFile', typesOfFile, filesCount));

    const errors = validationErrors.filter(e => e !== null);
    if (errors.length > 0) {
      throw new ValidationError(
        "Error de validación para archivos distintos",
        "filesData",
        errors
      );
    }

    // Construir filesData
    const filesData = req.files.map((file, index) => ({
      file,
      channel: getValueAtIndex(channels, index),
      documentType: getValueAtIndex(documentTypes, index),
      securityLevel: getValueAtIndex(securityLevels, index),
      hasCompany: parseBoolean(getValueAtIndex(hasCompanies, index)),
      typeOfFile: getValueAtIndex(typesOfFile, index),
      emissionDate: getValueAtIndex(emissionDates, index, null),
      expirationDate: getValueAtIndex(expirationDates, index, null),
      metadata: getValueAtIndex(metadatas, index, null)
    }));

    return { filesData };
  },

  // Para actualizar los archivos
  update: (req) => {
    if (!req.files || req.files.length === 0) {
      throw new ValidationError("Se requiere al menos un archivo", "files");
    }

    const codesArray = parseArrayField(req.body.codes);

    if (codesArray.length !== req.files.length) {
      throw new ValidationError(
        `La cantidad de códigos (${codesArray.length}) debe coincidir con los archivos (${req.files.length})`,
        "codes"
      );
    }

    const fileToUpdate = req.files.map((file, index) => ({
      code: codesArray[index],
      file
    }));

    return {
      fileToUpdate,
      hasCompany: parseBoolean(req.body.hasCompany)
    };
  }
};