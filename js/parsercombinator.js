
// see http://theorangeduck.com/page/you-could-have-invented-parser-combinators
const PEG = require('pegjs');
const fs = require('fs');


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
		this.sequenceIndex = 0;
		this.sequence = [];
        this.failure = false;
	}

	interpret(pcDefString) {
		const pcparser = PEG.generate(PC_DEF_GRAMMAR);
		const pcDef = pcparser.parse(pcDefString);
		this.buildFromPEGDefinition(pcDef);
	}

	consumeSequence(sequence) {
        this.sequenceReset();
        this.sequence = Array.from(sequence); // copy
    }

    inputAdvance(howMuch) {
        this.sequenceIndex += howMuch;
    }

    inputRead() {
        return this.sequence[this.sequenceIndex];
    }

    inputGet() {
        return this.sequenceIndex;
    }

    inputSet(val) {
        this.sequenceIndex = val;
    }

    sequenceReset() {
        this.sequenceIndex = 0;
    }

	buildFromPEGDefinition(pcDef) {
        // this is where we'll create the actual parsers to use in the combinator
        this.parser = this.or(pcDef.map((pattern) => {
            this.seqmatch(pattern);
        }));
    }

    singleMatch(c) {
        return (function (input) {
            const r = this.inputRead(input);
            if (r == c) {
                this.inputAdvance(input, 1);
                return c;
            } else {
                return this.failure;
            }
        });
    }

    or(...parsers) {
        return (function (input) {
            const results = parsers.map((parser) => {
                return parser(input);
            }).filter((result) => {
                return result !== this.failure;
            });
            if (results.length > 0) {
                return results;
            } else {
                return this.failure;
            }
        });
    }

    seqmatch(...parsers) {
        return (function (input) {
            const pos = this.inputGet(input);
            if (pos > input.length) {
                return this.failure;
            }
            const results = parsers.map((parser) => {
                let result = parser(input);
                if (result === this.failure) {
                    this.inputSet(pos);
                    return this.failure;
                }
                return result;
            });
            if (!results.every((x) => {
                    return x !== this.failure;
                })) {
                this.inputSet(pos);
                return this.failure;
            }
            return results;
        });
    }

}


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

/*
function ori(parser0, parser1) {

    return (function (input) {
        var result0 = parser0(input);
        if (result0 != failure) { return result0; }
        var result1 = parser1(input);
        if (result1 != failure) { return result1; }
        return failure;
    });

}
*/

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

/*
function and(parser0, parser1) {

    return (function (input) {
        var pos = inputGet(input);
        var result0 = parser0(input);
        if (result0 == failure) { inputSet(pos); return failure; }
        var result1 = parser1(input);
        if (result1 == failure) { inputSet(pos); return failure; }
        return [result0, result1];
    });

}
*/

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

function main() {

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

	inputReset();
	const metaparser = seqmatch(singlematch, singlematch, singlematch);
	const result4 = metaparser()

}

main();
//module.exports.ParserCombinator = ParserCombinator;

