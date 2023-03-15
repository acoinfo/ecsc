/**
 * Copyright (C) 2023 ACOINFO
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * Author : Fu Tongtang <futongtang@acoinfo.com>
 * File   : index.js
 * Desc   : list of commands
 */

'use strict'

module.exports = {
  help: require('./help'),
  version: require('./version'),
  create: require('./create'),
  pack: require('./pack')
}
