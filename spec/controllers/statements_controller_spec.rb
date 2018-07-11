require 'rails_helper'

RSpec.describe StatementsController, type: :controller do
  let!(:statement) { build(:statement) }

  let(:show_parameters) do
    { id: '123', format: 'json' }
  end

  before do
    allow(Statement).to receive(:find_by!).with(transaction_id: '123').
      and_return(statement)
  end

  describe 'GET #show' do
    it 'returns http success for a transaction that exists' do
      get :show, params: show_parameters
      expect(response).to be_successful
    end

    it 'does not update the actioned_at time' do
      get :show, params: show_parameters
      expect(statement.actioned_at).to be_nil
    end

    context 'when force_type: done is provided' do
      let(:show_parameters) do
        { id: '123', format: 'json', force_type: 'done' }
      end

      it 'should call record_actioned! on statement' do
        expect(statement).to receive(:record_actioned!)
        get :show, params: show_parameters
      end
    end
  end
end
