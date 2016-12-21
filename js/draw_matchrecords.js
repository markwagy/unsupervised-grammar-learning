
function loadMatchRecords() {

	//let iteration = document.getElementById("matchitertext").value || "1";
	d3.select("table#matchrecords").selectAll("th").data([]).exit().remove();
	d3.select("table#matchrecords").selectAll("tr").data([]).exit().remove();		
	
	d3.json(`../js/metagram_matchrecords_${iteration}.json`, (err, data) => {

		if (err) throw error;

		let cols = ["key", "counts"];

		d3.select("table#matchrecords").selectAll("th").data(cols).enter().append("th")
			.html( d => { return `<td>${d}</td>`; });

		data.sort( (a, b) => { return b.counts - a.counts; });

		// ignore match records that don't have a count of at least 2
		let datafilt = data.filter(d => { return d.counts > 1; });

		d3.select("table#matchrecords").selectAll("tr").data(datafilt).enter().append("tr")
			.html( (d) => {
				return cols.reduce( (p, c) => {
					return p + `<td>${d[c]}</td>`;
				}, "");
			});
		
	});
}
