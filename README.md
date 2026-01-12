# Redmine Gantt Extra

A Redmine plugin that enhances the standard Gantt chart with improved usability, new features, and a premium UI.

## Key Features

### 1. Intuitive Scheduling (Drag & Drop / Resize)
- **Reschedule**: Drag tasks horizontally on the timeline to shift both start and due dates.
- **Resize**: Drag the edges of task bars to adjust the start or due date independently.
- **Parent Reassignment**: Drag and drop issue subjects (on the left) to change their parent issues dynamically.
- **Real-time updates**: All changes are saved instantly via AJAX.

### 2. Date Display Mode (Compact Mode)
- **Toggle View**: A "Switch to Date View" button in the top-right allows you to display numeric dates instead of week numbers.
- **Sleek Layout**: Slims down the header to maximize the usable chart area.
- **Persistence**: Your selected view mode is remembered even after page reloads.

### 3. Quick Edit Popover
- **Instant Editing**: Click any Gantt bar to open a quick-edit popup.
- **Fields**: Modify Start Date, Due Date, Done Ratio, and Assignee on the fly.
- **Seamless Experience**: Update issue details without leaving the Gantt page.

### 4. Advanced Tree View Filter
- **Hierarchy Focus**: Adds a "Parent Issue ID" filter to the Gantt options.
- **Descendant View**: Displays the selected parent and all its children/descendants, allowing you to focus on specific project branches.

### 5. Premium Design system
- **Modern UI**: Features glassmorphism (background blurring), subtle shadows, and smooth CSS animations.
- **Accessibility**: Enhances usability through highlighted weekend backgrounds and visual feedback (icons) for resize handles.
- **Full I18n Support**: All UI labels and messages are fully localized (English and Japanese included).

## Installation

1.  Clone this repository into your Redmine `plugins` directory:
    ```bash
    cd /path/to/redmine/plugins
    git clone https://github.com/yken-tsuru/redmine_gantt_extra.git
    ```
2.  Restart your Redmine application.

## How to Use

### Toggle Date View
In the Gantt chart's contextual menu (top-right), click "Switch to Date View" to toggle the compact display mode.

### Quick Edit
Click on any task bar to open the editor. Change the values and click "Save" to apply.

### Change Parent
Drag the subject of an issue from the list on the left and drop it onto another issue name to set it as the new parent.

## Technical Details
For technical documentation, please refer to `IMPLEMENTATION_GUIDE.md`.
