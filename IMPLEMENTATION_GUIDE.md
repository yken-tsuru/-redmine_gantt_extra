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
