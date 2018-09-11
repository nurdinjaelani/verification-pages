# frozen_string_literal: true

# Service to classify statements into actionable, manually_actionable or done groups
class StatementClassifier
  attr_reader :page, :statements, :transaction_id

  def initialize(page_title, transaction_ids = nil)
    @page = Page.find_by!(title: page_title)
    @statements = page.statements.original
                      .includes(:verifications)
                      .references(:verifications)
                      .order(:id)

    return unless transaction_ids
    @transaction_id = transaction_ids.first if transaction_ids.count == 1
    @statements = @statements.where(transaction_id: transaction_ids)
  end

  # verifiable
  # unverifiable
  # reconcilable
  # actionable
  # manually_actionable
  # done(able)
  # reverted

  def verifiable
    classified_statements.fetch(:verifiable, [])
  end

  def unverifiable
    classified_statements.fetch(:unverifiable, [])
  end

  def reconcilable
    classified_statements.fetch(:reconcilable, [])
  end

  def actionable
    classified_statements.fetch(:actionable, [])
  end

  def manually_actionable
    classified_statements.fetch(:manually_actionable, [])
  end

  def done
    classified_statements.fetch(:done, [])
  end

  def reverted
    classified_statements.fetch(:reverted, [])
  end

  def to_a
    decorated_statements.map do |decorated_statement|
      decorated_statement.tap do |s|
        s.type = statement_type(s)
      end
    end
  end

  private

  def classified_statements
    @classified_statements ||= decorated_statements
                               .each_with_object({}) do |statement, h|
      type = statement_type(statement)
      next unless type

      h[type] ||= []
      h[type] << statement
    end
  end

  def statement_type(statement)
    if statement.unverifiable?
      :unverifiable
    elsif statement.done?
      :done
    elsif statement.reverted?
      :reverted
    elsif statement.manually_actionable?
      :manually_actionable
    elsif statement.actionable?
      :actionable
    elsif statement.verified?
      :reconcilable
    else
      :verifiable
    end
  end

  def decorated_statements
    statements.to_a.map do |statement|
      decorate_statement(statement)
    end
  end

  def decorate_statement(statement)
    StatementDecorator.new(statement, matching_position_held_data(statement))
  end

  def person_item_from_transaction_id
    return unless transaction_id
    statements.first.person_item
  end

  def position_held_data
    @position_held_data ||= RetrievePositionData.run(
      page.position_held_item,
      page.parliamentary_term_item,
      person_item_from_transaction_id
    )
  end

  def merged_then_deleted(data)
    data.merged_then_deleted.split.map { |item| item.split('/').last }
  end

  def matching_position_held_data(statement)
    position_held_data.select do |data|
      ([data.person] + merged_then_deleted(data)).include?(statement.person_item)
    end
  end
end
