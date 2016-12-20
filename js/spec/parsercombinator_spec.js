const pc = require('../ParserCombinator.js');

describe("test parser combinator-related functions and classes", function() {
    it("should parse the parser combinator currentGrammar correctly", function (done) {
        const p = new pc.ParserCombinator("X Y ; X X ; X | Y ;");
        expect(body).toEqual("hello world");
    });
});