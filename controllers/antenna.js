var LMS_SCHEMA = 'mass_media';
var db_lms = require('./db_lms.js');

// this function returns the lng(s), lat(s) by passing application_id, facility_id, or callsign
function getAntenna(req, res) {
	console.log('\n' + '============ getAntenna ============');
	// retrieve query parameters
	var application_id = req.query.applicationId;
	var facility_id = req.query.facilityId;
	var callsign = req.query.callsign;
	var service_type = req.query.serviceType;
	
	// checkQueryParams return true if parameters are valid
	// if there is an error, it returns false + it sends 400 response
	var paramsOK = check_query_params(application_id,facility_id,callsign,service_type,res);
	// if one of the params is invalid, exit the function
	if (!paramsOK){
		return;
	}
	
	// this condition should be removed once the am table is re-structured
	if (service_type.toLowerCase() == 'am'){
		console.log('\n' + 'The code is not implemented yet to accept am service type.');
		res.status(400).send({
			'status': 'error',
			'statusCode':'400',
			'statusMessage': 'The code is not implemented yet to accept am service type. ' + process.version
		});
		return;
	}
	else {
		// 
		if (application_id != undefined && facility_id == undefined && callsign == undefined){
			query_by_application_id(application_id,service_type,res);
		}
		else if (application_id == undefined && facility_id != undefined && callsign == undefined){
			query_by_facility_id(facility_id,service_type,res);
		}
		else if (application_id == undefined && facility_id == undefined && callsign != undefined){
			callsign = callsign.toUpperCase()
			query_by_callsign(callsign,service_type,res);
		}
	}

}

function check_query_params(application_id,facility_id,callsign,service_type,res){
	
	// check if service is not tv, fm, or am, then if not return 400 response
	if ( !(['tv', 'am', 'fm'].includes(service_type.toLowerCase())) ) {
		console.log('\n' + 'invalid serviceType value');
		res.status(400).send({
			'status': 'error',
			'statusCode':'400',
			'statusMessage': 'Invalid serviceType value - must be tv, fm, or am.'
		});
		return false;
	}
	
	// check which of the three params is passed "callsign, facility_id, or application_id"
	var v3 = [application_id, facility_id, callsign];
	var numDefined = 0;
	for (var i = 0; i < v3.length; i++) {
		if (v3[i] !== undefined) {
			numDefined++;
		}
	}

	// if none of the three params is passed,
	// send 400 response explaining the need to use one of the three params
	if (numDefined === 0) {
		console.log('\n' + 'must provide (callsign, facilityId, or applicationId) plus serviceType.');
		res.status(400).send({
			'status': 'error',
			'statusCode':'400',
			'statusMessage': 'must provide (callsign, facilityId, or applicationId) plus serviceType.'
		});
		return false;
	}
	
	// if more than one of the three params are passed,
	// send 400 response explaining that the user can pass only on of three params
	if (numDefined > 1) {
		console.log('\n' + 'should provide only callsign, facilityId, or applicationId');
		res.status(400).send({
			'status': 'error',
			'statusCode':'400',
			'statusMessage': 'should provide only callsign, facilityId, or applicationId.'
		});
		return false;
	}

	// check if applicationId is used and invalid, return 400 response
	if (application_id != undefined) {
		if (application_id == '' || !application_id.match(/^\d+$/)) {
			console.log('\n' + 'invalid applicationId value');
			res.status(400).send({
			'status': 'error',
			'statusCode':'400',
			'statusMessage': 'Invalid applicationId value.'
			});
			return false;
		}
	}

	// check if facilityId is used and invalid, return 400 response
	if (facility_id != undefined) {
		// check if facility id is in numeric format
		if (facility_id == '' || !facility_id.match(/^\d+$/)) {
			console.log('\n' + 'invalid facilityId value');
			res.status(400).send({
			'status': 'error',
			'statusCode':'400',
			'statusMessage': 'Invalid facilityId value.'
			});
			return false;
		}
		// facility_id=0 are for proposed locations for stations.
		if (facility_id == '0'){
			console.log('\n' + 'invalid facilityId value of 0');
			res.status(400).send({
			'status': 'error',
			'statusCode':'400',
			'statusMessage': 'Invalid facilityId value. The value 0 is for proposed locations for stations.'
			});
			return false;
		}
	}

	// check if callsign is used and invalid, return 400 response
	if (callsign != undefined) {
		// check if callsign has only numeric, chars, and -s
		if (callsign == '' || !callsign.match(/^[a-zA-Z0-9-]+$/)) {
		
			console.log('\n' + 'invalid callsign value');
			res.status(400).send({
				'status': 'error',
				'statusCode':'400',
				'statusMessage': 'Invalid callsign value.'
			});
			return false;
		}

		// check if callsign is 'NEW', 'VACANT', 
		if (['NEW','VACANT','NEW-DT','XE','XENVA2','NEWDT'].includes(callsign.toUpperCase())){

			console.log('\n' + 'Irregular callsign value');
			res.status(400).send({
				'status': 'error',
				'statusCode':'400',
				'statusMessage': 'Irregular callsign value.'
			});
			return false;
		}

		// check if callsign starts with D
		if (callsign.toUpperCase().startsWith('D')) {

			console.log('\n' + 'Deleted callsign value');
			res.status(400).send({
				'status': 'error',
				'statusCode':'400',
				'statusMessage': 'This callsign value is deleted.'
			});
			return false;
		}

		// Use pg sql to check other columns

		var q = "SELECT facility_id, fac_country, fac_status ";
		q = q + "FROM mass_media.gis_facility ";
		q = q + "where fac_callsign = '"+callsign+"';";
		
		db_lms.any(q)
		.then(function (data) {
			
			if(data[0].facility_id == 0){
				console.log('\n' + 'callsign returns facilityId value of 0');
				res.status(400).send({
				'status': 'error',
				'statusCode':'400',
				'statusMessage': 'The callsign '+callsign+' returns a facilityId value of 0. The value 0 is for proposed locations for stations.'
				});
				return false;
			}
			
			if(data[0].fac_country != 'US'){
				console.log('\n' + 'Callsign value outside US boundary.');
				res.status(400).send({
					'status': 'error',
					'statusCode':'400',
					'statusMessage': 'This callsign value is outside the US boundary.'
				});
				return false;
			}

			if(data[0].fac_status == 'LICAN'){
				console.log('\n' + 'Callsign has a status of (license cancelled).');
				res.status(400).send({
					'status': 'error',
					'statusCode':'400',
					'statusMessage': 'This callsign has a status of (license cancelled).'
				});
				return false;
			}

			if(data[0].fac_status == 'FVOID'){
				console.log('\n' + 'Callsign has a status of (facility void).');
				res.status(400).send({
					'status': 'error',
					'statusCode':'400',
					'statusMessage': 'This callsign has a status of (facility void).'
				});
				return false;
			}

		})
		.catch(function (err) {
			console.log('\n' + err);
			callback(err, null);
		});

	}
	return true;
}

function query_by_application_id(application_id,service_type,res){
	
	var eng_data_table = LMS_SCHEMA + ".gis_" + service_type + "_eng_data";

	var	q = "select distinct case when lon_dir = 'W' ";
	q = q + "then round(((lon_deg + lon_min/60 + lon_sec/3600)*-1)::numeric,7) ";
	q = q + "when lon_dir = 'E' ";
	q = q + "then round((lon_deg + lon_min/60 + lon_sec/3600)::numeric,7) ";
	q = q + "else -999::numeric ";
	q = q + "end as lng, "
	q = q + "case "
	q = q + "when lat_dir = 'N' ";
	q = q + "then round((lat_deg + lat_min/60 + lat_sec/3600)::numeric,7) ";
	q = q + "when lat_dir = 'S' ";
	q = q + "then round(((lat_deg + lat_min/60 + lat_sec/3600)*-1)::numeric,7) ";
	q = q + "else -999::numeric ";
	q = q + "end as lat ";
	q = q + "from " + eng_data_table + " ";
	q = q + "where application_id = "+application_id+";";
	
	
	db_lms.any(q)
	.then(function (data) {

		var params = undefined;
		if (data.length == 0) {
			console.log('\n' + 'no valid record found');
			res.status(400).send({
				'status': 'error',
				'statusCode':'400',
				'statusMessage': 'applicationId not found in database.'
			});
			return;
		}
		else {
			params = {
					'service type': service_type,
					'application id': application_id,
					'antenna(s)': data
			};

			res.status(200);
			res.setHeader('Content-Type','application/json');
			res.send(JSON.stringify(params));
			
		}

	})
	.catch(function (err) {
		console.log('\n' + err);
		callback(err, null);
	});
}

function query_by_facility_id(facility_id,service_type,res){
	
	var eng_data_table = LMS_SCHEMA + ".gis_" + service_type + "_eng_data";

	var	q = "select distinct case when lon_dir = 'W' ";
	q = q + "then round(((lon_deg + lon_min/60 + lon_sec/3600)*-1)::numeric,7) ";
	q = q + "when lon_dir = 'E' ";
	q = q + "then round((lon_deg + lon_min/60 + lon_sec/3600)::numeric,7) ";
	q = q + "else -999::numeric ";
	q = q + "end as lng, "
	q = q + "case "
	q = q + "when lat_dir = 'N' ";
	q = q + "then round((lat_deg + lat_min/60 + lat_sec/3600)::numeric,7) ";
	q = q + "when lat_dir = 'S' ";
	q = q + "then round(((lat_deg + lat_min/60 + lat_sec/3600)*-1)::numeric,7) ";
	q = q + "else -999::numeric ";
	q = q + "end as lat ";
	q = q + "from " + eng_data_table + " ";
	q = q + "where facility_id = "+facility_id+";";
	
	console.log(q);
	
	db_lms.any(q)
	.then(function (data) {

		var params = undefined;
		if (data.length == 0) {
			console.log('\n' + 'no valid record found');
			res.status(400).send({
				'status': 'error',
				'statusCode':'400',
				'statusMessage': 'facilityId not found in database.'
			});
			return;
		}
		else {
			params = {
					'service type': service_type,
					'facility id': facility_id,
					'antenna(s)': data
			};

			res.status(200);
			res.setHeader('Content-Type','application/json');
			res.send(JSON.stringify(params));
			return;
		}

	})
	.catch(function (err) {
		console.log('\n' + err);
		callback(err, null);
	});
}

function query_by_callsign(callsign,service_type,res){
	
	var q1 = "SELECT facility_id ";
	q1 = q1 + "FROM mass_media.gis_facility ";
	q1 = q1 + "where fac_callsign = '"+callsign+"';";
	
	var fac_ids = [];
	db_lms.any(q1)
	.then(function (data) {

		if (data.length == 0) {
			console.log('\n' + 'no valid record found');
			res.status(400).send({
				'status': 'error',
				'statusCode':'400',
				'statusMessage': 'callsign not found in database.'
			});
			return;
		}
		else {
							
			var eng_data_table = LMS_SCHEMA + ".gis_" + service_type + "_eng_data";

			var	q2 = "select distinct case when lon_dir = 'W' ";
			q2 = q2 + "then round(((lon_deg + lon_min/60 + lon_sec/3600)*-1)::numeric,7) ";
			q2 = q2 + "when lon_dir = 'E' ";
			q2 = q2 + "then round((lon_deg + lon_min/60 + lon_sec/3600)::numeric,7) ";
			q2 = q2 + "else -999::numeric ";
			q2 = q2 + "end as lng, "
			q2 = q2 + "case "
			q2 = q2 + "when lat_dir = 'N' ";
			q2 = q2 + "then round((lat_deg + lat_min/60 + lat_sec/3600)::numeric,7) ";
			q2 = q2 + "when lat_dir = 'S' ";
			q2 = q2 + "then round(((lat_deg + lat_min/60 + lat_sec/3600)*-1)::numeric,7) ";
			q2 = q2 + "else -999::numeric ";
			q2 = q2 + "end as lat ";
			q2 = q2 + "from " + eng_data_table + " ";
			q2 = q2 + "where facility_id = "+data[0].facility_id+";";

			db_lms.any(q2)
			.then(function (data) {

				var params = undefined;
				if (data.length == 0) {
					console.log('\n' + 'no valid record found');
					res.status(400).send({
						'status': 'error',
						'statusCode':'400',
						'statusMessage': 'facilityId of callsign '+ callsign +' not found in database.'
					});
					return;
				}
				else {
					params = {
							'service type': service_type,
							'callsign': callsign,
							'antenna(s)': data
					};

					res.status(200);
					res.setHeader('Content-Type','application/json');
					res.send(JSON.stringify(params));
					return;
				}
			})
			.catch(function (err) {
				console.log('\n' + err);
				callback(err, null);
			});
		}

	})
	.catch(function (err) {
		console.log('\n' + err);
		callback(err, null);
	});
	
}

module.exports.getAntenna = getAntenna;


