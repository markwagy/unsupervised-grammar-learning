/* MetaGrammar code */

//const redis = require('redis'),
//	  client = redis.createClient();
const md5 = require('md5');
const fs = require('fs');
const peg = require('pegjs');


class MetaGram {

	constructor(pegFileName, dataFileName) {
		this.loadPEGDef(pegFileName);
	}

	consumeFromFile(dataFileName) {
		const vals = fs.readFileSync(dataFileName, 'utf8').replace('\n', ' ');
		return vals;
	}

	loadPEGDef(pegFileName) {
		const pegDef = fs.readFileSync(pegFileName, 'utf8');
		this.parser = peg.generate(pegDef, {output:"parser", trace: true});
	}

	run(dataFileName) {

		const vals = this.consumeFromFile(dataFileName);
		console.log(`running on ${vals}`);
		var rtn = this.parser.parse("(+ 1 (f x 3 y))");
		console.log(`done parsing: ${rtn}`);
		return;
	}

}


function main() {

	/*
	client.on('error', (err) => {
		console.log("error " + err);
	});
	 */

	const mg = new MetaGram("test2.peg");
	mg.run("test1.txt");
	return;
}

main();
