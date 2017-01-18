/* MetaGrammar code */

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

	constructor(pattern, sequence, grammarCoordinate) {
		this.key = MatchRecord.getKey(sequence);
		this.sequence = sequence;
		this.grammarCoord = grammarCoordinate;
		this.pattern = pattern;
		//this.counts = 1;
		//this.uid = null;
		//this.hasFiredBefore = false;
		//this.originalSequence = sequence;
		//this.matchType = matchType; // can be - or | for "sequence" or "or"
	}

	toString() {
		return `${this.key}\t|\t${this.sequence}\t|\t${this.pattern}\t|\t${this.grammarCoord}`;
	}

	attachUID() {
		this.uid = MatchRecord.UID;
		this.hasFiredBefore = true;
	}

	static getKey(sequence) {
		let keySep = "-";
		return sequence.reduce( (p, c) => {
			return p + keySep + c;
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

	static overlap(mr1, mr2) {
		return GrammarCoord.overlap(mr1.grammarCoord, mr2.grammarCoord);
	}

}
MatchRecord.charIdx = 0;
MatchRecord.num = 0;


class MetaGram {

	constructor(dataFileName, matchProgram, startRulesSplitter="\n") {
		this.dataFileName = dataFileName;
		this.currentGrammar = new cfg.CFG();
		this.nextGrammar = new cfg.CFG();
		this.initializeStartRules(startRulesSplitter);
		this.matchers = matcher.Matcher.getMatchers(matchProgram);
		this.matchRecords = [];
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

    resetMatchRecords() {
		this.matchRecords = [];
	}

	swapGrammars() {
		this.currentGrammar = this.nextGrammar.clone();
		this.nextGrammar = new cfg.CFG();
	}

	/*****
	begin new section
	 *****/

	findMatches(rule) {
        let matchRecords = [];
        let seq = rule.rhs.map(x => {
            return x.val;
        });
        this.matchers.forEach(m => {
            for (let i = 0; i < seq.length; i++) {
            	let rest = seq.slice(i);
                let matchSeq = m.match(rest);
                if (matchSeq.length > 0) {
                	let grammarCoord = new cfg.GrammarCoords(rule.uid, i, i+matchSeq.length);
                    matchRecords.push(new MatchRecord(m.patternString, matchSeq, grammarCoord));
                }
            }
        });
        return matchRecords;
    }

	storeMatches(matchrecs) {
		matchrecs.forEach(mr => { this.matchRecords.push(mr); });
		/*
		matchrecs.forEach(mr => {
			let k = `${mr.grammarCoord.toString()}@${mr.key}@`;
            client.hset(k, "coord", mr.grammarCoord, redis.print);
            client.hset(k, "pattern", mr.pattern, redis.print);
            client.hset(k, "sequence", mr.sequence, redis.print);
		});
		*/
	}

	collectMatches() {
		this.currentGrammar.rules.forEach(r => {
			let matchrecs = this.findMatches(r);
			this.storeMatches(matchrecs);
		});
	}

	printMatchRecords() {
		console.log("--- Match Records ---");
		this.matchRecords.sort( (a, b) => {
			return a.key.length - b.key.length || a.key.localeCompare(b.key);
		}).forEach(mr =>  { console.log(mr.toString()); });
	}

	printAggregates(keyAggregates) {
		console.log("--- Match Record Aggregates ---");
		let keys = Object.keys(keyAggregates);
		for (let k of keys) {
			console.log(`${k} : ${keyAggregates[k]}`);
		}
	}

	aggregateMatches() {
		// ignore overlaps for now...
		let keyAggregates = {};
		this.matchRecords.forEach(mr => {
			if (Object.keys(keyAggregates).indexOf(mr.key) < 0) {
				keyAggregates[mr.key] = 1
			} else {
				keyAggregates[mr.key]++;
			}
		});
		return keyAggregates;
	}

	/*****
	end new section
	 *****/

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

	run(maxIters=1000) {
		let grammarIteration = 1;
		let grammarChanged = true;
		while(grammarChanged && grammarIteration<maxIters) {
			console.log("------ Grammar iteration " + grammarIteration + " ------\n");
			this.collectMatches();
			this.printMatchRecords();
			let aggregatedMatches = this.aggregateMatches();
			this.printAggregates(aggregatedMatches);
			/*
            this.buildNextGrammar();
            grammarChanged = this.grammarChanged();
            this.report();
            this.swapGrammars();
            this.writeGrammar(`metagram_grammar_${grammarIteration}.json`);
            this.writeMatchRecords(`metagram_matchrecords_${grammarIteration}.json`);
            this.resetMatchRecords();
            */
			break; // TODO: temporary
            grammarIteration++;
        }
		this.writeGrammar();
		MetaGram.writeInfo({numIters: grammarIteration});
	}

	static writeInfo(infoObj, filename="info.json") {
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
	let dataFile = "../data/basic.txt";
	const mg = new MetaGram(dataFile, "1, 2, X Y X; 3, 4, X Y;", "\n");
	mg.run();
	console.log("---- GENERATED SENTENCES ----");
	mg.generate();
	console.log("---- DONE ---- ");
}

main();
