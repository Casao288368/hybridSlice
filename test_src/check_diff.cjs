// diff the two csv files, and perform a left subtract and right subtract.
const fsp = require('fs/promises')

async function main(){
    const file1 = 'success.txt';
    const file2String = `mime-types
http-errors
source-map-support
compressible
global-modules
thenify
mz
memory-fs
pinkie-promise
pretty-error
renderkid
hpack.js
wbuf
expand-tilde
homedir-polyfill
basic-auth
for-own
is-unc-path
recursive-readdir
path-root
cookies
bufferutil
utf-8-validate
easy-table
is-dotfile`;
    const file1String = await fsp.readFile(file1, 'utf8');
    const f1Elements = file1String.split('\n').filter(Boolean);
    const f2Elements = file2String.split('\n').filter(Boolean);
    const leftSubtract = f1Elements.filter(x => !f2Elements.includes(x));
    // const rightSubtract = f2Elements.filter(x => !f1Elements.includes(x));
    console.log('Left Subtract:f1, not in f2');
    const leftSubtractString = leftSubtract.join('\n')
    await fsp.writeFile('left_subtract.txt', leftSubtractString, 'utf8');
    // console.log('Right Subtract: done, but not in main list', rightSubtract);
}


main().catch(err => {
    console.error('Error:', err);
});