
const PEG = require('pegjs');
const fs = require('fs');

// the following function is necessary for the parsed PEG grammar functions
let arrayEqual = (x, y) => {
    return x.map( (t,i) => { return t === y[i]; }).every( (x) => {return x===true } );
};


const pegdefstr = fs.readFileSync("parserdef.peg", "utf-8");

const pattern = "X X; X Y X;"
const pegdef = PEG.generate(pegdefstr);
const parserFuncs = pegdef.parse(pattern).map( (fstr) => { return eval(fstr); } );

console.log(parserFuncs[0](1, 1));
console.log(parserFuncs[0](1, 2));
console.log(parserFuncs[1](1, 2, 1));
console.log(parserFuncs[1](1, 2, 8));

