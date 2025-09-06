import 'dotenv/config';  // Esto carga las variables de entorno de .env
import pgPromise from 'pg-promise';
//import iconv from 'iconv-lite';
//import jschardet from 'jschardet';

// Configuración de la conexión a la base de datos
const connection = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: '-c client_encoding=UTF8'
};

//Inicializacion del pg-promise
const pgp = pgPromise({
    capSQL: true, // Habilita la capacidad de SQL
    query(e) {
        if(typeof process.env.MOSTRAR_QUERY_LOGS !== 'undefined' && process.env.MOSTRAR_QUERY_LOGS !== null && parseInt(process.env.MOSTRAR_QUERY_LOGS) == 1){
            console.debug('QUERY: ' + e.query);
        } 
    },
    error(error, e) { //Un hook que maneja los errores que ocurren durante la ejecución de una consulta. Imprime el error y, si está disponible, la consulta que causó el error.
        console.error('Error en la base de datos:', error);
        if (e.query) {
            console.error('Query con error:', e.query);
        }
    },
    receive(e) {
        //Un hook que se ejecuta después de que se reciben los resultados de una consulta. Imprime la cantidad de filas retornadas.
        if(typeof process.env.MOSTRAR_QUERY_LOGS !== 'undefined' && process.env.MOSTRAR_QUERY_LOGS !== null && parseInt(process.env.MOSTRAR_QUERY_LOGS) == 1){
            console.info('Cantidad de filas retornadas:', e.result.rowCount);
        } 
    }
});

// Crear la instancia de la base de datos
let db;
try {
    db = pgp(connection);
    console.debug('Logré crear el objeto db con la configuración del sistema ...');
} catch (error) {
    console.error('Error al tratar de crear la conexión a la base de datos:', error);
}


// Funciones de consulta
//Verifica la conexión a la base de datos. Intenta obtener una conexión y devuelve 
//la versión del servidor de la base de datos si la conexión es exitosa. Si ocurre un error, se captura y se devuelve null.
async function verificarConexionBD() {
    try {
        const c = await db.connect();
        c.done(); // Libera la conexión
        return c.client.serverVersion;
    } catch (error) {
        console.error('Error al conectarse a la BD:', error);
        return null;
    }
}


//Ejecuta una consulta que debe devolver exactamente una fila. Lanza un error si no se encuentra ninguna fila o si se encuentran múltiples.
async function onePgMethod(query, values) {
    return db.one(query, values);
}


//Ejecuta una consulta que puede devolver una fila o ninguna. Lanza un error si se encuentran múltiples filas.
async function oneOrNonePgMethod(query, values) {
    return db.oneOrNone(query, values);
}

//Ejecuta una consulta que puede devolver múltiples filas o ninguna. No lanza un error si no se encuentran filas.
async function manyOrNonePgMethod(query, values) {
    return db.manyOrNone(query, values);
}


//Ejecuta una consulta que debe devolver múltiples filas. Lanza un error si no se encuentran filas.
async function manyPgMethod(query, values) {
    return db.many(query, values);
}

//Ejecuta una consulta que se utiliza para concatenar los resultados. Es útil para operaciones específicas que requieren concatenación de resultados.
async function concatPgMethod(query, values) {
    return db.concat(query, values);
}


//aneja una transacción de base de datos. Permite ejecutar múltiples consultas dentro de una transacción y 
//asegura que todas las consultas se ejecuten correctamente antes de confirmar la transacción. Captura y maneja errores durante la transacción.
async function txPgMethod(args, cb) {
    try {
        return await db.tx(args, cb);
    } catch (error) {
        console.error('Error en la transacción:', error);
        return error;
    }
}


// Maneja una tarea de base de datos que puede incluir varias consultas. 
//Permite agrupar consultas bajo una tarea que puede ser gestionada y manejada como una unidad. Captura y maneja errores durante la tarea.
async function taskPgMethod(args, cb) {
    try {
        return await db.task(args, cb);
    } catch (error) {
        console.error('Error en la tarea:', error);
        return error;
    }
}

// Función para insertar un solo registro
/*
const newUser = {
	name: 'John Doe',
	email: 'john.doe@example.com',
	age: 30
};
const insertedUser = await insertOne('users', newUser);
*/
async function insertOne(tableName, data, tx = null) {
  let query = null
  try {
    const columns = new pgp.helpers.ColumnSet(Object.keys(data), {
      table: tableName,
    });
    query = pgp.helpers.insert(data, columns) + " RETURNING *";

    return await (tx || db).one(query);
  } catch (error) {
    console.error("Error al insertar un registro:", error);
    console.error(`Datos consulta: ${query}`)
    throw error; // Lanza el error
  }
}

// Función para insertar múltiples registros
/*
const newUsers = [
	{ name: 'John Doe', email: 'john.doe@example.com', age: 30 },
	{ name: 'Jane Smith', email: 'jane.smith@example.com', age: 25 },
	{ name: 'Bob Johnson', email: 'bob.johnson@example.com', age: 40 }
];
 const insertedUsers = await insertMany('users', newUsers);
*/
async function insertRange(tableName, dataList, tx = null) {
  let query = null
  try {
    const columns = new pgp.helpers.ColumnSet(Object.keys(dataList[0]), {
      table: tableName,
    });
    query = pgp.helpers.insert(dataList, columns) + " RETURNING *";

    return await (tx || db).any(query);
  } catch (error) {
    console.error("Error al insertar multiples registros:", error);
    console.error(`Datos consulta: ${query}`)
    throw error; // Lanza el error
  }
}

// Función para actualizar un registro con una condición flexible en el WHERE
/*
const updatedUserData = {
	name: 'Alice Doe',
	age: 30
};

//Si se envia como un objeto el where
const whereClause = {
	id: 1,
	status: 'active',
	_operator: 'AND' // Este campo define si usamos 'AND' o 'OR'. Por defecto es 'AND'.
};

//Si se envia como un string el where (puede ser más compleja)
const whereClause = "where email = 'bob@example.com' AND is_verified = true";

const updatedUser = await updateOne('users', updatedUserData, null, whereClause);
Si se envia como un string el where
*/
async function updateOne(tableName, data, tx = null, whereClause = null) {
  let query = null
  let whereValues = [];
  try {
    if (
      typeof tableName === "undefined" ||
      tableName === null ||
      tableName === ""
    ) {
      throw new Error("No se envio nombre de la tabla");
    }

    if (
      typeof data === "undefined" ||
      data === null ||
      Object.keys(data).length === 0
    ) {
      throw new Error("No hay datos para actualizar.");
    }

    const columns = new pgp.helpers.ColumnSet(
      Object.keys(data).filter((key) => key !== "id"),
      { table: tableName }
    );

    let whereCondition = "";

    if (
      data.hasOwnProperty("id") &&
      (typeof whereClause === "undefined" || whereClause === null)
    ) {
      whereCondition = " where id = $1";
      whereValues.push(data.id);
    } else if (typeof whereClause === "string") {
      whereCondition = whereClause;
    } else {
      const operator = whereClause._operator || "AND";
      const conditions = Object.entries(whereClause)
        .filter(([key]) => key !== "_operator")
        .map(([key, value], index) => {
          whereValues.push(value);
          return `${key} = $${index + 1}`;
        });
      whereCondition = " where " + conditions.join(` ${operator} `);
    }

    query = pgp.helpers.update(data, columns) + ` ${whereCondition} RETURNING *`;
    return await (tx || db).any(query, whereValues);
  } catch (error) {
    console.error(`Error al actualizar el registro en la tabla ${tableName}:`, error);
    console.error(`Datos consulta: ${query}, where values: ${JSON.stringify(whereValues)}`)
    throw error;
  }
}

// Función para actualizar múltiples registros
/* 
let updatedDataList = [
    { id: 5, nombre: 'PRUEBAS1', descripcion: 'Pruebas1' },
    { id: 6, nombre: 'PRUEBAS2', descripcion: 'Pruebas2' }
];

let whereClauseList = [
    { id: 5, estado: true, _operator: 'AND' },  // Usamos un objeto
    "id = 6 OR estado = false"                  // Usamos un string
];

let actualizar = await dbConnectionProvider.updateRange('canal', updatedDataList, whereClauseList);
*/
// Función para actualizar múltiples registros
async function updateRange(tableName, dataList, tx = null) {
  try {
    if (
      typeof tableName === "undefined" ||
      tableName === null ||
      tableName === ""
    ) {
      throw new Error("No se envio nombre de la tabla");
    }

    if (
      typeof dataList === "undefined" ||
      dataList === null ||
      Object.keys(dataList).length === 0
    ) {
      throw new Error("No hay datos para actualizar.");
    }
    let resultado = [];
    if (typeof tx === "undefined" || tx === null) {
      const transaccion = await db.tx(async (t) => {
        let resultadoTransaccion = [];
        for (let data of dataList) {
          const result = await updateOne(tableName, data, t);
          if (Array.isArray(result)) {
            // Si source es un array, utiliza el operador spread para agregarlo al targetArray
            resultadoTransaccion.push(...result);
          } else if (result !== null && typeof result === "object") {
            // Si source es un objeto, agrégalo directamente
            resultadoTransaccion.push(result);
          }
        }

        return {
          resultadoTransaccion,
        };
      });
      if (
        typeof transaccion !== "undefined" &&
        transaccion !== null &&
        typeof transaccion.resultadoTransaccion !== "undefined" &&
        transaccion.resultadoTransaccion !== null
      ) {
        resultado = transaccion.resultadoTransaccion;
      }
    } else {
      for (let data of dataList) {
        const result = await updateOne(tableName, data, tx);
        if (Array.isArray(result)) {
          // Si source es un array, utiliza el operador spread para agregarlo al targetArray
          resultado.push(...result);
        } else if (result !== null && typeof result === "object") {
          //console.log(result);
          // Si source es un objeto, agrégalo directamente
          resultado.push(result);
        }
      }
    }

    return resultado;
  } catch (error) {
    console.error("Error al actualizar múltiples registros:", error);
    throw error;
  }
}

// Función que retorna el primer resultado encontrado o null si no hay registros
async function firstOrDefault(query, values = []) {
  try {
    const results = await db.manyOrNone(query, values);

    if (results.length === 0) {
      return null; // Retorna null si no hay registros
    }

    return results[0]; // Retorna el primer resultado
  } catch (error) {
    console.error("Error en firstOrDefault:", error);
    console.error(`Datos consulta: ${query}, values: ${JSON.stringify(values)}`)
    throw error; // Lanza el error si la consulta o conexión falla
  }
}

// Función que retorna todos los registros encontrados o null si no hay registros
async function getAll(query, values = []) {
  try {

    const results = await db.manyOrNone(query, values);

    if (results.length === 0) {
      return []; // Retorna null si no hay registros
    }

    return results; // Retorna todos los resultados
  } catch (error) {
    console.error("Error en getAll:", error);
    console.error(`Datos consulta: ${query}, values: ${JSON.stringify(values)}`)
    throw error; // Lanza el error si la consulta o conexión falla
  }
}

// ======================== RESTO DE FUNCIONES (SIN CAMBIOS IMPORTANTES) ========================

const CalcularPaginacion = async (query, registrosPorPagina, accionPaginacion, numeroPagina) => {
  try {
    const resultado = await firstOrDefault(query);
    const contador = parseInt(resultado?.count || 0, 10);

    if (!contador || isNaN(contador)) {
      return {
        paginaActual: 1,
        totalPaginas: 1,
        registrosPorPagina: registrosPorPagina,
        totalRegistros: 0,
        tienePaginaPrevia: false,
        tienePaginaSiguiente: false,
      };
    }

    let totalPaginas = Math.ceil(contador / registrosPorPagina);
    let nuevapaginaActual = 1;
    let tienePaginaPrevia = false;
    let tienePaginaSiguiente = false;

    if (accionPaginacion === 0) {
      nuevapaginaActual = numeroPagina;
      if (totalPaginas > numeroPagina) {
        tienePaginaSiguiente = true;
      }
    } else if (accionPaginacion === 1) {
      nuevapaginaActual = numeroPagina <= 1 ? 1 : numeroPagina - 1;
      tienePaginaPrevia = nuevapaginaActual > 1;
      tienePaginaSiguiente = nuevapaginaActual < totalPaginas;
    } else {
      nuevapaginaActual = numeroPagina >= totalPaginas ? totalPaginas + 1 : numeroPagina + 1;
      tienePaginaPrevia = nuevapaginaActual > 1;
      tienePaginaSiguiente = nuevapaginaActual < totalPaginas;
    }

    return {
      paginaActual: nuevapaginaActual,
      totalPaginas: totalPaginas,
      registrosPorPagina: registrosPorPagina,
      totalRegistros: contador,
      tienePaginaPrevia: tienePaginaPrevia,
      tienePaginaSiguiente: tienePaginaSiguiente,
    };
  } catch (error) {
    console.error("Error al calcular la paginación:", error.message);
    return {
      paginaActual: 1,
      totalPaginas: 1,
      registrosPorPagina: registrosPorPagina,
      totalRegistros: 0,
      tienePaginaPrevia: false,
      tienePaginaSiguiente: false,
    };
  }
};

const generarCondiciones = async (filtros, listaColumna, operadorLogico = "AND") => {
  try {
    let condiciones = "";
    let primeraCondicion = true;
    let operador = operadorLogico.toUpperCase() === "Y" ? "AND" : "OR";

    for (const filtro of filtros) {
      const columna = listaColumna.find((x) =>
        x.nombre.toLowerCase().includes(filtro.columna.toLowerCase())
      );

      if (columna) {
        const nombreColumna = columna.nombre.split(" AS ")[0];
        const tipoColumna = columna.tipo;
        let condicion = "";
        const condicionParametroNumero = parseInt(filtro.condicion, 10);

        // Validaciones por tipo
        if (tipoColumna === "bigint") {
          if (!Number.isInteger(Number(filtro.valor))) {
            throw new Error(`El valor '${filtro.valor}' no es válido para la columna bigint '${nombreColumna}'.`);
          }
        } else if (tipoColumna === "date") {
          const fechaFormato = !isNaN(new Date(filtro.valor).getTime());
          if (!fechaFormato) {
            throw new Error(`El valor '${filtro.valor}' no es una fecha válida para la columna '${nombreColumna}'.`);
          }
        }

        // 🔥 MEJORADO: Limpiar el valor
        const valorLimpio = limpiarDatosParaPostgreSQL(filtro.valor);

        // Generar condición
        switch (condicionParametroNumero) {
          case 1:
            condicion = `${nombreColumna} = ${tipoColumna === "bigint" ? valorLimpio : `'${valorLimpio}'`}`;
            break;
          case 2:
            condicion = `${nombreColumna} != ${tipoColumna === "bigint" ? valorLimpio : `'${valorLimpio}'`}`;
            break;
          case 3:
            condicion = `LOWER(${nombreColumna}) LIKE LOWER('%${valorLimpio}%')`;
            break;
          case 4:
            condicion = `LOWER(${nombreColumna}) NOT LIKE LOWER('%${valorLimpio}%')`;
            break;
          case 5:
            condicion = `LOWER(${nombreColumna}) LIKE LOWER('${valorLimpio}%')`;
            break;
          case 6:
            if (nombreColumna.includes("fecha")) {
              condicion = `${nombreColumna} > '${valorLimpio}T00:00:00Z'`;
            }
            break;
          case 7:
            if (nombreColumna.includes("fecha")) {
              condicion = `${nombreColumna} < '${valorLimpio}T23:59:59Z'`;
            }
            break;
          case 8:
            if (nombreColumna.includes("fecha")) {
              condicion = `${nombreColumna} >= '${valorLimpio}T00:00:00Z'`;
            }
            break;
          case 9:
            if (nombreColumna.includes("fecha")) {
              condicion = `${nombreColumna} <= '${valorLimpio}T23:59:59Z'`;
            }
            break;
          case 10:
            if (tipoColumna === "boolean") {
              condicion = `${nombreColumna} = ${valorLimpio}`;
            }
            break;
          default:
            condicion = `LOWER(${nombreColumna}) LIKE LOWER('${valorLimpio}%')`;
        }

        if (primeraCondicion) {
          condiciones += condicion;
          primeraCondicion = false;
        } else {
          condiciones += ` ${operador} ${condicion}`;
        }
      }
    }

    return condiciones;
  } catch (error) {
    console.error("Error al generar condiciones:", error);
    throw error;
  }
};

const procesarColumnas = async (usuarioId, tablaInterfaz) => {
  try {
    const queryColumnas = `
        SELECT id, etiqueta, clave, tipo_dato 
        FROM columna 
        WHERE tabla_interfaz = '${tablaInterfaz}' AND registro_esta_activo = TRUE`;

    const columnasDisponibles = await getAll(queryColumnas);

    if (!columnasDisponibles || columnasDisponibles.length === 0) {
      throw new Error(`La tabla ${tablaInterfaz} no posee columnas definidas.`);
    }

    const queryColumnasUsuario = `
        SELECT col.id, col.etiqueta, col.clave, col.tipo_dato 
        FROM tabla_configuracion AS tc
        JOIN columna AS col ON tc.columna_id = col.id AND col.registro_esta_activo = TRUE
        WHERE tc.usuario_id = ${usuarioId} 
        AND tc.tabla_interfaz = '${tablaInterfaz}' 
        AND tc.registro_esta_activo = TRUE`;

    const columnasConfiguradas = await getAll(queryColumnasUsuario);

    const queryColumnasUsuarioFijadas = `
        SELECT col.id, col.etiqueta, col.clave, col.tipo_dato 
        FROM columna_fijada AS cf
        JOIN columna AS col ON cf.columna_id = col.id AND col.registro_esta_activo = TRUE
        WHERE cf.usuario_id = ${usuarioId} 
        AND cf.registro_esta_activo = TRUE`;

    const columnasUsuarioFijadas = await getAll(queryColumnasUsuarioFijadas);

    const columnasVisibles = [];
    const columnasFijadas = [];
    let columnasConsulta = [];

    if (columnasConfiguradas && columnasConfiguradas.length > 0) {
      columnasConsulta = columnasConfiguradas.map((col) => col.clave);
      columnasVisibles.push(...columnasConfiguradas.map((col) => col.etiqueta));
    } else {
      columnasConsulta = columnasDisponibles.map((col) => col.clave);
    }

    if (columnasUsuarioFijadas && columnasUsuarioFijadas.length > 0) {
      columnasFijadas.push(...columnasUsuarioFijadas.map((col) => col.etiqueta));
    }

    return {
      columnasDisponibles,
      columnasVisibles,
      columnasFijadas,
      columnasConsulta,
    };
  } catch (error) {
    console.error("Error al procesar columnas:", error);
    throw error;
  }
};

// ======================== FUNCIÓN DE DEBUG ========================

const debugString = (str, contexto = '') => {
  if (typeof str !== 'string') return;
  
  console.log(`\n=== DEBUG STRING: ${contexto} ===`);
  console.log(`String: "${str}"`);
  console.log(`Longitud: ${str.length}`);
  
  // Mostrar cada carácter con su código
  for (let i = 0; i < Math.min(str.length, 50); i++) { // Limitar a 50 chars
    const char = str[i];
    const code = str.charCodeAt(i);
    const hex = code.toString(16).padStart(4, '0');
    
    if (code > 127 || code < 32) {
      console.log(`[${i}]: "${char}" (U+${hex.toUpperCase()}) - Código: ${code}`);
    }
  }
  console.log('=====================================\n');
};

// ======================== EXPORT FINAL ========================

const dbConnectionProvider = {
  helpers: pgp.helpers,
  pgpErrors: pgp.errors,
  one: onePgMethod,
  manyOrNone: manyOrNonePgMethod,
  many: manyPgMethod,
  oneOrNone: oneOrNonePgMethod,
  concat: concatPgMethod,
  tx: txPgMethod,
  task: taskPgMethod,
  verificarConexionBD,
  insertOne,
  insertRange,
  updateOne,
  updateRange,
  firstOrDefault,
  getAll,
  CalcularPaginacion,
  generarCondiciones,
  procesarColumnas,
};

export { dbConnectionProvider };