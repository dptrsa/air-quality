// Copyright 2017, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';
const http = require('http');
const host = 'airnowapi.org';
const airNowApiKey = '6D5F2F7E-06C8-48E5-83AD-D6DDC3ADB202';

exports.airQualityWebhook = (req, res) => {
  // Get the zip and date from the request
  var tempDate = new Date();
  var today = tempDate.getFullYear() + '-' + ('0' + (tempDate.getMonth()+1)).slice(-2) + '-' + ('0' + (tempDate.getDate())).slice(-2);
  let zip = req.body.result.parameters['zip-code']; // zip is a required param
  // Get the date
  let date = '';
  if (req.body.result.parameters['date']) {
    date = req.body.result.parameters['date'];
  } else {
	  date = today;
  }
  // Call the AirNow API
  callAirNowApi(zip, date).then((output) => {
    // Return the results of the AirNow API to Dialogflow
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ 'speech': output, 'displayText': output }));
  }).catch((error) => {
    // If there is an error let the user know
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ 'speech': error, 'displayText': error }));
  });
  // run firestore test
  firestoreTest();
};

function callAirNowApi (zip, date) {
  return new Promise((resolve, reject) => {
	
	var tense = 'is';
	var tempDate = new Date();
	var today = tempDate.getFullYear() + '-' + ('0' + (tempDate.getMonth()+1)).slice(-2) + '-' + ('0' + (tempDate.getDate())).slice(-2);
	var path = '';
	var type = '';
	var output ='';

    // Create the path for the HTTP request to get the air quality index
	
	if (date <= today) {
		type = 'observation';
		path = '/aq/observation/zipCode/current/?format=application/json&zipCode=' + zip + '&distance=25&API_KEY=' + airNowApiKey;
	} else {
		type = 'forecast';
		path = '/aq/forecast/zipCode/?format=application/json&zipCode=' + zip + '&date=' + date + '&distance=25&API_KEY=' + airNowApiKey;
	}
    
	// Make the HTTP request to get the aqi
    http.get({host: host, path: path}, (res) => {
      let body = ''; // var to store the response chunks
      res.on('data', (d) => { body += d; }); // store each response chunk
      res.on('end', () => {
        // After all the data has been received parse the JSON for desired data
        let response = JSON.parse(body);
		let datum = response[0];
		
		// TODO: Cache 2 weeks' historical AQI observations in GCP and read from there instead of the AirNow API
		// TODO: Invsetigate feasibility to offering product suggestions when air quality is bad, or when user asks for them. Ideally 
		//       suggestions would be carefully curated ads.
		// TODO: Change agent response from numerical AQI to a conversational assessment of the weather. Maybe only call poor quality metrics.
		// TODO: Maybe add wind forecast / actual to agent response.
		// TODO: Maybe add any local (25mi radius) fire alerts to agent response.
		// TODO: Are there any agencies that monitor and issue air alerts in response to industrial accidents? Include.
		
		if (typeof datum['AQI'] === 'undefined' || datum['AQI']===-1) {
			resolve(`I may have misheard your zip code, or the forecast is not available yet. Would you like to try again?`);
		}
		
		if (type === 'observation') {
			if (date < today) {
				tense = 'was';
			} else {
				tense = 'is';
			}
			output = `The AQI ${tense} ${datum['AQI']} (${datum['Category']['Name']}). Would you like to check another zip code?`;
		} else {
			output = `The AQI is forecast to be ${datum['AQI']} (${datum['Category']['Name']}). Can I help you with anything else?`;
		}
		
        // Resolve the promise with the output text
        resolve(output);
      });
      res.on('error', (error) => {
        reject(error);
      });
    });
  });
}

// test for firestore
function firestoreTest () {
	const admin = require('firebase-admin');
	const functions = require('firebase-functions');

	console.log('Initializing Firestore');
	admin.initializeApp(functions.config().firebase);
	var db = admin.firestore();
	
	db.collection('readings').get()
    .then((snapshot) => {
      snapshot.forEach((doc) => {
        console.log(doc.id, '=>', doc.data());
      });
    })
    .catch((err) => {
      console.log('Error getting documents', err);
    });
}