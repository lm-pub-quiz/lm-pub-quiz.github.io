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

function params_format(x, precision=null) {
  if (x == "-") return x; 
  else if (x >= 1e12) return (x / 1e12).toFixed(precision !== null ? precision : 1) + "T";
  else if (x >= 1e9) return (x / 1e9).toFixed(precision !== null ? precision : 1) + "b";
  else if (x >= 1e6) return (x / 1e6).toFixed(precision !== null  ? precision : 0) + "M";
  else if (x >= 1e3) return (x / 1e6).toFixed(precision !== null  ? precision : 0) + "K";
  else return x;
}

function setup_table(data) {
  data = data.sort((a, b) => b.accuracy.mean - a.accuracy.mean)

  var row = table_body.selectAll("tr")
    .data(data)
    .enter()
    .append("tr");

  row.append("td").append("a").attr("href", (d) => d.model_url).text((d) => d.model_name);
  row.append("td").text((d) => d.model_type);
  row.append("td").text((d) => params_format(d.num_params));
  row.append("td").text((d) => params_format(d.num_tokens, 0));
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
        if (a.model_name == "Random Baseline") return 1;
        else if (b.model_name == "Random Baseline") return -1;

        a_value = a[sort_key];
        b_value = b[sort_key];
      }
      if (typeof a_value === 'string' || a_value instanceof String) a_value = a_value.toLowerCase();
      if (typeof b_value === 'string' || b_value instanceof String) b_value = b_value.toLowerCase();

      if (a_value == null) return 1;
      else if (b_value == null) return -1;
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

const width = 600;
const height = 300;
const marginTop = 20;
const marginRight = 20;
const marginBottom = 30;
const marginLeft = 40;


// Setup the static elements

var symbol = d3.symbol();

const svg = d3.selectAll("svg.result-plot").attr("viewBox","0 0 " + width + " " + height);

// Set up the axis
const x = d3.scaleLog().range([marginLeft, width - marginRight]);
const y = d3.scaleLinear().range([height - marginBottom, marginTop]);

const group_x = svg.append("g")
  .attr("transform", `translate(0,${height - marginBottom})`)
  .attr("opacity", 0.7);

const xAxis = d3.axisBottom(x).tickSizeOuter(0);

const group_y = svg.append("g")
  .attr("transform", `translate(${marginLeft},0)`)
  .attr("opacity", 0.7)

const yAxis = d3.axisLeft(y);

const random_baseline = svg.append("g");
const line_plot = svg.append("g");
const scatter_plot = svg.append("g");
const scatter_plot_hightlight_layer = svg.append("g").attr("pointer-events", "none");

// Add the line for the random baseline

random_baseline
  .append("line")
  .attr("x1", marginLeft)
  .attr("x2", width - marginRight)
  .attr("y1", 0)
  .attr("y2", 0)
  .attr("fill", "none")
  .attr("stroke", "gray")
  .attr("stroke-dasharray", "1,1")
  .attr("stroke-width", 1);

random_baseline.append("text")
  .attr("x", width - marginRight)
  .attr("y", -4)
  .attr("fill", "gray")
  .text("Random Baseline")
  .attr("text-anchor", "end")
  .attr("font-size", "10");

// Add a legend-group
const legend_dy = 15;
const legend = svg.append("g").attr("transform", `translate(${marginLeft + 20} ${marginTop + legend_dy/2})`);


function prepare_data(data) {
  window.random_baseline_accuracy = data.filter((d) => d.model_name == "Random Baseline")[0].accuracy.mean;
  window.datapoints = data.filter((d) => d.model_name != "Random Baseline");
  
  model_families = {};

  window.datapoints.forEach((d) => {
    if (!(d.model_family in model_families)) {
      model_families[d.model_family] = [];
    }
    model_families[d.model_family].push(d);
  });

  window.model_families = Object.values(model_families);
}


function sorted_datapoints(datapoints) {
  var data_key = xAxisKeySelect.value;
  datapoints = datapoints.slice(0);

  datapoints.sort((a, b) => (a == b) ? (a.accuracy.mean - b.accuracy.mean) : (a[data_key] - b[data_key]));
  return datapoints;
}

function update_axis() {
  var data_key = xAxisKeySelect.value;
  var data = window.datapoints;

  let xValues = data.map((d) => d[data_key]).filter(x => !!x);

  var xmin = Math.max(Math.min(...xValues), 1);
  var xmax = Math.max(Math.max(...xValues), 10);
  var ymax = Math.max(...data.map((d) => d.accuracy.mean));

  var xmin_log = Math.log(xmin);
  var xmax_log = Math.log(xmax);

  x.domain([Math.exp(xmin_log - 0.1*(xmax_log - xmin_log)), Math.exp(xmax_log + 0.1*(xmax_log - xmin_log))]).range([marginLeft, width - marginRight]);
  y.domain([0, ymax + 0.05]).range([height - marginBottom, marginTop]);

  group_x.transition().duration(400).call(xAxis);
  group_y.transition().duration(400).call(yAxis);
}

function update_plot() {
  var data_key = xAxisKeySelect.value;

  update_axis();

  line_plot
    .selectAll(".family-line")
    .data(model_families)
    .enter()
    .append("path")
      .attr("d", d3.line()
        .x((d) => x(d[xAxisKeySelect.value]))
        .y((d) => y(d.accuracy.mean))
      );
      /*.on("mouseover", (e, d, i) => mouseover_model_family(d[0].model_family))
      .on("mouseout", (e, d, i) => mouseout_model_family(d[0].model_family));*/

  // Add the error bars
  datapoint_elements
    .append("line")
      .attr("x1", (d) => x(d[data_key]))
      .attr("x2", (d) => x(d[data_key]))

  var datapoint = datapoint_elements
    .append("g")
      .attr("transform", (d) => `translate(${x(d[data_key])}, ${y(d.accuracy.mean)}) scale(1, 1)`);
}


function setup_plot() {
  var data_key = xAxisKeySelect.value;
  var model_families = window.model_families;

  update_axis();

  // Add the legend
  // Usually you have a color scale in your chart already
  var family_color = d3.scaleOrdinal()
    .domain(model_families.map(f => f[0].model_family))
    .range(d3.schemeTableau10);

  line_plot
    .selectAll(".family-line")
    .data(model_families)
    .join(
      function(enter) {
        enter.append("path")
          .attr("class", d => `family-line family-line-${d[0].model_family}`)
          .attr("stroke", "gray")
          .attr("fill", "none")
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "2,2")
          .attr("d", family_d => (d3.line()
            .defined((d) => !!d[data_key])
            .x((d) => x(d[xAxisKeySelect.value]))
            .y((d) => y(d.accuracy.mean))
          )(sorted_datapoints(family_d)));
      },
      function(update) {
        var line = 

        update
          .transition().duration(200).attr("opacity", 0)
          .transition().duration(0)
          .attr("d", family_d => (d3.line()
            .defined((d) => !!d[data_key])
            .x((d) => x(d[xAxisKeySelect.value]))
            .y((d) => y(d.accuracy.mean))
          )(sorted_datapoints(family_d)))
          .transition().duration(200).attr("opacity", 1)
      }
    )
    
  function transform_string(d) {
    if (d[data_key]) {
      return `translate(${x(d[data_key])}, ${y(d.accuracy.mean)})`
    } else {
      return `translate(${width/2}, ${height-marginBottom})`
    }
  }

  scatter_plot
    .selectAll("g.datapoint")
    .data(window.datapoints)
    .join(
      function (enter) {
        var annotatedDatapoint = enter.append("g")
          .attr("class", (d) => `datapoint datapoint-${d.model_family}`)
          .on("mouseover", (e, d, i) => hightlight_model_family(d.model_family))
          .on("mouseout", (e, d, i) => dehiglight_model_family(d.model_family))
          .attr("opacity", (d) => (d[data_key]) ? 1.0 : 0.0)
          .attr("transform", transform_string)
          .attr("style", (d) => (d[data_key]) ? "" : "display: none");

        // Add the error bars
        annotatedDatapoint
          .append("line")
            .attr("class", "datapoint-errorbar")
            .attr("x1", 0)
            .attr("x2", 0)
            .attr("y1", (d) => y(d.accuracy.mean + d.accuracy.sem) - y(d.accuracy.mean))
            .attr("y2", (d) => y(d.accuracy.mean - d.accuracy.sem) - y(d.accuracy.mean))
            .attr("stroke", (d) => family_color(d.model_family))
            .attr("stroke-width", 2);

        // Add the scatter plot symbols
        annotatedDatapoint 
          .append("path")
            .attr("class", "datapoint-symbol")
            .attr("d", symbol.type((d) => {
              if (d.model_type.startsWith("MLM")) {return d3.symbolSquare} else {return d3.symbolCircle}
            }))
            .attr("transform", (d) => `scale(0.7, 0.7)`)
            .attr("fill", (d) => family_color(d.model_family))
            .append("svg:title").text((d) => `${d.model_name}: ${d.accuracy.mean.toPrecision(3)}`);
      },
      function (update) {
        update.transition().duration(400)
          .attr("transform", transform_string)
          .attr("opacity", (d) => (d[data_key]) ? 1.0 : 0.0)
          .transition()
          .attr("style", (d) => (d[data_key]) ? "" : "display: none");

      }
    )

  scatter_plot_hightlight_layer
    .selectAll("g.datapoint")
    .data(window.datapoints)
    .join(
      function (enter) {
        var annotatedDatapoint = enter.append("g")
          .attr("class", (d) => `datapoint datapoint-${d.model_family}`)
          .attr("opacity", 0.0)
          .attr("transform", transform_string)
          .attr("style", (d) => (d[data_key]) ? "" : "display: none");

        // Add the scatter plot symbols
        annotatedDatapoint 
          .append("path")
            .attr("class", "datapoint-symbol")
            .attr("d", symbol.type((d) => {
              if (d.model_type.startsWith("MLM")) {return d3.symbolSquare} else {return d3.symbolCircle}
            }))
            .attr("transform", (d) => `scale(0.7, 0.7)`)
            .attr("fill", (d) => family_color(d.model_family))

        // Add the model names
        annotatedDatapoint
          .append("text")
            .attr("class", "datapoint-annotation")
            .text((d) => d.model_name)
            .attr("transform", "rotate(20)")
            .attr("dx", 8)
            .attr("dy", 4)
            .attr("font-size", 10);
      },
      function (update) {
        update.transition().duration(400)
          .attr("transform", transform_string)
          .attr("style", (d) => (d[data_key]) ? "" : "display: none");
      }
    )
  random_baseline
    .attr("transform", `translate(0, ${y(random_baseline_accuracy)})`);

  // Add one dot in the legend for each name.
  var legend_element = legend.selectAll("g.legend-element")
    .data(model_families)
    .enter()
    .append("g")
      .attr("class", (d, i) => `legend-element legend-element-${d[0].model_family}`)
      .attr("transform", (d, i) => `translate (0, ${i * legend_dy})`)
      .on("mouseover", (e, d, i) => hightlight_model_family(d[0].model_family))
      .on("mouseout", (e, d, i) => dehiglight_model_family(d[0].model_family));

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


/* Animate the plot on selecting a different value */

xAxisKeySelect.addEventListener("change", function(event) {
  event.preventDefault();
  setup_plot();
  return false;
});

/* Animate hightlighting of model families */

function hightlight_model_family(model_family) {
  console.log(model_family)
  line_plot.select(`.family-line-${model_family}`)
    .transition().duration(200)
    .attr("stroke-width", 2);

  // Hightlight all scatter plots
  var dp = scatter_plot_hightlight_layer.selectAll(`.datapoint-${model_family}`)

  dp.attr("visible", "visible")
    .transition()
    .duration(100)
    .attr("opacity", 1.0);

  dp.selectAll("path.datapoint-symbol")
      .transition()
      .duration(100)
      .attr("transform", "scale(1, 1)");
}

function dehiglight_model_family(model_family) {
  line_plot.select(`.family-line-${model_family}`)
    .transition().duration(200)
    .attr("stroke-width", 1);
  
  var dp = scatter_plot_hightlight_layer.selectAll(`.datapoint-${model_family}`);

  dp.transition()
    .duration(200)
    .attr("opacity", 0.0)
    .transition()
    .attr("visible", "none");

  dp.selectAll("path.datapoint-symbol")
      .transition()
      .duration(200)
      .attr("transform", "scale(0.7, 0.7)");
}



/* DATA LOADING */

// Load the data and add lines and dots
d3.json("results.json").then((data) => {
  prepare_data(data);
  setup_plot();
  setup_table(data);
});


