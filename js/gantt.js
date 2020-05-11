// ========================================================
// Innovation Tech Industries - calendar-gantt-tool
// innovation.tech.industries@gmail.com
// gantt.js:
// 		--gantt-specific functions and drawing logic
//		--basic build pulled from: http://bl.ocks.org/dk8996/5449641
//		--built using D3.js v5 
// ========================================================

d3.gantt = function () {
	var FIT_TIME_DOMAIN_MODE = "fit";
	var FIXED_TIME_DOMAIN_MODE = "fixed";

	var margin = {
		top: 20,
		right: 40,
		bottom: 0,
		left: 150
	};
	var timeDomainStart = d3.timeDay.offset(new Date(), -3);
	var timeDomainEnd = d3.timeHour.offset(new Date(), +3);
	var timeDomainMode = FIXED_TIME_DOMAIN_MODE; // Gantt chart has hard cut offs in each direction
	var taskNames = [];
	var taskPriority = [];
	var taskTypes = [];
	var rectPositions = [];
	var typeColors;
	var links = [];
	var height;
	var rectMinWidth = 10; // min pixel width for displaying rects in very zoomed out views like year and quarter
	var width = document.body.clientWidth - margin.right - margin.left - 5;

	var tickFormat = "%H:%M"; // you will never see this format unless changeTimeDomain() isn't called

	//----START Date formats for chart title-----
	// D3 docs lists all different types of formats
	var yearFormat = d3.timeFormat("%Y");
	var monthYearFormat = d3.timeFormat("%B %Y")
	var monthYearDayFormat = d3.timeFormat("%a., %B %e, %Y");
	//----END Date formats for chart title----

	// a unique key function is required in D3 for adding data
	var keyFunction = function (d) {
		return d.start + d.title + d.end;
	};

	// PURPOSE: to calculate position of rectangle and help with drawing connection lines
	// Stores visual DOM properties of rectangle into rectPositions array
	var rectTransform = function (d) {
		let xCoord = x(d.start) + (x(d.end) - x(d.start)) / 2;

		// if the rect is small, connection line must be drawn based on 10px min-width instead
		if((x(d.end) - x(d.start)) < rectMinWidth && (x(d.end) - x(d.start)) > 0) {
			xCoord = x(d.start) + 5;
		}

		// object that helps in drawing connection lines
		// for horizontal lines that aren't as clean, make x: x(d.start) + 1 and y: y(d.title) + y.bandwidth() / 2
		let rectProperties = {
			id: d.id,
			x: xCoord,
			y: y(d.title) + y.bandwidth(),
			width: x(d.end) - x(d.start),
			dependId: d.dependsOn
		};
		rectPositions.push(rectProperties);
		return "translate(" + x(d.start) + "," + y(d.title) + ")";
	};

	var x, y, xAxis, yAxis;

	initAxis();

	// function to wrap label text pulled from: https://bl.ocks.org/mbostock/7555321
	function wrap(text, width) {
		text.each(function() {
			var text = d3.select(this),
					words = text.text().split(/\s+/).reverse(),
					word,
					line = [],
					lineHeight = 1.1, // ems
					y = text.attr("y"),
					dy = parseFloat(text.attr("dy")),
					tspan = text.text(null).append("tspan").attr("x", -3).attr("y", y).attr("dy", dy + "em"),
					count = 0,
					firstSpan = tspan;
			
			while (word = words.pop()) {
				line.push(word);
				tspan.text(line.join(" "));
				// $("#display-gantt").addClass("show active"); hack to wrap text even though chart is not showing
				if (tspan.node().getComputedTextLength() > width) {
					line.pop();
					tspan.text(line.join(" "));
					line = [word];
					dyConcat = lineHeight + dy + "em";
					count++;
					tspan = text.append("tspan").attr("x", -3).attr("y", y).attr("dy", dyConcat).text(word);
				}
				// $("#display-gantt").removeClass("show active"); d3 has issues with DOM drawing on hidden elements
			}
			// moves label up slightly based on how many words were wrapped
			// really not ideal as text should be resized when axis is redrawn
			// if there are multiple labels with very very long titles, they will overlap
			// this is meant to mitigate collisions not entirely prevent them
			if(count > 0)
				firstSpan.attr("dy", (dy - lineHeight) * (count * 0.7) + "em");
		})
	}
	
	// PURPOSE: create a link connection between two rectangles using rectPositions array
	function makeLinks() {
		for(let i = 0; i < rectPositions.length; i++) {
			if(rectPositions[i].dependId != null) {
				let linkTarget = {
					x: rectPositions[i].x,
					y: rectPositions[i].y - y.bandwidth() + 1		// remove y.bandwidth() + 1 when switching to horizontal lines
				};
	
				// work around to replace find() method not supported by IE
				// returns a single object given that id's are unique
				let target = rectPositions.filter(function (x) {
					return x.id == rectPositions[i].dependId
				})[0];
				
				let linkSource = {
					x: target.x,
					y: target.y
				};
				let link = {
					coords: d3.linkVertical()
						.x(function(d){ return d.x })
						.y(function(d) { return d.y })({
						source: linkSource,
						target: linkTarget
					}),
					sourceWidth: rectPositions[i].width,
					targetWidth: target.width
				}
				links.push(link);
			}
		}
	}

	// calculates the timeDomainStart and timeDomainEnd to fit entire array, not used in our case 
	initTimeDomain = function () {
		if (timeDomainMode === FIT_TIME_DOMAIN_MODE) {
			if (tasks === undefined || tasks.length < 1) {
				timeDomainStart = d3.timeDay.offset(new Date(), -3);
				timeDomainEnd = d3.timeHour.offset(new Date(), +3);
				return;
			}
			tasks.sort(function (a, b) {
				return a.end - b.end;
			});
			timeDomainEnd = tasks[tasks.length - 1].end;
			tasks.sort(function (a, b) {
				return a.start - b.start;
			});
			timeDomainStart = tasks[0].start;
		}
	};

	function initAxis() {
		x = d3.scaleTime().domain([timeDomainStart, timeDomainEnd]).range([0, width]).clamp(true);

		y = d3.scaleBand().domain(taskNames).range([0, height]).padding(0.3);

		xAxis = d3.axisBottom().scale(x).tickFormat(d3.timeFormat(tickFormat))
			.tickSize(8).tickPadding(8);

		yAxis = d3.axisLeft().scale(y).tickSize(0);
	};

	// ----BEGIN Gantt chart drawing and redrawing------
	// Initial drawing of Gantt chart
	function gantt(tasks) {
		initTimeDomain();
		initAxis();

		var svg = d3.select("#gantt-container")
			.append("svg")
			.attr("class", "chart")
			.attr("width", width + margin.left + margin.right)
			.attr("height", height + margin.top + margin.bottom)
			.append("g")
			.attr("class", "gantt-chart")
			.attr("width", width + margin.left + margin.right)
			.attr("height", height + margin.top + margin.bottom)
			.attr("transform", "translate(" + margin.left + ", " + (margin.top) + ")");

		svg.selectAll(".chart")
			.data(tasks, keyFunction).enter()
			.append("rect")
			.attr("id", function(d){ return d.id; })
			.attr("rx", 3)
			.attr("ry", 3)
			.attr("fill", function (d) {
				for (let i = 0; i < taskTypes.length; i++){
					if (d.type === taskTypes[i]){
						return typeColors(i);
					}
				}
			})
			.attr("y", 0)
			.attr("transform", rectTransform)
			.attr("height", function (d) { return y.bandwidth(); })
			.attr("width", function (d) {
				// any smaller than a rectangle width of 10px makes it impossible to hover or click in larger views (year, quarter)
				// therefore, smallest size of a rectange should not be below 10px
				if((x(d.end) - x(d.start)) < rectMinWidth && (x(d.end) - x(d.start)) > 0)
					return rectMinWidth;
				return (x(d.end) - x(d.start));
			})
			.on("mouseover", function(d){
				d3.select(this).style("cursor", "pointer");
				$(this).popover(popoverOptions(d, "manual")); // work around for having bootstrap popover with d3
				$(this).popover("toggle");
			})
			.on("mouseout", function(d){
				$(this).popover("dispose"); // without disposing of popover, it sometimes appears in top left corner on IE
				d3.select(this).style("cursor", "default");
			})
			.on("click", function(d){
				$(this).popover("dispose");
				editTaskModal(d);
			});
		
		makeLinks();

		// draw connections lines based on properties of rectPositions array
		svg.selectAll(".chart")
			.data(links).enter()
			.append("path")
			.attr("class", "connection")
			.attr("d", function(d){ return d.coords; })
			.attr("stroke", "black")
			.attr("fill", "none")
			.attr("stroke-width", "0px"); // using 0px to remove rendered lines on first init, use 1.5px for testing initial draw
			// .lower();
		
		// creates a separate SVG to keep x axis fixed to same position on screen
		var xAxisSVG = d3.select("#xaxis").append("svg");

		xAxisSVG.attr("width", width + margin.left + margin.right)
			.attr("height", 45)
			.append("g")
			.attr("class", "x axis")
			.attr("transform", "translate(" + margin.left + ", " + 0 + ")") // replace y value with amount of spacing needed above x axis
			.transition()
			.call(xAxis);
		
		svg.append("g").attr("class", "y axis").call(yAxis); // word wrap not called on initial draw

		return gantt;
	};

	// Redraw the Gantt chart anytime view changes or data changes
	gantt.redraw = function (tasks) {

		initTimeDomain();
		initAxis();
		rectPositions.length = 0; // clear position array since widths/transforms have changed
		
		links.length = 0; // clear links as the positions of rects have changed

		var svg = d3.select("#gantt-container svg");
		var xAxisSVG = d3.select("#xaxis svg")
		var ganttChartGroup = svg.select(".gantt-chart");
		var rect = ganttChartGroup.selectAll("rect").data(tasks, keyFunction);

		svg.attr("height", height + margin.top + margin.bottom);
		svg.attr("width", width + margin.left + margin.right);
		ganttChartGroup.attr("height", height + margin.top + margin.bottom);
		ganttChartGroup.attr("width", width + margin.left + margin.right);

		rect.enter()
			.insert("rect", ":first-child")
			.attr("id", function(d) { return d.id; })
			.attr("rx", 3)
			.attr("ry", 3)
			.attr("fill", function (d) {
				for (let i = 0; i < taskTypes.length; i++){
					if (d.type === taskTypes[i]){
						return typeColors(i);
					}
				}
			})
			.attr("y", 0)
			.attr("transform", rectTransform)
			.attr("height", function (d) { return y.bandwidth(); })
			.attr("width", function (d) {
				// any smaller than a rectangle width of 10px makes it impossible to hover or click in larger views (year, quarter)
				// therefore, smallest size of a rectange should not be below 10px
				if((x(d.end) - x(d.start)) < rectMinWidth && (x(d.end) - x(d.start)) > 0)
					return rectMinWidth;
				return (x(d.end) - x(d.start));
			})
			.on("mouseover", function(d){
				d3.select(this).style("cursor", "pointer");
				$(this).popover(popoverOptions(d, "manual")); // work around for having bootstrap popover with d3
				$(this).popover("toggle");
			})
			.on("mouseout", function(d){
				$(this).popover("dispose"); // without disposing of popover, it sometimes appears in top left corner on IE
				d3.select(this).style("cursor", "default");
			})
			.on("click", function(d){
				$(this).popover("dispose");
				editTaskModal(d);
			})
			.transition();
		
		// merge the newly added rects with the existing rects
		rect.merge(rect).transition()
			.attr("transform", rectTransform)
			.attr("fill", function (d) {
				for (let i = 0; i < taskTypes.length; i++){
					if (d.type === taskTypes[i]){
						return typeColors(i);
					}
				}
			})
			.attr("height", function (d) { return y.bandwidth(); })
			.attr("width", function (d) {
				// any smaller than a rectangle width of 10px makes it impossible to hover or click in larger views (year, quarter)
				// therefore, smallest size of a rectange should not be below 10px
				if((x(d.end) - x(d.start)) < rectMinWidth && (x(d.end) - x(d.start)) > 0)
					return rectMinWidth;
				return (x(d.end) - x(d.start));
			});

		rect.exit().remove(); // remove deleted tasks
		
		makeLinks();

		// redraw all connections
		var path = ganttChartGroup.selectAll("path.connection").data(links);
		path.enter() // add any new connections
			.insert("path", ":first-child")
			.attr("class", "connection")
			.attr("d", function(d){
				return d.coords; 
			})
			.attr("stroke", "black")
			.attr("fill", "none")
			.attr("stroke-width", "1.5px") // using 0px to remove rendered lines on first init, use 1.5px for testing initial draw
			.raise();
		path.merge(path).transition() // merge new connections with existing connections
			.attr("d", function(d) { return d.coords; })
			.attr("stroke-width", function(d){
				// removes connection lines from view if both of the rects are out of view
				if(d.sourceWidth <= 0 && d.targetWidth <= 0)
					return "0px";
				else
					return "1.5px";
			});
		path.exit().remove(); // remove any connections that may have been disconnected by a task deletion

		// Smoothly move the x and y axes.
		xAxisSVG.attr("width", width + margin.left + margin.right).select(".x").call(xAxis).transition();
		svg.select(".y").call(yAxis).selectAll(".tick text").call(wrap, margin.left - 1).transition();
		
		// PURPOSE: Adds title based on view and first tick value in that view.
		// Must match exactly with values in changeTimeDomain() function for now.
		$("#date-header").text(function(){
			// If the tickFormat is Mon DD, then include month in title
			// NOTE: Both quarter and month share same tick format.  Quarter has space at end of its tickFormat.
			if(tickFormat === "%b %e")
				return monthYearFormat(timeDomainStart);
			
			// If the tickFormat is 24Hour:MM, then include day, month DD, year in title
			if(tickFormat === "%H:%M")
				return monthYearDayFormat(timeDomainStart);

			// else put year as title
			else
				return yearFormat(timeDomainStart);
		});
		return gantt;
	};
	// ----END Gantt chart drawing and redrawing------

	// --------BEGIN Gantt setter functions---------
	gantt.margin = function (value) {
		if (!arguments.length)
			return margin;
		margin = value;
		return gantt;
	};

	gantt.timeDomain = function (value) {
		if (!arguments.length)
			return [timeDomainStart, timeDomainEnd];
		timeDomainStart = +value[0], timeDomainEnd = +value[1];
		return gantt;
	};


// The value can be "fit" - the domain fits the data or "fixed" - fixed domain
	gantt.timeDomainMode = function (value) {
		if (!arguments.length)
			return timeDomainMode;
		timeDomainMode = value;
		return gantt;
	};

	gantt.taskNames = function (value) {
		if (!arguments.length)
			return taskNames;
		taskNames = value;
		return gantt;
	};

	gantt.taskPriority = function (value) {
		if (!arguments.length)
			return taskPriority;
		taskPriority = value;
		return gantt;
	};

	gantt.typeColors = function (value) {
		if (!arguments.length)
			return typeColors;
		typeColors = value;
		return gantt;
	};

	gantt.taskTypes = function (value) {
		if (!arguments.length)
			return taskTypes;
		taskTypes = value;
		return gantt;
	};

	gantt.width = function (value) {
		if (!arguments.length)
			return width;
		width = +value;
		return gantt;
	};

	gantt.height = function (value) {
		if (!arguments.length)
			return height;
		height = +value;
		return gantt;
	};

	gantt.tickFormat = function (value) {
		if (!arguments.length)
			return tickFormat;
		tickFormat = value;
		return gantt;
	};
	// --------END Gantt setter functions---------

	return gantt;
};

// if number of tasks is < 8, use default svg height of 630, defined in index.js
// this would cause bars to expand to fill that 630px svg height and make y axis connect with x axis
function adjustGanttHeight() {
	if(tasks.length > 8)
		return tasks.length * 70; // each task will have 70px of spacing in svg height top and bottom.
	else
		return ganttHeight; // else the height will be the default of 630
}

// ---------------------------------------
// BEGIN Gantt Chart-specific nav functions
// ---------------------------------------
// PURPOSE: Move along a specified time domain based on prev/next button events
// PARAM: Element id (prev or next) as a string
function prevNext(moveDirection) {
	switch(timeDomainString) {
		case "3month":
			if(moveDirection === "prev") {
				startQuarter -= 3;
				endQuarter -= 3;
			}
			else {
				startQuarter += 3;
				endQuarter += 3;
			}
			gantt.timeDomain([d3.timeMonth.offset(newYear, startQuarter), d3.timeMonth.offset(newYear, endQuarter)]);
			break;
		case "1month":
			if(moveDirection === "prev") {
				startMonth--;
				endMonth--;
			}
			else {
				startMonth++;
				endMonth++;
			}
			gantt.timeDomain([d3.timeMonth.offset(newYear, startMonth), d3.timeMonth.offset(newYear, endMonth)]);
			break;
		case "1day":
			if(moveDirection === "prev") {
				startDay--;
				endDay--;
			}
			else {
				startDay++;
				endDay++;
			}
			gantt.timeDomain([d3.timeDay.offset(newYear, startDay), d3.timeDay.offset(newYear, endDay)]);
			break;
		case "1year":
			if(moveDirection === "prev") {
				startYear--;
				endYear--;
			}
			else {
				startYear++;
				endYear++;
			}
			gantt.timeDomain([d3.timeYear.offset(newYear, startYear), d3.timeYear.offset(newYear, endYear)]);
			break;
		default:
			console.log("Something went wrong with Previous and Next buttons");
	}
	gantt.redraw(tasks);
}

// PURPOSE: Change entire view based on Day/Month/Quarter/Year button events
// PARAM: Element id (Day/Month/Quarter/Year) as a string
function changeTimeDomain(newDomain) {
	timeDomainString = newDomain;
	switch (newDomain) {
		case "3month":
			format = "%b %e ";
			var x = currentDate.getMonth() + 1;
			// if the current month is divisible by 3, then we are at end of quarter
			if (x % 3 === 0) {
				startQuarter = currentDate.getMonth() - 2;
				endQuarter = currentDate.getMonth() + 1;
			}
			// if Jan., April., Jul., or Oct. then it is beginning of quarter
			else if (x===1 || x===4 || x===7 || x===10) {
				startQuarter = currentDate.getMonth();
				endQuarter = currentDate.getMonth() + 3;
			}
			else {
				startQuarter = currentDate.getMonth() - 1;
				endQuarter = currentDate.getMonth() + 2;
			}
			gantt.timeDomain([d3.timeMonth.offset(newYear, startQuarter), d3.timeMonth.offset(newYear, endQuarter)]);
			break;
		case "1month":
			format = "%b %e";
			startMonth = currentDate.getMonth();
			endMonth = startMonth + 1;
			gantt.timeDomain([d3.timeMonth.offset(newYear, startMonth), d3.timeMonth.offset(newYear, endMonth)]);
			break;
		case "1day":
			format = "%H:%M";
			startDay = getDayofYear();
			endDay = getDayofYear() + 1;
			gantt.timeDomain([d3.timeDay.offset(newYear, startDay), d3.timeDay.offset(newYear, endDay)]);
			break;
		case "1year":
			format = "%b %Y";
			startYear = 0;
			endYear = 1;
			gantt.timeDomain([d3.timeYear.offset(newYear, startYear), d3.timeYear.offset(newYear, endYear)]);
			break;
		default:
			console.log("Something went wrong in selecting a time domain");
	}
	gantt.tickFormat(format).redraw(tasks);
}

// gets current day of year, returns 0-based day of year
// https://stackoverflow.com/questions/8619879/javascript-calculate-the-day-of-the-year-1-366/27790471
function getDayofYear() {
	var now = new Date();
	var start = new Date(now.getFullYear(), 0, 0);
	var diff = (now - start) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
	var oneDay = 1000 * 60 * 60 * 24;
	var day = Math.floor(diff / oneDay);
	return day - 1;
}

// Grabs last date listed in the tasks array
function getEndDate() {
	let lastEndDate = Date.now();
	if (tasks.length > 0) {
		lastEndDate = tasks[tasks.length - 1].endDate;
	}
	return lastEndDate;
}

// Calculates current year for initial creation of gantt chart
function getCurrentYear() {
	let currYear = new Date();
	return currYear.getFullYear();
}

// Compares task objects based on alphabetical types to help with sorting
function compareTypes( a, b ) {
  if ( a.type < b.type ){
    return -1;
  }
  if ( a.type > b.type ){
    return 1;
  }
  return 0;
}
// ---------------------------------------
// END Gantt Chart-specific functions
// ---------------------------------------