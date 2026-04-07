
var {existsSync,readFile} = require('node:fs');
// const {cwd} = require('process');
var _var = require('process');
var {sum, div,sad} = require('./arithmetic.cjs');
// var {sum, div} = require('../output/lodash.bundle.js');
var ms = require('./ms.bundle.cjs')
var cn = require('classnames')


let cwd = process.cwd;
console.log('a')

function x(){
    return {x:3};
}

// readFile('./package.json',(data)=>{
    
// });
let newLocal = existsSync("./package.json");

console.log(`Read some data`,newLocal,sum(2,34));
console.log(`Read some data`,newLocal,
    div(7,0),
    div(32,3),
    // ceil(10.24),
    cn('fooo','foobar',{tempo:true}),
    ms('1000y',{long:true})
);