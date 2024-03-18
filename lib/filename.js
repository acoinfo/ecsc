/**
 * Copyright (C) 2023 ACOINFO
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * Author : Fu Tongtang <futongtang@acoinfo.com>
 * File   : filename.js
 * Desc   : filename validator
 */

'use strict'

const os = require('os')

const MAX_LENGTH = 255
const RESERVED_CHAR = /[/]/

/**
 * MS file name convention
 * https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file
 */
const RESERVED_CHAR_WIN = /[<>:"/\\|?*]/
const RESERVED_NAME_WIN = [
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
]

module.exports = validate

function validate (filename) {
  if (!(filename && typeof filename === 'string')) {
    throw Error('filename is required!')
  }
  if (filename.length > MAX_LENGTH) {
    throw Error('filename is too long!')
  }

  if (os.platform() === 'win32') {
    if (RESERVED_CHAR_WIN.test(filename)) {
      throw Error(`filename is invalid: "${filename}"`)
    }
    if (RESERVED_NAME_WIN.includes(filename)) {
      throw Error(`filename cannnot use Windows reserved name: "${filename}"`)
    }
  } else {
    if (RESERVED_CHAR.test(filename)) {
      throw Error(`filename is invalid: "${filename}"`)
    }
  }
  return filename
}
