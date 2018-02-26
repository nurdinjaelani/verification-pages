# frozen_string_literal: true

# Statement for verification object
class Statement < ApplicationRecord
  has_many :verifications, dependent: :destroy
  has_many :reconciliations, dependent: :destroy

  validates :transaction_id, presence: true, uniqueness: true

  def page
    Page.find_by(parliamentary_term_item: parliamentary_term_item)
  end

  def latest_verification
    verifications.last
  end

  def latest_reconciliation
    reconciliations.last
  end
end
