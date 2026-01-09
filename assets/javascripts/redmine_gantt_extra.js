/**
 * Redmine Gantt Extra Plugin
 * Adds drag and drop functionality to the Redmine Gantt chart.
 * 
 * @author Antigravity
 * @version 0.1.0
 */

var RedmineGanttExtra = (function ($) {
    'use strict';

    var _public = {};
    var _private = {};

    // Configuration and State
    _private.config = {
        ganttAreaSelector: '#gantt_area',
        headerSelector: '.gantt_hdr',
        tooltipSelector: '.tooltip',
        taskBarSelectors: '.task_todo, .task_late, .task_done',
        issueIdPattern: /issue-(\d+)/,
        defaultPxPerDay: 16
    };

    /**
     * Initialize the plugin
     */
    _public.init = function () {
        console.log('Redmine Gantt Extra: Initializing...');

        if (!_private.checkPrerequisites()) {
            return;
        }

        _private.setupAjax();
        _private.addParentIssueFilter();
        _private.initSubjectDraggables(); // NEW: Parent Reassignment
        _private.initResizables(); // NEW: Resizing
        _private.initQuickEditor(); // NEW: Quick Edit
        _private.initDraggables();

        console.log('Redmine Gantt Extra: Initialization complete.');
    };

    /**
     * Check if necessary DOM elements and libraries are present
     * @return {boolean} True if prerequisites are met
     */
    _private.checkPrerequisites = function () {
        var $area = $(_private.config.ganttAreaSelector);
        var $headers = $(_private.config.headerSelector);

        if ($area.length === 0 && $headers.length === 0) {
            // Not a gantt page
            return false;
        }

        if (typeof $.fn.draggable === 'undefined') {
            console.error('Redmine Gantt Extra: jQuery UI Draggable functionality is missing.');
            return false;
        }

        return true;
    };

    /**
     * Setup global AJAX settings (CSRF token)
     */
    _private.setupAjax = function () {
        $.ajaxSetup({
            headers: {
                'X-CSRF-Token': $('meta[name="csrf-token"]').attr('content')
            }
        });
    };

    /**
     * Add filter input for Parent Issue ID
     */
    _private.addParentIssueFilter = function () {
        if ($('#parent_issue_id').length > 0) return;

        var $form = $('#query_form');
        if ($form.length === 0) {
            console.warn('Redmine Gantt Extra: #query_form not found. Filter input cannot be added.');
            return;
        }

        console.log('Redmine Gantt Extra: Adding parent issue filter input.');
        var urlParams = new URLSearchParams(window.location.search);
        var val = urlParams.get('parent_issue_id') || '';

        var labelText = (typeof RedmineGanttExtra.label_parent_issue_id !== 'undefined') ? RedmineGanttExtra.label_parent_issue_id : 'Parent Issue ID';

        var $wrapper = $('<p>').css({ 'float': 'left', 'margin-right': '15px' });
        var $label = $('<label>').attr('for', 'parent_issue_id').text(labelText + ': ').css('margin-right', '5px');
        var $input = $('<input>').attr({
            type: 'text',
            name: 'parent_issue_id',
            id: 'parent_issue_id',
            value: val,
            size: 10
        });

        $wrapper.append($label).append($input);

        var $buttons = $form.find('p.buttons');
        if ($buttons.length > 0) {
            $wrapper.insertBefore($buttons);
        } else {
            $form.append($wrapper);
        }
    };

    /**
     * Calculate pixels per day based on the Gantt chart zoom level
     * @return {number} Pixels per day
     */
    _private.getPxPerDay = function () {
        var urlParams = new URLSearchParams(window.location.search);
        var zoom = parseInt(urlParams.get('zoom'), 10) || 3; // Default to 3

        // Redmine Gantt Zoom Map
        // 1: 4px
        // 2: 8px
        // 3: 16px
        // 4: 24px
        var zoomMap = {
            1: 4,
            2: 8,
            3: 16,
            4: 24
        };

        return zoomMap[zoom] || 16;
    };

    /**
     * Initialize draggable functionality on issue subjects for parent reassignment
     */
    _private.initSubjectDraggables = function () {
        var $subjects = $("div.issue-subject");

        if (typeof $.fn.droppable === 'undefined') {
            console.warn('Redmine Gantt Extra: jQuery UI Droppable not present.');
            return;
        }

        console.log('Redmine Gantt Extra: Initializing Subject Draggables for ' + $subjects.length + ' elements.');

        // Make subjects draggable
        $subjects.draggable({
            helper: 'clone',
            opacity: 0.7,
            cursor: 'move',
            revert: 'invalid', // Revert if not dropped on a valid droppable
            zIndex: 1000,
            distance: 10,
            start: function (event, ui) {
                $(this).addClass('is-dragging');
                ui.helper.css('width', $(this).width());
                ui.helper.addClass('issue-subject'); // Ensure helper looks like original
            },
            stop: function (event, ui) {
                $(this).removeClass('is-dragging');
            }
        });

        // Make subjects droppable (to accept children)
        $subjects.droppable({
            accept: function (draggable) {
                // Check if the dragged element is an issue subject
                return draggable.hasClass('issue-subject');
            },
            hoverClass: 'subject-hover',
            tolerance: 'pointer',
            over: function (event, ui) {
                // console.log('Over:', $(this).attr('id')); // Too verbose for production, useful for deep debug
            },
            drop: function (event, ui) {
                var $dragged = ui.draggable;
                var $target = $(this);

                var draggedIdMatch = $dragged.attr('id').match(/issue-(\d+)/);
                var targetIdMatch = $target.attr('id').match(/issue-(\d+)/);

                if (!draggedIdMatch || !targetIdMatch) return;

                var draggedId = draggedIdMatch[1];
                var targetId = targetIdMatch[1];

                // Prevent dropping on self
                if (draggedId === targetId) return;

                console.log("Reassigning: Issue " + draggedId + " -> New Parent " + targetId);

                if (confirm('Are you sure you want to change the parent of issue #' + draggedId + ' to issue #' + targetId + '?')) {
                    _private.updateIssueParent(draggedId, targetId);
                }
            }
        });
    };

    /**
     * AJAX call to update issue parent
     */
    _private.updateIssueParent = function (issueId, parentId) {
        var rootPath = (typeof R !== 'undefined' && R.path) ? R.path : '/';

        // Use standard form submission format instead of JSON API
        var payload = {
            'issue[parent_issue_id]': parentId
        };

        console.log('Redmine Gantt Extra: Updating parent for Issue #' + issueId, payload);

        // Reuse the shared submit function
        _private.submitIssueUpdate(issueId, payload, rootPath);
    };

    /**
     * Initialize resizable functionality on task tooltips
     */
    _private.initResizables = function () {
        var $tooltips = $(_private.config.tooltipSelector).filter(function () {
            var data = $(this).attr('data-collapse-expand');
            return data && data.match(_private.config.issueIdPattern);
        });

        if (typeof $.fn.resizable === 'undefined') {
            console.warn('Redmine Gantt Extra: jQuery UI Resizable not present.');
            return;
        }

        console.log('Redmine Gantt Extra: Found ' + $tooltips.length + ' resizable elements.');
        var pxPerDay = _private.getPxPerDay();

        $tooltips.resizable({
            handles: 'e, w', // East (right) and West (left) handles
            minWidth: pxPerDay, // Minimum width 1 day
            grid: [pxPerDay, 0], // Snap to day grid
            start: function (event, ui) {
                var $el = $(this);
                $el.data('start-width', ui.size.width);
                $el.data('start-left', ui.position.left);

                // Tooltip setup
                var $tooltip = $('<div class="gantt-resize-tooltip">Loading...</div>');
                $('body').append($tooltip);
                $el.data('resize-tooltip', $tooltip);

                var issueIdMatch = $el.attr('data-collapse-expand').match(_private.config.issueIdPattern);
                if (issueIdMatch) {
                    var issueId = issueIdMatch[1];
                    _private.fetchIssueDates(issueId, function (dates) {
                        $el.data('issue-dates', dates);
                        // Trigger an update if still dragging
                        if ($el.data('resize-tooltip')) {
                            // Force update (simulate resize event logic effectively)
                            // But we lack 'ui' here easily. 
                            // Simplified: just set flag.
                            $el.data('dates-loaded', true);
                        }
                    });
                }
            },
            resize: function (event, ui) {
                var $el = $(this);
                var $tooltip = $el.data('resize-tooltip');
                if (!$tooltip) return;

                var deltaWidth = ui.size.width - $el.data('start-width');
                var deltaLeft = ui.position.left - $el.data('start-left');
                var pxPerDay = _private.getPxPerDay(); // Re-fetch to be safe

                var deltaDays = 0;
                var mode = ''; // 'start' or 'due'

                if (Math.abs(deltaLeft) > 1) {
                    deltaDays = Math.round(deltaLeft / pxPerDay);
                    mode = 'start';
                } else {
                    deltaDays = Math.round(deltaWidth / pxPerDay);
                    mode = 'due';
                }

                // Update Tooltip Position
                $tooltip.css({
                    top: event.pageY - 30,
                    left: event.pageX + 15
                });

                var dates = $el.data('issue-dates');
                if (dates) {
                    var baseDateStr = (mode === 'start') ? dates.start_date : dates.due_date;
                    if (baseDateStr) {
                        // Calc new date
                        var parts = baseDateStr.split('-');
                        var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                        d.setDate(d.getDate() + deltaDays);

                        var newY = d.getFullYear();
                        var newM = d.getMonth() + 1;
                        var newD = d.getDate();
                        var newDateStr = newY + '-' + (newM < 10 ? '0' + newM : newM) + '-' + (newD < 10 ? '0' + newD : newD);

                        $tooltip.text((mode === 'start' ? 'Start: ' : 'Due: ') + newDateStr + ' (' + (deltaDays > 0 ? '+' : '') + deltaDays + 'd)');
                    } else {
                        $tooltip.text((mode === 'start' ? 'Start' : 'Due') + ': ' + (deltaDays > 0 ? '+' : '') + deltaDays + ' days');
                    }
                } else {
                    $tooltip.text('Moving: ' + (deltaDays > 0 ? '+' : '') + deltaDays + ' days');
                }
            },
            stop: function (event, ui) {
                var $el = $(this);
                var $tooltip = $el.data('resize-tooltip');
                if ($tooltip) {
                    $tooltip.remove();
                    $el.removeData('resize-tooltip');
                }
                $el.removeData('issue-dates');
                $el.removeData('dates-loaded');

                var deltaWidth = ui.size.width - $el.data('start-width');
                var deltaLeft = ui.position.left - $el.data('start-left');

                // Determine direction and delta days
                var deltaDays = 0;
                var issueIdMatch = $el.attr('data-collapse-expand').match(_private.config.issueIdPattern);
                if (!issueIdMatch) return;
                var issueId = issueIdMatch[1];

                var pxPerDay = _private.getPxPerDay();

                // If left position changed, it's a start_date change (West handle)
                if (Math.abs(deltaLeft) > 1) {
                    deltaDays = Math.round(deltaLeft / pxPerDay);
                    _private.updateIssueSingleDate(issueId, 'start_date', deltaDays);
                }
                // If only width changed but left stayed same, it's a due_date change (East handle)
                else {
                    deltaDays = Math.round(deltaWidth / pxPerDay);
                    _private.updateIssueSingleDate(issueId, 'due_date', deltaDays);
                }
            }
        });
    };

    /**
     * Helper to fetch issue dates for tooltip
     */
    _private.fetchIssueDates = function (issueId, callback) {
        var rootPath = (typeof R !== 'undefined' && R.path) ? R.path : '/';
        var url = rootPath + 'issues/' + issueId + '.json';

        $.getJSON(url, function (data) {
            if (data && data.issue) {
                callback({
                    start_date: data.issue.start_date,
                    due_date: data.issue.due_date
                });
            }
        });
    };

    /**
     * Update single date (start or due) due to resize
     */
    _private.updateIssueSingleDate = function (issueId, dateField, daysDelta) {
        if (daysDelta === 0) return;

        var rootPath = (typeof R !== 'undefined' && R.path) ? R.path : '/';
        var url = rootPath + 'issues/' + issueId + '.json';

        $.getJSON(url, function (data) {
            if (!data || !data.issue) {
                window.location.reload();
                return;
            }
            var issue = data.issue;
            var currentStr = issue[dateField];
            if (!currentStr) {
                // Creating date where none existed might be complex without reference, rely on reload
                window.location.reload();
                return;
            }

            // Safe Local Date Parsing to avoid timezone shifts
            var parts = currentStr.split('-');
            var y = parseInt(parts[0], 10);
            var m = parseInt(parts[1], 10) - 1;
            var d = parseInt(parts[2], 10);

            var dateObj = new Date(y, m, d);
            dateObj.setDate(dateObj.getDate() + daysDelta);

            var newY = dateObj.getFullYear();
            var newM = dateObj.getMonth() + 1;
            var newD = dateObj.getDate();

            var newStr = newY + '-' + (newM < 10 ? '0' + newM : newM) + '-' + (newD < 10 ? '0' + newD : newD);

            console.log('Resizing Issue #' + issueId + ': ' + dateField + ' from ' + currentStr + ' to ' + newStr + ' (delta: ' + daysDelta + ')');

            var payload = {};
            payload['issue[' + dateField + ']'] = newStr;

            _private.submitIssueUpdate(issueId, payload, rootPath);
        });
    };

    /**
     * Initialize Quick Editor functionality on task click
     */
    _private.initQuickEditor = function () {
        // Bind to elements that represent the task bar
        // .task_todo, .task_late, .task_done are the visible bars.
        // .tooltip is the overlay. We bind to tooltip as it covers them.
        $(_private.config.tooltipSelector).on('click', function (e) {
            // Check if it's a valid issue
            var data = $(this).attr('data-collapse-expand');
            var match = data && data.match(_private.config.issueIdPattern);
            if (!match) return;

            e.preventDefault();
            e.stopPropagation(); // Stop navigation

            var issueId = match[1];
            _private.openQuickEditor(issueId, e.pageX, e.pageY);
        });

        // Close popup on click outside
        $(document).on('click', function (e) {
            if (!$(e.target).closest('.gantt-quick-edit-popup').length) {
                $('.gantt-quick-edit-popup').remove();
            }
        });
    };

    /**
     * Open Quick Editor Popup
     */
    _private.openQuickEditor = function (issueId, x, y) {
        // Remove existing
        $('.gantt-quick-edit-popup').remove();

        var rootPath = (typeof R !== 'undefined' && R.path) ? R.path : '/';
        var url = rootPath + 'issues/' + issueId + '.json';

        // Show loading or wait? Better wait for data.
        $.getJSON(url, function (data) {
            if (!data || !data.issue) return;
            var issue = data.issue;

            // Generate UI
            var $popup = $('<div class="gantt-quick-edit-popup">');
            $popup.append('<h3>Edit Issue #' + issue.id + '</h3>');

            // Start Date
            var start = issue.start_date || '';
            $popup.append('<div class="form-row"><label>Start:</label><input type="date" name="start_date" value="' + start + '"></div>');

            // Due Date
            var due = issue.due_date || '';
            $popup.append('<div class="form-row"><label>Due:</label><input type="date" name="due_date" value="' + due + '"></div>');

            // Done Ratio
            var $ratioSelect = $('<select name="done_ratio">');
            for (var i = 0; i <= 100; i += 10) {
                var selected = (issue.done_ratio === i) ? 'selected' : '';
                $ratioSelect.append('<option value="' + i + '" ' + selected + '>' + i + ' %</option>');
            }
            $popup.append($('<div class="form-row"><label>Done:</label>').append($ratioSelect));

            // Assignee
            var $assigneeSelect = $('<select name="assigned_to_id">');
            $assigneeSelect.append('<option value="">(None)</option>');

            // Populate from injected data
            var currentAssigneeId = issue.assigned_to ? issue.assigned_to.id : null;
            if (RedmineGanttExtra.assignables && RedmineGanttExtra.assignables.length > 0) {
                $.each(RedmineGanttExtra.assignables, function (idx, user) {
                    var selected = (currentAssigneeId == user.id) ? 'selected' : '';
                    $assigneeSelect.append('<option value="' + user.id + '" ' + selected + '>' + user.name + '</option>');
                });
            } else {
                // Fallback: If no injected data, at least show current assignee if exists
                if (issue.assigned_to) {
                    $assigneeSelect.append('<option value="' + issue.assigned_to.id + '" selected>' + issue.assigned_to.name + '</option>');
                }
                $assigneeSelect.append('<option disabled>Loading user list failed or empty</option>');
            }
            $popup.append($('<div class="form-row"><label>Assignee:</label>').append($assigneeSelect));

            // Buttons
            var $btns = $('<div class="gantt-quick-edit-buttons">');
            var $saveBtn = $('<button>Save</button>').click(function () {
                _private.submitQuickEdit(issueId, $popup);
            });
            var $cancelBtn = $('<button>Cancel</button>').click(function () {
                $popup.remove();
            });

            $btns.append($cancelBtn).append($saveBtn);
            $popup.append($btns);

            $('body').append($popup);
            $popup.css({ top: y, left: x });
        });
    };

    /**
     * Submit Quick Edit Data
     */
    _private.submitQuickEdit = function (issueId, $popup) {
        var start = $popup.find('input[name="start_date"]').val();
        var due = $popup.find('input[name="due_date"]').val();
        var ratio = $popup.find('select[name="done_ratio"]').val();
        var assignee = $popup.find('select[name="assigned_to_id"]').val();

        var payload = {
            'issue[start_date]': start,
            'issue[due_date]': due,
            'issue[done_ratio]': ratio,
            'issue[assigned_to_id]': assignee
        };

        var rootPath = (typeof R !== 'undefined' && R.path) ? R.path : '/';
        _private.submitIssueUpdate(issueId, payload, rootPath);
        $popup.remove();
    };

    /**
     * Initialize draggable functionality on task tooltips
     */
    _private.initDraggables = function () {
        var $tooltips = $(_private.config.tooltipSelector).filter(function () {
            var data = $(this).attr('data-collapse-expand');
            return data && data.match(_private.config.issueIdPattern);
        });

        console.log('Redmine Gantt Extra: Found ' + $tooltips.length + ' draggable elements.');

        var pxPerDay = _private.getPxPerDay();
        console.log('Redmine Gantt Extra: Scale is ' + pxPerDay + ' px/day.');

        $tooltips.draggable({
            axis: 'x',
            cursor: 'move',
            distance: 10,
            start: function (event, ui) {
                _private.handleDragStart(this, ui);
            },
            drag: function (event, ui) {
                _private.handleDrag(this, ui);
            },
            stop: function (event, ui) {
                _private.handleDragStop(this, ui, pxPerDay);
            }
        });
    };

    _private.handleDragStart = function (el, ui) {
        var issueKey = $(el).attr('data-collapse-expand');
        var $related = $('div[data-collapse-expand="' + issueKey + '"]');

        $(el).data('related-elements', $related);
        $(el).data('start-left', ui.position.left);

        $related.each(function () {
            $(this).data('origin-left', parseInt($(this).css('left'), 10));
            $(this).css('opacity', '0.6');
        });
    };

    _private.handleDrag = function (el, ui) {
        var delta = ui.position.left - $(el).data('start-left');
        var $related = $(el).data('related-elements');

        $related.not(el).each(function () {
            var origin = $(this).data('origin-left');
            $(this).css('left', (origin + delta) + 'px');
        });
    };

    _private.handleDragStop = function (el, ui, pxPerDay) {
        var $related = $(el).data('related-elements');
        $related.css('opacity', '');

        var deltaPx = ui.position.left - $(el).data('start-left');
        var deltaDays = Math.round(deltaPx / pxPerDay);

        var issueKey = $(el).attr('data-collapse-expand');
        var matches = issueKey.match(_private.config.issueIdPattern); // issue-(\d+)

        if (matches && matches[1]) {
            // Logic to confirm action could go here
            _private.updateIssueDate(matches[1], deltaDays);
        } else {
            // Revert if ID not found
            _private.revertPosition($related);
        }
    };

    _private.revertPosition = function ($elements) {
        $elements.each(function () {
            $(this).animate({ left: $(this).data('origin-left') }, 200);
        });
    };

    /**
     * Fetch issue data and update start/due dates
     * @param {string} issueId 
     * @param {number} daysDelta 
     */
    _private.updateIssueDate = function (issueId, daysDelta) {
        if (daysDelta === 0) return;

        var rootPath = (typeof R !== 'undefined' && R.path) ? R.path : '/';
        var url = rootPath + 'issues/' + issueId + '.json';

        $.getJSON(url, function (data) {
            if (!data || !data.issue) {
                alert('Error: Could not fetch issue data.');
                window.location.reload();
                return;
            }

            var issue = data.issue;
            var start = issue.start_date ? new Date(issue.start_date) : null;
            var due = issue.due_date ? new Date(issue.due_date) : null;
            var payload = {};

            if (start) {
                start.setDate(start.getDate() + daysDelta);
                payload['issue[start_date]'] = start.toISOString().slice(0, 10);
            }
            if (due) {
                due.setDate(due.getDate() + daysDelta);
                payload['issue[due_date]'] = due.toISOString().slice(0, 10);
            }

            _private.submitIssueUpdate(issueId, payload, rootPath);
        }).fail(function () {
            alert('Error: Network error while fetching issue data.');
            window.location.reload();
        });
    };

    /**
     * Submit the update via POST (method=put) to handle session correctly
     * @param {string} issueId 
     * @param {object} dataPayload 
     * @param {string} rootPath 
     */
    _private.submitIssueUpdate = function (issueId, dataPayload, rootPath) {
        var updateUrl = rootPath + 'issues/' + issueId;

        // Add Rails method override and CSRF token
        dataPayload['_method'] = 'put';
        dataPayload['authenticity_token'] = $('meta[name="csrf-token"]').attr('content');

        console.log('Redmine Gantt Extra: Submitting update for Issue #' + issueId, dataPayload);

        $.ajax({
            url: updateUrl,
            type: 'POST',
            data: dataPayload,
            success: function () {
                console.log('Redmine Gantt Extra: Update successful. Reloading.');
                window.location.reload();
            },
            error: function (xhr) {
                _private.handleUpdateError(xhr);
            }
        });
    };

    _private.handleUpdateError = function (xhr) {
        var msg = 'Failed to update issue';
        if (xhr.status === 403) {
            msg = 'Permission denied: You do not have permission to edit this issue.';
        } else if (xhr.responseJSON && xhr.responseJSON.errors) {
            msg = 'Validation failed: ' + xhr.responseJSON.errors.join(', ');
        } else {
            msg += ': ' + xhr.status + ' ' + xhr.statusText;
        }
        alert(msg);
        window.location.reload();
    };

    return _public;

})(jQuery);

// Initialize when DOM is ready
$(function () {
    RedmineGanttExtra.init();
});
