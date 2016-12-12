
const PEG = require('pegjs');
const fs = require('fs');

const PEG_DEF_FILE = "parserdef.peg";


function log(msg) {
    console.log(msg);
}

// the following function is necessary for the parsed PEG grammar functions
let arrayEqual = (x, y) => {
    return x.map( (t,i) => { return t === y[i]; }).every( (x) => {return x===true } );
};


const pegdefstr = fs.readFileSync(PEG_DEF_FILE, "utf-8");

const pattern = "X X; X Y X;";
const pegdef = PEG.generate(pegdefstr);
const parserFuncs = pegdef.parse(pattern).map( (fstr) => { return eval(fstr); } );


function test() {
    console.log(parserFuncs[0].apply(null, [1, 1]));
    console.log(parserFuncs[0].apply(null, [1, 2]));
    console.log(parserFuncs[1].apply(null, [1, 2, 1]));
    console.log(parserFuncs[1].apply(null, [1, 2, 8]));
    console.log(parserFuncs[1].apply(null, [1, 2, 8, 4]));
    console.log(parserFuncs[1].apply(null, [1, 2, 1, 4]));
}

//test();

class Matcher {

    constructor(patternString) {
        this.patternString = patternString;
        const pegdefstr = fs.readFileSync(PEG_DEF_FILE, "utf-8");
        const pegdef = PEG.generate(pegdefstr);
        this.parserFuncs = pegdef.parse(patternString).map( (fstr) => { return eval(fstr); } );
    }

    toString() {
        return patternString;
    }

    match(patternArray) {
        const pfResults = this.parserFuncs.map( (pf) => {
            return pf.apply(null, patternArray);
        });
        return pfResults.some( (x) => { return x; });
    }

}

function test1() {
    const matcher = new Matcher("X X; X Y X;");
    log(matcher.match([1, 1]));
    log(matcher.match([1, 2]));
    log(matcher.match([1, 2, 1]));
    log(matcher.match([1, 2, 4]));
}

//test1();
