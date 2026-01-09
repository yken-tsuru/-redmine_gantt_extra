module RedmineGanttExtra
  module PatchGantt
    def initialize(options={})
      super(options)
      if options[:parent_issue_id].present?
        @parent_issue_id = options[:parent_issue_id].to_s.strip
      end
    end

    def issues
      if defined?(@parent_issue_id) && @parent_issue_id.present?
        if @issues.nil?
          parent = Issue.visible.find_by(id: @parent_issue_id)
          if parent
            # Load parent and descendants
            items = [parent] + parent.descendants.visible.reorder("#{Issue.table_name}.lft ASC")
            
            if @max_rows && items.size > @max_rows
              items = items[0, @max_rows]
              @truncated = true
            end
            
            @issues = items
          end
        end
        return @issues if @issues
      end
      
      super
    end
  end
end
