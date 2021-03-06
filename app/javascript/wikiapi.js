/* global mw */
'use strict'

import Axios from 'axios'
import jsonp from 'jsonp'

function mapObjectValue (object) {
  switch (object.type) {
    case 'wikibase-entityid':
      return {
        'entity-type': 'item',
        'numeric-id': Number(object.value.substring(1)),
        id: object.value
      }
    case 'time':
      return {
        after: 0,
        before: 0,
        calendarmodel: 'http://www.wikidata.org/entity/Q1985727',
        precision: 11,
        time: object.value,
        timezone: 0
      }
    case 'string':
      return String(object.value)
    default:
      throw new Error('unknown data type')
  }
}

function getItemValue (item) {
  if (typeof item !== 'object') {
    item = { type: 'wikibase-entityid', value: item }
  }

  return mapObjectValue(item)
}

function getItemValueString (item) {
  return JSON.stringify(getItemValue(item))
}

function getQualifiersFromAPIClaims (apiClaims, property) {
  if (!apiClaims[property]) {
    return []
  }
  return apiClaims[property][0].qualifiers
}

function getReferencesFromAPIClaims (apiClaims, property) {
  if (!apiClaims[property]) {
    return []
  }
  return apiClaims[property][0].references
}

function getReferenceForURLFromAPIClaims (references, referenceURLProp, referenceURL) {
  if (!references || !referenceURL) return
  return references.find(function (r) {
    var snak
    var snaks = r.snaks[referenceURLProp]
    if (!snaks) {
      // There may be existing references using other properties, so
      // skip over them.
      return false
    }
    snak = snaks.find(function (s) {
      return s.datatype === 'url' && s.datavalue.value === referenceURL.value
    })
    console.log(snak)
    return typeof snak !== 'undefined'
  })
}

function checkForError (data) {
  // Weirdly, errors like bad CSRF tokens still return success
  // rather than going to the fail handlers, so we use this even
  // on apparently successful AJAX calls.
  if (data.error) {
    throw new Error(
      'Error from the Wikidata API [' + data.error.code + '] ' +
      data.error.info + ': ' + data.error['*']
    )
  }
}

function buildReferenceSnaks (references) {
  var snaks = {}

  Object.keys(references).forEach(function (property) {
    var object = references[property]
    if (!object.value) return

    snaks[property] = [{
      snaktype: 'value',
      property: property,
      datavalue: {
        type: object.type,
        value: mapObjectValue(object)
      }
    }]
  })

  return JSON.stringify(snaks)
}

function getNewQualifiers (qualifiersFromAPI, wantedQualifiers) {
  var newQualifiers = Object.assign({}, wantedQualifiers)
  var qualifiersToCheck = Object.keys(newQualifiers)
  var i

  if (qualifiersFromAPI) {
    for (i = 0; i < qualifiersToCheck.length; ++i) {
      var qualifierToCheck = qualifiersToCheck[i]
      var newQualifier = newQualifiers[qualifierToCheck]

      if (typeof newQualifier !== 'object') {
        newQualifier = { type: 'wikibase-entityid', value: newQualifier }
      }

      var existingQualifiersForProperty = qualifiersFromAPI[qualifierToCheck]

      if (!existingQualifiersForProperty) {
        continue
      }

      if (existingQualifiersForProperty.length > 1) {
        throw new Error(
          'Multiple existing ' + qualifierToCheck + ' qualifiers found'
        )
      }

      var existingQualifier = existingQualifiersForProperty[0]

      if (existingQualifier.snaktype !== 'value') {
        throw new Error(
          'Unexpected snaktype ' + existingQualifier.snaktype +
          ' found on the ' + qualifierToCheck + ' qualifier'
        )
      }

      if (existingQualifier.datavalue.type !== newQualifier.type) {
        throw new Error(
          'Unexpected datavalue type ' + existingQualifier.datavalue.type +
          ' found on the ' + qualifierToCheck + ' qualifier'
        )
      }

      var newValue = JSON.stringify(
        getItemValue(newQualifier), Object.keys(getItemValue(newQualifier)).sort()
      )
      var oldValue = JSON.stringify(
        existingQualifier.datavalue.value, Object.keys(existingQualifier.datavalue.value).sort()
      )

      if (newValue === oldValue) {
        delete newQualifiers[qualifierToCheck]
      } else {
        throw new Error('The existing item for the ' + qualifierToCheck + ' qualifier was ' + oldValue + ' but we think it should be ' + newValue)
      }
    }
  }
  return newQualifiers
}

var wikidataItem = function (spec) {
  var that = {}
  var wikidata = spec.wikidata
  var item = spec.item
  var lastRevisionID = null
  var my = {}

  my.ajaxSetQualifier = function (qualifierDetails) {
    wikidata.log('Setting ' + wikidata.getPropertyName(qualifierDetails.qualifierProperty))
    return wikidata.ajaxAPI(true, 'wbsetqualifier', {
      claim: qualifierDetails.statement,
      property: qualifierDetails.qualifierProperty,
      value: getItemValueString(qualifierDetails.value),
      baseRevisionID: lastRevisionID,
      snaktype: 'value',
      summary: wikidata.summary()
    }).then(function (data) {
      checkForError(data)
      lastRevisionID = data.pageinfo.lastrevid
      return data
    })
  }

  my.makeSetQualifierThenFunction = function (statementToCreate) {
    return function (data) {
      console.log('in \'then\' function for ' + statementToCreate + ' data was: ', data)
      checkForError(data)
      return my.ajaxSetQualifier(statementToCreate)
    }
  }

  my.createQualifiers = function (newClaim, newQualifiers) {
    var requestChain
    var i
    var statementsToCreate = Object.keys(newQualifiers).map(function (qualifierProperty) {
      return {
        statement: newClaim.statement,
        qualifierProperty: qualifierProperty,
        value: newQualifiers[qualifierProperty]
      }
    })

    console.log('There are ' + statementsToCreate.length + ' statements to create....')

    if (statementsToCreate.length > 0) {
      requestChain = my.ajaxSetQualifier(statementsToCreate[0])
      for (i = 1; i < statementsToCreate.length; ++i) {
        requestChain = requestChain.then(
          my.makeSetQualifierThenFunction(statementsToCreate[i]))
      }
      return requestChain.then(function (data) {
        console.log('final data: ', data)
        checkForError(data)
      })
    } else {
      return Promise.resolve(null)
    }
  }

  my.getReferencePropertyInUse = function (newReferences) {
    var found
    var newReferenceProperties = Object.keys(newReferences)
    var knownReferencePropertyLabels = [
      'Wikimedia import URL', 'reference URL'
    ]
    var knownReferencePropertyIDs = knownReferencePropertyLabels.map(l => wikidata.getPropertyID(l))
    found = newReferenceProperties.find(k => knownReferencePropertyIDs.includes(k))
    if (!found) {
      throw new Error("Couldn't find a reference property ID in " + newReferenceProperties)
    }
    return found
  }

  my.createReferences = function (claims, data) {
    var referenceURLProp = my.getReferencePropertyInUse(data.references)
    var referenceURL = data.references[referenceURLProp]

    var currentReference = getReferenceForURLFromAPIClaims(
      getReferencesFromAPIClaims(claims, data.property),
      referenceURLProp,
      referenceURL
    )

    console.log('There are ' + Object.keys(data.references).length + ' references to create....')

    if (Object.keys(data.references).length > 0) {
      var referenceData = {
        statement: data.statement,
        snaks: buildReferenceSnaks(data.references),
        baserevid: lastRevisionID,
        summary: wikidata.summary()
      }

      if (currentReference) {
        referenceData['reference'] = currentReference.hash
      }

      wikidata.log('Setting references')
      return wikidata.ajaxAPI(true, 'wbsetreference', referenceData)
    } else {
      return Promise.resolve(null)
    }
  }

  my.createBareClaimDeferred = function (claimData) {
    // TODO the data we've been passed (indicating there wasn't an
    // existing statement to update) might be quite stale,
    // so we should really check that an appropriate claim hasn't
    // been created in the meantime.
    wikidata.log('Creating a claim')
    return wikidata.ajaxAPI(true, 'wbcreateclaim', {
      entity: item,
      snaktype: 'value',
      property: claimData.property,
      value: getItemValueString(claimData.object),
      baserevid: lastRevisionID,
      summary: wikidata.summary()
    }).then(function (data) {
      checkForError(data)
      lastRevisionID = data.pageinfo.lastrevid
      return data.claim.id
    }).catch(function (error) {
      console.log('AJAX failure when trying to create a new claim:', error)
    })
  }

  my.updateClaim = function (newClaim) {
    // First check that (currently) there are no qualifiers that
    // would be changed by updating the claim
    wikidata.log('Getting existing claims')
    return wikidata.ajaxAPI(false, 'wbgetclaims', {
      entity: item,
      claim: newClaim.statement
    }).then(function (data) {
      var newQualifiers
      checkForError(data)
      try {
        newQualifiers = getNewQualifiers(
          getQualifiersFromAPIClaims(data.claims, newClaim.property),
          newClaim.qualifiers
        )
      } catch (error) {
        throw new Error(
          'Problem checking existing qualifiers for statement ' +
            newClaim.statement + ' for relationship ' + item +
            ' <-- ' + newClaim.property + ' --> ' + newClaim.object + ': ' +
            error.message
        )
      }

      console.log('Looks good to update these qualifiers:', newQualifiers)

      return my.createQualifiers(newClaim, newQualifiers).then(function (foo) {
        return my.createReferences(data.claims, newClaim)
      })
    })
  }

  that.updateOrCreateClaim = function (baseRevisionID, claimData) {
    lastRevisionID = baseRevisionID
    if (claimData.statement) {
      return my.updateClaim(claimData)
    } else {
      // Then we need to create a new statement:
      return my.createBareClaimDeferred(claimData).then(function (statement) {
        if (!statement) {
          throw new Error('Creating the new statement failed')
        }
        return my.updateClaim(Object.assign({}, claimData, { statement: statement }))
      })
    }
  }

  that.latestRevision = function () {
    wikidata.log('Getting latest revision')
    return wikidata.ajaxAPIBasic({
      action: 'query',
      prop: 'revisions',
      titles: item
    }).then(function (data) {
      checkForError(data)
      var pageKey
      // FIXME: this is very weird; the response from the
      // mediawiki API doesn't include the .query, but when
      // calling the API directly it doesn't (!)
      var pages = data.pages || data.query.pages
      for (pageKey in pages) {
        if (pages.hasOwnProperty(pageKey)) {
          if (pages[pageKey].title === item) {
            return pages[pageKey].revisions[0].revid
          }
        }
      }
      throw new Error('No revision found for item ' + item)
    })
  }

  return that
}

function encodeURIParams (o) {
  // From a comment on: https://stackoverflow.com/a/18116302/223092
  return Object.entries(o).map(e => e.map(ee => encodeURIComponent(ee)).join('=')).join('&')
}

const jsonpPromise = function (url) {
  return new Promise(function (resolve, reject) {
    jsonp(url, null, function (err, data) {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

var wikidata = function (spec) {
  var that = {
    log: function () {}
  }

  if (typeof mw === 'undefined') {
    that.useAPIProxy = true
    that.apiURL = '/api-proxy'
    that.serverName = 'localhost'
    that.neverUseToken = true
    that.user = 'ExampleUser'
    that.page = window.CURRENT_PAGE_TITLE
  } else {
    that.useAPIProxy = false
    that.apiURL = 'https:' + mw.config.get('wgServer') + '/w/api.php'
    that.serverName = mw.config.get('wgServerName')
    that.neverUseToken = false
    that.user = mw.config.get('wgUserName')
    that.page = mw.config.get('wgRelevantPageName')
  }

  that.ajaxAPIBasic = function (data) {
    console.log(data)
    data = Object.assign({}, data, { format: 'json' })
    var params = new URLSearchParams()
    for (let [k, v] of Object.entries(data)) {
      params.append(k, v)
    }
    if (that.useAPIProxy) {
      params.append('action_name', data.action)
    }
    return Axios.post(
      that.apiURL, params, { responseType: 'json' }
    ).then(function (response) {
      return response.data
    }).catch(error => {
      console.log(error)
    })
  }

  if (!that.neverUseToken) {
    that.tokenDeferred = that.ajaxAPIBasic({
      action: 'query',
      meta: 'tokens'
    }).then(function (data) {
      return data.query.tokens.csrftoken
    })
  }

  that.ajaxAPI = function (writeOperation, action, data) {
    var completeData = Object.assign({}, data, { action: action })
    console.log(completeData)
    if (writeOperation && !that.neverUseToken) {
      return that.tokenDeferred.then(function (token) {
        completeData.token = token
        return that.ajaxAPIBasic(completeData)
      })
    } else {
      return that.ajaxAPIBasic(completeData)
    }
  }

  that.setLogger = function (loggerCallback) {
    that.log = loggerCallback
    return that
  }

  that.item = function (itemID) {
    // Get the current revision ID for the item
    return wikidataItem({ wikidata: that, item: itemID })
  }

  that.getReferencePropertyID = function (referenceURL) {
    var propertyLabel
    if (referenceURL.match(/^https?:\/\/\w+.wikipedia.org/)) {
      propertyLabel = 'Wikimedia import URL'
    } else {
      propertyLabel = 'reference URL'
    }
    return that.getPropertyID(propertyLabel)
  }

  that.getPropertyID = function (propertyLabel) {
    var knownProperties = that.getProperties()
    if (!(propertyLabel in knownProperties)) {
      throw new Error(
        'Unknown property ' + propertyLabel + ' for server ' + that.serverName
      )
    };
    return knownProperties[propertyLabel]
  }

  that.getPropertyName = function (property) {
    return Object.keys(that.getProperties()).find(key => that.getProperties()[key] === property)
  }

  that.getProperties = function () {
    var knownPropertiesByServer = {
      'www.wikidata.org': {
        'reference URL': 'P854',
        'Wikimedia import URL': 'P4656',
        'reference retrieved': 'P813',
        'occupation': 'P106',
        'parliamentary group': 'P4100',
        'electoral district': 'P768',
        'position held': 'P39',
        'parliamentary term': 'P2937',
        'title': 'P1476',
        'language of work or name': 'P407',
        'country': 'P17',
        'instance of': 'P31',
        'start time': 'P580',
        'end time': 'P582'
      },
      'test.wikidata.org': {
        'reference URL': 'P43659',
        'Wikimedia import URL': 'P77057',
        'reference retrieved': 'P388',
        'occupation': 'P70554',
        'parliamentary group': 'P70557',
        'electoral district': 'P70558',
        'position held': 'P39',
        'parliamentary term': 'P70901',
        'title': 'P77107',
        'language of work or name': 'P77090',
        'country': 'P17',
        'instance of': 'P82',
        'start time': 'P355',
        'end time': 'P356'
      },
      'localhost': {
        // For local development assume we're using test.wikidata for
        // the moment (FIXME: though it might be better to ask the
        // server for this information, since it must know which server
        // it's proxying to..)
        'reference URL': 'P43659',
        'Wikimedia import URL': 'P77057',
        'reference retrieved': 'P388',
        'occupation': 'P70554',
        'parliamentary group': 'P70557',
        'electoral district': 'P70558',
        'position held': 'P39',
        'parliamentary term': 'P70901',
        'title': 'P77107',
        'language of work or name': 'P77090',
        'country': 'P17',
        'instance of': 'P82',
        'start time': 'P355',
        'end time': 'P356'
      }
    }
    if (!(that.serverName in knownPropertiesByServer)) {
      throw new Error('Unknown server name ' + that.serverName)
    }
    return knownPropertiesByServer[that.serverName]
  }

  that.getItemID = function (itemLabel) {
    return {
      'www.wikidata.org': {
        'politician': 'Q82955',
        'Canada': 'Q16',
        'human': 'Q5'
      },
      'test.wikidata.org': {
        'politician': 'Q514',
        'Canada': 'Q620',
        'human': 'Q497'
      },
      'localhost': {
        // For local development assume we're using test.wikidata for
        // the moment (FIXME: though it might be better to ask the
        // server for this information, since it must know which server
        // it's proxying to..)
        'politician': 'Q514',
        'Canada': 'Q620',
        'human': 'Q497'
      }
    }[that.serverName][itemLabel]
  }

  that.getPersonCreateData = function (label, description) {
    var data = {
      labels: {},
      descriptions: {}
    }
    data.labels[label.lang] = {
      language: label.lang,
      value: label.value
    }
    data.descriptions[description.lang] = {
      language: description.lang,
      value: description.value
    }
    data.claims = [
      {
        'mainsnak': {
          'snaktype': 'value',
          'property': that.getPropertyID('occupation'),
          'datavalue': {
            'value': getItemValue(that.getItemID('politician')),
            'type': 'wikibase-entityid'
          }
        },
        'type': 'statement',
        'rank': 'normal'
      },
      {
        'mainsnak': {
          'snaktype': 'value',
          'property': that.getPropertyID('instance of'),
          'datavalue': {
            'value': getItemValue(that.getItemID('human')),
            'type': 'wikibase-entityid'
          }
        },
        'type': 'statement',
        'rank': 'normal'
      }
    ]
    return JSON.stringify(data)
  }

  that.getCreateData = function (label, description, countryItem, instanceOfItem) {
    var data = {
      labels: {},
      descriptions: {}
    }
    data.labels[label.lang] = {
      language: label.lang,
      value: label.value
    }
    data.descriptions[description.lang] = {
      language: description.lang,
      value: description.value
    }
    data.claims = [
      {
        'mainsnak': {
          'snaktype': 'value',
          'property': that.getPropertyID('country'),
          'datavalue': {
            'value': getItemValue(countryItem),
            'type': 'wikibase-entityid'
          }
        },
        'type': 'statement',
        'rank': 'normal'
      },
      {
        'mainsnak': {
          'snaktype': 'value',
          'property': that.getPropertyID('instance of'),
          'datavalue': {
            'value': getItemValue(instanceOfItem),
            'type': 'wikibase-entityid'
          }
        },
        'type': 'statement',
        'rank': 'normal'
      }
    ]
    return JSON.stringify(data)
  }

  that.createItem = function (data) {
    return that.ajaxAPI(true, 'wbeditentity', {
      new: 'item',
      data: data,
      summary: this.summary()
    }).then(function (result) {
      return {
        item: result.entity.id,
        revisionID: result.entity.lastrevid
      }
    })
  }

  // Returns a Promise that is resolved with an array of search results.
  // eg: wikiapi.search(n, w, l).then(function(allResults){ ... })
  that.search = function (name, wikipediaToSearch, language) {
    var allResults = {}
    var site = wikipediaToSearch + 'wiki'

    var searchWikidata = new Promise(function (resolve, reject) {
      that.ajaxAPIBasic({
        action: 'wbsearchentities',
        search: name,
        language: language,
        limit: 20,
        type: 'item'
      }).then(function (data) {
        checkForError(data)
        allResults.fromWikidata = transformWikidataResults(data.search)
        resolve()
      })
    })

    var searchWikipedia = new Promise(function (resolve, reject) {
      jsonpPromise(
        'https://' + wikipediaToSearch + '.wikipedia.org/w/api.php?' +
        encodeURIParams({
          action: 'query',
          list: 'search',
          format: 'json',
          srsearch: name
        })
      ).then(function (data) {
        allResults.fromWikipedia = transformWikipediaResults(data.query.search)

        var titles = allResults.fromWikipedia.map(function (result) { return result.title })
        if (allResults.fromWikipedia.length > 0) {
          // Get any Wikidata items associated with those titles from
          // sitelinks:
          that.ajaxAPIBasic({
            action: 'wbgetentities',
            props: 'sitelinks',
            titles: titles.join('|'),
            sites: site
          }).then(function (sitelinks) {
            checkForError(sitelinks)
            addWikidataItemsToWikipediaResults(sitelinks)
            resolve()
          })
        } else {
          resolve()
        }
      })
    })

    var transformWikidataResults = function (results) {
      return results.map(function (result) {
        return {
          item: result.id,
          label: result.label,
          url: 'https://' + that.serverName + '/wiki/' + result.id,
          description: result.description
        }
      })
    }

    var transformWikipediaResults = function (results) {
      return results.map(function (result) {
        return {
          title: result.title,
          item: null,
          snippetHTML: result.snippet,
          wpURL: 'https://' + wikipediaToSearch + '.wikipedia.org/wiki/' +
            encodeURIComponent(result.title.replace(/ /, '_'))
        }
      })
    }

    var addWikidataItemsToWikipediaResults = function (sitelinks) {
      var titleToWikidataItem = {}
      for (let [wikidataItem, sitelinkData] of Object.entries(sitelinks.entities)) {
        // For titles that can't be found, you get back a string of
        // a negative number as the key. If it can be found, the key
        // is an Wikidata item ID.
        if (Number(wikidataItem) < 0) {
          continue
        }
        titleToWikidataItem[sitelinkData.sitelinks[site].title] = wikidataItem
      }
      allResults.fromWikipedia.forEach(function (data, index) {
        var item = titleToWikidataItem[data.title]
        if (item) {
          data.item = item
          data.wdURL = 'https://' + that.serverName + '/wiki/' + item
        }
      })
    }

    // Search wikidata and wikipedia in parallel, formatting the results and
    // storing them in allResults, to be returned when the Promise resolves.
    return Promise.all([
      searchWikidata,
      searchWikipedia
    ]).then(function () {
      return allResults
    })
  }

  that.summary = function () {
    return 'Edited with Verification Pages (' + this.page + ')'
  }

  return that
}

export default wikidata({})
