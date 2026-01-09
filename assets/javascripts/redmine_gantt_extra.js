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
     * Calculate pixels per day based on the Gantt chart headers
     * @return {number} Pixels per day
     */
    _private.getPxPerDay = function () {
        var $headers = $(_private.config.headerSelector);
        if ($headers.length === 0) return _private.config.defaultPxPerDay;

        var maxTop = 0;
        $headers.each(function () {
            var top = parseInt($(this).css('top'), 10);
            if (top > maxTop) maxTop = top;
        });

        var $bottomHeaders = $headers.filter(function () {
            return Math.abs(parseInt($(this).css('top'), 10) - maxTop) < 2;
        });

        if ($bottomHeaders.length > 0) {
            return $($bottomHeaders[0]).outerWidth();
        }
        return _private.config.defaultPxPerDay;
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
