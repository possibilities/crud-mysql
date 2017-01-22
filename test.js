import 'babel-register'
import 'async-to-gen/register'

import test from 'ava'
import mysqlDatabase from './index'
import runMysqlQuery from './modules/runMysqlQuery'

const appConfig = {
  host: 'localhost',
  user: 'testuser',
  password: 'testpassword',
  database: 'testdatabase'
}

const rootConfig = process.env.CIRCLECI
  ? { user: 'ubuntu', host: 'localhost' }
  : { user: 'root', host: 'localhost' }

const runMysqlQueryAsApp = runMysqlQuery(appConfig)
const runMysqlQueryAsRoot = runMysqlQuery(rootConfig)

test.before(async t => {
  await runMysqlQueryAsRoot(
    `CREATE USER IF NOT EXISTS 'testuser'@'%' IDENTIFIED BY 'testpassword'`
  )
  await runMysqlQueryAsRoot(
    `GRANT ALL PRIVILEGES ON *.* TO 'testuser'@'%' WITH GRANT OPTION`
  )
  await runMysqlQueryAsRoot(
    `FLUSH PRIVILEGES`
  )
  await runMysqlQueryAsRoot(
    `DROP DATABASE IF EXISTS testdatabase`
  )
  await runMysqlQueryAsRoot(
    `CREATE DATABASE testdatabase`
  )
  await runMysqlQueryAsApp(
    `CREATE TABLE IF NOT EXISTS foo (
      moof TINYINT,
      doof VARCHAR(32)
    )`
  )
})

test.afterEach(async t => {
  await runMysqlQueryAsApp(`TRUNCATE TABLE foo`)
})

const database = mysqlDatabase(appConfig)

test('requires config', async t => {
  t.throws(() => mysqlDatabase())
})

test.serial('create adds item', async t => {
  const fooTable = database.table('foo')

  const initialFoos = await fooTable.read({ moof: 1 })
  t.deepEqual(initialFoos.length, 0)

  await fooTable.create({ moof: 1, doof: 'yes' })

  const foos = await fooTable.read({ moof: 1 })
  t.deepEqual(foos.length, 1)

  t.deepEqual(foos[0].moof, 1)
  t.deepEqual(foos[0].doof, 'yes')
})

test.serial('update changes fields', async t => {
  const fooTable = database.table('foo')

  await fooTable.create({ moof: 1 })
  await fooTable.update({ moof: 1 }, { doof: 'yes' })

  const foos = await fooTable.read({ moof: 1 })
  t.deepEqual(foos[0].doof, 'yes')
})

test.serial('delete removes an item', async t => {
  const fooTable = database.table('foo')

  await fooTable.create({ moof: 1 })
  await fooTable.create({ moof: 2 })
  await fooTable.create({ moof: 3 })

  const foosBefore = await fooTable.read()
  t.deepEqual(foosBefore.map(f => f.moof), [1, 2, 3])

  await fooTable.delete({ moof: 3 })

  const foosAfter = await fooTable.read()
  t.deepEqual(foosAfter.map(f => f.moof), [1, 2])
})

test.serial('empty query returns all items', async t => {
  const fooTable = database.table('foo')

  await fooTable.create({ moof: 1 })
  await fooTable.create({ moof: 2 })
  await fooTable.create({ moof: 3 })

  const foos = await fooTable.read()
  t.deepEqual(foos.map(f => f.moof), [1, 2, 3])
})

test.serial('query returns matching items', async t => {
  const fooTable = database.table('foo')

  await fooTable.create({ moof: 1, doof: 'no' })
  await fooTable.create({ moof: 2, doof: 'yes' })
  await fooTable.create({ moof: 3, doof: 'yes' })

  const foos = await fooTable.read({ doof: 'yes' })
  t.deepEqual(foos.map(f => f.moof), [2, 3])
})

test.serial('query returns matching items with specified fields', async t => {
  const fooTable = database.table('foo')

  await fooTable.create({ moof: 1, doof: 'no' })
  await fooTable.create({ moof: 2, doof: 'yes' })
  await fooTable.create({ moof: 3, doof: 'yes' })

  const foosWithMoof = await fooTable.read({ doof: 'yes' }, ['moof'])
  t.deepEqual(Object.keys(foosWithMoof[0]), ['moof'])
  t.deepEqual(Object.keys(foosWithMoof[1]), ['moof'])

  const foosWithDoof = await fooTable.read({ doof: 'yes' }, ['doof'])
  t.deepEqual(Object.keys(foosWithDoof[0]), ['doof'])
  t.deepEqual(Object.keys(foosWithDoof[1]), ['doof'])
})
