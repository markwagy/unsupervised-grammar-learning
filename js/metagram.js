/* MetaGrammar code */

//const redis = require('redis'),
//	  client = redis.createClient();
const md5 = require('md5');
const fs = require('fs');
const matcher = require('./matcher.js');
const cfg = require("./cfg.js");

/*
const redis = require('redis'), client = redis.createClient();

client.on("error", (error) => {
	console.err("Error with redis client: " + err)
});
*/

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

class MatchRecord {

	constructor(sequence) {
		this.key = MatchRecord.getKey(sequence);
		this.counts = 1;
		this.uid = null;
		this.hasFiredBefore = false;
	}

	fires() {
		return this.counts > 1;
	}

	hasFired() {
		return this.hasFiredBefore;
	}

	incrementCount() {
		this.counts++;
	}

	attachUID() {
		this.uid = MatchRecord.UID;
		this.hasFiredBefore = true;
	}

	static getKey(sequence) {
		return sequence.reduce( (p, c) => {
			return p + "." + c;
		});
	}

	static get UID() {
		if (MatchRecord.charIdx > LETTERS.length) {
			MatchRecord.charIdx = 0;
			MatchRecord.num++;
		}
		return LETTERS[MatchRecord.charIdx] + MatchRecord.num;
	}

}
MatchRecord.charIdx = 0;
MatchRecord.num = 0;


class MetaGram {

	constructor(dataFileName) {
		this.dataFileName = dataFileName;
		this.currentGrammar = new cfg.CFG();
		this.nextGrammar = new cfg.CFG();
		this.initializeStartRules();
		// TODO probably want to generalize to multiple matchers that are randomly generated
		this.matcher = new matcher.Matcher("X Y; X Y X;");
		this.matchRecords = [];
	}

	pullMatchRecord(sequence) {
		const mrKey = MatchRecord.getKey(sequence);
		const matchedRecords = this.matchRecords.filter( (mr) => {
                return mr.key === mrKey;
            });
		let match = matchedRecords.length === 0 ? new MatchRecord(sequence) : matchedRecords[0];
		if (matchedRecords.length === 0) {
			this.matchRecords.push(match);
		} else {
			matchedRecords[0].incrementCount();
		}
		return match;
	}

	initializeStartRules() {
        const lines = fs.readFileSync(this.dataFileName, 'utf8').split("\n");
        const cleanedLines = lines.map( (x) => { return MetaGram.cleanLine(x); });
        cleanedLines.forEach( (x) => {
        	const rhs = x.split(cfg.CFG.SYMBOL_SEP).map( (x) => {
				return new cfg.Symbol(x, true);
			});
            this.currentGrammar.addRule(cfg.CFG.START_SYMBOL, rhs);
		})
	}

	static cleanLine(txtLine) {
		return txtLine.replace("[^\w\s.!?]", "");
	}

	addNewNextRule(matchRecord, matchSequence, currRHS) {
        matchRecord.attachUID();
        const matchLHS = matchRecord.uid;
        const matchSym = new cfg.Symbol(matchLHS, false);
        // pull RHS from the actual sequence to get Symbols rather than just values
        const matchRHS = currRHS.slice(0, matchSequence.length);
        this.nextGrammar.addRule(matchLHS, matchRHS);
        return matchSym;
	}

	getUpdatedRHS(rhs) {
		let newRHS = [];
		let i = 0;
        while (i < rhs.length) {
            const currRHS = rhs.slice(i);
            const matchSequence = this.matcher.match(currRHS);
            if (matchSequence.length === 0) {
                newRHS.push(rhs[i].clone());
                i++;
                continue;
            }
            const matchRecord = this.pullMatchRecord(matchSequence);
            if (matchRecord.fires()) {
            	let hasFired = matchRecord.hasFired();
            	let newSym = hasFired ? new cfg.Symbol(matchRecord.uid, false) : this.addNewNextRule(matchRecord, matchSequence, currRHS);
				newRHS.push(newSym);
                i += matchSequence.length;
			} else {
                newRHS.push(rhs[i].clone());
                i++;
            }
        }
        return newRHS;
    }

    resetMatchRecords() {
		this.matchRecords = [];
	}

	swapGrammars() {
		this.currentGrammar = this.nextGrammar.clone();
		this.nextGrammar = new cfg.CFG();
	}

	buildNextGrammar() {
        this.currentGrammar.rules.forEach( (r) => {
            const updatedRHS = this.getUpdatedRHS(r.rhs);
            this.nextGrammar.addRule(r.lhs, updatedRHS);
        } );
	}

	showCurrentGrammar() {
		console.log(this.currentGrammar.toString());
	}

	showNextGrammar() {
		console.log(this.nextGrammar.toString());
	}

	report() {
		this.showCurrentGrammar();
		this.showNextGrammar();
	}

	grammarIsChanging() {
		return !this.nextGrammar.equals(this.currentGrammar);
	}

	run() {
		let grammarIteration = 1;
		while(this.grammarIsChanging()) {
			console.log("Grammar iteration " + grammarIteration);
            this.buildNextGrammar();
            this.report();
            this.swapGrammars();
            this.resetMatchRecords();
            grammarIteration++;
        }
	}

}


function main() {
	const mg = new MetaGram("nmw.txt");
	mg.run();
}

main();
