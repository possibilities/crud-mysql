# CRUD mysql

CRUD interface for mysql

[![CircleCI](https://circleci.com/gh/possibilities/crud-mysql.svg?style=svg)](https://circleci.com/gh/possibilities/crud-mysql)

### Summary

When developing small CRUD apps it's useful to have a simple abstraction over database operations. This library provides a minimal viable interface over mysq database tables.

### Usage

#### Setup

```
import configureDatabase from 'crud-mysql'

const mysqlConfig = {
  user: 'test',
  password: 'test',
  database: 'test'
}

const database = configureDatabase(mysqlConfig)
const userTable = database.table('users')
```

See [mysql](https://github.com/mysqljs/mysql) docs for [config](https://github.com/mysqljs/mysql#connection-options) options

#### Creates

```
await userTable.create({ id: 1, username: 'possibilities' })
await userTable.create({ id: 2, username: 'thrivingkings' })
```

#### Reads

Read all rows

```
const users = await userTable.read()
const usernames = users.map(u => u.username)
console.info(usernames) //-> ['possibilities', 'thrivingkings']
```

Fetch certain rows

```
const users = await userTable.read({ id: 1 })
const { username } = users.pop()
console.info(username) //-> possibilities
```

#### Updates

```
const { country } = await userTable.update({ id: 1, country: 'denmark' })
console.info(country) //-> denmark
```

#### Deletion

```
await userTable.delete({ id: 1 })
const users = userTable.read({ id: 1 })
console.info(users.length) //-> 0
```

#### Raw queries

```
const insertSql = "INSERT INTO users (`username`, `country`) VALUES ('possibilities', 'iceland')"
await database.query(insertSql)

const selectSql = 'SELECT username, country FROM users WHERE country = iceland'
const users = await database.query(selectSql)

const { country, username } = users.pop()

console.info(username) //-> possibilities
console.info(country) //-> iceland
```

Formating and escaping is provided by [sqlstring](https://github.com/mysqljs/sqlstring)

```
const insertSql = "INSERT INTO ?? (??) VALUES (?)"
await database.query(insertSql, ['users', ['username', 'country'], ['possibilities', 'iceland']])

const selectSql = 'SELECT ?? FROM ?? WHERE ?'
const users = await database.query(selectSql, [['username', 'country'], 'users', { country: 'iceland' }])

const { country, username } = users.pop()

console.info(username) //-> possibilities
console.info(country) //-> iceland
```

### Other backends

* [In memory](https://github.com/possibilities/crud-in-memory)
