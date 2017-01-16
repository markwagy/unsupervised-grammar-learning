
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

class Stream {

    constructor(vals) {
        this.i = 0;
        this.vals = vals;
    }

    next() {
        return this.vals[this.i+1];
    }

    hasNext() {
        return this.vals.length > (this.i+1);
    }

    getIndex() {
        return this.i;
    }

}


class TokenDict {

    constructor() {
        this.d = {};
    }

    keys() {
        return Object.keys(this.d);
    }

    init(t) {
        this.d[t] = null;
    }

    numKeys() {
        return this.keys().length;
    }

    values() {
        let v = this.keys().map(x => { return this.d[x]}).filter( x => { return x !== null; });
        return v;
    }

    hasKey(k) {
        return this.keys().indexOf(k) >= 0;
    }

    hasValue(v) {
        return this.values().indexOf(v) >= 0;
    }

    add(k, v="EMPTY") {
        if (this.hasKey(k)) {
            if (this.d[k] === null) {
                this.d[k] = v;
            } else if (v !== this.d[k]) {
                return false;
            }
        }
        return true;
    }

    get(k) {
        return this.d[k];
    }

    isNull(key) {
        return this.d[key] === null;
    }

    clear() {
        this.d = {};
    }

}


class MatchFunction {

    constructor(patternString) {
        const TOKEN_SEP = " ";
        this.tokenDict = new TokenDict();
        this.tokens = patternString.split(TOKEN_SEP);
        this.uniqueTokens = this.getUniqueTokensInOrder(this.tokens);
        this.uniqueTokens.forEach(t => {this.tokenDict.init(t);});
    }

    getUniqueTokensInOrder(toks) {
        return toks.reduce( (p, c) => {
            if (p.indexOf(c) < 0) {
                p.push(c);
            }
            return p;
        }, []);
    }

    getVarFromVal(val) {
        return this.tokenDict.keys().filter( k => {
            return this.tokenDict.get(k) === val;
        })[0];
    }

    reset() {
        this.tokenDict.clear();
        this.uniqueTokens.forEach(t => {this.tokenDict.init(t);});
    }

    run(seq) {
        let canBeAMatch = true;
        let i=-1;
        let matchedVals = [];
        while (canBeAMatch) {
            i++;
            if (i>=seq.length || i>=this.tokens.length) {
                canBeAMatch = false;
                break;
            }
            let currentVar = this.tokens[i];
            let currentVal = seq[i];
            let varIsAlreadyAssigned = !this.tokenDict.isNull(currentVar);
            let valAlreadyExists = this.tokenDict.values().indexOf(currentVal) >= 0;
            if (varIsAlreadyAssigned) {
                let assignedVal = this.tokenDict.get(currentVar);
                if (assignedVal !== currentVal) {
                    canBeAMatch = false;
                    break;
                }
            } else if (valAlreadyExists) {
                let assignedVar = this.getVarFromVal(currentVal);
                if (assignedVar !== currentVar) {
                    canBeAMatch = false;
                    break;
                }
            } else {
                this.tokenDict.add(currentVar, currentVal);
            }
            // if we get here, the current val is a match with the current var
            matchedVals.push(currentVal);
            if (matchedVals.length === this.tokens.length) {
                break;
            }
        }
        this.reset();
        return canBeAMatch?matchedVals:[];
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

function test2() {
    const mf = new MatchFunction("X X Y X");
    console.log(mf.run([1, 1, 1, 1]));
    console.log(mf.run([1, 1, 3, 1, 3]));
    console,log(mf.run(["a","b","c","d"]));
    console.log(mf.run([0,0,1]));
    console.log(mf.run([0,1,1,0,1]));
    console.log(mf.run(["a","a","b","a","a"]))
}


//test2();
module.exports.Matcher = Matcher;
