/**
 * Copyright (C) 2023 ACOINFO
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * Author : Fu Tongtang <futongtang@acoinfo.com>
 * File   : version.js
 * Desc   : version command
 */

module.exports = printVersion

async function printVersion (pkg = require('../../package.json')) {
  const println = console.log
  const depends = pkg.dependencies
  const dependsListWidth = 64
  const dependsListSpaces = 4

  println()
  println(`${pkg.description} (${getPakageName(pkg.name)}) ${pkg.version}`)
  println()
  println('Dependencies:')
  Object.keys(depends).forEach(p => {
    const version = pkg.dependencies[p]
    const spaces = dependsListWidth - dependsListSpaces - p.length - version.length
    const dots = spaces > 0 ? Buffer.alloc(spaces).fill('.').toString() : ''
    println(`  ${p} ${dots} ${version}`)
  })
}

function getPakageName (packageName, withoutScope = true) {
  if (packageName) {
    return withoutScope ? packageName.split('/').pop() : packageName
  }
}