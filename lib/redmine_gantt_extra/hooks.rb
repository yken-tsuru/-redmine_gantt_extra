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
               javascript_tag("if(typeof RedmineGanttExtra !== 'undefined') { RedmineGanttExtra.label_parent_issue_id = '#{I18n.t(:label_parent_issue_id)}'; }")
        return tags
        return tags
      end
    end
  end
end
