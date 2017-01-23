import test from 'ava'
import mysqlDatabase from './src/index'

const appConfig = {
  host: 'localhost',
  user: 'testuser',
  password: 'testpassword',
  database: 'testdatabase'
}

const rootConfig = process.env.CIRCLECI
  ? { user: 'ubuntu', host: 'localhost' }
  : { user: 'root', host: 'localhost' }

const databaseAsApp = mysqlDatabase(appConfig)
const databaseAsRoot = mysqlDatabase(rootConfig)

test.before(async t => {
  await databaseAsRoot(async query => {
    await query(`
      CREATE USER IF NOT EXISTS 'testuser'@'%'
      IDENTIFIED BY 'testpassword'
    `)
    await query(`
      GRANT ALL PRIVILEGES ON *.* TO 'testuser'@'%'
      WITH GRANT OPTION
    `)
    await query(`FLUSH PRIVILEGES`)
    await query(`DROP DATABASE IF EXISTS testdatabase`)
    await query(`CREATE DATABASE testdatabase`)
  })

  await databaseAsApp(async query => {
    await query(
      `CREATE TABLE IF NOT EXISTS users (
        username VARCHAR(32),
        country VARCHAR(32)
      )`
    )
  })
})

test.beforeEach(async t => {
  databaseAsApp(query => query(`TRUNCATE TABLE users`))
})

test('requires config', async t => t.throws(() => mysqlDatabase()))

test.serial('`create` adds item', async t => {
  await databaseAsApp(async query => {
    const initialUsers = await query.read('users', { username: 'possibilities' })
    t.deepEqual(initialUsers.length, 0)

    await query.create('users', {
      username: 'possibilities',
      country: 'denmark'
    })

    const users = await query.read('users', { username: 'possibilities' })
    t.deepEqual(users.length, 1)

    t.deepEqual(users[0].username, 'possibilities')
    t.deepEqual(users[0].country, 'denmark')
  })
})

test.serial('`update` changes fields', async t => {
  await databaseAsApp(async query => {
    await query.create('users', { username: 'possibilities' })
    await query.update(
      'users',
      { username: 'possibilities' },
      { country: 'denmark' }
    )
    const users = await query.read('users', { username: 'possibilities' })
    t.deepEqual(users[0].country, 'denmark')
  })
})

test.serial('`delete` removes an item', async t => {
  await databaseAsApp(async query => {
    await query.create('users', { username: 'possibilities' })
    await query.create('users', { username: 'thrivingkings' })
    await query.create('users', { username: 'rjz' })

    const usersBefore = await query.read('users')
    t.deepEqual(usersBefore.map(f => f.username), [
      'possibilities',
      'thrivingkings',
      'rjz'
    ])

    await query.delete('users', { username: 'possibilities' })

    const usersAfter = await query.read('users')
    t.deepEqual(usersAfter.map(f => f.username), [
      'thrivingkings',
      'rjz'
    ])
  })
})

test.serial('`read` returns all items when empty', async t => {
  await databaseAsApp(async query => {
    await query.create('users', { username: 'possibilities' })
    await query.create('users', { username: 'thrivingkings' })
    await query.create('users', { username: 'rjz' })

    const users = await query.read('users')
    t.deepEqual(users.map(f => f.username), [
      'possibilities',
      'thrivingkings',
      'rjz'
    ])
  })
})

test.serial('`read` returns matching items', async t => {
  await databaseAsApp(async query => {
    await query.create('users', { username: 'possibilities', country: 'iceland' })
    await query.create('users', { username: 'thrivingkings', country: 'denmark' })
    await query.create('users', { username: 'rjz', country: 'denmark' })

    const users = await query.read('users', { country: 'denmark' })
    t.deepEqual(users.map(f => f.username), ['thrivingkings', 'rjz'])
  })
})

test.serial('`read` returns matching items with specified fields', async t => {
  await databaseAsApp(async query => {
    await query.create('users', { username: 'possibilities', country: 'iceland' })
    await query.create('users', { username: 'thrivingkings', country: 'denmark' })
    await query.create('users', { username: 'rjz', country: 'denmark' })

    const usersWithUsername = await query.read(
      'users',
      { country: 'denmark' },
      ['username']
    )
    t.deepEqual(Object.keys(usersWithUsername[0]), ['username'])
    t.deepEqual(Object.keys(usersWithUsername[1]), ['username'])

    const usersWithCountry = await query.read(
      'users',
      { country: 'denmark' },
      ['country']
    )
    t.deepEqual(Object.keys(usersWithCountry[0]), ['country'])
    t.deepEqual(Object.keys(usersWithCountry[1]), ['country'])
  })
})

test.serial('`query` runs raw sql', async t => {
  await databaseAsApp(async query => {
    const initialusers = await query('SELECT username, country FROM users')
    t.deepEqual(initialusers, [])

    await query("INSERT INTO users (`username`, `country`) VALUES ('possibilities', 'denmark')")
    await query("INSERT INTO users (`username`, `country`) VALUES ('thrivingkings', 'iceland')")

    const user1 = await query("SELECT `username`, `country` FROM `users` WHERE username = 'possibilities'")
    t.deepEqual(user1[0].username, 'possibilities')
    t.deepEqual(user1[0].country, 'denmark')

    const user2 = await query("SELECT `username`, `country` FROM `users` WHERE username = 'thrivingkings'")
    t.deepEqual(user2[0].username, 'thrivingkings')
    t.deepEqual(user2[0].country, 'iceland')
  })
})

test.serial('`query` runs raw sql', async t => {
  await databaseAsApp(async query => {
    const initialusers = await query('SELECT ?? FROM users', ['username', 'country'])
    t.deepEqual(initialusers, [])

    await query(
      'INSERT INTO ?? (??) VALUES (?)',
      'users',
      ['username', 'country'],
      ['possibilities', 'denmark']
    )

    await query(
      'INSERT INTO ?? (??) VALUES (?)', 'users',
      ['username', 'country'],
      ['thrivingkings', 'iceland']
    )

    const user1 = await query(
      'SELECT ?? FROM ?? WHERE ?',
      ['username', 'country'],
      'users',
      { username: 'possibilities' }
    )
    t.deepEqual(user1[0].username, 'possibilities')
    t.deepEqual(user1[0].country, 'denmark')

    const user2 = await query(
      'SELECT ?? FROM ?? WHERE ?',
      ['username', 'country'],
      'users',
      { username: 'thrivingkings' }
    )
    t.deepEqual(user2[0].username, 'thrivingkings')
    t.deepEqual(user2[0].country, 'iceland')
  })
})

test.serial('`query` can be run in a transaction', async t => {
  await databaseAsApp.withTransaction(async query => {
    await query("INSERT INTO users (`username`, `country`) VALUES ('possibilities', 'denmark')")
    await query("INSERT INTO users (`username`, `country`) VALUES ('thrivingkings', 'denmark')")
  })

  await databaseAsApp(async query => {
    const users = await query('SELECT * FROM users')
    t.deepEqual(users.length, 2)
  })
})

test.serial('`query` transactions fail gracefully', async t => {
  await databaseAsApp(async query => {
    const users = await query('SELECT * FROM users')
    t.deepEqual(users.length, 0)
  })

  await databaseAsApp.withTransaction(async query => {
    await query("INSERT INTO users (`username`, `country`) VALUES ('possibilities', 'denmark')")
    await query("INSERT INTO users (`username`, `country`) VALUES ('thrivingkings', 'denmark')")
    await query("INSERT INTO users (`nonexistent`) VALUES ('possibilities')")
  })

  await databaseAsApp(async query => {
    const users = await query('SELECT * FROM users')
    t.deepEqual(users.length, 0)
  })
})
