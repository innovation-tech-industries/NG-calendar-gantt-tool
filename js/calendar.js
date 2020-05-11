// ========================================================
// Innovation Tech Industries - calendar-gantt-tool
// innovation.tech.industries@gmail.com
// calendar.js:
// 		--calendar-specific options and functions
//		--built on Fullcalendar.io v2.2.7 
// ========================================================


// ---------------------------------------
// BEGIN Calendar-specific functions
// ---------------------------------------
// PURPOSE: Initialize calendar with a default view of month
// PARAMS: Any parameter that is left out is automatically set to a default value per Fullcalendar documentation
// --changeView: type of view to change calendar to
// --first: Used in quarter and year views for starting month
// --last: Used in quarter and year views for ending month
// --columns: Used in quarter and year views for how many months are displayed in a row
function initializeCalendar(changeView, first, last, columns) {
	$('#calendar').fullCalendar({
		header: {
			left: '',
			center: 'title',
			right: ''
		},
		firstMonth: first,
		lastMonth: last,
		defaultDate: moment(),
		defaultView: changeView,
		yearColumns: columns,
		selectable: true,
		select: function (start, end) {
			addTaskModal(); // pull up add task modal
			// set start/end date and time to whatever the user had just selected
			$("#start-date-text").val(formatFullDate(start));
			$("#end-date-text").val(formatFullDate(end));

			$('#calendar').fullCalendar('unselect');
		},
		eventRender: function(eventObj, $el) {
			// tooltip that appears on hover
			// can be edited in popOverOptions function in index.js
			$el.popover(popoverOptions(eventObj, "hover"));
			colorCalendarEvents(eventObj, $el);	// colors calendar events according to filteredTypes
		},
		eventClick: function(event) {
			$(this).popover("hide");	// hide any stray tooltips
			editTaskModal(event);
		},
		firstDay: 0,
		eventLimit: true, // allow "more" link when too many events
		events: tasks	// data to pull from is tasks array
	});
}

// sets calendar task colors without appending a color field to tasks array like what is suggested in docs
function colorCalendarEvents(taskObj, element) {
	for (let i = 0; i < filteredTypes.length; i++){
		if (taskObj.type === filteredTypes[i]){
			element.css("background-color", colors(i));
			element.css("border-color", colors(i));
		}
	}
}
// ---------------------------------------
// END Calendar-specific functions
// ---------------------------------------