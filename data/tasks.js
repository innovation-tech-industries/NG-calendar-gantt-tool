// ========================================================
// Innovation Tech Industries - calendar-gantt-tool
// innovation.tech.industries@gmail.com
// tasks.js:
// 		--JSON styled array of tasks included in <head> of HTML
// ========================================================

// array of tasks, must be called "tasks" unless you do assignment in index.js
var tasks = [
		{
      "id": 1,
			"title": "Write function to wrap words in gantt chart",
      "description": "This will describe task 1",
      "type": "Phase 1",
			"start": "2020-02-09T01:36:00",
			"end": "2020-02-15T02:36:00",
			"dependsOn": null,
			"priority": 1
    },
    {
      "id": 2,
			"title": "WBS 1.2",
      "description": "This will describe task 2",
      "type": "Phase 1",
			"start": "2020-02-15T04:56:00",
			"end": "2020-02-23T06:35:00",
			"dependsOn": 1,
			"priority": 3
    },
    {
      "id": 3,
			"title": "Task 3",
      "description": "This will describe task 3",
      "type": "Phase 1",
			"start": "2020-02-20T06:29:00",
			"end": "2020-02-25T08:45:00",
			"dependsOn": 1,
			"priority": 5
    },
    {
      "id": 4,
			"title": "Task 4",
      "description": "This will describe task 4",
      "type": "Phase 1",
			"start": "2020-02-26T08:45:00",
			"end": "2020-03-09T10:21:00",
			"dependsOn": 3,
			"priority": 6
    },
    {
      "id": 5,
			"title": "Task 5",
      "description": "This will describe task 5",
      "type": "Phase 1",
			"start": "2020-03-09T11:08:00",
			"end": "2020-03-16T11:33:00",
			"dependsOn": 4,
			"priority": 6
    },
    {
      "id": 6,
			"title": "Task 6",
      "description": "This will describe task 6",
      "type": "Phase 1",
			"start": "2020-03-25T06:08:00",
			"end": "2020-03-27T15:33:00",
			"dependsOn": null,
			"priority": 9
    },
    {
      "id": 7,
			"title": "Task 7",
      "description": "This will describe task 7",
      "type": "Phase 1",
			"start": "2020-03-26T13:30:00",
			"end": "2020-03-28T16:00:00",
			"dependsOn": null,
			"priority": 1
    },
    {
      "id": 8,
			"title": "Task 8",
      "description": "This will describe task 8",
      "type": "Phase 1",
			"start": "2020-03-28T11:08:00",
			"end": "2020-03-30T11:33:00",
			"dependsOn": null,
			"priority": 1
    },
    {
      "id": 9,
			"title": "Task 9",
      "description": "This will describe task 9",
      "type": "Phase 2",
			"start": "2020-03-21T11:08:00",
			"end": "2020-03-30T11:33:00",
			"dependsOn": null,
			"priority": 1
    }
  ];