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

	constructor(matcher, sequence, grammarCoordinate) {
		this.key = MatchRecord.getKey(sequence);
		this.sequence = sequence;
		this.grammarCoord = grammarCoordinate;
		this.matcher = matcher;
		//this.counts = 1;
		//this.uid = null;
		//this.hasFiredBefore = false;
		//this.originalSequence = sequence;
		//this.matchType = matchType; // can be - or | for "sequence" or "or"
	}

	toString() {
		return `${this.key}\t|\t${this.sequence}\t|\t${this.matcher.toString()}\t|\t${this.grammarCoord}`;
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
		//this.nextGrammar = new cfg.CFG();
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
                    matchRecords.push(new MatchRecord(m, matchSeq, grammarCoord));
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
		keyAggregates.forEach( k => {
			console.log(`${k.key} : ${k.count}`);
		});
	}

	aggregateMatches() {
		// ignore overlaps for now...
		let keyAggregates = {};
		// need to combine both the sequence that was matched and the pattern to dedupe on
		// since the same sequence could be matched with different patterns with different behavior (e.g. "X Y;" and "X $;")
		let combinedKey = (mrKey, pattern) => {
			return mrKey + ":" + pattern;
		};
		this.matchRecords.forEach(mr => {
			let k = combinedKey(mr.key, mr.matcher.patternString);
			if (Object.keys(keyAggregates).indexOf(k) < 0) {
				keyAggregates[k] = {};
				keyAggregates[k].count = 1;
				keyAggregates[k].matcher = mr.matcher;
				keyAggregates[k].sequence = mr.sequence;
			} else {
				keyAggregates[k].count++;
			}
		});
        let aggArr = Object.keys(keyAggregates).reduce( (p, c) => {
        	keyAggregates[c].key = c;
            p.push(keyAggregates[c]);
            return p;
        }, []);
		return aggArr;
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

	collectFireSequences(aggMatches) {
		return aggMatches.filter(am => {
			return am.count >= am.matcher.fireThreshold;
		}).sort( (a, b) => {
			return b.count - a.count;
		});
	}

	collectWildcardSequences(aggMatches) {
		return aggMatches.filter(am => {
			return am.count >= am.matcher.wildcardThreshold;
		}).sort( (a, b) => {
			return b.count - a.count;
		});
	}

	run(maxIters=1000) {
		let grammarIteration = 1;
		let grammarChanged = true;
		while(grammarChanged && grammarIteration<maxIters) {
			console.log("------ Grammar iteration " + grammarIteration + " ------\n");
			this.collectMatches();
			this.printMatchRecords();
			let aggregatedMatches = this.aggregateMatches();
            console.log("--- Match Record Aggregates ---");
			this.printAggregates(aggregatedMatches);
			let fires = this.collectFireSequences(aggregatedMatches);
			console.log("--- Sequence Fires --- ");
			this.printAggregates(fires);
			let wilds = this.collectWildcardSequences(aggregatedMatches);
			console.log("--- Wildcard Fires");
			this.printAggregates(wilds);
			this.handleSequenceFires(fires);
			//this.handleWildcardFires(wilds);
			//this.updateGrammar();
			break; // TODO: temporary
            grammarIteration++;
        }
		this.writeGrammar();
		MetaGram.writeInfo({numIters: grammarIteration});
	}

	handleSequenceFires(seqFires) {
		seqFires.forEach(seqAgg => {
			let addedRules = [];
			let matches = (sequence, ruleSegment) => {
				if (sequence.length !== ruleSegment.length) {
					return false;
				}
				let m = ruleSegment.every( (x, i) => {
					let s = x.val === sequence[i];
					return s;
				});
				return m;
			};
			this.currentGrammar.rules = this.currentGrammar.rules.map(r => {
                let newRHS = [];
				let i=0;
				while (i<(r.rhs.length)) {
					let rhsSlice = r.rhs.slice(i, i+(seqAgg.sequence.length));
					if (matches(seqAgg.sequence, rhsSlice)) {
						// found match. create new rule and symbol
						let uid = cfg.Rule.getUID();
						newRHS.push(new cfg.Symbol(uid, false));
						addedRules.push(new cfg.Rule(uid, rhsSlice.slice()));
						i += rhsSlice.length;
					} else {
						// no match. keep status quo
						newRHS.push(r.rhs[i]);
						i++;
					}
				}
                return new cfg.Rule(r.lhs, newRHS);
                //this.currentGrammar.replaceRule(r, newRule);
			});
			addedRules.forEach(r => {
				this.currentGrammar.addRule(r.lhs, r.rhs);
			});
        });
		this.currentGrammar.cleanUpRules();
	}

	handleWildcardFires(wcFires) {
		// TODO
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
	const mg = new MetaGram(dataFile, "2, 20, X Y X; 30, 2, X Y;", "\n");
	mg.run();
	console.log("---- GENERATED SENTENCES ----");
	mg.generate();
	console.log("---- END GRAMMAR ----");
	console.log(mg.currentGrammar.toString());
	console.log("---- DONE ---- ");
}

main();
