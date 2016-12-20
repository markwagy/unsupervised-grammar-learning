d3.json("../js/metagram_matchrecords.json", (err, data, maxNum=-1) => {

	if (err) throw error;

	let cols = ["key", "counts"];

	d3.select("table#matchrecords").selectAll("th").data(cols).enter().append("th")
		.html( d => { return `<td>${d}</td>`; });

	var dataTruncated = data.slice(0, maxNum).sort( (x, y) => { return d3.descending(x.counts, y.countss); });;
	d3.select("table#matchrecords").selectAll("tr").data(dataTruncated).enter().append("tr")
		.html( (d) => {
			return cols.reduce( (p, c) => {
				return p + `<td>${d[c]}</td>`;
			}, "");
		});
	
});


