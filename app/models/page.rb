# frozen_string_literal: true

# Verification page object
class Page < ApplicationRecord
  include TransactionID

  has_many :statements, dependent: :destroy

  validates :title, presence: true, uniqueness: true
  validates :position_held_item, presence: true
  validates :country_item, presence: true, if: ->(p) { p.hash_epoch >= 3 }
  validates :country_code, presence: true, if: ->(p) { p.hash_epoch <= 2 }
  validates :reference_url, length: { maximum: 2000 }
  validates :csv_source_url, presence: true

  before_validation :fetch_country
  before_validation :set_position_held_name, if: :position_held_item_changed?
  before_validation :set_parliamentary_term_name, if: :parliamentary_term_item_changed?
  before_validation :set_country_name, if: :country_item_changed?
  before_validation :set_new_party_instance_of_name, if: :new_party_instance_of_item_changed?
  before_validation :set_new_district_instance_of_name, if: :new_district_instance_of_item_changed?

  def from_suggestions_store?
    URI.parse(csv_source_url).host == URI.parse(SuggestionsStore::Request::URL).host
  end

  private

  def fetch_country
    return unless position_held_item_changed? || parliamentary_term_item_changed?

    self.country_item = RetrieveCountry.run(position_held_item, parliamentary_term_item)&.country
  end

  def set_position_held_name
    self.position_held_name = item_data[position_held_item]&.label
  end

  def set_parliamentary_term_name
    self.parliamentary_term_name = item_data[parliamentary_term_item]&.label
  end

  def set_country_name
    self.country_name = item_data[country_item]&.label
  end

  def set_new_party_instance_of_name
    self.new_party_instance_of_name = item_data[new_party_instance_of_item]&.label
  end

  def set_new_district_instance_of_name
    self.new_district_instance_of_name = item_data[new_district_instance_of_item]&.label
  end

  def item_data
    @item_data ||= RetrieveItems.run(
      position_held_item, parliamentary_term_item, country_item,
      new_party_instance_of_item, new_district_instance_of_item
    )
  end
end
