import {safeImport} from '../lib/safeImport.cjs'
// const {safeImport} = require('../lib/safeImport.cjs')



const x = safeImport('classnames','test_src/index/index.cjs');
console.log(x('hello'));