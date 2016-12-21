function loadGrammar(tableID="table#grammartable") {
	//let iteration = document.getElementById("grammaritertext").value || "1";
	d3.select(tableID).selectAll("th").data([]).exit().remove();
	d3.select(tableID).selectAll("tr").data([]).exit().remove();

	d3.json(`../js/metagram_grammar_${iteration}.json`, (err, data) => {

		if (err) throw error;

		let cols = ["lhs", "rhs"];

		data.sort( (a, b) => { return a.lhs.localeCompare(b.lhs); });

		d3.select(tableID).selectAll("th").data(cols).enter().append("th")
			.html( d => { return `<td>${d}</td>`; });

		d3.select(tableID).selectAll("tr").data(data).enter().append("tr")
			.html( d => {
				let rhslist = d.rhs.reduce( (p, c) => { return p + " " + c.val;}, "");
				return `<td>${d.lhs}</td><td>${rhslist}</td>`;
			});

	});

}
