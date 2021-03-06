# frozen_string_literal: true

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins  %r{\Ahttps://(www|test)\.wikidata\.org\z}
    resource %r{\A/statements}, headers: :any, methods: %i[get options]
    resource %r{\A/verifications}, headers: :any, methods: %i[post options]
    resource %r{\A/reconciliations}, headers: :any, methods: %i[post options]
  end
end
