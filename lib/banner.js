/* eslint-disable quotes */
/**
 * Copyright (C) 2023 ACOINFO
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * Author : Fu Tongtang <futongtang@acoinfo.com>
 * File   : banner.js
 * Desc   : comamnd line ascii banner
 */

'use strict'

const COLORS = {
  default: '\x1B[39m',
  green: '\x1B[32m',
  cyan: '\x1B[36m'
}

module.exports = printBanner
module.exports.COLORS = COLORS

const banner = [
  '   _____________ _____                              __       ',
  '  / __/ ___/ __// ___/__  __ _  __ _  ___ ____  ___/ /__ ____',
  " / _// /___\\ \\ / /__/ _ \\/  ' \\/  ' \\/ _ `/ _ \\/ _  / -_) __/",
  '/___/\\___/___/ \\___/\\___/_/_/_/_/_/_/\\_,_/_//_/\\_,_/\\__/_/   \n'
]

function printBanner (color = COLORS.cyan) {
  banner.forEach(line => {
    console.log(`${color}${line}${COLORS.default}`)
  })
}
