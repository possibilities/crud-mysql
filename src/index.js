import sqlstring from 'sqlstring'
import runMysqlQuery from './runMysqlQuery'

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

const database = config => {
  if (!config) {
    throw new Error('mysql config object is required')
  }

  const query = runMysqlQuery(config)

  const transaction = async () => {
    const start = () => query('START TRANSACTION')
    const commit = () => query('COMMIT')
    const rollback = () => query('ROLLBACK')

    return { start, commit, rollback }
  }

  const table = tableName => {
    const create = item => {
      const insertQuery = buildInsertQuery(tableName, item)
      return query(insertQuery)
    }

    const read = async (where, fields = []) => {
      const selectQuery = buildSelectQuery(tableName, where, fields)
      const results = await query(selectQuery)
      return Promise.resolve(results)
    }

    const update = async (where, item) => {
      const updateQuery = buildUpdateQuery(tableName, where, item)
      const results = await query(updateQuery)
      return Promise.resolve(results)
    }

    const del = async where => {
      const deleteQuery = buildDeleteQuery(tableName, where)
      await query(deleteQuery)
      return Promise.resolve()
    }

    return { create, read, update, delete: del }
  }

  return { table, query, transaction }
}

export default database
