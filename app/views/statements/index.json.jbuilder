# frozen_string_literal: true

json.statements @classifier.statements do |statement| # rubocop:disable Metrics/BlockLength
  json.call(
    statement,
    :type,
    :transaction_id,
    :person_item,
    :person_revision,
    :statement_uuid,
    :parliamentary_group_item,
    :electoral_district_item,
    :parliamentary_term_item,
    :created_at,
    :updated_at,
    :person_name,
    :parliamentary_group_name,
    :electoral_district_name,
    :parliamentary_term_name,
    :problems,
    :problem_reported?
  )

  if statement.latest_verification
    json.verified_on "+#{statement.verified_on.iso8601}T00:00:00Z"
    json.verification_status statement.latest_verification.status
    json.reference_url statement.latest_verification.reference_url
  else
    json.verified_on nil
    json.verification_status nil
  end

  if statement.position_start
    json.position_start "+#{statement.position_start.iso8601}T00:00:00Z"
    json.position_start_date statement.position_start
  else
    json.position_start nil
  end

  if statement.position_end
    json.position_end "+#{statement.position_end.iso8601}T00:00:00Z"
    json.position_end_date statement.position_end
  else
    json.position_end nil
  end

  json.bulk_update @bulk_update
end

json.page @classifier.page,
          :position_held_item, :executive_position, :country_item,
          :reference_url, :reference_url_title, :reference_url_language,
          :csv_source_language, :new_item_description_en,
          :new_party_description_en, :new_party_instance_of_item,
          :new_district_description_en, :new_district_instance_of_item
