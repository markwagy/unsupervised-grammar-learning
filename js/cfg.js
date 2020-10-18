/**
 * Created by mwagy on 12/12/16.
 */

var fs = require('fs');

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
        return new Symbol(this.val, this.isTerminal);
    }

    equals(other) {
        return this.val == other.val;
    }

    static isTerminalSym(val) {
        // non-terminal is defined by underscores surrounding the symbol
        let trimval = val.trim();
        let spl = trimval.split("");
        return  !(spl[0] === "_" && spl[spl.length-1] === "_");
    }


}

Symbol._uid = 0;


class Rule {

    constructor(lhsval, rhsval) {
        this.lhs = lhsval;
        this.rhs = rhsval;
        this.uid = Rule.getUID();
    }

    toString() {
        const rhsvals = this.rhs.map( (s) => { return s.toString(); });
        return `${this.lhs} -> ${rhsvals}`;
    }

    static getUID() {
        Rule.num++;
        return "_" + Rule.num + "_";
    }

    static equals(r1, r2) {
        return r1.lhs === r2.lhs && r1.rhs.every( (s, i) => {
                return s.equals(r2.rhs[i]);
            });
    }

}
Rule.num = 0;


class GrammarCoords {

    constructor(ruleId, startIdx, endIdx) {
        this.ruleId = ruleId;
        this.startIdx = startIdx;
        this.endIdx = endIdx;
    }

    toString() {
        return `${this.ruleId}(${this.startIdx},${this.endIdx})`;
    }

    static overlap(gc1, gc2) {
        if (gc1.ruleId !== gc2.ruleId) {
            // they can't overlap if they aren't in the same rule
            return false;
        }
        let start1 = gc1.startIdx,
            start2 = gc2.startIdx;
        let end1 = gc1.endIdx,
            end2 = gc2.endIdx;
        let overlaps1 = start1 >= start2 && start1 <= end2 || end1 >= start2 && end1 <= end2;
        let overlaps2 = start2 >= start1 && start2 <= end1 || end2 >= start1 && end2 <= end1;
        return overlaps1 || overlaps2;
    }
}

class CFG {

    constructor() {
        this.rules = [];
    }

    getByCoords(ruleID, startIdx, endIdx) {
        let rule = this.rules.filter(r => {
            return r.uid === ruleID;
        })[0];
        return rule.lhs.slice(startIdx, endIdx+1);
    }

    toString() {
        let s = "GRAMMAR:\n";
        this.rules.forEach( (r) => { s += r.toString() + "\n"; });
        return s;
    }

    toJSON(filename) {
        let contents = this.rules;
        fs.writeFileSync(filename, JSON.stringify(contents, null, 2));
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

    replaceRule(newRule) {
        let didReplace = false;
        let newRules = this.rules.map(r => {
            if (r.lhs === newRule.lhs) {
                didReplace = true;
                return newRule;
            } else {
                return r;
            }
        });
        if (!didReplace) {
            throw "ErrorReplaceRules";
        }
        this.rules = newRules;
    }

    // replace all instances of symOld in RHS's of all rules with symNew
    replaceAll(symOld, symNew) {
        this.rules = this.rules.map(r => {
            r.rhs = r.rhs.map(s => {
                if (s === symOld) {
                    return symNew;
                } else {
                    return s;
                }
            });
            return r;
        });
    }

    removeRule(rule) {
        this.rules = this.rules.filter(r => {
            return ! Rule.equals(r, rule);
        });
    }

    // remove redundant rules and those with a single symbol on the RHS
    cleanUpRules() {

        // i.e. those with a single element in their RHS. UPDATE: this is the way we have OR rules... so not removing them
        /*
        let isTrivial = r => {
            return r.rhs.length === 1;
        };
        // separate out trivial rules and eliminate from grammar
        let trivialRules = this.rules.filter(r => { return isTrivial(r)});
        this.rules = this.rules.filter(r => {
            return !isTrivial(r);
        });
        // then replace all trivial rule LHS vals in RHS of valid rules with their RHS
        trivialRules.forEach(r => {
            if (r.rhs.length > 1) {
                throw "NonTrivialRuleReplacement";
            }
            this.replaceAll(r.lhs, r.rhs[0]);
        });
        */

        // remove redundant rules
        let getRHSKey =  (seq) => {
            return seq.reduce( (p, c) => {
                return p + "-" + c.val;
            }, "");
        };
        let ruleDupes = {};
        this.rules.forEach(r => {
            let k = getRHSKey(r.rhs);
            if (Object.keys(ruleDupes).indexOf(k) < 0) {
                ruleDupes[k] = {};
                ruleDupes[k].dupes = []; // the list of rules we will replace with the representative
                ruleDupes[k].rep = r; // the chosen representative rule
            } else {
                ruleDupes[k].dupes.push(r);
            }
        });
        // TODO: now process the rule dupes: replace each rule on the dupe list with the representative
        let dupeArr = Object.keys(ruleDupes).reduce( (p, c) => {
            if (ruleDupes[c].dupes.length > 0) {
                p.push(ruleDupes[c]);
            }
            return p;
        }, []);
        dupeArr.forEach(da => {
            let rep = da.rep;
            da.dupes.forEach(d => {
                this.replaceAll(d.lhs, rep.lhs);
                this.removeRule(d);
            });
        });
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
    Array.apply(null, {length:10}).forEach(() => {
        console.log(CFG.terminalsToString(cfg.generate()));
    });
    let tree = cfg.generateTree();
    console.log(JSON.stringify(tree, null, 2));
}


//main();
module.exports.CFG = CFG;
module.exports.Symbol = Symbol;
module.exports.Rule = Rule;
module.exports.GrammarCoords = GrammarCoords;

