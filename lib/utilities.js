/**
 * Copyright (C) 2023 ACOINFO
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * Author : Fu Tongtang <futongtang@acoinfo.com>
 * File   : utilities.js
 * Desc   : useful functions
 */

'use strict'

module.exports = {
  clone
}

/**
 * @param {Objct} obj plain object to be cloned
 * @returns {Object}
 */
function clone(obj) {
  if (typeof obj === 'object') {
    if (Array.isArray(obj)) {
      return cloneArray(obj)
    }
    return clonePlain(obj)
  }
  return obj // we don't clone anything else

  function clonePlain (obj) {
    return Object.keys(obj).reduce((acc, k) => {
      acc[k] = clone(obj[k])
      return acc
    }, {})
  }

  function cloneArray (arr) {
    return arr.map(clone)
  }
}
