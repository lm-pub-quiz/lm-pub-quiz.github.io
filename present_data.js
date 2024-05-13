// Modify SI units such that the param counts to be presented as e.g. 7B

fcopy = d3.format;
function myFormat(){
         function_ret = fcopy.apply(d3, arguments)
         return (function(args){return function (){
                return args.apply(d3, arguments).replace(/G/, "B");
         }})(function_ret)
}
d3.format = myFormat;



/* LEADERBOARD TABLE */
var leaderboard = d3.select("table.leaderboard")

var table_body = leaderboard.select("tbody");


function pad(text, length, end=false) {
  if (text.length >= length)
    return text
  else if (end)
    return text + "&#8199;".repeat(length - text.length)
  else
    return "&#8199;".repeat(length - text.length) + text
}

function format_accuracy(accuracy) {
  if (accuracy.sem) {
    return `${pad((accuracy.mean * 100).toFixed(1), 4)}%&#8199;&plusmn;<small>${pad((accuracy.sem * 100).toFixed(1), 4)}%</small>`
  } else {
    return pad((accuracy.mean * 100).toFixed(1), 4) + "%" + ("&#8199;".repeat(3)) + `<small>${pad("", 4)}</small>`
  }
}

function params_format(x) {
  if (x == "-") return x; 
  else if (x >= 1e12) return (x / 1e12).toFixed(2) + "T";
  else if (x >= 1e9) return (x / 1e9).toFixed(1) + "b";
  else if (x >= 1e6) return (x / 1e6).toFixed(0) + "M";
  else if (x >= 1e3) return (x / 1e6).toFixed(0) + "K";
  else return x;
}

function populate_table(data) {
  data = data.sort((a, b) => b.accuracy.mean - a.accuracy.mean)

  var row = table_body.selectAll("tr")
    .data(data)
    .enter()
    .append("tr");

  row.append("td").append("a").attr("href", (d) => d.model_url).text((d) => d.model_name);
  row.append("td").text((d) => d.model_type);
  row.append("td").text((d) => params_format(d.num_params));
  row.append("td").html((d) => format_accuracy(d.accuracy));
}

function sort_table(sort_key, to_ascending) {
  table_body.selectAll("tr").sort(
    (a, b) => {
      let a_value, b_value
      if (sort_key == "accuracy") {
        a_value = a.accuracy.mean;
        b_value = b.accuracy.mean;
      } else {
        a_value = a[sort_key];
        b_value = b[sort_key];
      }
      if (typeof a_value === 'string' || a_value instanceof String) a_value = a_value.toLowerCase();
      if (typeof b_value === 'string' || b_value instanceof String) b_value = b_value.toLowerCase();


      if (a_value == "-") return 1;
      else if (b_value == "-") return -1;
      else if (to_ascending) return d3.ascending(a_value, b_value);
      else return d3.descending(a_value, b_value);
    }
  );
}

leaderboard.selectAll("th").on("click", (e) => {
  var th = d3.select(e.target);

  var to_ascending = !th.classed("th-sort-asc");
  var sort_key = th.attr("data-sort-key")
  console.log(sort_key, to_ascending);

  leaderboard.selectAll("th").classed("th-sort-asc", false).classed("th-sort-desc", false);
  th.classed("th-sort-asc", to_ascending).classed("th-sort-desc", !to_ascending);

  sort_table(sort_key, to_ascending);
})

/* PERFROMANCE PLOT */

var symbol = d3.symbol();

// Declare the chart dimensions and margins.
const width = 600;
const height = 300;
const marginTop = 20;
const marginRight = 20;
const marginBottom = 30;
const marginLeft = 40;

const xmin = 90e6, xmax=45e9;


// Set up the plot

const svg = d3.selectAll("svg.result-plot").attr("viewBox","0 0 " + width + " " + height);


// Set up the axis
const x = d3.scaleLog().domain([xmin, xmax]).range([marginLeft, width - marginRight]);
const y = d3.scaleLinear().domain([0, 0.7]).range([height - marginBottom, marginTop]);

const xAxis = svg.append("g")
  .attr("transform", `translate(0,${y(0)})`)
  .attr("opacity", 0.7)
  .call(d3.axisBottom(x)
  .tickSizeOuter(0).tickValues([125e6, 300e6, 1e9, 3e9, 7e9, 13e9, 30e9]));

const yAxis = svg.append("g")
  .attr("transform", `translate(${x(xmin)},0)`)
  .attr("opacity", 0.7)
  .call(d3.axisLeft(y));

const line_plot = svg.append("g");
const scatter_plot = svg.append("g");

// Add the line for the random baseline
const random_baseline = svg.append("g");

random_baseline
  .append("line")
  .attr("x1", x(xmin))
  .attr("x2", x(xmax))
  .attr("y1", 0)
  .attr("y2", 0)
  .attr("fill", "none")
  .attr("stroke", "gray")
  .attr("stroke-dasharray", "1,1")
  .attr("stroke-width", 1);

random_baseline.append("text")
  .attr("x", x(xmax))
  .attr("y", -4)
  .attr("fill", "gray")
  .text("Random Baseline")
  .attr("text-anchor", "end")
  .attr("font-size", "10");

// Add a legend-group
const legend_dy = 15;
var legend = svg.append("g")
  .attr("transform", `translate(${marginLeft + 20} ${marginTop + legend_dy/2})`);

function mouseover_model_family(model_family) {
  line_plot.select(`.family-line-${model_family}`)
    .transition().duration(200)
    .attr("stroke-width", 2);

  // Hightlight all scatter plots
  var datapoints = scatter_plot.selectAll(`.model-datapoint-${model_family}`);

  datapoints
    .selectAll("path")
    .transition()
    .duration('100')
    .attr("transform", "scale(1.2, 1.2)");

  datapoints
    .selectAll("text")
    .attr("style", "")
    .transition()
    .duration("100")
    .attr("opacity", 1.0);

  /*legend.select(`.legend-element-${model_family}`)
    .select("text")
    .transition()
    .duration(200)
    .attr("opacity", 1);*/
  

  // Raising the datapoint itself somehow messes with the mouseout event, hence we lower every other element
  var selection = scatter_plot.selectAll(`.model-datapoint:not(.model-datapoint-${model_family})`);
  selection.lower();
  selection.order(); // reorder elements to prevent shifting between them

  //datapoints.raise().on("mouseout", () => mouseout_model_family(model_family));
}

function mouseout_model_family(model_family) {
  line_plot.select(`.family-line-${model_family}`)
    .transition().duration(200)
    .attr("stroke-width", 1);
  
  var datapoints = scatter_plot.selectAll(`.model-datapoint-${model_family}`);
  datapoints.selectAll("path")
    .transition()
    .duration('200')
    .attr("transform", "scale(0.7, 0.7)");

  datapoints.selectAll("text")
    .transition()
    .duration("100")
    .attr("opacity", 0.0)
    .transition()
    .attr("style", "display: none");

  /*legend.select(`.legend-element-${model_family}`)
    .select("text")
    .transition()
    .duration(100)
    .attr("opacity", 0.7);*/
}

function populate_plot(data) {
  random_baseline_accuracy = data.filter((d) => d.model_name == "Random Baseline")[0].accuracy.mean;
  data = data.filter((d) => d.model_name != "Random Baseline");

  var model_families = {};

  data.forEach((d) => {
    if (!(d.model_family in model_families)) {
      model_families[d.model_family] = [];
    }
    model_families[d.model_family].push(d);
  });

  model_families = Object.values(model_families).map(f => f.sort((a, b) => a.num_params - b.num_params))

  // Add the legend
  // Usually you have a color scale in your chart already
  var family_color = d3.scaleOrdinal()
    .domain(model_families.map(f => f[0].modle_family))
    .range(d3.schemeTableau10);

  line_plot
    .selectAll(".family-line")
    .data(model_families)
    .enter()
    .append("path")
      .attr("class", d => `family-line family-line-${d[0].model_family}`)
      .attr("stroke", "gray")
      .attr("fill", "none")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "2,2")
      .attr("d", d3.line()
        .x((d) => x(d.num_params))
        .y((d) => y(d.accuracy.mean))
      );
      /*.on("mouseover", (e, d, i) => mouseover_model_family(d[0].model_family))
      .on("mouseout", (e, d, i) => mouseout_model_family(d[0].model_family));*/

  var datapoint_elements = scatter_plot
    .selectAll(".model-datapoint")
    .data(data)
    .enter()
    .append("g")
      .attr("class", (d) => `model-datapoint model-datapoint-${d.model_family}`)
      .on("mouseover", (e, d, i) => mouseover_model_family(d.model_family))
      .on("mouseout", (e, d, i) => mouseout_model_family(d.model_family));

  // Add the error bars
  datapoint_elements
    .append("line")
      .attr("x1", (d) => x(d.num_params))
      .attr("x2", (d) => x(d.num_params))
      .attr("y1", (d) => y(d.accuracy.mean + d.accuracy.sem))
      .attr("y2", (d) => y(d.accuracy.mean - d.accuracy.sem))
      .attr("stroke", (d) => family_color(d.model_family))
      .attr("stroke-width", 2);

  var datapoint = datapoint_elements
    .append("g")
      .attr("transform", (d) => `translate(${x(d.num_params)}, ${y(d.accuracy.mean)}) scale(1, 1)`);

  // Add the scatter plot symbols
  datapoint
    .append("path")
      .attr("d", symbol.type((d) => {
        if (d.model_type.startsWith("MLM")) {return d3.symbolSquare} else {return d3.symbolCircle}
      }))
      .attr("transform", (d) => `scale(0.7, 0.7)`)
      .attr("fill", (d) => family_color(d.model_family))
      .append("svg:title").text((d) => `${d.model_name}: ${d.accuracy.mean.toPrecision(3)}`);

  // Add the model names
  datapoint
    .append("text")
    .text((d) => d.model_name)
    .attr("transform", "rotate(20)")
    .attr("dx", 8)
    .attr("dy", 4)
    .attr("font-size", 10)
    .attr("style", "display: none;")
    .attr("opacity", 0.0);
            
  random_baseline
    .attr("transform", `translate(0, ${y(random_baseline_accuracy)})`);

  // Add one dot in the legend for each name.
  var legend_element = legend.selectAll("legend-elements")
    .data(model_families)
    .enter()
    .append("g")
      .attr("class", (d, i) => `legend-element-${d[0].model_family}`)
      .attr("transform", (d, i) => `translate (0, ${i * legend_dy})`)
      .on("mouseover", (e, d, i) => mouseover_model_family(d[0].model_family))
      .on("mouseout", (e, d, i) => mouseout_model_family(d[0].model_family));

  legend_element
    .append("path")
      .attr("d", symbol.type((d) => {
        if (d[0].model_type.startsWith("MLM")) {return d3.symbolSquare} else {return d3.symbolCircle}
        }))
      .attr("transform", "scale(0.7, 0.7)")
      .style("fill", function(d, i){ return family_color(d[0].model_family)})

  // Add one dot in the legend for each name.
  legend_element
    .append("text")
      .attr("x", 10)
      .attr("y", 3)
      .attr("opacity", 0.7)
      .text(function(d){ return d[0].model_family})
      .attr("text-anchor", "start")
      .attr("font-size", "10");

}


/* DATA LOADING */

// Load the data and add lines and dots
d3.json("results.json").then((data) => {
  populate_plot(data);
  populate_table(data);
});
