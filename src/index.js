import mysql from 'mysql'
import sqlstring from 'sqlstring'

const buildInsertQuery = (tableName, item) => {
  const keys = Object.keys(item)
  const values = keys.map(k => item[k])

  return sqlstring.format(
    'INSERT INTO ?? (??) VALUES (?)',
    [tableName, keys, values]
  )
}

const buildSelectQuery = (tableName, where, fields) => {
  const selectFields = fields.length ? fields : '*'

  if (where) {
    return sqlstring.format(
      `SELECT ?? FROM ?? WHERE ?`,
      [selectFields, tableName, where]
    )
  } else {
    return sqlstring.format(
      `SELECT ?? FROM ??`,
      [selectFields, tableName]
    )
  }
}

const buildUpdateQuery = (tableName, where, item) => {
  return sqlstring.format(
    `UPDATE ?? SET ? WHERE ?`,
    [tableName, item, where]
  )
}

const buildDeleteQuery = (tableName, where, item) => {
  return sqlstring.format(
    `DELETE FROM ?? WHERE ?`,
    [tableName, where]
  )
}

const mysqlPools = {}

const ensurePool = config => {
  if (!mysqlPools[config.user]) {
    const poolConfig = { connectionLimit: 10, ...config }
    mysqlPools[config.user] = mysql.createPool(poolConfig)
  }

  return mysqlPools[config.user]
}

const getConnection = pool => {
  return new Promise((resolve, reject) => {
    pool.getConnection((error, connection) => {
      if (error) {
        reject(error)
      } else {
        resolve(connection)
      }
    })
  })
}

const query = connection => (sql, ...sqlValues) => {
  return new Promise((resolve, reject) => {
    // If there are any values we assume sql is a format string and
    // appply the values
    const finalSql = sqlValues.length
      ? sqlstring.format(sql, sqlValues)
      : sql

    // Execute the sql
    connection.query(finalSql, (error, results, fields) => {
      if (error) {
        reject(error)
      } else {
        // Release connection and return results
        resolve(results)
      }
    })
  })
}

const mysqlDatabase = config => {
  if (!config) {
    throw new Error('mysql config object is required')
  }

  const database = async (queryFn, options = { shouldRunWithTransaction: false }) => {
    const pool = ensurePool(config)
    const connection = await getConnection(pool)
    const connectionQuery = query(connection)

    connectionQuery.create = (tableName, item) => {
      const insertQuery = buildInsertQuery(tableName, item)
      return connectionQuery(insertQuery)
    }

    connectionQuery.read = (tableName, where, fields = []) => {
      const selectQuery = buildSelectQuery(tableName, where, fields)
      return connectionQuery(selectQuery)
    }

    connectionQuery.update = async (tableName, where, item) => {
      const updateQuery = buildUpdateQuery(tableName, where, item)
      return connectionQuery(updateQuery)
    }

    connectionQuery.delete = async (tableName, where) => {
      const deleteQuery = buildDeleteQuery(tableName, where)
      await connectionQuery(deleteQuery)
    }

    const { shouldRunWithTransaction } = options

    if (shouldRunWithTransaction) await connectionQuery('START TRANSACTION')

    try {
      await queryFn(connectionQuery)
      if (shouldRunWithTransaction) await connectionQuery('COMMIT')
    } catch (error) {
      if (shouldRunWithTransaction) await connectionQuery('ROLLBACK')
    } finally {
      connection.release()
    }

    return Promise.resolve()
  }

  const databaseWithTransaction = queryFn => database(queryFn, { shouldRunWithTransaction: true })

  database.withTransaction = databaseWithTransaction

  return database
}

export default mysqlDatabase
