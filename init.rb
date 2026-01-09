require 'redmine'
require_relative 'lib/redmine_gantt_extra/hooks'

# Force apply patch without waiting for callbacks if possible, or use both
require_relative 'lib/redmine_gantt_extra/patch_gantt'

# Define the patching logic
apply_patch = -> {
  # Ensure the class is loaded
  require_dependency 'redmine/helpers/gantt' unless defined?(Redmine::Helpers::Gantt)

  target = Redmine::Helpers::Gantt
  patch = RedmineGanttExtra::PatchGantt

  unless target.ancestors.include?(patch)
    target.prepend(patch)
    Rails.logger.info "RedmineGanttExtra: Patch successfully applied to Redmine::Helpers::Gantt"
  end
}

# Apply immediately
apply_patch.call

# And apply on reload to survive auto-loading reset
if Rails.configuration.respond_to?(:to_prepare)
  Rails.configuration.to_prepare(&apply_patch)
else
  Dispatcher.to_prepare(&apply_patch) if defined?(Dispatcher)
end

Redmine::Plugin.register :redmine_gantt_extra do
  name 'Redmine Gantt Extra plugin'
  author 'yken tsuru'
  description 'Plugin to improve Gantt chart usability and display'
  version '0.1.0'
  url 'https://github.com/yken-tsuru/-redmine_gantt_extra'
  author_url 'https://github.com/yken-tsuru'
end
