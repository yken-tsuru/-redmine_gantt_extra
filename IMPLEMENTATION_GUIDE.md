# Implementation Guide: Redmine Gantt Extra

This document details the technical implementation of the `redmine_gantt_extra` plugin.

## architecture Overview

The plugin modifies Redmine's Gantt chart behavior through two main mechanisms:
1.  **Backend Patching**: Monkey-patching `Redmine::Helpers::Gantt` to customize issue fetching logic.
2.  **Frontend Injection**: Injecting JavaScript and CSS via a View Hook to enhance the UI and enable drag & drop.

## Components

### 1. Initialization (`init.rb`)

The `init.rb` file is the entry point. It handles:
- Plugin registration.
- Loading the View Hook (`RedmineGanttExtra::Hooks`).
- Robustly applying the backend patch (`RedmineGanttExtra::PatchGantt`) to `Redmine::Helpers::Gantt` using `to_prepare` callbacks to support Rails auto-reloading.

### 2. Backend Logic

#### Tree View Filter (`lib/redmine_gantt_extra/patch_gantt.rb`)
- **Module**: `RedmineGanttExtra::PatchGantt`
- **Method**: Overrides/Prepends `#issues` in `Redmine::Helpers::Gantt`.
- **Logic**:
    - Checks for the presence of `parent_issue_id` in the initialization options.
    - If present, fetches the specified parent issue and its descendants (`parent.descendants.visible`).
    - Sorts the collection by the Nested Set column `lft` (`lft ASC`) to ensure the Gantt helper renders the indentation correctly.
    - If `parent_issue_id` is missing, it calls `super` to fall back to standard Redmine behavior.

### 3. Frontend Logic (`assets/javascripts/redmine_gantt_extra.js`)

#### Drag & Drop
- Uses jQuery UI Draggable (bundled with Redmine).
- **Initialization**: Finds all task bars (`.task_todo`, `.task_late`, `.task_done`) and makes their tooltips draggable.
- **Scaling**: Calculates `pixels_per_day` by analyzing the CSS positions of the Gantt headers to ensure accurate date transformation during dragging.
- **Update**: On drag stop, calculates the day delta and sends an AJAX PUT request to `/issues/:id.json` to update `start_date` and `due_date`.

#### Parent Reassignment
- **Initialization**: `_private.initSubjectDraggables` targets `.issue-subject` elements.
- **Draggable**: Helper is cloned to provide visual feedback.
- **Droppable**: Accepts other `.issue-subject` elements. 
- **Action**: On drop, confirms the action with the user and sends an AJAX PUT request to `/issues/:id.json` updating `parent_issue_id`.
- **Feedback**: Reloads the page upon success to reflect the new hierarchy.
- **フィードバック**: 成功時にページをリロードして新しい階層構造を反映させます。

#### Resizing (Duration Change)
- **Initialization**: `_private.initResizables` targets `.tooltip` elements within the Gantt area.
- **Library**: Uses jQuery UI Resizable (bundled) with 'e' (East) and 'w' (West) handles.
- **UX**: 
    - Adds visual grips (CSS) to handles for better affordance.
    - Displays a dynamic tooltip (`.gantt-resize-tooltip`) during drag showing the calculated date.
- **Logic**:
    - **East Handle (Right)**: Changing width affects `due_date`.
    - **West Handle (Left)**: Changing left position affects `start_date`.
- **Date Calculation**: Uses local `Date` parsing to ensure timezone stability (fixes "0-day delta" issues in some zones).
- **Zoom Support**: Calculates `pxHighPerDay` using standard Redmine zoom constants (4, 8, 16, 24) derived from the `zoom` URL parameter to ensure accuracy at all zoom levels.

#### Quick Edit Popover
- **Trigger**: Click event on `.tooltip` (Gantt bar).
- **Backend**: Injects `RedmineGanttExtra.assignables` (using `Project#assignable_users`) via `Hooks#view_layouts_base_html_head` to populate the assignee dropdown without extra API calls.
- **Frontend**: 
    - `_private.initQuickEditor` binds the click handler.
    - `_private.openQuickEditor` fetches the latest issue data (JSON) and renders an absolute-positioned popup (`.gantt-quick-edit-popup`).
- **UI**: Provides fields for Start Date, Due Date, Done Ratio (0-100%), and Assignee.
- **Action**: AJAX POST (method=put) to update the issue.

#### Tree View Input
- **Injection**: Dynamically appends a "Parent Issue ID" text input to the `#query_form` on the Gantt page.
- **Localization**: Uses `RedmineGanttExtra.label_parent_issue_id` (injected via Hooks) to display the localized label.

### 4. Integration (`lib/redmine_gantt_extra/hooks.rb`)

- **Class**: `RedmineGanttExtra::Hooks < Redmine::Hook::ViewListener>`
- **Hook**: `view_layouts_base_html_head`
- **Logic**:
    - Checks if the current controller is `GanttsController`.
    - If true, appends the plugin's CSS and JavaScript files.
    - Injects localized strings into the `RedmineGanttExtra` JS object for frontend use.

## Localization
Locale files are located in `config/locales/`.
- `en.yml`: English
- `ja.yml`: Japanese
