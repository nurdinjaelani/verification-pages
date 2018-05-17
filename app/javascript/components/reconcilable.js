import ENV from '../env'
import Axios from 'axios'
import wikidataClient from '../wikiapi'
import template from './reconcilable.html'

export default template({
  data () { return {
    searchResultsLoading: false,
    searchResultsLoaded: false,
    searchResults: null,
  } },
  props: ['statement', 'country'],
  created: function () {
    this.$parent.$on('statement-changed', () => {
      this.searchResultsLoading = false
      this.searchResultsLoaded = false
    })
  },
  methods: {
    searchForName: function () {
      this.searchResultsLoading = true;
      const name = this.statement.person_name
      wikidataClient.search(name, 'en', 'en').then(data => {
        console.log(data);
        this.searchResults = data;
        this.searchResultsLoaded = true;
        this.searchResultsLoading = false;
      })
    },
    reconcileWithItem: function(itemID) {
      this.$parent.$emit('statement-update', () => {
        return Axios.post(ENV.url + '/reconciliations.json', {
          id: this.statement.transaction_id,
          user: wikidataClient.user,
          item: itemID
        })
      })
    },
    createPerson: function() {
      wikidataClient.createPerson(
        {
          lang: this.country.label_lang,
          value: this.statement.person_name,
        },
        {
          lang: 'en',
          value: this.country.description_en,
        },
      ).then(createdItemData => {
        this.reconcileWithItem(createdItemData.item);
      })
    },
  }
})
