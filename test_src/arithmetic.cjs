module.exports.sum = function sum(a, b) {
    let x = 0;
    
    for(var c in [1,2,3,4]){
        x+=c;
    }

    return a + b;
}
module.exports.div = function div(a, b) {
    if (b == 0) return NaN;
    return a / b;
}