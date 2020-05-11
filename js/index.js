// ========================================================
// Innovation Tech Industries - calendar-gantt-tool
// innovation.tech.industries@gmail.com
// index.js:
// 		--calendar and gantt initialization
//		--shared calendar and gantt functions
//		--general DOM event handling (modals, view changes, etc.)
// ========================================================

// Important! The tasks array is included in the <head> of the HTML, it is a static JS array
// Pulling new data locally should be done by replacing this file with the appropriate JS file
// If retrieving JSON of tasks from server make sure to create an array called "tasks" here first
// 		and remove the static file from the <head> of the HTML document.

// convert date strings to JS Date objects
// Calendar doesn't need Date objects but gantt chart does or else it will break
$.each(tasks, function(index, value) {
	tasks[index].start = new Date(tasks[index].start);
	tasks[index].end = new Date(tasks[index].end);
});

// sort array on id's in case data file is out of order
// we need a sorted array by id to determine the next task id
tasks.sort(function(a, b) {
	return a.id - b.id;
});
var unsortedTasks = tasks.slice(0); // make a copy of the sorted id tasks array

// --------------------------------------------
// BEGIN initial task sorting and separation
// --------------------------------------------
sortTasks(); // initial sort of entire tasks array

// get all the taskNames for now sorted tasks (used in y axis)
var names = tasks.map(function(a) { return a.title; });

// get all initial types for a task object (used for coloring and grouping)
var types = tasks.map(function(a){ return a.type; });

// Pulled from here https://stackoverflow.com/questions/38206915/filter-out-array-to-have-only-unique-values
// O(n^2) but tasks array shouldn't be terribly large
// Puts unique types into an array
var filteredTypes = types.filter(function(item, pos){
	return types.indexOf(item) == pos;
});
// --------------------------------------------
// END initial task sorting and separation
// --------------------------------------------


// --------------------------------------------
// BEGIN initialization for Gantt Chart & Calendar
// --------------------------------------------
//Variables used to increment and decrement next and previous time.
var startDay = 0;
var endDay = 1;
var startMonth = 0;
var endMonth = 1;
var startQuarter = 0;
var endQuarter = 3;
var startYear = 0;
var endYear = 1;
var newYear = new Date(getCurrentYear(), 0, 1); // must be defined before Gantt chart is instantiated
var currentDate = new Date();

$("#read-only-view").prop("checked", true); // sets to read-only on every page load regardless of HTML
toggleModalDisable(true); // therefore, all form entry will be disabled

// Change out sprites for both calendar and gantt tooltips here
var highPriority = "img/high-priority.svg";
var medPriority = "img/medium-priority.svg";
var lowPriority = "img/checkmark.svg";

// grabs active class of button group and makes it default view on load
// this way, changing the default view only has to be done by adding/removing the active class in index.html
var timeDomainString = $("#change-view-gantt .active").prop("id");

// Cycle through 10 colors to represent each different type
// Currently, the colors will repeat if there are more than 10 types
// List of categorical colors found here, only use categorical: https://observablehq.com/@d3/color-schemes?collection=@d3/d3-scale-chromatic
// .range() can be replaced by an array of hex colors if more options are necessary
var colors = d3.scaleOrdinal().range(d3.schemeTableau10);

var margin = {
  top: 20,
  right: 40,
  bottom: 0,
  left: 90
}; // gantt chart margins

const ganttHeight = 630; // default height of gantt chart

// Init gantt chart with basic task info
var gantt = d3.gantt().taskNames(names).typeColors(colors).taskTypes(filteredTypes).margin(margin).timeDomainMode("fixed");

gantt.height(adjustGanttHeight()) // adjust SVG height based on number of tasks, found in gantt.js

$(document).ready(function(){
  gantt(tasks);	// initialize Gantt chart with the sorted tasks array
  initializeCalendar("month"); // Initialize the calendar in month view initially
});

// Redraw Gantt chart to default view given the timeDomainString active class retrieved above
// Function definition details found in gantt.js
changeTimeDomain(timeDomainString); // remove this function if you want to see initial draw (for testing)
// --------------------------------------------
// END initialization for Gantt Chart & Calendar
// --------------------------------------------


// --------------------------------------------
// BEGIN Shared DOM event handling
// --------------------------------------------
// On window resize, redraw the entire gantt chart to accomodate screen size
window.onresize = function(){
	// a hack way of determining client width
	// initial client width doesn't have body margin's yet, so that's why there's an offset of 48
	// will most likely leave small horizontal scrollbars between Edge and IE
	gantt.width(document.body.clientWidth - margin.right - margin.left - 48);
	gantt.redraw(tasks);
}

// On change handler for admin/read-only view selection
$("input:radio[name='change-view']").change(function() {
	if (this.value === "Admin")
		toggleModalDisable(false);
	else if (this.value === "Read-Only")
		toggleModalDisable(true);
});

// populates dependsOn drop down list based on the task type field changing
$("#task-type, #start-date-text, #end-date-text").change(function(){
	populateDependList();
});

// specific event to listen to when datepicker icon is clicked
// fires once on first open according to docs
$("#start-date, #end-date").on("change.datetimepicker", function(){
	populateDependList();
});

// handles submission when user clicks Confirm
$("#task-submission").submit(function(e){
	e.preventDefault();

	if(verifyTask()) {
		// capture all fields even if they weren't set
		var taskTitle = $("#task-name").val();
		var taskType = $("#task-type").val();
		var taskPriority = parseInt($("#task-priority").val());
		var taskStart = moment(formatInputToISO("#start-date-text")).toDate();
		var taskEnd = moment(formatInputToISO("#end-date-text")).toDate();
		var taskDescription = $("#task-description").val();
		var taskDependsOn;
		if($("#depend-select").val() === "null")
			taskDependsOn = null
		else
			taskDependsOn = parseInt($("#depend-select").val());

		if($("#confirm-task").hasClass("edit-mode")) { // if we are editing an existing task
			editedTask = getTaskObject($("#task-modal").data("id")); // get the task based on modal ID
			var oldType = editedTask.type;
			var newType = taskType;
			editedTask.title = taskTitle;
			editedTask.description = taskDescription;
			editedTask.type = taskType;
			editedTask.start = taskStart;
			editedTask.end = taskEnd;
			editedTask.priority = taskPriority;

			// if the previous task type is not the same as before, then check if the old one should be removed from filteredTypes
			// if the type is not the same, then dependencies must also be adjusted
			if(oldType !== newType) {
				addNewTaskType(newType); // adds the type to filteredTypes array if type is new
				checkTypeRemoval(oldType); // if the old task type is no longer used, remove it
				adjustDependencies(editedTask);
			}
			editedTask.dependsOn = taskDependsOn;
			
		}
		else { // else we are adding a task
			var newID = unsortedTasks[unsortedTasks.length - 1].id; // pull the next id
			newID++;
			newTask = {
				"id": newID,
				"title": taskTitle,
				"description": taskDescription,
				"type": taskType,
				"start": taskStart,
				"end": taskEnd,
				"dependsOn": taskDependsOn,
				"priority": taskPriority
			};
			addNewTaskType(taskType);	// adds the type to filteredTypes array if type is new
			tasks.push(newTask);
			unsortedTasks.push(newTask);
		}
		redrawGanttCal();
		$("#task-modal").modal("toggle");
	}
});

// Handles deletion of task when user clicks "Delete" button
$("#delete-task").on("click", function(){
	var idDel = $("#task-modal").data("id");
	var indexDel, objDel;
	// find the index of the task being deleted
	for (var i = tasks.length - 1; i >= 0; --i) {
    if (tasks[i].id === idDel) {
			indexDel = i;
			objDel = tasks[i];
    }
	}
	adjustDependencies(objDel);
	tasks.splice(indexDel, 1);	// Remove task from tasks array
	checkTypeRemoval(objDel.type); // check if the type should be removed from filteredTypes
	redrawGanttCal();
	$("#task-modal").modal("toggle");
});

// Fixes issue where when FullCalendar is not focused tasks do not update
// Fixes issue where word wrap on y axis labels doesn't happen if gantt chart is hidden
// Rerenders events on calendar and redraws gantt chart to ensure parity
$('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
	// change gantt width if client has resized at all while on calendar tab without ever switching back to gantt tab
	gantt.width(document.body.clientWidth - margin.right - margin.left - 48);
	gantt.redraw(tasks);
	$("#calendar").fullCalendar("rerenderEvents");
});
// --------------------------------------------
// END Shared DOM event handling
// --------------------------------------------


// --------------------------------------------
// BEGIN Handling of DOM events for Gantt Chart
// --------------------------------------------
// On Click handler to handle view selection
$("#change-view-gantt button").on("click", function(){
	let timeSelection = event.target.id; 			// retrieve id of object that generated event
	changeTimeDomain(timeSelection); 					// change the time domain based on the id
	$(this).siblings().removeClass("active"); // remove all buttons with "active"
	$(this).addClass("active"); 							// change button to an active state
});

// On Click handler to handle incremental view selection
$("#prev-next-gantt button").on("click", function(){
	let direction = event.target.id;	// retrieve id of object that generated event
	prevNext(direction);							// move backward/forward based on timeDomainString
});

$("#add-task-btn").on("click", function() {
	addTaskModal(); // pull up add task modal
});
// --------------------------------------------
// END Handling of DOM events for Gantt Chart
// --------------------------------------------


// --------------------------------------------
// BEGIN Handling of DOM events for Calendar
// --------------------------------------------
// On Click handler to handle view selection
$("#change-view-cal button").on("click", function(){
	let viewSelection = event.target.id; 			// retrieve id of object that generated event

	$("#calendar").fullCalendar("destroy"); 	// fully removes current view from DOM
	$("#calendar").html("");

	if(viewSelection === "quarter")
		// change to calendar year mode, limit months to 3 at a time, with column size of 2
		// column size of 3 causes scroll bars on longer months, doesn't look as nice
		initializeCalendar("year", 0, 3, 2); 
	else
		// extra params are for year view, 12 months at a time, column size of 3
		initializeCalendar(viewSelection, 0, 12, 3);

	$(this).siblings().removeClass("active"); // remove all classes with "active"
	$(this).addClass("active"); 							// change button to an active state
});

// On Click handler to handle incremental view selection
$("#prev-next-cal button").on("click", function(){
	let direction = event.target.id;	// retrieve id of object that generated event
	$("#calendar").fullCalendar(direction);
});

// On click handler to handle changing view to today
$("#today").on("click", function(){
	$("#calendar").fullCalendar('today');
});
// -----------------------------------------
// END Handling of DOM events for Calendar
// -----------------------------------------


// ---------------------------------------
// BEGIN Shared Calendar/Gantt functions
// ---------------------------------------
// sorts by end date, start date, and then by task type
function sortTasks() {
	// sort tasks array by end
	tasks.sort(function (a, b) {
		return a.end - b.end;
	});

	// sort tasks array by start date
	tasks.sort(function (a, b) {
		return a.start - b.start;
	});

	// sort tasks array by type, so colors match
	// compareTypes function is found in gantt.js
	tasks.sort(compareTypes);
}

// redraws both the gantt chart and calendar if tasks array has been updated
function redrawGanttCal() {
	sortTasks();
	names = tasks.map(function(a) { return a.title; });
	gantt.height(adjustGanttHeight());
	gantt.taskTypes(filteredTypes);
	gantt.taskNames(names);
	gantt.redraw(tasks);
	$("#calendar").fullCalendar('removeEventSource', tasks); 		// updateEvent function from FullCalendar docs doesn't work
	$("#calendar").fullCalendar('addEventSource', tasks, true); // readding the event source seemed to be the best work around
}

// -----------BEGIN Modal-specific functions--------
// Adds the newType to filteredTypes array if it isn't there already
function addNewTaskType(newType) {
	if(filteredTypes.indexOf(newType) == -1)
		filteredTypes.push(newType);
}

// Checks if the oldType that is being replaced should be removed from filteredTypes array
// Helps with recycling of colors, and only needs to be used for editing a task
function checkTypeRemoval(oldType) {
	var count = 0;
	var index = filteredTypes.indexOf(oldType);
	for(var i = 0; i < tasks.length; i++) {
		if(tasks[i].type == oldType)
			count++;
	}
	if(count > 0) // if there is an instance of oldType in tasks array, then it should remain in filteredTypes
		return;
	else if(index > -1)
		filteredTypes.splice(index, 1); // else remove that type and recycle the color
}

// Populates the dropdown list in the modal with a specific set of options based on type and date of selected task
function populateDependList() {
	$("#depend-select").empty();
	if(filteredTypes.indexOf($("#task-type").val()) == -1) // if the type can't be found in filteredTypes, then there should be no options
		$("#depend-select").append("<option value='null'>None</option>");
	else {
		$("#depend-select").append("<option value='null'>None</option>");
		for(var i = 0; i < tasks.length; i++) {
			// able to select certain tasks in dependsOn dropdown menu...
			if(tasks[i].type === $("#task-type").val()	// only if the task has the same type
				&& tasks[i].id !==  $("#task-modal").data("id")		// if the task is the current task, you cannot select it as a dependsOn
				&& getPredecessor(tasks[i]).id !== $("#task-modal").data("id")	// cannot select a dependency as a predecessor
				&& moment(tasks[i].start).isBefore($("#start-date-text").val())	// assuming linear tasks, cannot select a task with a start date before current start
				&& moment(tasks[i].start).isBefore($("#end-date-text").val()))	// assuming linear tasks, cannot select a task with start date before current end
				$("#depend-select").append("<option value='" + tasks[i].id + "'>" + tasks[i].title + "</option>");
		}
	}
}

// given the task that's being edited/deleted, adjust it's dependencies accordingly
function adjustDependencies(taskObj) {
	if(checkRootTask(taskObj)) { // if the task is a root task
		var dependencies = getDependency(taskObj);
		for(var i = 0; i < dependencies.length; i++)
			dependencies[i].dependsOn = null; // set its dependencies dependsOn field to null
	}
	else if(checkChildTask(taskObj)) { // if the task has dependency and predecessor
		var dependencies = getDependency(taskObj);
		var predecessor = getPredecessor(taskObj);
		for(var i = 0; i < dependencies.length; i++)
			dependencies[i].dependsOn = predecessor.id; // set its dependency's dependsOn field to its predecessor's id
	}
}

// Task is a root task if it has a dependency and no predecessor
function checkRootTask(taskObj) {
	if(taskObj.dependsOn === null && getDependency(taskObj))
		return true;
	return false;
}

// task is a child if it has a predecessor and a dependency
function checkChildTask(taskObj) {
	if(taskObj.dependsOn !== null && getDependency(taskObj))
		return true;
	return false;
}

// populates edit task modal with task information
function editTaskModal(taskObj) {
	$("#start-date, #end-date").datetimepicker("destroy");
	clearVerificationHelp();
	$("#task-modal #modalTitle").text("Edit Task");
	$("#task-modal").data("id", taskObj.id); // pass the id of the task to the modal
	$("#delete-task").show();
	$("#task-name").val(taskObj.title);
	$("#task-type").val(taskObj.type);
	$("#task-priority").val(taskObj.priority);
	$("#start-date-text").val(formatFullDate(taskObj.start));
	$("#end-date-text").val(formatFullDate(taskObj.end));
	$("#task-description").val(taskObj.description);
	populateDependList();
	$("#confirm-task").addClass("edit-mode");
	initDateTimePicker();
	$("#task-modal").modal({});
	var predecessor = getPredecessor(taskObj);
	if( predecessor ) { // set select to current dependsOn task if it exists		
		$("#depend-select").val(predecessor.id);
	}
}

// opens the add task modal and clears values from previous edit task modal calls
function addTaskModal() {
	$("#start-date, #end-date").datetimepicker("destroy");
	clearVerificationHelp();
	$("#task-modal #modalTitle").text("Add Task");
	$("#task-modal").data("id", 0); // if id of a task is 0, then it was not set right in the click handler for gantt/calendar tasks
	$("#delete-task").hide();
	$("#task-priority").val("1");
	$("#fieldset-modal input").each(function(){
		$(this).val("");
	});
	$("#depend-select").empty().append("<option value='null'>None</option>");
	$("#confirm-task").removeClass("edit-mode");
	initDateTimePicker();
	$("#task-modal").modal({});
}

// datetimepicker ended up saving the last date that was selected even when modal is closed
// now it is initialized at every modal open so it automatically populates with current date
function initDateTimePicker() {
	$("#start-date, #end-date").datetimepicker({
		format: "YYYY-MM-DD HH:mm",
		useStrict: true,
		keepInvalid: true,
	});
}

// Toggles form disable depending on selection of admin/read-only view
function toggleModalDisable(toggle) {
	$("#fieldset-modal .form-control").each(function(){
		$(this).prop("disabled", toggle);
	});
	$("#delete-task").prop("disabled", toggle);
	$("#confirm-task").prop("disabled", toggle);
	$("#add-task-btn").prop("disabled", toggle);
}

// Removes any form invalidation from previous modal open
function clearVerificationHelp() {
	$("#task-submission input").each(function() {
		$(this).removeClass("is-invalid");
	});
	$("#depend-select").removeClass("is-invalid");
	$("#confirm-task").removeClass("is-invalid");
}

// PURPOSE: verifies if the data entered for a task is valid
// returns whether the task is valid or not
function verifyTask() {
	var valid = true;
	// goes through each input element to check validity
	$("#task-submission input").each(function() {
		// toggles the invalid class based on if the input is empty
		if(!$.trim(this.value).length) {
			$(this).addClass("is-invalid");
			valid = false;
		}
		else
			$(this).removeClass("is-invalid");
	});
	
	// Checks if the task name is already in use, excludes the task title that is being edited.
	for(var i = 0; i < tasks.length; i++) {
    if (tasks[i].title === $("#task-name").val() && tasks[i].id !== $("#task-modal").data("id")) {
				valid = false;
				$("#task-name").addClass("is-invalid");
        break;
    }
	}

	// verify date on submission
	if(!verifyDateFormat())
		valid = false;
	
	return valid;
}

// Verifies date formats of the two date inputs in case someone manually enters a date
function verifyDateFormat() {
	var valid = true;
	$("#date-inputs input").each(function() {
		if(!moment($(this).val(), "YYYY-MM-DD HH:mm", true).isValid()) {
			$(this).addClass("is-invalid");
			valid = false;
		}
		else
			$(this).removeClass("is-invalid");
	});
	// only compare range if they are valid dates first
	if( valid ) {
		// if the ISO formatted start date comes after the ISO formatted end date, then it is not a valid date range
		if(!moment(formatInputToISO("#start-date-text")).isBefore(formatInputToISO("#end-date-text"))) {
			valid = false;
			$("#confirm-task").addClass("is-invalid");
			$("#date-inputs input").each(function() {
				$(this).addClass("is-invalid");
			});
		}
		else 
			$("#confirm-task").removeClass("is-invalid");
	}
	return valid
}
// -----------END Modal-specific functions--------

// --------BEGIN tooltip-specific functions--------
// Bootstrap popover options, specified in their docs
function popoverOptions(taskObj, triggerType) {
	return { 
		html: true,
		animation: true,
		title: "<div class='row'><div class='col-md-10'>" + taskObj.title + "</div><div class='col-md-2'>" + tooltipSprites(taskObj) + "</div></div>",
		content: displayTooltip(taskObj),
		trigger: triggerType,
		placement: "top",
		container: "body"
	};
}

// The "content" field of the above Bootstrap popover.  Edit this to change tooltip info 
function displayTooltip(taskObj) {
	let tooltipPrint = "Start: " + formatFullDate(taskObj.start)
		+ "<br> End: " + formatFullDate(taskObj.end)
		+ "<br> Type: " + taskObj.type
		+ "<br> Description: " + taskObj.description
		+ "<br> Priority: " + taskObj.priority;
	
	if( taskObj.dependsOn ){
		let target = getPredecessor(taskObj);
		return tooltipPrint + "<br> Depends On: " + target.title + "<br>";
	}
	else
		return tooltipPrint;
}

// Selects appropriate sprite for calendar tooltip based on priority
// 1-3 = high priority, 4-7 = medium priority, 8-10 = low priority
function tooltipSprites(taskObj) {
	if( taskObj.priority <= 3 )
		return "<img class='float-right' src='" + highPriority + "' height = '20' width = '20'>";
	else if( taskObj.priority <= 7 && taskObj.priority >= 4)
		return "<img class='float-right' src='" + medPriority + "' height = '20' width = '20'>";
	else
		return "<img class='float-right' src='" + lowPriority + "' height = '20' width = '20'>";
}
// --------END tooltip-specific functions--------

// ---------Helper functions for dependencies--------
// Gets a tasks object array given a task ID
function getTaskObject(id) {
	for (var i = tasks.length - 1; i >= 0; --i) {
    if (tasks[i].id === id) {
			return tasks[i];
    }
	}
}

// returns the task object specified in another task's dependsOn field
// filter returns an array, but since ID's are unique we return first object
function getPredecessor(taskObj) {
	var predecessor = tasks.filter(function (x) {
		return x.id === taskObj.dependsOn
	})[0];
	if( predecessor )
		return predecessor;
	return false;
}

// Similar to above function except it gets a list of dependencies of a taskObj
function getDependency(taskObj) {
	var dependencies = tasks.filter(function(x) {
		return x.dependsOn === taskObj.id;
	});
	if( dependencies )
		return dependencies;
	return false;
}

// -----Date format functions using moment.js---------
// Used on the 2 input fields in the modal.
// Returns the text in the date inputs in a properly formatted ISO moment
function formatInputToISO(dateSelector) {
	return moment($(dateSelector).val()).format();
}
function formatFullDate(eventDate) {
	return moment(eventDate).format("YYYY-MM-DD HH:mm");
}
// ---------------------------------------
// END Shared Calendar/Gantt functions
// ---------------------------------------