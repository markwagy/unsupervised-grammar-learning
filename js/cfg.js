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
        this.val = this.clean(val);
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

    shuffleRules() {
        this.rules.sort( (a, b) => {
            return 0.5 - Math.random();
        })
    }

    getMatch(lhs) {
        this.shuffleRules();
        return this.rules.filter( (x) => {
            return x.lhs === lhs;
        })[0];
    }

    generateTreeHelper(sym, parent) {
        let tree = {
            "name": sym.val,
            "parent": parent
        };
        if (!sym.isTerminal) {
            tree['children'] = this.getMatch(sym.val).rhs.map( (r) => {
                return this.generateTreeHelper(r, sym.val)
            });
        }
        return tree;
    }

    generateTree() {
        return this.generateTreeHelper(new Symbol(CFG.START_SYMBOL, false), null);
    }

    generate() {
        let sententialForm = [new Symbol(CFG.START_SYMBOL, false)];

        while(sententialForm.some( (x) => {return !x.isTerminal} )) {

            sententialForm = sententialForm.reduce( (p, c) => {
                if (c.isTerminal) {
                    p.push(c);
                } else {
                    let matchSym = this.getMatch(c.val);
                    p = p.concat(matchSym.rhs);
                }
                return p;
            }, []);

        }
        return sententialForm;
    }

    static getUID() {
        CFG._uid += 1;
        return CFG._uid;
    }

    static terminalsToString(termslist) {
        return termslist.reduce( (p, c) => {
            return p + CFG.SYMBOL_SEP + c.val;
        });
    }

}

CFG.START_SYMBOL = '_S_';
CFG.OR_SEP = '|';
CFG.SYMBOL_SEP = ' ';
CFG.LHS_RHS_SEP = '->';
CFG._uid = 0;


function main() {
    const cfg = new CFG();
    cfg.addRule(CFG.START_SYMBOL, "NP VP".split(" ").map( (x) => { return new Symbol(x,false);}));
    cfg.addRule("NP", [new Symbol("N", false)]);
    cfg.addRule("NP", [new Symbol("the", true), new Symbol("N", false)]);
    cfg.addRule("NP", [new Symbol("the", true), new Symbol("A", false), new Symbol("N", false)]);
    cfg.addRule("N", [new Symbol("tree", true)]);
    cfg.addRule("N", [new Symbol("dog", true)]);
    cfg.addRule("N", [new Symbol("Bill", true)]);
    cfg.addRule("N", [new Symbol("woman", true)]);
    cfg.addRule("N", [new Symbol("man", true)]);
    cfg.addRule("VP", [new Symbol("V", false)]);
    cfg.addRule("V", [new Symbol("ran", true)]);
    cfg.addRule("V", [new Symbol("jumped", true)]);
    cfg.addRule("V", [new Symbol("ate", true)]);
    cfg.addRule("V", [new Symbol("walked", true)]);
    cfg.addRule("V", [new Symbol("fell", true)]);
    cfg.addRule("VP", [new Symbol("V", false), new Symbol("P", false), new Symbol("NP", false)]);
    cfg.addRule("P", [new Symbol("on", true)]);
    cfg.addRule("P", [new Symbol("over", true)]);
    cfg.addRule("P", [new Symbol("above", true)]);
    cfg.addRule("P", [new Symbol("under", true)]);
    cfg.addRule("A", [new Symbol("red", true)]);
    cfg.addRule("A", [new Symbol("ugly", true)]);
    cfg.addRule("A", [new Symbol("sophisticated", true)]);
    cfg.addRule("A", [new Symbol("inconvenient", true)]);
    console.log(cfg.toString());
    console.log(CFG.terminalsToString(cfg.generate()));
    let tree = cfg.generateTree();
    console.log(JSON.stringify(tree, null, 2));
}

//main();

module.exports.CFG = CFG;
module.exports.Symbol = Symbol;
module.exports.Rule = Rule;

