# CRUD mysql

CRUD interface for mysql

[![CircleCI](https://circleci.com/gh/possibilities/crud-mysql.svg?style=svg)](https://circleci.com/gh/possibilities/crud-mysql)

### Summary

When developing small CRUD apps it's useful to have a simple abstraction over database operations. This library provides a minimal viable interface over mysql, manages a connection pool, and transaction management.

### Usage

#### Setup

```
import configureMysql from 'crud-mysql'

const mysqlConfig = {
  user: 'test',
  password: 'test',
  database: 'test'
}

const database = configureMysql(mysqlConfig)
```

See [mysql](https://github.com/mysqljs/mysql) docs for [config](https://github.com/mysqljs/mysql#connection-options) options

#### Creates

```
await database(async query => {
  await query.create('users', { id: 1, username: 'possibilities' })
  await query.create('users', { id: 2, username: 'thrivingkings' })
})
```

#### Reads

Read all rows

```
await database(async query => {
  const users = await query.read('users')
  const usernames = users.map(u => u.username)
  console.info(usernames) //-> ['possibilities', 'thrivingkings']
})
```

Fetch certain rows

```
await database(async query => {
  const users = await query.read('users', { id: 1 })
  const { username } = users.pop()
  console.info(username) //-> possibilities
})
```

#### Updates

```
await database(async query => {
  const { country } = await query.update('users', { id: 1, country: 'denmark' })
  console.info(country) //-> denmark
})
```

#### Deletion

```
await database(async query => {
  await query.delete('users', { id: 1 })
  const users = query.read('users', { id: 1 })
  console.info(users.length) //-> 0
})
```

#### Raw queries

```
await database(async query => {
  const insertSql = "INSERT INTO users (`username`, `country`) VALUES ('possibilities', 'iceland')"
  await query(insertSql)

  const selectSql = 'SELECT username, country FROM users WHERE country = iceland'
  const users = await query(selectSql)

  const { country, username } = users.pop()

  console.info(username) //-> possibilities
  console.info(country) //-> iceland
})
```

Formating and escaping is provided by [sqlstring](https://github.com/mysqljs/sqlstring)

```
await database(async query => {
  const insertSql = "INSERT INTO ?? (??) VALUES (?)"
  await query(insertSql, ['users', ['username', 'country'], ['possibilities', 'iceland']])

  const selectSql = 'SELECT ?? FROM ?? WHERE ?'
  const users = await query(selectSql, [['username', 'country'], 'users', { country: 'iceland' }])

  const { country, username } = users.pop()

  console.info(username) //-> possibilities
  console.info(country) //-> iceland
})
```

#### Transactions

```
database.withTransaction(async query => {
  await query("INSERT INTO users (`username`) VALUES ('possibilities')")
  await query('INSERT INTO users (`nonexistent`) VALUES ('nonexistent')')
})

database(async query => {
  const users = await query('SELECT * FROM users')
  console.info(users.length) //-> 0
})
```

### Other backends

* [In memory](https://github.com/possibilities/crud-in-memory)
