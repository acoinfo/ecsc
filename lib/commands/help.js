/**
 * Copyright (C) 2023 ACINFO
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * Author : Fu Tongtang <futongtang@acoinfo.com>
 * File   : help.js
 * Desc   : help command
 */

module.exports = printHelp

const CLI = 'ecsc'
const HELP  = `
Usage: ${CLI} [command]

Commands:
  help        print this help information
  version     print ${CLI} version information
  create      create an OCI compliant runc bundle
  pack        pack the runc bundle into an OCI image

For more info, run command with '--help':
  $ ${CLI} create --help
  $ ${CLI} pack --help
`

function printHelp () {
  console.log(HELP)
}