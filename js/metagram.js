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
		this.originalSequence = sequence;
	}

	fires() {
		return this.counts > 1;
	}

	incrementCount() {
		this.counts++;
	}

	getOriginalSequence() {
	    return this.originalSequence;
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
		if (MatchRecord.charIdx >= LETTERS.length) {
			MatchRecord.charIdx = 0;
			MatchRecord.num++;
		}
		let rtn = LETTERS[MatchRecord.charIdx] + MatchRecord.num;
		MatchRecord.charIdx++;
		return rtn;
	}

}
MatchRecord.charIdx = 0;
MatchRecord.num = 0;


class MetaGram {

	constructor(dataFileName, matchPattern, startRulesSplitter="\n") {
		this.dataFileName = dataFileName;
		this.currentGrammar = new cfg.CFG();
		this.nextGrammar = new cfg.CFG();
		this.initializeStartRules(startRulesSplitter);
		this.matcher = new matcher.Matcher(matchPattern);
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

	initializeStartRules(startRulesSplitter) {
        const lines = fs.readFileSync(this.dataFileName, 'utf8').split(startRulesSplitter);
        const cleanedLines = lines.map( (x) => {
            return MetaGram.cleanLine(x);
        }).filter( (x) => { return x.length > 0; });
        cleanedLines.forEach( (x) => {
        	const rhs = x.split(cfg.CFG.SYMBOL_SEP).filter( (x) => {
        	    return x!==undefined && x.length > 0;
            }).map( (x) => {
				return new cfg.Symbol(x, true);
			});
            this.currentGrammar.addRule(cfg.CFG.START_SYMBOL, rhs);
		});
	}

	static cleanLine(txtLine) {
		return txtLine.replace("[^\w\s.!?]", "");
	}

	addNewRuleToNextGrammar(matchRecord, matchSequence, currRHS) {
        matchRecord.attachUID();
        const matchLHS = matchRecord.uid;
        const matchSym = new cfg.Symbol(matchLHS, false);
        // pull RHS from the actual sequence to get Symbols rather than just values
        const matchRHS = currRHS.slice(0, matchSequence.length);
        this.nextGrammar.addRule(matchLHS, matchRHS);
        return matchSym;
	}

	getExistingRuleMatches(sequence) {
        // get all rules for which this sequence fully matches the RHS
		return this.currentGrammar.rules.filter( (r) => {
            // ensure it doesn't match the start rule
			if (r.lhs === cfg.CFG.START_SYMBOL) {
				return false;
			}
			return r.rhs.slice(0, sequence.length).map( (s, i) => {
				return s.equals(sequence[i]);
			}).every( (x) => { return x; });
		});
	}

	static sequencesOverlap(seq1, seq2) {
	    let getids = (x) => { return x.uid; };
	    let seq2ids = seq2.map(getids);
	    let seq1ids = seq1.map(getids);
	    return seq1ids.some( (uid) => {
	        return seq2ids.indexOf(uid) >= 0;
        });
    }

	getUpdatedRHS(rhs) {
		let newRHS = [];
		let i = 0;
        while (i < rhs.length) {
            const currRHS = rhs.slice(i);
            // TODO: test check for match on existing rule RHS values here
			let existingRuleMatches = this.getExistingRuleMatches(currRHS);
            if (existingRuleMatches.length === 0) {
                const matchSequence = this.matcher.match(currRHS);
                if (matchSequence.length === 0) {
                    let symbol = rhs[i].clone();
                    newRHS.push(symbol);
                    i++;
                    continue;
                }
                const matchRecord = this.pullMatchRecord(matchSequence);
                if (matchRecord.fires()) {
                    let originalSequence = matchRecord.getOriginalSequence();
                    if (MetaGram.sequencesOverlap(originalSequence, matchSequence)) {
                        newRHS.push(rhs[i].clone());
                        i++;
                        continue;
                    }
                    let hasFired = matchRecord.hasFiredBefore;
                    let addNewRule = !hasFired;
                    let newSym = addNewRule ? this.addNewRuleToNextGrammar(matchRecord, matchSequence, currRHS) : new cfg.Symbol(matchRecord.uid, false);
                    newRHS.push(newSym);
                    i += matchSequence.length;
                } else {
                    let symbol = rhs[i].clone();
                    newRHS.push(symbol);
                    i++;
                }
            } else {
            	// ASSUMPTION: we want to just use the first rule matched
            	let ruleWinner = existingRuleMatches[0];
            	newRHS.push(new cfg.Symbol(ruleWinner.lhs, false));
            	i += ruleWinner.rhs.length;
			}
        }
        if (newRHS.length === 1) {
        	// we don't want to create new rules with just one element in them
        	return rhs;
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
		console.log("Current:");
		this.showCurrentGrammar();
		console.log("Next");
		this.showNextGrammar();
	}

	grammarChanged() {
		return !this.nextGrammar.equals(this.currentGrammar);
	}

	generalizeMatchRecords() {
		// find commonalities in match records to generalize for inference
	}

	postProcess() {
		this.generalizeMatchRecords();
	}

	run(maxIters=1000) {
		let grammarIteration = 1;
		let grammarChanged = true;
		while(grammarChanged && grammarIteration<maxIters) {
			console.log("------ Grammar iteration " + grammarIteration + " ------\n");
            this.buildNextGrammar();
            this.postProcess();
            grammarChanged = this.grammarChanged();
            this.report();
            this.swapGrammars();
            this.writeGrammar(`metagram_grammar_${grammarIteration}.json`);
            this.writeMatchRecords(`metagram_matchrecords_${grammarIteration}.json`);
            this.resetMatchRecords();
            grammarIteration++;
        }
		this.writeGrammar();
		this.writeInfo({numIters: grammarIteration});
	}

	writeInfo(infoObj, filename="info.json") {
		fs.writeFileSync(filename, infoObj);
	}

	writeMatchRecords(mrFileName="metagram_matchrecords.json") {
		fs.writeFileSync(mrFileName, JSON.stringify(this.matchRecords, null, 2));
	}

	writeGrammar(grammarFileName="metagram_grammar.json") {
		this.currentGrammar.toJSON(grammarFileName)
	}

	generate(howMany=20, treeFile="meta_trees.json") {
	    let trees = [];
	    for (let i=0; i<howMany; i++) {
            console.log(cfg.CFG.terminalsToString(this.currentGrammar.generate()));
            trees.push(this.currentGrammar.generateTree());
        }
        fs.writeFileSync(treeFile, JSON.stringify(trees, null, 2));
    }

}


function main() {
	//let dataFile = "nmw.txt";
	//let dataFile = "../data/sense_sents.txt";
	let dataFile = "../data/sense_sents_1000.txt";
	const mg = new MetaGram(dataFile, "X Y X; X Y;", "\n");
	mg.run();
	console.log("---- GENERATED SENTENCES ----");
	mg.generate();
	console.log("---- DONE ---- ");
}

main();
