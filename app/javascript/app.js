import Vue from 'vue'
import ENV from './env'
import Axios from 'axios'
import wikidataClient from './wikiapi'
import template from './app.html?style=./app.css'
import { parseFullName } from 'parse-full-name'

import statementComponent from './components/statement'
import SortControl from './components/sort_control'

Vue.component('Statement', statementComponent)
Vue.component('sort-control', SortControl)

export default template({
  data () {
    return {
      loaded: false,
      statements: [],
      sortBy: 'lastName',
      sortOptions: [
        ['lastName', 'Last name'],
        ['firstName', 'First name'],
        ['district', 'District'],
        ['parliamentaryGroup', 'Parliamentary group'],
        ['type', 'Type']
      ],
      page: null
    }
  },
  created: function () {
    this.loadStatements()
    this.$on('statement-update', (requestFunction, cb) => {
      requestFunction().then(response => {
        response.data.statements.forEach(function (newStatement) {
          var index = this.statements.findIndex(s => {
            return s.transaction_id === newStatement.transaction_id
          })
          var previousType = this.statements[index].type
          newStatement.previousType = previousType
          this.statements.splice(index, 1, newStatement)
        }, this)
      }).then(cb)
    })
    this.$on('statements-loaded', () => {
      this.$nextTick(function () {
        var hash = window.location.hash;
        if (hash) {
          this.$emit('scroll-to-fragment', hash)
        }
      })
    }),
    this.$on('scroll-to-fragment', (fragment) => {
      let selector = fragment.replace(/:/g, '\\:')
      let statementRow = document.querySelector(selector)
      if (statementRow) {
        let headerHeight = document.querySelector('.verification-tool__table th').offsetHeight
        statementRow.scrollIntoView()
        window.scrollBy(0, -headerHeight)
        statementRow.className += " targetted"
      }
    })
  },
  methods: {
    loadStatements: function () {
      Axios.get(ENV.url + '/statements.json', {
        params: { title: wikidataClient.page }
      }).then(response => {
        this.statements = response.data.statements
        this.sortStatements(this.sortBy)
        this.page = response.data.page
        this.country = response.data.country
      }).then(() => {
        this.loaded = true
        this.$emit('statements-loaded')
      })
    },
    countStatementsOfType: function (type) {
      if (type !== 'all') {
        return this.statements.filter(s => s.type === type).length
      } else {
        return this.statements.length
      }
    },
    sortStatements: function (sortBy) {
      this.statements = this.statements.sort((a, b) => {
        const typeOrder = [
          'verifiable',
          'reconcilable',
          'actionable',
          'manually_actionable',
          'reverted',
          'unverifiable',
          'done',
        ]
        const namesA = parseFullName(a.person_name)
        const namesB = parseFullName(b.person_name)
        const statementA = Object.assign({}, a, {
          firstName: namesA.first,
          lastName: namesA.last,
          typeSort: typeOrder.indexOf(a.type)
        })
        const statementB = Object.assign({}, b, {
          firstName: namesB.first,
          lastName: namesB.last,
          typeSort: typeOrder.indexOf(b.type)
        })
        let sortFields
        switch (sortBy) {
          case 'lastName':
            sortFields = ['lastName', 'firstName']
            break
          case 'firstName':
            sortFields = ['firstName', 'lastName']
            break
          case 'parliamentaryGroup':
            sortFields = ['parliamentary_group_name', 'lastName', 'firstName']
            break
          case 'district':
            sortFields = ['electoral_district_name', 'lastName', 'firstName']
            break
          case 'type':
            sortFields = ['typeSort', 'lastName', 'firstName']
            break
        }
        const stringA = sortFields.map(field => statementA[field]).join(' ')
        const stringB = sortFields.map(field => statementB[field]).join(' ')
        return stringA.localeCompare(stringB)
      })
    }
  }
})
