# frozen_string_literal: true

# Service to classify statements into actionable, manually_actionable or done groups
class StatementClassifier
  attr_reader :page, :statements, :transaction_id

  def initialize(page_title, transaction_id = nil)
    @page = Page.find_by!(title: page_title)
    @statements = page.statements.original
                      .includes(:verifications)
                      .references(:verifications)
                      .order(:id)
    @transaction_id = transaction_id

    return unless transaction_id
    @statements = @statements.where(transaction_id: transaction_id)
  end

  # verifiable
  # unverifiable
  # reconcilable
  # actionable
  # manually_actionable
  # done(able)
  #

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
    if statement.force_type
      statement.force_type.to_sym
    elsif statement.done?
      :done
    elsif statement.reconciled? && (statement.started_before_term? || statement.qualifiers_contradicting?)
      :manually_actionable
    elsif statement.reconciled?
      :actionable
    elsif statement.verified?
      :reconcilable
    elsif statement.unverifiable?
      :unverifiable
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
    StatementDecorator.new(statement, position_data_for_statement(statement))
  end

  def person_item_from_transaction_id
    return unless transaction_id
    statements.first.person_item
  end

  def position_held_data
    @position_held_data ||= RetrievePositionData.run(
      page.position_held_item,
      person_item_from_transaction_id
    )
  end

  def position_data_for_statement(statement)
    position_held_data.detect { |data| data.person == statement.person_item }
  end
end
