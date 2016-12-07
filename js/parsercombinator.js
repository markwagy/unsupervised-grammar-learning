
// see http://theorangeduck.com/page/you-could-have-invented-parser-combinators

const PEG = require('pegjs');


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
	matchLambda(sequence) {
	    // TODO
        return;
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

	buildFromPEGDefinition(pcDef) {
        // this is where we'll create the actual parsers to use in the combinator
        /*
        this.parser = this.or(pcDef.map((pattern) => {
            this.matchSequence(pattern);
        }));
        */
    }

    matchSingle(c) {
	    let self = this;
        return (function (input) {
            const r = self.inputRead(input);
            if (r == c) {
                self.inputAdvance();
                return c;
            } else {
                return self.failure;
            }
        });
    }

    matchOr(...parsers) {

	    let self = this;

        return (function (input) {
            const results = parsers.map( (parser) => {
                return parser(input);
            }).filter( (result) => {
                return result !== self.failure;
            });
            if (results.length > 0) {
                return results;
            } else {
                return self.failure;
            }
        });
    }

    matchSequence(...parsers) {

	    let self = this;

        return (function (input) {
            const pos = self.inputGetIndex();
            if (pos > input.length) {
                return self.failure;
            }
            const results = parsers.map( (parser) => {
                let result = parser(input);
                if (result === self.failure) {
                    this.inputSetIndex(pos);
                    return self.failure;
                }
                return result;
            });
            if (!results.every((x) => {
                    return x !== self.failure;
                })) {
                this.inputSet(pos);
                return self.failure;
            }
            return results;
        });
    }

}

/*
const seq = "babc";
let idx = 0;
let failure = false;

function inputRead(input) {
    return input[idx];
}

function inputAdvance(input, howmuch) {
    idx += howmuch;
}

function inputReset() {
    idx = 0;
}

function inputGet() {
    return idx;
}

function inputSet(val) {
    idx = val;
}


let singleMatch = function(c) {

    return (function(input) {
        const r = inputRead(input);
        if (r == c) {
            inputAdvance(input, 1);
            return c;
        } else {
            return failure;
        }
    });

};


function or(...parsers) {

    return (function(input) {
        const results = parsers.map( (parser) => {
            return parser(input);
        }).filter( (result) => {
            return result !== false;
        });
        if (results.length > 0) {
            return results;
        } else {
            return false;
        }
    });

}


function seqmatch(...parsers) {

    return (function (input) {
        const pos = inputGet(input);
        if (pos > input.length) {
            return false;
        }
        const results = parsers.map( (parser) => {
            let result = parser(input);
            if (result === false) { inputSet(pos); return false; }
            return result;
        });
        if (!results.every( (x) => { return x !== false; })) {
            inputSet(pos);
            return false;
        }
        return results;
    });

}
*/

function main() {
/*
	//var parser = singleMatch('a');
	const parser = or(singleMatch('a'), singleMatch('b'));
	const result1 = parser(seq);
    console.log("result1 " +  result1);

    inputReset();
	const parser2 = seqmatch(singleMatch('a'), singleMatch('b'));
	const result2 = parser2(seq);
    console.log("result2 " +  result2);

    inputReset();
    const parser3 = or(
    	seqmatch(singleMatch('a'), singleMatch('b')),
		seqmatch(singleMatch('b'), singleMatch('a')));
	const result3 = parser3(seq);
	console.log("result3: " + result3);

	inputReset();
	const parser4 = seqmatch(singleMatch('b'), singleMatch('a'), singleMatch('b'));
    const result4 = parser4(seq);
	console.log("result4: " + result4);
*/
    const seq = "babc";
    const pc = new ParserCombinator("a b;");
    const parser = pc.matchOr(pc.matchSingle('a'), pc.matchSingle('b'));
    console.log(parser("ab"));
    console.log(parser("ba"));

}

main();
//module.exports.ParserCombinator = ParserCombinator;

