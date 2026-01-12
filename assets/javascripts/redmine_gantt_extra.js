/**
 * Redmine Gantt Extra Plugin
 * Improved version with better maintainability, security, and readability.
 * 
 * @author Antigravity
 * @version 0.2.1
 */

var RedmineGanttExtra = (function ($) {
    'use strict';

    var _public = {};
    var _private = {};

    // --- Configuration ---
    _private.config = {
        selectors: {
            ganttArea: '#gantt_area',
            header: '.gantt_hdr',
            tooltip: '.tooltip',
            taskBars: '.task_todo, .task_late, .task_done',
            issueSubjects: 'div.issue-subject',
            queryForm: '#query_form',
            csrfToken: 'meta[name="csrf-token"]'
        },
        classes: {
            dragging: 'is-dragging',
            subjectHover: 'subject-hover',
            resizeTooltip: 'gantt-resize-tooltip',
            quickEditPopup: 'gantt-quick-edit-popup',
            formRow: 'form-row',
            buttonGroup: 'gantt-quick-edit-buttons'
        },
        patterns: {
            issueId: /issue-(\d+)/
        },
        zoomMap: {
            1: 4,  // Year
            2: 8,  // Month
            3: 16, // Week
            4: 24  // Day
        },
        state: {
            isCompactMode: sessionStorage.getItem('gantt_extra_compact') === 'true'
        }
    };

    /**
     * Internationalization
     */
    _private.i18n = {
        t: function (key, params) {
            var str = (window.RedmineGanttExtraData && window.RedmineGanttExtraData.strings && window.RedmineGanttExtraData.strings[key]) || key;
            if (params) {
                $.each(params, function (k, v) {
                    str = str.replace('%{' + k + '}', v);
                });
            }
            return str;
        }
    };

    // --- Utilities ---
    _private.utils = {
        /**
         * Get Pixels per day based on current zoom
         */
        getPxPerDay: function () {
            var urlParams = new URLSearchParams(window.location.search);
            var zoom = parseInt(urlParams.get('zoom'), 10) || 3;
            return _private.config.zoomMap[zoom] || 16;
        },

        /**
         * Extract Issue ID from element or string
         */
        getIssueId: function (input) {
            var str = (typeof input === 'string') ? input : $(input).attr('id') || $(input).attr('data-collapse-expand');
            var match = str && str.match(_private.config.patterns.issueId);
            return match ? match[1] : null;
        },

        /**
         * Safe Date Parsing (avoiding timezone issues)
         */
        parseDate: function (dateStr) {
            if (!dateStr) return null;
            var parts = dateStr.split('-');
            if (parts.length !== 3) return new Date(dateStr);
            return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        },

        /**
         * Format Date to YYYY-MM-DD
         */
        formatDate: function (date) {
            if (!date) return '';
            var y = date.getFullYear();
            var m = date.getMonth() + 1;
            var d = date.getDate();
            return y + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d);
        },

        /**
         * Add days to a date string and return new string
         */
        addDays: function (dateStr, days) {
            var d = this.parseDate(dateStr);
            if (!d) return null;
            d.setDate(d.getDate() + days);
            return this.formatDate(d);
        },

        /**
         * Get Root Path for API calls
         */
        getRootPath: function () {
            return (typeof R !== 'undefined' && R.path) ? R.path : '/';
        }
    };

    // --- API Communication ---
    _private.api = {
        /**
         * Fetch current issue data from Redmine API
         */
        fetchIssue: function (issueId, callback) {
            var url = _private.utils.getRootPath() + 'issues/' + issueId + '.json';
            $.getJSON(url, function (data) {
                if (data && data.issue) {
                    callback(data.issue);
                }
            }).fail(function () {
                _private.ui.showError(_private.i18n.t('error_fetch_issue', { id: issueId }));
            });
        },

        /**
         * Update issue via API
         */
        updateIssue: function (issueId, payload, silent) {
            var url = _private.utils.getRootPath() + 'issues/' + issueId;
            var token = $(_private.config.selectors.csrfToken).attr('content');

            payload['_method'] = 'put';
            payload['authenticity_token'] = token;

            _private.ui.loading(true);

            $.ajax({
                url: url,
                type: 'POST',
                data: payload,
                success: function () {
                    if (!silent) window.location.reload();
                    else _private.ui.loading(false);
                },
                error: function (xhr) {
                    _private.ui.loading(false);
                    _private.ui.handleAjaxError(xhr);
                }
            });
        }
    };

    // --- UI Helpers ---
    _private.ui = {
        showError: function (message) {
            alert(message);
        },

        loading: function (show) {
            if (show) {
                if ($('#gantt-loader').length === 0) {
                    $('<div id="gantt-loader"/>').css({
                        position: 'fixed',
                        top: 0, left: 0, width: '100%', height: '100%',
                        backgroundColor: 'rgba(255,255,255,0.5)',
                        zIndex: 20000,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '20px', fontWeight: 'bold'
                    }).text(_private.i18n.t('loading')).appendTo('body');
                }
            } else {
                $('#gantt-loader').remove();
            }
        },

        handleAjaxError: function (xhr) {
            var msg = _private.i18n.t('error_update_failed');
            if (xhr.status === 403) {
                msg = _private.i18n.t('error_permission_denied');
            } else if (xhr.responseJSON && xhr.responseJSON.errors) {
                msg = _private.i18n.t('error_validation_failed', { errors: xhr.responseJSON.errors.join(', ') });
            } else if (xhr.statusText) {
                msg += ': ' + xhr.status + ' ' + xhr.statusText;
            }
            this.showError(msg);
            window.location.reload();
        },

        createFormRow: function (label, $content) {
            return $('<div/>')
                .addClass(_private.config.classes.formRow)
                .append($('<label/>').text(label))
                .append($content);
        }
    };

    // --- Modules ---

    /**
     * Parent Issue Filter in Query Form
     */
    _private.initParentFilter = function () {
        if ($('#parent_issue_id').length > 0) return;

        var $form = $(_private.config.selectors.queryForm);
        if ($form.length === 0) return;

        var urlParams = new URLSearchParams(window.location.search);
        var val = urlParams.get('parent_issue_id') || '';
        var labelText = _private.i18n.t('label_parent_issue_id');

        var $wrapper = $('<p>').css({ 'float': 'left', 'margin-right': '15px' });
        var $label = $('<label>').attr('for', 'parent_issue_id').text(labelText + ': ').css('margin-right', '5px');
        var $input = $('<input>').attr({
            type: 'text', name: 'parent_issue_id', id: 'parent_issue_id',
            value: val, size: 10
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
     * Drag and Drop for Entire Task
     */
    _private.initDraggables = function () {
        var $tooltips = $(_private.config.selectors.tooltip).filter(function () {
            return _private.utils.getIssueId(this);
        });

        var pxPerDay = _private.utils.getPxPerDay();

        $tooltips.draggable({
            axis: 'x',
            cursor: 'move',
            distance: 10,
            start: function (event, ui) {
                var $el = $(this);
                var issueKey = $el.attr('data-collapse-expand');
                var $related = $('div[data-collapse-expand="' + issueKey + '"]');

                $el.data('related-elements', $related);
                $el.data('start-left', ui.position.left);

                // Create dragging tooltip
                var $tip = $('<div/>').addClass(_private.config.classes.resizeTooltip).text(_private.i18n.t('loading'));
                $('body').append($tip);
                $el.data('drag-tooltip', $tip);

                var issueId = _private.utils.getIssueId($el);
                _private.api.fetchIssue(issueId, function (issue) {
                    $el.data('issue-data', issue);
                });

                $related.each(function () {
                    $(this).data('origin-left', parseInt($(this).css('left'), 10));
                    $(this).css('opacity', '0.6');
                });
            },
            drag: function (event, ui) {
                var $el = $(this);
                var delta = ui.position.left - $el.data('start-left');
                var $related = $el.data('related-elements');

                $related.not(this).each(function () {
                    var origin = $(this).data('origin-left');
                    $(this).css('left', (origin + delta) + 'px');
                });

                // Update tooltip
                var $tip = $el.data('drag-tooltip');
                if ($tip) {
                    $tip.css({ top: event.pageY - 40, left: event.pageX + 15 });
                    var deltaDays = Math.round(delta / pxPerDay);
                    var issue = $el.data('issue-data');
                    if (issue) {
                        var start = issue.start_date ? _private.utils.addDays(issue.start_date, deltaDays) : '?';
                        var due = issue.due_date ? _private.utils.addDays(issue.due_date, deltaDays) : '?';
                        $tip.html(
                            _private.i18n.t('label_start_date') + ': ' + start + '<br/>' +
                            _private.i18n.t('label_due_date') + ': ' + due +
                            ' (' + (deltaDays > 0 ? '+' : '') + deltaDays + 'd)'
                        );
                    }
                }
            },
            stop: function (event, ui) {
                var $el = $(this);
                var $related = $el.data('related-elements');
                var $tip = $el.data('drag-tooltip');
                if ($tip) $tip.remove();

                $related.css('opacity', '');

                var deltaPx = ui.position.left - $el.data('start-left');
                var deltaDays = Math.round(deltaPx / pxPerDay);

                if (deltaDays === 0) {
                    _private.revertPosition($related);
                    return;
                }

                var issueId = _private.utils.getIssueId($el);
                if (issueId) {
                    _private.api.fetchIssue(issueId, function (issue) {
                        var payload = {};
                        if (issue.start_date) {
                            payload['issue[start_date]'] = _private.utils.addDays(issue.start_date, deltaDays);
                        }
                        if (issue.due_date) {
                            payload['issue[due_date]'] = _private.utils.addDays(issue.due_date, deltaDays);
                        }
                        _private.api.updateIssue(issueId, payload);
                    });
                } else {
                    _private.revertPosition($related);
                }
            }
        });
    };

    _private.revertPosition = function ($elements) {
        $elements.each(function () {
            $(this).animate({ left: $(this).data('origin-left') }, 200);
        });
    };

    /**
     * Resizing Tasks
     */
    _private.initResizables = function () {
        var $tooltips = $(_private.config.selectors.tooltip).filter(function () {
            return _private.utils.getIssueId(this);
        });

        if (typeof $.fn.resizable === 'undefined') return;

        var pxPerDay = _private.utils.getPxPerDay();

        $tooltips.resizable({
            handles: 'e, w',
            minWidth: pxPerDay,
            grid: [pxPerDay, 0],
            start: function (event, ui) {
                var $el = $(this);
                $el.data('start-width', ui.size.width);
                $el.data('start-left', ui.position.left);

                var $tip = $('<div/>').addClass(_private.config.classes.resizeTooltip).text(_private.i18n.t('loading'));
                $('body').append($tip);
                $el.data('resize-tooltip', $tip);

                var issueId = _private.utils.getIssueId($el);
                _private.api.fetchIssue(issueId, function (issue) {
                    $el.data('issue-data', issue);
                });
            },
            resize: function (event, ui) {
                var $el = $(this);
                var $tip = $el.data('resize-tooltip');
                if (!$tip) return;

                var deltaWidth = ui.size.width - $el.data('start-width');
                var deltaLeft = ui.position.left - $el.data('start-left');
                var pxPerDay = _private.utils.getPxPerDay();

                var deltaDays = (Math.abs(deltaLeft) > 1) ? Math.round(deltaLeft / pxPerDay) : Math.round(deltaWidth / pxPerDay);
                var mode = (Math.abs(deltaLeft) > 1) ? 'start' : 'due';

                $tip.css({ top: event.pageY - 30, left: event.pageX + 15 });

                var issue = $el.data('issue-data');
                var label = _private.i18n.t(mode === 'start' ? 'label_start_date' : 'label_due_date');

                if (issue) {
                    var baseDate = (mode === 'start') ? issue.start_date : issue.due_date;
                    if (baseDate) {
                        var newDate = _private.utils.addDays(baseDate, deltaDays);
                        $tip.text(label + ': ' + newDate + ' (' + (deltaDays > 0 ? '+' : '') + deltaDays + 'd)');
                    } else {
                        $tip.text(label + ': ' + (deltaDays > 0 ? '+' : '') + deltaDays + 'd');
                    }
                }
            },
            stop: function (event, ui) {
                var $el = $(this);
                var $tip = $el.data('resize-tooltip');
                if ($tip) $tip.remove();

                var deltaWidth = ui.size.width - $el.data('start-width');
                var deltaLeft = ui.position.left - $el.data('start-left');
                var pxPerDay = _private.utils.getPxPerDay();

                var issueId = _private.utils.getIssueId($el);
                var deltaDays = (Math.abs(deltaLeft) > 1) ? Math.round(deltaLeft / pxPerDay) : Math.round(deltaWidth / pxPerDay);
                var mode = (Math.abs(deltaLeft) > 1) ? 'start_date' : 'due_date';

                if (deltaDays === 0) return;

                _private.api.fetchIssue(issueId, function (issue) {
                    if (!issue[mode]) {
                        window.location.reload();
                        return;
                    }
                    var payload = {};
                    payload['issue[' + mode + ']'] = _private.utils.addDays(issue[mode], deltaDays);
                    _private.api.updateIssue(issueId, payload);
                });
            }
        });
    };

    /**
     * Parent Reassignment by dragging Subjects
     */
    _private.initHierarchyDraggables = function () {
        var $subjects = $(_private.config.selectors.issueSubjects);
        if (typeof $.fn.droppable === 'undefined') return;

        $subjects.draggable({
            helper: 'clone', opacity: 0.7, cursor: 'move', revert: 'invalid', zIndex: 1000, distance: 10,
            start: function (event, ui) {
                $(this).addClass(_private.config.classes.dragging);
                ui.helper.css('width', $(this).width()).addClass('issue-subject');
            },
            stop: function (event, ui) {
                $(this).removeClass(_private.config.classes.dragging);
            }
        });

        $subjects.droppable({
            accept: '.' + _private.config.selectors.issueSubjects.split('.')[1],
            hoverClass: _private.config.classes.subjectHover,
            tolerance: 'pointer',
            drop: function (event, ui) {
                var draggedId = _private.utils.getIssueId(ui.draggable);
                var targetId = _private.utils.getIssueId(this);

                if (!draggedId || !targetId || draggedId === targetId) return;

                if (confirm(_private.i18n.t('confirm_change_parent', { dragged_id: draggedId, target_id: targetId }))) {
                    var payload = { 'issue[parent_issue_id]': targetId };
                    _private.api.updateIssue(draggedId, payload);
                }
            }
        });
    };

    /**
     * Quick Editor Popup
     */
    _private.initQuickEditor = function () {
        $(_private.config.selectors.tooltip).on('click', function (e) {
            var issueId = _private.utils.getIssueId(this);
            if (!issueId) return;

            e.preventDefault();
            e.stopPropagation();

            _private.openQuickEditor(issueId, e.pageX, e.pageY);
        });

        $(document).on('click', function (e) {
            if (!$(e.target).closest('.' + _private.config.classes.quickEditPopup).length) {
                $('.' + _private.config.classes.quickEditPopup).remove();
            }
        });
    };

    _private.openQuickEditor = function (issueId, x, y) {
        $('.' + _private.config.classes.quickEditPopup).remove();

        _private.api.fetchIssue(issueId, function (issue) {
            var $popup = $('<div/>').addClass(_private.config.classes.quickEditPopup);
            $popup.append($('<h3/>').text(_private.i18n.t('title_edit_issue', { id: issue.id })));

            // Date Fields
            $popup.append(_private.ui.createFormRow(_private.i18n.t('label_start_date') + ':',
                $('<input type="date" name="start_date"/>').val(issue.start_date || '')));

            $popup.append(_private.ui.createFormRow(_private.i18n.t('label_due_date') + ':',
                $('<input type="date" name="due_date"/>').val(issue.due_date || '')));

            // Done Ratio
            var $ratioSelect = $('<select name="done_ratio"/>');
            for (var i = 0; i <= 100; i += 10) {
                $('<option/>').val(i).text(i + ' %').prop('selected', issue.done_ratio === i).appendTo($ratioSelect);
            }
            $popup.append(_private.ui.createFormRow(_private.i18n.t('label_done_ratio') + ':', $ratioSelect));

            // Assignee
            var $assigneeSelect = $('<select name="assigned_to_id"/>');
            $assigneeSelect.append($('<option/>').val('').text(_private.i18n.t('label_none')));

            var currentId = issue.assigned_to ? issue.assigned_to.id : null;
            var assignables = (window.RedmineGanttExtraData && window.RedmineGanttExtraData.assignables) || [];

            if (assignables.length > 0) {
                $.each(assignables, function (idx, user) {
                    $('<option/>').val(user.id).text(user.name).prop('selected', currentId == user.id).appendTo($assigneeSelect);
                });
            } else if (issue.assigned_to) {
                $('<option/>').val(issue.assigned_to.id).text(issue.assigned_to.name).prop('selected', true).appendTo($assigneeSelect);
            }
            $popup.append(_private.ui.createFormRow(_private.i18n.t('label_assignee') + ':', $assigneeSelect));

            // Buttons
            var $btns = $('<div/>').addClass(_private.config.classes.buttonGroup);
            $('<button/>').text(_private.i18n.t('button_cancel')).click(function () { $popup.remove(); }).appendTo($btns);
            $('<button/>').text(_private.i18n.t('button_save')).click(function () {
                var payload = {
                    'issue[start_date]': $popup.find('input[name="start_date"]').val(),
                    'issue[due_date]': $popup.find('input[name="due_date"]').val(),
                    'issue[done_ratio]': $popup.find('select[name="done_ratio"]').val(),
                    'issue[assigned_to_id]': $popup.find('select[name="assigned_to_id"]').val()
                };
                _private.api.updateIssue(issueId, payload);
                $popup.remove();
            }).appendTo($btns);
            $popup.append($btns);

            $('body').append($popup);

            // Positioning
            var popupWidth = 260;
            var left = (x + popupWidth > $(window).width()) ? $(window).width() - popupWidth - 20 : x;
            $popup.css({ top: y, left: left });
        });
    };

    /**
     * Transform Gantt Header: Hide Weeks and change Weekdays to Dates
     * MutationObserverを利用して、Redmine本体の再描画後も表示を維持します。
     */
    /**
     * Transform Gantt Header: Hide Weeks and change Weekdays to Dates
     * MutationObserverを利用して、Redmine本体の再描画後も表示を維持します。
     */
    _private.transformHeader = function () {
        var $area = $(_private.config.selectors.ganttArea);
        if ($area.length === 0 || $area.data('processing')) return;

        var urlParams = new URLSearchParams(window.location.search);
        var zoom = parseInt(urlParams.get('zoom'), 10) || 3;

        // ズームレベル1（年単位）は対象外
        if (zoom === 1) return;

        // 重複実行防止フラグ
        $area.data('processing', true);
        console.log("RedmineGanttExtra: Applying transformation (Zoom: " + zoom + ")...");

        // 1. 週番号行を特定して非表示にする
        // Redmineの標準では週番号は <small> タグで囲まれていることが多い
        var $weekRows = $area.find('.gantt_hdr').filter(function () {
            var top = parseInt(this.style.top, 10);
            return (top === 19 || top === 18) && $(this).find('small').length > 0;
        });
        $weekRows.hide();

        // 2. 曜日行を特定して加工（ズーム3以上の場合）
        var $dayDivs = $area.find('.gantt_hdr').filter(function () {
            var top = parseInt(this.style.top, 10);
            // 曜日行は通常 top 30付近にある
            return top >= 30 && $(this).find('small, a').length === 0;
        });

        if ($dayDivs.length > 0) {
            $dayDivs.each(function () {
                var top = parseInt(this.style.top, 10);
                $(this).css({
                    'top': (top - 18) + 'px',
                    'z-index': '20',
                    'color': '#333'
                }).addClass('gantt-extra-date-cell');

                if ($(this).width() < 18) $(this).addClass('gantt-tight-col');
            });
        }

        // 3. 全体の表示位置を上に詰める
        // ズーム2など曜日行がない場合でも、週番号行を消した分の隙間(18px)を埋める
        var shiftY = 18;

        $('#today_line, #gantt_draw_area, #gantt_area .gantt_selected_column_content').each(function () {
            var top = parseInt($(this).css('top'), 10);
            if (top > 20) $(this).css('top', (top - shiftY) + 'px');
        });

        $('.gantt_subjects div, .gantt_selected_column_content div').filter(function () {
            return this.style.position === 'absolute';
        }).each(function () {
            var top = parseInt(this.style.top, 10);
            if (top > 20) $(this).css('top', (top - shiftY) + 'px');
        });

        // 4. ヘッダー背景画像/枠線の高さを調整
        $('.gantt_hdr').each(function () {
            var h = parseInt(this.style.height, 10);
            // 本来3段(Month/Week/Day)あるものを2段にする想定
            if (h >= 54) $(this).css('height', (h - 18) + 'px');
            else if (h === 36) $(this).addClass('gantt-extra-header-shrunk');
        });

        // 5. 曜日を日付に置換（ズーム3以上の場合のみ）
        if (zoom >= 3 && $dayDivs.length > 0) {
            var year = parseInt(urlParams.get('year'), 10);
            var month = parseInt(urlParams.get('month'), 10);

            if (!year || !month) {
                var $monthLink = $area.find('.gantt_hdr[style*="top: 0px"] a').first();
                if ($monthLink.length > 0) {
                    var text = $monthLink.text().trim();
                    var parts = text.split('-');
                    if (parts.length >= 2) {
                        year = parseInt(parts[0], 10);
                        month = parseInt(parts[1], 10);
                    }
                }
            }

            if (year && month) {
                var currentDate = new Date(year, month - 1, 1);
                $dayDivs.each(function () {
                    var currentText = $(this).text().trim();
                    if (currentText.length < 4) {
                        $(this).text(currentText === "" ? "" : currentDate.getDate());
                        if ($(this).width() > 0 && currentText !== "") {
                            currentDate.setDate(currentDate.getDate() + 1);
                        }
                    }
                });
            }
        }

        // 処理完了後にフラグを解除
        setTimeout(function () { $area.data('processing', false); }, 150);
    };

    /**
     * Initialization Core
     */
    _public.init = function () {
        var $area = $(_private.config.selectors.ganttArea);
        if ($area.length === 0) return;

        if (typeof $.fn.draggable === 'undefined') return;

        $.ajaxSetup({
            headers: { 'X-CSRF-Token': $(_private.config.selectors.csrfToken).attr('content') }
        });

        _private.initParentFilter();
        _private.initHierarchyDraggables();
        _private.initResizables();
        _private.initQuickEditor();
        _private.initDraggables();

        // モード切替の初期化
        _private.initModeToggle();

        if (_private.config.state.isCompactMode) {
            setTimeout(_private.transformHeader, 100);

            if (window.MutationObserver) {
                var observer = new MutationObserver(function () {
                    if (_private.config.state.isCompactMode) _private.transformHeader();
                });
                observer.observe($area[0], { childList: true, subtree: false });
                var $subjects = $('.gantt_subjects');
                if ($subjects.length > 0) {
                    observer.observe($subjects[0], { childList: true });
                }
            }
        }
    };

    /**
     * 表示モード切替ボタンの設置
     */
    _private.initModeToggle = function () {
        var $contextual = $('p.contextual').first();
        if ($contextual.length === 0) return;

        var labelKey = _private.config.state.isCompactMode ? "label_switch_to_standard_view" : "label_switch_to_date_view";
        var label = _private.i18n.t(labelKey);
        var $btn = $('<a href="#" id="gantt-mode-toggle" class="icon icon-calendar"></a>')
            .text(label)
            .css({ 'margin-left': '10px', 'cursor': 'pointer' })
            .toggleClass('active', _private.config.state.isCompactMode);

        $btn.on('click', function (e) {
            e.preventDefault();
            _private.config.state.isCompactMode = !_private.config.state.isCompactMode;
            sessionStorage.setItem('gantt_extra_compact', _private.config.state.isCompactMode);
            window.location.reload();
        });

        $contextual.append($btn);
    };

    return _public;

})(jQuery);

$(function () {
    RedmineGanttExtra.init();
});
