import mysql from 'mysql'
import curry from 'lodash.curry'

const mysqlPools = {}

const getOrCreateConnectionPool = config => {
  if (!mysqlPools[config.user]) {
    const poolConfig = Object.assign({}, { connectionLimit: 10 }, config)
    mysqlPools[config.user] = mysql.createPool(poolConfig)
  }

  return mysqlPools[config.user]
}

const runMysqlQuery = (config, query) => {
  const mysqlPool = getOrCreateConnectionPool(config)
  return new Promise((resolve, reject) => {
    mysqlPool.getConnection((error, connection) => {
      if (error) {
        reject(error)
      } else {
        connection.query(query, (error, results, fields) => {
          if (error) {
            reject(error)
          } else {
            connection.release()
            resolve(results)
          }
        })
      }
    })
  })
}

export default curry(runMysqlQuery)
