# Redmine Gantt Extra

A Redmine plugin that enhances the standard Gantt chart with improved usability and new features.

## Features

### 1. Drag & Drop Rescheduling
Allows users to modify the start and due dates of issues directly on the Gantt chart by dragging and dropping the task bars.
- Drag tasks horizontally to shift dates.
- Updates are saved via AJAX.
- Respects user permissions (issues are only draggable if the user has permission to edit them).

### 2. Tree View Filter
Provides a "Tree View" mode to focus on a specific task hierarchy.
- Adds a "Parent Issue ID" filter to the Gantt options.
- When filtered, displays the specified parent issue and all its descendants (children, grandchildren, etc.).
- Excludes unrelated issues for a cleaner view.

## Installation

1.  Clone this repository into your Redmine `plugins` directory:
    ```bash
    cd /path/to/redmine/plugins
    git clone https://github.com/your-repo/redmine_gantt_extra.git
    ```
2.  Restart Redmine.

## Usage

### Drag & Drop
Simply open the Gantt chart (`/projects/xxx/issues/gantt`). If you have edit permissions, you can drag visible task bars.

### Tree View
1.  Navigate to the Gantt chart.
2.  Locate the "Parent Issue ID" input field in the filter area.
3.  Enter the ID of the root issue you want to view.
4.  Click "Apply".
5.  The Gantt chart will display the tree structure rooted at the specified issue.
