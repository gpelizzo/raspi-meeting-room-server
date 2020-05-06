"use strict";
/**	This file is part of RASPI-MEETING-SERVER.
*
*	RASPI-MEETING-SERVER is free software: you can redistribute it and/or modify
*	it under the terms of the GNU General Public License as published by
*	the Free Software Foundation, either version 3 of the License, or
*	(at your option) any later version.
*
*	RASPI-MEETING-SERVER is distributed in the hope that it will be useful,
*	but WITHOUT ANY WARRANTY; without even the implied warranty of
*	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
*	GNU General Public License for more details.
*
*	You should have received a copy of the GNU General Public License
*	along with Foobar.  If not, see <https://www.gnu.org/licenses/>.
*
*
*	Author: Gilles PELIZZO
*	Date: April 20th, 2020.
*/
Object.defineProperty(exports, "__esModule", { value: true });
var https = require('https');
var querystring = require('querystring');
var moment = require('moment');
var CLogger_1 = require("./CLogger");
/**
* 	Peforms IEventsProvider operations for Microsoft Azure/O365 - Meeting Rooms events calendars
*/
var CMicrosoftGraph = /** @class */ (function () {
    /**
    *	Class constructor
    *	param pParams: required parameters in order to manage API operations. Only keys below are mandatory
    *		{
    *			...
    *			"MSGraph_application_id": "<Microsoft Graph application ID>",
    *			"MSGraph_client_secret": "<Microsoft Graph client secret>",
    *			"MSGraph_active_directory_id": "Microsoft Graph active directory ID",
    *			"push_notification_web_hook_addr": "Push notification URL",
    *			"push_notifications_web_hook_port": "Push notification port",
    *			"impersonate_user_email": "<email address of one Microsft Azure/O365 admin>"
    *			...
    *		}
    */
    function CMicrosoftGraph(pParams) {
        this.mApplicationID = '';
        this.mClientSecret = '';
        this.mActiveDirectoryID = '';
        this.mWebHookAddr = '';
        this.mImpersonateUser = '';
        this.mApplicationID = pParams.MSGraph_application_id;
        this.mClientSecret = pParams.MSGraph_client_secret;
        this.mActiveDirectoryID = pParams.MSGraph_active_directory_id;
        this.mWebHookAddr = pParams.push_notification_web_hook_addr + ':' + pParams.push_notifications_web_hook_port.toString();
        this.mImpersonateUser = pParams.impersonate_user_email;
    }
    /**
    * Retreive aMS graph API access token
    * return: API access token
    */
    CMicrosoftGraph.prototype.getAccessToken = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var requestParams = querystring.stringify({
                grant_type: 'client_credentials',
                client_id: _this.mApplicationID,
                client_secret: _this.mClientSecret,
                resource: 'https://graph.microsoft.com'
            });
            var options = {
                hostname: 'login.microsoftonline.com',
                port: 443,
                path: '/' + _this.mActiveDirectoryID + '/oauth2/token',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': requestParams.length
                }
            };
            var request = https.request(options, function (res) {
                res.on('data', function (data) {
                    resolve(JSON.parse(data.toString('utf8')));
                });
            });
            request.on('error', function (error) {
                CLogger_1.CLogger.error('(CMicrosoftGraph:getAccessToken:#1) ' + error);
                reject(error);
            });
            request.write(Buffer.from(requestParams, 'utf-8'));
            request.end();
        });
    };
    /**
    *	Push notification callback. This member function is called by https listener server when a push notification occures
    */
    CMicrosoftGraph.prototype.callbackPushNotification = function (pRequest, pResponse, pCallBack) {
        if (pRequest.query.validationToken !== undefined) {
            /* this a a validation token request performed immediatly after a new push notification channel registration*/
            pResponse.setHeader('Content-Type', 'text/plain');
            pResponse.status(200).send(pRequest.query.validationToken);
        }
        else {
            /*this is a real event push notification*/
            if (pRequest.body.value.length !== 0) {
                var meetingRoomId = pRequest.body.value[0].clientState;
                pResponse.setHeader('Content-Type', 'text/plain');
                pResponse.status(202).send('Accepted');
                pCallBack(meetingRoomId);
            }
        }
    };
    /**
    * Retreive the list of the current subscriptions already registered for a meeting room calendar
    * in order to ensure that the susbcriptions have been registered only for this web hook, check the notification URL
    * return data :
    *		[
    *			{
    *				id: <id of the push notification>
    *				expiration: <expiration date/time, e.g.: 31/05/2020 14:55>
    *			},
    *			...
    *		]
    */
    CMicrosoftGraph.prototype.getPushNotificationSubscriptions = function (pCalendarID) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.getAccessToken().then(function (data) {
                var options = {
                    hostname: 'graph.microsoft.com',
                    port: 443,
                    path: '/v1.0/subscriptions',
                    method: 'GET',
                    headers: {
                        'Authorization': 'Bearer ' + data.access_token,
                        'Accept': 'application/json'
                    }
                };
                var request = https.request(options, function (res) {
                    var chunksData = [];
                    res.on('data', function (data) {
                        chunksData.push(data);
                    });
                    res.on('end', function () {
                        var body = Buffer.concat(chunksData);
                        var listSubscriptions = [];
                        JSON.parse(body.toString('utf8')).value.forEach(function (item) {
                            //console.log(this.mWebHookAddr + ' | ' + item.notificationUrl + ' | ' + item.resource.match('users/(.*)/calendar/events')[1] + ' | ' + pCalendarID);
                            if ((_this.mWebHookAddr === item.notificationUrl) && (item.resource.match('users/(.*)/calendar/events')[1] === pCalendarID)) {
                                listSubscriptions.push({ id: item.id, expiration: moment.utc(item.expirationDateTime, 'YYYY-MM-DDTHH:mm:ss').local().format('DD/MM/YYYY HH:mm') });
                            }
                        });
                        CLogger_1.CLogger.debug('(CMicrosoftGraph:getPushNotificationSubscriptions:#1) ' + JSON.stringify(listSubscriptions));
                        resolve(listSubscriptions);
                    });
                });
                request.on('error', function (error) {
                    CLogger_1.CLogger.error('(CMicrosoftGraph:getPushNotificationSubscriptions:#2) ' + error);
                    reject(error);
                });
                request.end();
            })
                .catch(function (err) {
                CLogger_1.CLogger.error('(CMicrosoftGraph:getPushNotificationSubscriptions:#3) ' + err);
                reject(err);
            });
        });
    };
    /**
    * Unregister a push notification channel
    * param pChannelID: channel ID
    * param pMeetingRoomId: meeting room ID (meeting_room_id of events config)
    * return: MS graph API result
    */
    CMicrosoftGraph.prototype.unregisterPushNotification = function (pChannelID, pMeetingRoomID) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.getAccessToken().then(function (data) {
                var options = {
                    hostname: 'graph.microsoft.com',
                    port: 443,
                    path: '/v1.0/subscriptions' + '/' + pChannelID,
                    method: 'DELETE',
                    headers: {
                        'Authorization': 'Bearer ' + data.access_token,
                        'Accept': 'application/json'
                    }
                };
                var request = https.request(options, function (res) {
                    var chunksData = [];
                    res.on('data', function (data) {
                        chunksData.push(data);
                    });
                    res.on('end', function () {
                        var body = Buffer.concat(chunksData);
                        CLogger_1.CLogger.debug('(CMicrosoftGraph:unregisterPushNotification:#1) ' + JSON.stringify(body.toString('utf8')));
                        resolve(body.toString('utf8'));
                    });
                });
                request.on('error', function (error) {
                    CLogger_1.CLogger.error('(CMicrosoftGraph:unregisterPushNotification:#2) ' + error);
                    reject(error);
                });
                request.end();
            })
                .catch(function (err) {
                CLogger_1.CLogger.error('(CMicrosoftGraph:unregisterPushNotification:#3) ' + err);
                reject(err);
            });
        });
    };
    /**
    * Register a push notification channel
    * param pCalendarId: calendar ID (= email address)
    * param pResourceID: meeting room ID (meeting_room_id of events config)
    * return: MS Graph API result
    */
    CMicrosoftGraph.prototype.registerPushNotification = function (pCalendarId, pResourceID) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            /*first ensure that a push notification has noy yet previously registered*/
            _this.getPushNotificationSubscriptions(pCalendarId).then(function (result) {
                if (result.length !== 0) {
                    reject('subscription already exists');
                }
                else {
                    /*subcsription does not already exist. regsister it*/
                    _this.getAccessToken().then(function (data) {
                        var requestParams = JSON.stringify({
                            changeType: 'created,updated,deleted',
                            notificationUrl: _this.mWebHookAddr,
                            resource: 'users/' + pCalendarId + '/calendar/events',
                            expirationDateTime: moment.utc('23:59:59', 'hh:mm:ss').toISOString(),
                            clientState: pResourceID
                        });
                        var options = {
                            hostname: 'graph.microsoft.com',
                            port: 443,
                            path: '/v1.0/subscriptions',
                            method: 'POST',
                            headers: {
                                'Authorization': 'Bearer ' + data.access_token,
                                'Accept': 'application/json;charset=UTF-8',
                                'Content-Type': 'application/json; charset=UTF-8',
                                'Content-Length': requestParams.length
                            }
                        };
                        var request = https.request(options, function (res) {
                            var chunksData = [];
                            res.on('data', function (data) {
                                chunksData.push(data);
                            });
                            res.on('end', function () {
                                var body = Buffer.concat(chunksData);
                                CLogger_1.CLogger.debug('(CMicrosoftGraph:registerPushNotification:#1) ' + body.toString('utf8'));
                                resolve(JSON.parse(body.toString('utf8')).id);
                            });
                        });
                        request.on('error', function (error) {
                            CLogger_1.CLogger.error('(CMicrosoftGraph:registerPushNotification:#2) ' + error);
                            reject(error);
                        });
                        request.write(Buffer.from(requestParams, 'utf-8'));
                        request.end();
                    })
                        .catch(function (err) {
                        CLogger_1.CLogger.error('(CMicrosoftGraph:registerPushNotification:#3) ' + err);
                    });
                }
            });
        });
    };
    /**
    * Retreive daily events for a calendar
    * param pCalendarId: calendar ID (= email address)
    * return eventsArray:
    *		[
    *			{
    *				"start_time": "<e.g.: 18:30>",
    *				"stop_time": "<e.g.: 19:00>",
    *				"date": "<e.g.: 16/04/2020>",
    *				"topic": "<subject of the event>"
    *			},
    *			...
    *		]
    */
    CMicrosoftGraph.prototype.getEvents = function (pCalendarId) {
        var _this = this;
        var mnt_start = moment('00:00:00', 'hh:mm:ss');
        var mnt_stop = moment('23:59:59', 'hh:mm:ss');
        return new Promise(function (resolve, reject) {
            _this.getAccessToken().then(function (data) {
                var options = {
                    hostname: 'graph.microsoft.com',
                    port: 443,
                    path: '/v1.0/users/' + pCalendarId + '/calendarView?startDateTime=' + mnt_start.format('YYYY-MM-DDTHH:mm') + '&endDateTime=' + mnt_stop.format('YYYY-MM-DDTHH:mm'),
                    method: 'GET',
                    headers: {
                        'Authorization': 'Bearer ' + data.access_token,
                        'Accept': 'application/json'
                    }
                };
                var request = https.request(options, function (res) {
                    var chunksData = [];
                    res.on('data', function (data) {
                        chunksData.push(data);
                    });
                    res.on('end', function () {
                        var body = Buffer.concat(chunksData);
                        var eventsArray = [];
                        JSON.parse(body.toString('utf8')).value.forEach(function (item) {
                            eventsArray.push({
                                //return time is ITC, then convert to local
                                start_time: moment.utc(item.start.dateTime, 'YYYY-MM-DDTHH:mm:ss').local().format('HH:mm'),
                                stop_time: moment.utc(item.end.dateTime, 'YYYY-MM-DDTHH:mm:ss').local().format('HH:mm'),
                                date: moment().format('DD/MM/YYYY'),
                                topic: item.subject
                            });
                        });
                        CLogger_1.CLogger.debug('(CMicrosoftGraph:getEvents:#1) ' + JSON.stringify(eventsArray));
                        resolve(eventsArray);
                    });
                });
                request.on('error', function (error) {
                    CLogger_1.CLogger.error('(CMicrosoftGraph:getEvents:#2) ' + error);
                    reject(error);
                });
                request.end();
            })
                .catch(function (err) {
                CLogger_1.CLogger.error('(CMicrosoftGraph:getEvents:#3) ' + err);
                reject(err);
            });
        });
    };
    /**
    * Retreive the list of all meeting rooms, including name and email address
    * return retValue :
    *		[
    *			{
    *				name: <name of the meeting room>
    *				address: <email address of the calendare related to the meeting room>
    *			},
    *			...
    *		]
    */
    CMicrosoftGraph.prototype.getResources = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.getAccessToken().then(function (data) {
                var options = {
                    hostname: 'graph.microsoft.com',
                    port: 443,
                    path: '/beta/users/' + _this.mImpersonateUser + '/findRooms',
                    method: 'GET',
                    headers: {
                        'Authorization': 'Bearer ' + data.access_token,
                        'Accept': 'application/json'
                    }
                };
                var request = https.request(options, function (res) {
                    var chunksData = [];
                    res.on('data', function (data) {
                        chunksData.push(data);
                    });
                    res.on('end', function () {
                        var body = Buffer.concat(chunksData);
                        var retValue = [];
                        JSON.parse(body.toString('utf8')).value.forEach(function (item) {
                            retValue.push({ name: item.name, address: item.address });
                        });
                        CLogger_1.CLogger.debug('(CMicrosoftGraph:getResources:#1) ' + JSON.stringify(retValue));
                        resolve(retValue);
                    });
                });
                request.on('error', function (error) {
                    CLogger_1.CLogger.error('(CMicrosoftGraph:getResources:#2) ' + error);
                    reject(error);
                });
                request.end();
            })
                .catch(function (err) {
                CLogger_1.CLogger.error('(CMicrosoftGraph:getResources:#3) ' + err);
                reject(err);
            });
        });
    };
    return CMicrosoftGraph;
}());
exports.CMicrosoftGraph = CMicrosoftGraph;
//# sourceMappingURL=CMicrosoftGraph.js.map