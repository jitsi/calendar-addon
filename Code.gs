var BASE_DOMAIN = "meet.jit.si";
var MORE_NUMBERS_LINK = "https://" + BASE_DOMAIN + "/static/dialInInfo.html?room=";
var PHONE_NUMBERS_LIST_LINK = "https://api.jitsi.net/phoneNumberList?calendar=true";
var CONF_MAPPER_LINK = "https://api.jitsi.net/conferenceMapper?conference=";
var MUC_HOST = "@conference." + BASE_DOMAIN;

/**
 *  Creates a conference, then builds and returns a ConferenceData object
 *  with the corresponding conference information. This method is called
 *  when a user selects a conference solution defined by the add-on that
 *  uses this function as its 'onCreateFunction' in the add-on manifest.
 *
 *  @param {Object} arg The default argument passed to a 'onCreateFunction';
 *      it carries information about the Google Calendar event.
 *  @return {ConferenceData}
 */
function createConference(arg) {
  const eventData = arg.eventData;
  const calendarId = eventData.calendarId;
  const eventId = eventData.eventId;

  // Retrieve the Calendar event information using the Calendar
  // Advanced service.
  var calendarEvent;
  try {
    calendarEvent = Calendar.Events.get(calendarId, eventId);
  } catch (err) {
    // The calendar event does not exist just yet; just proceed with the
    // given event ID and allow the event details to sync later.
    console.log(err);
    calendarEvent = {
      id: eventId,
    };
  }

  // Create a conference on the third-party service and return the
  // conference data or errors in a custom JSON object.
  var conferenceInfo = create3rdPartyConference(calendarEvent);

  // Build and return a ConferenceData object, either with conference or
  // error information.
  var dataBuilder = ConferenceDataService.newConferenceDataBuilder();

  if (!conferenceInfo.error) {
    // No error, so build the ConferenceData object from the
    // returned conference info.
    var conferenceTypeParameter = ConferenceDataService.newConferenceParameter()
        .setKey('conferenceSolutionType')
        .setValue('jitsi');

    dataBuilder.setConferenceId(conferenceInfo.id)
        .addConferenceParameter(conferenceTypeParameter)

    conferenceInfo.numbers.forEach(function(number) {
      var phoneEntryPoint = ConferenceDataService.newEntryPoint()
        .setEntryPointType(ConferenceDataService.EntryPointType.PHONE)
        .setUri('tel:' + number)
        .setPin(conferenceInfo.phonePin);
      dataBuilder.addEntryPoint(phoneEntryPoint);
    });
    
    var moreEntryPoint = ConferenceDataService.newEntryPoint()
        .setEntryPointType(ConferenceDataService.EntryPointType.MORE)
        .setUri(conferenceInfo.moreLink);
      dataBuilder.addEntryPoint(moreEntryPoint);

    if (conferenceInfo.videoUri) {
      var videoEntryPoint = ConferenceDataService.newEntryPoint()
          .setEntryPointType(ConferenceDataService.EntryPointType.VIDEO)
          .setUri(conferenceInfo.videoUri);
      dataBuilder.addEntryPoint(videoEntryPoint);
    }
  } else {
    // Other error type;
    var error = ConferenceDataService.newConferenceError()
        .setConferenceErrorType(
            ConferenceDataService.ConferenceErrorType.TEMPORARY);
    dataBuilder.setError(error);
  }

  // Don't forget to build the ConferenceData object.
  return dataBuilder.build();
}

/**
 *  Contact the third-party conferencing system to create a conference there,
 *  using the provided calendar event information. Collects and returns the
 *  conference data returned by the third-party system in a custom JSON object
 *  with the following fields:
 *
 *    data.adminEmail - the conference administrator's email
 *    data.conferenceLegalNotice - the conference legal notice text
 *    data.error - Only present if there was an error during
 *         conference creation. Equal to 'AUTH' if the add-on user needs to
 *         authorize on the third-party system.
 *    data.id - the conference ID
 *    data.phoneNumber - the conference phone entry point phone number
 *    data.phonePin - the conference phone entry point PIN
 *    data.videoPasscode - the conference video entry point passcode
 *    data.videoUri - the conference video entry point URI
 *
 *  The above fields are specific to this example; which conference information
 *  you add-on needs is dependent on the third-party conferencing system
 *  requirements.
 *
 * @param {Object} calendarEvent A Calendar Event resource object returned by
 *     the Google Calendar API.
 * @return {Object}
 */
function create3rdPartyConference(calendarEvent) {
  var data = {};

  var response = UrlFetchApp.fetch(PHONE_NUMBERS_LIST_LINK);
  var jsonobj = JSON.parse(response.getContentText());

  var roomName = generateRoomWithoutSeparator(jsonobj.roomNameDictionary);
  data.id = BASE_DOMAIN +"/" + roomName;
  data.videoUri = "https://" + BASE_DOMAIN +"/" + roomName;
  data.moreLink = MORE_NUMBERS_LINK + roomName;
  
  var responseMapper = UrlFetchApp.fetch(CONF_MAPPER_LINK + roomName + MUC_HOST);
  var jsonobjMapper = JSON.parse(responseMapper.getContentText());
  data.phonePin = jsonobjMapper.id;
  
  data.numbers = [];
  
  var keys = [];

  for (var key in jsonobj.numbers) {
    if (jsonobj.numbers.hasOwnProperty(key)) {
      data.numbers.push.apply(data.numbers, jsonobj.numbers[key]);
    }
  }

  return data;
}

/*
 * Returns true if the string 's' contains one of the
 * template strings.
 */
function hasTemplate(s, categories) {
    for (var template in categories){
        if (s.indexOf(template) >= 0){
            return true;
        }
    }
}

/**
 * Generates random int within the range [min, max]
 * @param min the minimum value for the generated number
 * @param max the maximum value for the generated number
 * @returns random int number
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get random element from array or string.
 * @param {Array|string} arr source
 * @returns array element or string character
 */
function randomElement(arr) {
    return arr[randomInt(0, arr.length -1)];
}

var PATTERNS = [
    "_ADJECTIVE__PLURALNOUN__VERB__ADVERB_"
];

/**
 * Generates new room name.
 * @param customDictionary a dictionary containing keys pluralNouns, verbs,
 * adverbs and adjectives, values are array of strings.
 */
function generateRoomWithoutSeparator(customDictionary) {
    // Note that if more than one pattern is available, the choice of
    // 'name' won't have a uniform distribution amongst all patterns (names
    // from patterns with fewer options will have higher probability of
    // being chosen that names from patterns with more options).
    var name = randomElement(PATTERNS);
    var word;
    var categories = {
            "_PLURALNOUN_": customDictionary.pluralNouns,
            "_VERB_": customDictionary.verbs,
            "_ADVERB_": customDictionary.adverbs,
            "_ADJECTIVE_": customDictionary.adjectives
        };
    while (hasTemplate(name, categories)) {
        for (var template in categories) {
            word = randomElement(categories[template]);
            name = name.replace(template, word);
        }
    }

    return name;
}
