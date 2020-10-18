
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
        // form of patternString should be: <fire thresh>, <wild thresh>, <pattern def>
        let patternObj = this.preprocess(patternString);
        this.patternString = patternObj.pattern;
        this.fireThreshold = patternObj.fireThreshold;
        this.wildcardThreshold= patternObj.wildcardThreshold;

        const pegdefstr = fs.readFileSync(PEG_DEF_FILE, "utf-8");
        const pegdef = PEG.generate(pegdefstr);
        this.parserFuncs = eval(pegdef.parse(this.patternString).funcstr);
    }

    toString() {
        return `[fire: ${this.fireThreshold}, wild: ${this.wildcardThreshold}, pattern: ${this.patternString}]`;
    }

    preprocess(patterndef) {
        let sections = patterndef.split(Matcher.PREPROCESSOR_CHAR);
        if (sections.length !== 3) {
            throw "PatternStringError";
        }
        let fireThreshold = Number(sections[0].trim());
        let wildcardThreshold = Number(sections[1].trim());
        let patternString = sections[2].trim();
        return {fireThreshold: fireThreshold, wildcardThreshold: wildcardThreshold, pattern: patternString};
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
Matcher.PREPROCESSOR_CHAR = ",";

function test1() {
    const matcher = new Matcher("1, 2, X $ X");
    log(mat1cher.match([1, ]));
    log(matcher.match([1, 2]));
    log(matcher.match([3, 2, 1, 3]));
    log(matcher.match([1, 2, 1, 2]));
    log(matcher.match([1]));
}

//test1();
module.exports.Matcher = Matcher;