import 'babel-register'
import 'async-to-gen/register'

import test from 'ava'
import mysqlDatabase from './index'

const appConfig = {
  host: 'localhost',
  user: 'testuser',
  password: 'testpassword',
  database: 'testdatabase'
}

const rootConfig = process.env.CIRCLECI
  ? { user: 'ubuntu', host: 'localhost' }
  : { user: 'root', host: 'localhost' }

const database = mysqlDatabase(appConfig)
const databaseAsRoot = mysqlDatabase(rootConfig)

test.before(async t => {
  await databaseAsRoot.query(
    `CREATE USER IF NOT EXISTS 'testuser'@'%' IDENTIFIED BY 'testpassword'`
  )
  await databaseAsRoot.query(
    `GRANT ALL PRIVILEGES ON *.* TO 'testuser'@'%' WITH GRANT OPTION`
  )
  await databaseAsRoot.query(
    `FLUSH PRIVILEGES`
  )
  await databaseAsRoot.query(
    `DROP DATABASE IF EXISTS testdatabase`
  )
  await databaseAsRoot.query(
    `CREATE DATABASE testdatabase`
  )
  await database.query(
    `CREATE TABLE IF NOT EXISTS foo (
      bar TINYINT,
      baz VARCHAR(32)
    )`
  )
})

test.afterEach(async t => {
  await database.query(`TRUNCATE TABLE foo`)
})

test('requires config', async t => {
  t.throws(() => mysqlDatabase())
})

test.serial('`create` adds item', async t => {
  const fooTable = database.table('foo')

  const initialFoos = await fooTable.read({ bar: 1 })
  t.deepEqual(initialFoos.length, 0)

  await fooTable.create({ bar: 1, baz: 'yes' })

  const foos = await fooTable.read({ bar: 1 })
  t.deepEqual(foos.length, 1)

  t.deepEqual(foos[0].bar, 1)
  t.deepEqual(foos[0].baz, 'yes')
})

test.serial('`update` changes fields', async t => {
  const fooTable = database.table('foo')

  await fooTable.create({ bar: 1 })
  await fooTable.update({ bar: 1 }, { baz: 'yes' })

  const foos = await fooTable.read({ bar: 1 })
  t.deepEqual(foos[0].baz, 'yes')
})

test.serial('`delete` removes an item', async t => {
  const fooTable = database.table('foo')

  await fooTable.create({ bar: 1 })
  await fooTable.create({ bar: 2 })
  await fooTable.create({ bar: 3 })

  const foosBefore = await fooTable.read()
  t.deepEqual(foosBefore.map(f => f.bar), [1, 2, 3])

  await fooTable.delete({ bar: 3 })

  const foosAfter = await fooTable.read()
  t.deepEqual(foosAfter.map(f => f.bar), [1, 2])
})

test.serial('`read` returns all items when empty', async t => {
  const fooTable = database.table('foo')

  await fooTable.create({ bar: 1 })
  await fooTable.create({ bar: 2 })
  await fooTable.create({ bar: 3 })

  const foos = await fooTable.read()
  t.deepEqual(foos.map(f => f.bar), [1, 2, 3])
})

test.serial('`read` returns matching items', async t => {
  const fooTable = database.table('foo')

  await fooTable.create({ bar: 1, baz: 'no' })
  await fooTable.create({ bar: 2, baz: 'yes' })
  await fooTable.create({ bar: 3, baz: 'yes' })

  const foos = await fooTable.read({ baz: 'yes' })
  t.deepEqual(foos.map(f => f.bar), [2, 3])
})

test.serial('`read` returns matching items with specified fields', async t => {
  const fooTable = database.table('foo')

  await fooTable.create({ bar: 1, baz: 'no' })
  await fooTable.create({ bar: 2, baz: 'yes' })
  await fooTable.create({ bar: 3, baz: 'yes' })

  const foosWithBar = await fooTable.read({ baz: 'yes' }, ['bar'])
  t.deepEqual(Object.keys(foosWithBar[0]), ['bar'])
  t.deepEqual(Object.keys(foosWithBar[1]), ['bar'])

  const foosWithBaz = await fooTable.read({ baz: 'yes' }, ['baz'])
  t.deepEqual(Object.keys(foosWithBaz[0]), ['baz'])
  t.deepEqual(Object.keys(foosWithBaz[1]), ['baz'])
})

test.serial('`query` runs raw sql', async t => {
  const initialFoos = await database.query('SELECT bar, baz FROM foo')
  t.deepEqual(initialFoos, [])

  await database.query("INSERT INTO foo (`bar`, `baz`) VALUES (1, 'yes')")
  await database.query("INSERT INTO foo (`bar`, `baz`) VALUES (2, 'no')")

  const foo1 = await database.query('SELECT `bar`, `baz` FROM `foo` WHERE bar = 1')
  t.deepEqual(foo1[0].bar, 1)
  t.deepEqual(foo1[0].baz, 'yes')

  const foo2 = await database.query('SELECT `bar`, `baz` FROM `foo` WHERE bar = 2')
  t.deepEqual(foo2[0].bar, 2)
  t.deepEqual(foo2[0].baz, 'no')
})

test.serial('`query` runs raw sql', async t => {
  const initialFoos = await database.query('SELECT ?? FROM foo', ['bar', 'baz'])
  t.deepEqual(initialFoos, [])

  await database.query('INSERT INTO ?? (??) VALUES (?)', 'foo', ['bar', 'baz'], [1, 'yes'])
  await database.query('INSERT INTO ?? (??) VALUES (?)', 'foo', ['bar', 'baz'], [2, 'no'])

  const foo1 = await database.query('SELECT ?? FROM ?? WHERE ?', ['bar', 'baz'], 'foo', { bar: 1 })
  t.deepEqual(foo1[0].bar, 1)
  t.deepEqual(foo1[0].baz, 'yes')

  const foo2 = await database.query('SELECT ?? FROM ?? WHERE ?', ['bar', 'baz'], 'foo', { bar: 2 })
  t.deepEqual(foo2[0].bar, 2)
  t.deepEqual(foo2[0].baz, 'no')
})
