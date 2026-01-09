module RedmineGanttExtra
  class Hooks < Redmine::Hook::ViewListener
    def view_layouts_base_html_head(context = {})
      return unless context[:controller]
      
      controller_name = context[:controller].class.name
      if controller_name == 'GanttsController'
        Rails.logger.info "RedmineGanttExtra: Injection active for #{controller_name}"
        
        # jQuery UI is normally loaded by Redmine. We append our plugin assets.
        tags = stylesheet_link_tag('redmine_gantt_extra', :plugin => 'redmine_gantt_extra') +
               javascript_include_tag('redmine_gantt_extra', :plugin => 'redmine_gantt_extra') +
               javascript_tag do
                 project = context[:project] # Access project from context
                 "
                   var RedmineGanttExtra = RedmineGanttExtra || {};
                   RedmineGanttExtra.label_parent_issue_id = '#{I18n.t(:label_parent_issue_id, default: 'Parent Issue ID')}';
                   
                   #{project ? "RedmineGanttExtra.assignables = #{project.assignable_users.collect { |u| { id: u.id, name: u.name } }.to_json};" : "RedmineGanttExtra.assignables = [];"}
                 ".html_safe
               end
        return tags
      end
    end
  end
end
