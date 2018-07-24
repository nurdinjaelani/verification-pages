# frozen_string_literal: true

require 'rails_helper'

# This spec was generated by rspec-rails when you ran the scaffold generator.
# It demonstrates how one might use RSpec to specify the controller code that
# was generated by Rails when you ran the scaffold generator.
#
# It assumes that the implementation code is generated by the rails scaffold
# generator.  If you are using any extension libraries to generate different
# controller code, this generated spec may or may not pass.
#
# It only uses APIs available in rails and/or rspec-rails.  There are a number
# of tools you can use to make these specs even more expressive, but we're
# sticking to rails and rspec-rails APIs to keep things simple and stable.
#
# Compared to earlier versions of this generator, there is very limited use of
# stubs and message expectations in this spec.  Stubs are only used when there
# is no simpler way to get a handle on the object needed for the example.
# Message expectations are only used when there is no simpler way to specify
# that an instance is receiving a specific message.
#
# Also compared to earlier versions of this generator, there are no longer any
# expectations of assigns and templates rendered. These features have been
# removed from Rails core in Rails 5, but can be added back in via the
# `rails-controller-testing` gem.

RSpec.describe CountriesController, type: :controller do
  # This should return the minimal set of attributes required to create a valid
  # Country. As you add validations to Country, be sure to
  # adjust the attributes here as well.
  let(:valid_attributes) do
    {
      name:           'Canada',
      code:           'ca',
      description_en: 'Canadian Politican',
      label_lang:     'en',
      wikidata_id:    'Q38',
    }
  end

  let(:invalid_attributes) do
    {
      name:           '',
      code:           'werr',
      description_en: '',
      label_lang:     'en_us',
      wikidata_id:    '1234',
    }
  end

  # This should return the minimal set of values that should be in the session
  # in order to pass any filters (e.g. authentication) defined in
  # CountriesController. Be sure to keep this updated too.
  let(:valid_session) { {} }

  describe 'GET #index' do
    it 'returns a success response' do
      country = Country.create! valid_attributes
      get :index, params: {}, session: valid_session
      expect(response).to be_successful
    end
  end

  describe 'GET #show' do
    it 'returns a success response' do
      country = Country.create! valid_attributes
      get :show, params: { id: country.to_param }, session: valid_session
      expect(response).to be_successful
    end
  end

  describe 'GET #new' do
    it 'returns a success response' do
      get :new, params: {}, session: valid_session
      expect(response).to be_successful
    end
  end

  describe 'GET #edit' do
    it 'returns a success response' do
      country = Country.create! valid_attributes
      get :edit, params: { id: country.to_param }, session: valid_session
      expect(response).to be_successful
    end
  end

  describe 'POST #create' do
    context 'with valid params' do
      it 'creates a new Country' do
        expect do
          post :create, params: { country: valid_attributes }, session: valid_session
        end.to change(Country, :count).by(1)
      end

      it 'redirects to the created country' do
        post :create, params: { country: valid_attributes }, session: valid_session
        expect(response).to redirect_to(Country.last)
      end
    end

    context 'with invalid params' do
      it "returns a success response (i.e. to display the 'new' template)" do
        post :create, params: { country: invalid_attributes }, session: valid_session
        expect(response).to be_successful
      end
    end
  end

  describe 'PUT #update' do
    context 'with valid params' do
      let(:new_attributes) do
        {
          name:           'Canada',
          code:           'ca',
          description_en: 'Canadian politican',
          label_lang:     'en-ca',
          wikidata_id:    'Q38',
        }
      end

      it 'updates the requested country' do
        country = Country.create! valid_attributes
        put :update, params: { id: country.to_param, country: new_attributes }, session: valid_session
        country.reload
        expect(country.description_en).to eq('Canadian politican')
        expect(country.label_lang).to eq('en-ca')
      end

      it 'redirects to the country' do
        country = Country.create! valid_attributes
        put :update, params: { id: country.to_param, country: valid_attributes }, session: valid_session
        expect(response).to redirect_to(country)
      end
    end

    context 'with invalid params' do
      it "returns a success response (i.e. to display the 'edit' template)" do
        country = Country.create! valid_attributes
        put :update, params: { id: country.to_param, country: invalid_attributes }, session: valid_session
        expect(response).to be_successful
      end
    end
  end

  describe 'DELETE #destroy' do
    it 'destroys the requested country' do
      country = Country.create! valid_attributes
      expect do
        delete :destroy, params: { id: country.to_param }, session: valid_session
      end.to change(Country, :count).by(-1)
    end

    it 'redirects to the countries list' do
      country = Country.create! valid_attributes
      delete :destroy, params: { id: country.to_param }, session: valid_session
      expect(response).to redirect_to(countries_url)
    end
  end
end
