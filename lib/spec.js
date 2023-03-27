/**
 * Copyright (C) 2023 ACOINFO
 *
 * Detailed license information can be found in the LICENSE file.
 *
 * Author : Fu Tongtang <futongtang@acoinfo.com>
 * File   : spec.js
 * Desc   : ECS specifications
 */

'use strict'

const ARCHITECTURES = [
  'noarch',
  'x86-64',
  'arm64',
  'arm',
  'riscv64',
  'mips64',
  'ppc',
  'loongarch'
]

const BUNDLES = [
  '/apps',
  '/home',
  '/bin',
  '/qt',
  '/boot',
  '/dev',
  '/lib',
  '/proc',
  '/root',
  '/sbin',
  '/tmp',
  '/usr',
  '/var',
]

module.exports = {
  ARCHITECTURES,
  BUNDLES
}