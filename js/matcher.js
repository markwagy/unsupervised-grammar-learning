
const PEG = require('pegjs');
const fs = require('fs');

const PEG_DEF_FILE = "parserdef.peg";
const WILDCARD = "*";
const TOKEN_SEP = " ";

function log(msg) {
    console.log(msg);
}


class MatchObj {

    constructor(matchArray, wild) {
        this.vals = matchArray;
        this.wild = wild || [];
    }

    get length() {
        return this.vals.length;
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

    values() {
        let v = this.keys().map(x => { return this.d[x]}).filter( x => { return x !== null; });
        return v;
    }

    hasKey(k) {
        return this.keys().indexOf(k) >= 0;
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
        this.tokenDict = new TokenDict();
        this.tokens = patternString.split(TOKEN_SEP);
        this.uniqueTokens = this.getUniqueTokensInOrder(this.tokens);
        this.uniqueTokens.forEach(t => {this.tokenDict.init(t);});
        this.wild = [];
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
            if (i >= seq.length || i >= this.tokens.length) {
                canBeAMatch = false;
                break;
            }
            let currentVar = this.tokens[i];
            let currentVal = seq[i];
            let varIsAlreadyAssigned = !this.tokenDict.isNull(currentVar);
            let varIsWildcard = currentVar === WILDCARD;
            let valAlreadyExists = this.tokenDict.values().indexOf(currentVal) >= 0;
            if (varIsWildcard) {
                this.wild.push(currentVal);
            } else if (varIsAlreadyAssigned) {
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
        //const pegdefstr = fs.readFileSync(PEG_DEF_FILE, "utf-8");
        //const pegdef = PEG.generate(pegdefstr);
        //this.parseobj = pegdef.parse(this.patternString);
        //const fstr = this.parseobj.funcstr;
        //this.parserFunc = eval(fstr);
        this.parserFunc = new MatchFunction(this.patternString);
    }

    toString() {
        return patternString;
    }

    match(patternArray) {
        const matchvals = this.parserFunc.run(patternArray);
        if (matchvals.length > 0) {
            let wild = matchvals.filter( (v, i) => {
                return this.patternString.split(TOKEN_SEP)[i]===WILDCARD;
            });
            return new MatchObj(matchvals, wild);
        }
    }

    static getMatchers(matchPatternString) {
        let mps = matchPatternString.split(';').filter(x => { return x.length > 0; });
        return mps.map( (mp) => {
            return new Matcher(mp);
        });
    }

}

function test1() {

    log("matcher 1");
    const matcher = new Matcher("X Y X");
    log(matcher.match([1, 1]));
    log(matcher.match([1, 2]));
    log(matcher.match([1, 2, 1]));
    log(matcher.match([1, 2, 4]));
    log(matcher.match([1]));

    log("matcher 2");
    const m2 = new Matcher("X X");
    log(m2.match([1, 1]));
    log(m2.match([1, 2, 3]));
    log(m2.match([2, 2]));

    log("matcher 3");
    const m3 = new Matcher("X *");
    log(m3.match([1, 1]));
    log(m3.match([1, 2, 3]));
    log(m3.match([1, 2]));

}


test1();
module.exports.Matcher = Matcher;
