# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Country, type: :model do
  describe '#name' do
    it 'is required' do
      subject.valid?
      expect(subject.errors[:name]).to include("can't be blank")
    end
  end

  describe '#code' do
    it 'is required' do
      subject.valid?
      expect(subject.errors[:code]).to include("can't be blank")
    end

    it "can't be more than 3 characters long" do
      subject.code = 'not-valid'
      subject.valid?
      expect(subject.errors[:code]).to include('is too long (maximum is 3 characters)')
    end

    it "can't be less than 2 characters long" do
      subject.code = 'a'
      subject.valid?
      expect(subject.errors[:code]).to include('is too short (minimum is 2 characters)')
    end
  end

  describe '#wikidata_id' do
    it 'is required' do
      subject.valid?
      expect(subject.errors[:wikidata_id]).to include("can't be blank")
    end

    it 'must be in the correct format' do
      subject.wikidata_id = '1234'
      subject.valid?
      expect(subject.errors[:wikidata_id]).to include('must be a valid Wikidata item identifier, e.g. Q42')
    end
  end
end
