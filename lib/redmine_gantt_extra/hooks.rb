module RedmineGanttExtra
  class Hooks < Redmine::Hook::ViewListener
    def view_layouts_base_html_head(context = {})
      return unless context[:controller]
      
      controller_name = context[:controller].class.name
      if controller_name == 'GanttsController'
        Rails.logger.info "RedmineGanttExtra: Injection active for #{controller_name}"
        
        # jQuery UI is normally loaded by Redmine. We append our plugin assets.
        tags = stylesheet_link_tag('redmine_gantt_extra', :plugin => 'redmine_gantt_extra') +
               javascript_include_tag('redmine_gantt_extra', :plugin => 'redmine_gantt_extra')
        
        # Inject configuration and translations safely
        project = context[:project]
        assignables = project ? project.assignable_users.collect { |u| { id: u.id, name: u.name } } : []
        
        js_data = {
          label_parent_issue_id: I18n.t(:label_parent_issue_id, default: 'Parent Issue ID'),
          assignables: assignables,
          project_id: project&.id,
          strings: {
            title_edit_issue: I18n.t('gantt_extra.title_edit_issue'),
            label_start_date: I18n.t('gantt_extra.label_start_date'),
            label_due_date: I18n.t('gantt_extra.label_due_date'),
            label_done_ratio: I18n.t('gantt_extra.label_done_ratio'),
            label_assignee: I18n.t('gantt_extra.label_assignee'),
            label_none: I18n.t('gantt_extra.label_none'),
            button_save: I18n.t('gantt_extra.button_save'),
            button_cancel: I18n.t('gantt_extra.button_cancel'),
            confirm_change_parent: I18n.t('gantt_extra.confirm_change_parent'),
            error_fetch_issue: I18n.t('gantt_extra.error_fetch_issue'),
            error_update_failed: I18n.t('gantt_extra.error_update_failed'),
            error_permission_denied: I18n.t('gantt_extra.error_permission_denied'),
            error_validation_failed: I18n.t('gantt_extra.error_validation_failed'),
            loading: I18n.t('gantt_extra.loading')
          }
        }

        tags += javascript_tag("window.RedmineGanttExtraData = #{js_data.to_json};")
        
        return tags
      end
    end
  end
end
