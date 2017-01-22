import mysql from 'mysql'
import sqlstring from 'sqlstring'

const mysqlPools = {}

const getOrCreateConnectionPool = config => {
  if (!mysqlPools[config.user]) {
    const poolConfig = { connectionLimit: 10, ...config }
    mysqlPools[config.user] = mysql.createPool(poolConfig)
  }

  return mysqlPools[config.user]
}

const runMysqlQuery = config => (query, ...queryValues) => {
  const mysqlPool = getOrCreateConnectionPool(config)

  return new Promise((resolve, reject) => {
    // Open up a new connection
    mysqlPool.getConnection((error, connection) => {
      if (error) {
        reject(error)
      } else {
        // If there are any values we assume query is a format string and
        // appply the values
        const finalQuery = queryValues.length
          ? sqlstring.format(query, queryValues)
          : query

        // Execute the query
        connection.query(finalQuery, (error, results, fields) => {
          // Close connection before responding
          connection.release()

          if (error) {
            reject(error)
          } else {
            // Release connection and return results
            resolve(results)
          }
        })
      }
    })
  })
}

export default runMysqlQuery
