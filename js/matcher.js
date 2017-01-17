
const PEG = require('pegjs');
const fs = require('fs');

const PEG_DEF_FILE = "parserdef.peg";


function log(msg) {
    console.log(msg);
}

const pegdefstr = fs.readFileSync(PEG_DEF_FILE, "utf-8");

const pattern = "X X Y";
const pegdef = PEG.generate(pegdefstr);
const parserFuncs = pegdef.parse(pattern);


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
        this.parserFuncs = eval(pegdef.parse(patternString).funcstr);
    }

    toString() {
        return patternString;
    }

    match(patternArray) {
        // return longest match. TODO might want to change this at some point
        return this.parserFuncs.apply(null, patternArray);
    }

    static getMatchers(matchProgram) {
        return matchProgram.split(";").filter(p => { return p.length > 0; }).map(p => {
           return new Matcher(p);
        });
    }

}
Matcher.WILD = "$";

function test1() {
    const matcher = new Matcher("$ Y X $");
    log(matcher.match([1, 1]));
    log(matcher.match([1, 2]));
    log(matcher.match([3, 2, 1, 3]));
    log(matcher.match([1, 2, 1, 2]));
    log(matcher.match([1]));
}

//test1();
module.exports.Matcher = Matcher;