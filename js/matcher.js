
const PEG = require('pegjs');
const fs = require('fs');

const PEG_DEF_FILE = "parserdef.peg";


function log(msg) {
    console.log(msg);
}


class MatchObj {
    constructor(matchArray) {
        this.vals = matchArray;
    }

    get length() {
        return this.vals.length;
    }

}

class Matcher {

    constructor(patternString) {
        if (patternString.indexOf(";") >= 0) {
            throw "YouAreUsingTheOldVersionOfPatternDefs";
        }
        this.patternString = patternString;
        const pegdefstr = fs.readFileSync(PEG_DEF_FILE, "utf-8");
        const pegdef = PEG.generate(pegdefstr);
        this.parseobj = pegdef.parse(this.patternString);
        const fstr = this.parseobj.funcstr;
        this.parserFunc = eval(fstr);
    }

    toString() {
        return patternString;
    }

    match(patternArray) {
        const matchvals = this.parserFunc.apply(null, patternArray);
        return new MatchObj(matchvals);
    }

    static getMatchers(matchPatternString) {
        let mps = matchPatternString.split(';').filter(x => { return x.length > 0; });
        return mps.map( (mp) => {
            return new Matcher(mp);
        });
    }

}

function test1() {
    const matcher = new Matcher("X Y Z");
    log(matcher.match([1, 1]));
    log(matcher.match([1, 2]));
    log(matcher.match([1, 2, 1]));
    log(matcher.match([1, 2, 4]));
    log(matcher.match([1]));
}

test1();
//module.exports.Matcher = Matcher;
