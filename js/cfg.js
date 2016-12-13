/**
 * Created by mwagy on 12/12/16.
 */

class Util {
    static randomChoice(array) {
        return array[Math.floor(Math.random()*array.length)];
    }
}

class Symbol {

    constructor(val, isTerminal) {
        this.val = this.clean(val)
        this.isTerminal = isTerminal;
        this.uid = Symbol.getUID();
    }

    toString() {
        return this.val;
    }

    static getUID() {
        Symbol._uid += 1;
        return Symbol._uid;
    }

    clean(sym) {
        return sym.replace("'", "");
    }

    clone() {
        return new Symbol(this.val, this.isTerminal)
    }

    equals(other) {
        return this.val == other.val;
    }

}

Symbol._uid = 0;


class Rule {

    constructor(lhsval, rhsval) {
        this.lhs = lhsval;
        this.rhs = rhsval;
    }

    toString() {
        const rhsvals = this.rhs.map( (s) => { return s.toString(); });
        return `${this.lhs} -> ${rhsvals}`;
    }

}

class CFG {

    constructor() {
        this.rules = [];
    }

    toString() {
        let s = "GRAMMAR:\n";
        this.rules.forEach( (r) => { s += r.toString() + "\n"; });
        return s;
    }

    getNext(lhs) {
        const matches = this.match(lhs);
        return matches.map( (x) => {
            if (x.isTerminal) {
                return x;
            }
            return this.getNext(x);
        })
    }

    match(lhs) {
        if (lhs.isTerminal) {
            return lhs;
        }
        const orRules = this.rules.filter( (r) => { return r.lhs === lhs.val; });
        if (orRules.length === 0) {
            throw "CannotFindRules";
        }
        return Util.randomChoice(orRules);
    }

    addRule(lhs, rhs) {
        this.rules.push(new Rule(lhs, rhs));
    }

    clone() {
        let rtn = new CFG();
        rtn.rules = this.rules.map( (r) => {
            return new Rule(r.lhs, r.rhs.slice(0));
        });
        return rtn;
    }

    equals(otherCFG) {
        if (otherCFG.rules.length !== this.rules.length) {
            return false;
        }
        let otherRulesSrt = otherCFG.rules.sort();
        let thisRulesSrt = this.rules.sort();
        let lhsElementsEqual = otherRulesSrt.map( (r, i) => {
                return r.lhs === thisRulesSrt[i].lhs;
            });
        if (otherRulesSrt.some( (r, i) => { return r.lhs !== thisRulesSrt[i].lhs;})) {
            return false;
        }
        let areEqual = true;
        otherRulesSrt.forEach( (otherRule, i) => {
            let thisRule = thisRulesSrt[i];
            if (otherRule.rhs.length !== thisRule.rhs.length) {
                areEqual = false;
                return;
            }
            otherRule.rhs.forEach( (otherRHSVal, i) => {
                let thisRHSVal = thisRule.rhs[i];
                if (!thisRHSVal.equals(otherRHSVal)) {
                    areEqual = false;
                    return;
                }
            })
        });
        return areEqual;
    }

    static getUID() {
        CFG._uid += 1;
        return CFG._uid;
    }

}

CFG.START_SYMBOL = '_S_';
CFG.OR_SEP = '|';
CFG.SYMBOL_SEP = ' ';
CFG.LHS_RHS_SEP = '->';
CFG._uid = 0;


function main() {
    const cfg = new CFG();
}

//main();
module.exports.CFG = CFG;
module.exports.Symbol = Symbol;
module.exports.Rule = Rule;