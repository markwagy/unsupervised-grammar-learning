
// see http://theorangeduck.com/page/you-could-have-invented-parser-combinators

const PEG = require('pegjs');


const VERBOSE = true;

function log(msg) {
    if (VERBOSE) console.log(msg);
}

PC_DEF_GRAMMAR = `

start = expression+

validchar = [0-9a-zA-Z]

atom = chars:validchar+ {
    return chars.join("");
}

space = " "

termsep = space* ";" space*

orsep = space* "|" space*

oritem = space* x:atom orsep y:atom space* { 
		return [{'tag': 'var', 'val': x}, {'tag':'var', 'val': y}]; 
    }

item = x:oritem { return {'tag': 'or', 'val': x}; } / space* x:atom space* {
    return {'tag': 'var', 'val': x};
}

items = x:item+ {
			   return x;
		}

expression = x:items+ termsep { return x[0]; }

`;

class ParserCombinator {

	constructor(pcDefString) {
		this.interpret(pcDefString);
		this.inputIndex = 0;
		//this.sequence = [];
        this.failure = false;
	}

	interpret(pcDefString) {
		const pcparser = PEG.generate(PC_DEF_GRAMMAR);
		const pcDef = pcparser.parse(pcDefString);
		this.buildFromPEGDefinition(pcDef);
	}

	// this returns a function that matches or not according to this parser combinator instance
    getMatchLambda() {
        return this.matchLambda;
    }

    inputAdvance() {
        this.inputIndex++;
    }

    inputRead(input) {
        return input[this.inputIndex];
    }

    inputGetIndex() {
        return this.inputIndex;
    }

    inputSetIndex(idxval) {
        this.inputIndex = idxval;
    }

    inputResetIndex() {
        this.inputIndex = 0;
    }

    static dedupe(vals) {
        let uniq = [];
        vals.forEach(x => { if (uniq.indexOf(x) < 0)
            uniq.push(x);
        })
        return uniq;
    }

    static flatten(arr) {
	    let self = this;
        return arr.reduce(function (flat, toFlatten) {
            return flat.concat(Array.isArray(toFlatten) ? self.flatten(toFlatten) : toFlatten);
        }, []);
    }

    static getUniqueVars(pcDef) {
	    if (pcDef.tag === "var") {
	        return pcDef.val;
        } else if (pcDef.tag === "or") {
            return pcDef.vals.map( x => ParserCombinator.getUniqueVars(x));
        }
        let vals = pcDef.map( x => ParserCombinator.getUniqueVars(x));
	    vals = ParserCombinator.flatten(vals);
	    return ParserCombinator.dedupe(vals);
    }

    constructFunctionDef(pcDef) {
	    if (pcDef.tag === "var") {
            return new Function(pcDef.val, `pc.matchSingle(${obj.val})`);
        } else if (pcDef.tag === "or") {
	        const orfuncs = pcDef.vals.reduce( (p,c) => {
	            return constructFunctionDef() + ",";
            });
            return new Function("...parsers", `pc.matchOr(${orfuncs})`)
        }
    }

	buildFromPEGDefinition(pcDef) {
        // TODO construct the appropriate parser combinator based on the pcDef
        this.matchLambda = function (x,y) {
            return pc.matchSequence(
                pc.matchOr(
                    pc.matchSingle(x),
                    pc.matchSingle(y)
                ),
                pc.matchSingle(x)
            )
        };
    }

    matchSingle(c) {
	    let self = this;
        return (function (input) {
            const r = self.inputRead(input);
            if (r == c) {
                self.inputAdvance();
                log(`    ${r}(i) == ${c} ? Y`);
                return c;
            } else {
                log(`    ${r}(i) == ${c} ? N`);
                return self.failure;
            }
        });
    }

    matchOr(...parsers) {
	    let self = this;
        return (function (input) {
            log("   or {");
            const results = parsers.map( (parser) => {
                return parser(input);
            }).filter( (result) => {
                return result !== self.failure;
            });
            if (results.length > 0) {
                // arbitrarily choosing the first matched or element.
                // TODO: think this over
                log("   } or");
                return results[0];
            } else {
                log("   } or");
                return self.failure;
            }
        });
    }

    matchSequence(...parsers) {
	    let self = this;
        return (function (input) {
            log("   seq {");
            const pos = self.inputGetIndex();
            if (pos > input.length) {
                log("   } seq");
                return self.failure;
            }
            const results = parsers.map( (parser) => {
                let result = parser(input);
                if (result === self.failure) {
                    self.inputSetIndex(pos);
                    return self.failure;
                }
                return result;
            });
            if (!results.every((x) => {
                    return x !== self.failure;
                })) {
                self.inputSetIndex(pos);
                log("   } seq");
                return self.failure;
            }
            log("   } seq");
            return results;
        });
    }

}


function main() {

    const pc = new ParserCombinator("a;");
    const parser = pc.matchSequence(
        pc.matchOr(
            pc.matchSingle('a'),
            pc.matchSingle('b')
        ),
        pc.matchSingle('c')
    );

    const parserparser = function (x,y) {
        return pc.matchSequence(
            pc.matchOr(
                pc.matchSingle(x),
                pc.matchSingle(y)
            ),
        pc.matchSingle(x)
        )
    };
    console.log("a|b c;");
    console.log(parser("bd"));

    pc.inputResetIndex();
    console.log("PARSERPARSER");
    console.log("a|b a;");
    const pp = parserparser('a','b');
    const res = pp("bd");
    console.log(res);
    //pc.inputResetIndex();
    //console.log("ba");
    //console.log(parser("ba")('a','b','z'));
    console.log(ParserCombinator.flatten([[1,2],3,[4,[5,6]]]));
    const uniqueVals = ParserCombinator.getUniqueVars([[{"tag": "var", "val": "x"}], [{"tag":"or", "vals":[{"tag":"var","val":"z"},{"tag":"var","val":"y"}]}]])
    console.log(uniqueVals);
}

main();
//module.exports.ParserCombinator = ParserCombinator;

