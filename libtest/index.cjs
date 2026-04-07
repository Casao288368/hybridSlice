// import {safeImport} from '../lib/safeImport.cjs'
const {safeImport} = require('../lib/safeImport.cjs')



const classnames = safeImport('classnames','test_src/index.cjs');

console.log(classnames('hello',"bruh"));

