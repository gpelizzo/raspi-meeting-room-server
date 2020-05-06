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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var http = require('http');
var https = require('https');
var express = require('express');
var body = require('body-parser');
var CGoogleGSuite_1 = require("./CGoogleGSuite");
var CMicrosoftGraph_1 = require("./CMicrosoftGraph");
var CLogger_1 = require("./CLogger");
var EVT_PROVIDER;
(function (EVT_PROVIDER) {
    EVT_PROVIDER["google_gsuite"] = "google";
    EVT_PROVIDER["microsoft_graph"] = "microsoft";
})(EVT_PROVIDER || (EVT_PROVIDER = {}));
var EnumClientRegistration;
(function (EnumClientRegistration) {
    EnumClientRegistration["already_registered"] = "Client is already registered";
    EnumClientRegistration["not_yet_registered"] = "Client has not yet been registered";
    EnumClientRegistration["meeting_room_error"] = "Meeting ID does not exist";
})(EnumClientRegistration = exports.EnumClientRegistration || (exports.EnumClientRegistration = {}));
/**
* 	Manage calendars events gathering and dispatching
*/
var CEvents = /** @class */ (function () {
    function CEvents() {
    }
    /**
    * Initialize class
    * param pParams: global params, including SSL certificats path for https server (push notification web hook), web hook URL, events provider and so on
    */
    CEvents.init = function (pParams) {
        return __awaiter(this, void 0, void 0, function () {
            var httpsServer, bUpdated, _loop_1, this_1, _i, _a, meetingRoom;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        this.mParams = pParams;
                        /*retreive calendars settings, including display clients. Set mEventsMeetingRooms*/
                        this.readEventsConfig();
                        httpsServer = https.createServer({
                            key: fs.readFileSync(this.mParams.ssl_key_path),
                            cert: fs.readFileSync(this.mParams.ssl_cert_path),
                        }, this.mExpressModule);
                        this.mExpressModule.use(body.json());
                        httpsServer.listen(this.mParams.push_notifications_web_hook_port, function () {
                            CLogger_1.CLogger.info('(CEvents:init:#1) HTTPS Server running on port ' + _this.mParams.push_notifications_web_hook_port);
                        });
                        /*set events calendars provider */
                        switch (this.mParams.event_provider) {
                            case EVT_PROVIDER.google_gsuite:
                                this.mEventsCalendarProvider = new CGoogleGSuite_1.CGoogleGSuite(this.mParams);
                                break;
                            case EVT_PROVIDER.microsoft_graph:
                                this.mEventsCalendarProvider = new CMicrosoftGraph_1.CMicrosoftGraph(this.mParams);
                                break;
                            default:
                                /*add here a log */
                                return [2 /*return*/];
                                break;
                        }
                        /*start listening push notifications. It has to start before push notification channel registration, because if events provider is Microsoft,
                        during push notification registration process, web hook url is verified*/
                        this.run();
                        bUpdated = false;
                        _loop_1 = function (meetingRoom) {
                            var err_1;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        _a.trys.push([0, 3, , 4]);
                                        return [4 /*yield*/, this_1.retreiveEventsFromCalendar(meetingRoom.calendar_id)];
                                    case 1:
                                        _a.sent();
                                        return [4 /*yield*/, this_1.mEventsCalendarProvider.registerPushNotification(meetingRoom.calendar_id, meetingRoom.meeting_room_id).then(function (pushNotificationChannelID) {
                                                meetingRoom.push_channel_notification_id = pushNotificationChannelID;
                                                bUpdated = true;
                                            })];
                                    case 2:
                                        _a.sent();
                                        return [3 /*break*/, 4];
                                    case 3:
                                        err_1 = _a.sent();
                                        CLogger_1.CLogger.error('(CEvents:init:#2): ' + err_1);
                                        return [3 /*break*/, 4];
                                    case 4: return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        _i = 0, _a = this.mEventsMeetingRooms;
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        meetingRoom = _a[_i];
                        return [5 /*yield**/, _loop_1(meetingRoom)];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        ;
                        /*if at least one push notification channel has been registered, then update events configuration file*/
                        if (bUpdated) {
                            this.writeEventsConfig();
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
    * Listen HTTPS push notification and forward to events provider module
    */
    CEvents.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                this.mExpressModule.post('/', function (req, res) {
                    _this.mEventsCalendarProvider.callbackPushNotification(req, res, _this.callbackPushNotification.bind(_this));
                });
                return [2 /*return*/];
            });
        });
    };
    /**
    * Read events config file and copy to mEventsMeetingRooms.
    */
    CEvents.readEventsConfig = function () {
        try {
            var fileContent = fs.readFileSync(this.mParams.event_config_path);
            if (fileContent !== undefined) {
                this.mEventsMeetingRooms = JSON.parse(fileContent);
            }
            else {
                CLogger_1.CLogger.error('(CEvents:readEventsConfig:#1) Error reading config file');
            }
        }
        catch (err) {
            CLogger_1.CLogger.error('(CEvents:readEventsConfig:#2) can\'t read events config file: ' + err);
        }
    };
    /**
    * Write events config from mEventsMeetingRooms to file.
    */
    CEvents.writeEventsConfig = function () {
        //this is a workaround because for an unknowned reason, array copy by value does no work. It always copy by reference then delete meetingRoom['events'] also affects this.mEventsMeetingRooms  e.g;:  
        //let tempEventsConfig = this.mEventsMeetingRooms.slice(0));
        //or
        //let tempEventsConfig = [...this.mEventsMeetingRooms];
        //both does not copy by value only 
        var tempEventsConfig = JSON.parse(JSON.stringify(this.mEventsMeetingRooms));
        /*store all params excpeted daily events*/
        for (var _i = 0, tempEventsConfig_1 = tempEventsConfig; _i < tempEventsConfig_1.length; _i++) {
            var meetingRoom = tempEventsConfig_1[_i];
            delete meetingRoom['events'];
        }
        var data = JSON.stringify(tempEventsConfig, null, 2);
        try {
            fs.writeFileSync(this.mParams.event_config_path, data);
        }
        catch (err) {
            CLogger_1.CLogger.error('(CEvents:writeEventsConfig:#1) can\'t write events config file :' + err);
        }
    };
    /**
    * Display's device registration management. This request is send by any display device after booting.
    * 2 options:
    * 		1) client is already registered to the meeting room, then send it back the daily events list
    *		2) client is not regitered to the meeting room, then add it to the event config settings and send it back the daily events list
    * param pClient:
    *		{
    *			"ip": "<IP address of the client>",
    *			"mac": "<MAC address of the client>",
    *			"meeting_room_id": "<meeting room id the client is registered to>",
    *			"date_time": "<date&time og the request, format 'DD/MM/YY HH:mm'>"
    * 		}
    * return status: EnumClientRegistration
    */
    CEvents.registerDevice = function (pClient) {
        return __awaiter(this, void 0, void 0, function () {
            var indexMeetingRoom, status, indexClient;
            return __generator(this, function (_a) {
                indexMeetingRoom = this.mEventsMeetingRooms.findIndex(function (meetingRoom) { return (meetingRoom.meeting_room_id === pClient.meeting_room_id); });
                if (indexMeetingRoom !== -1) {
                    indexClient = this.mEventsMeetingRooms[indexMeetingRoom].clients.findIndex(function (client) { return (client.ip === pClient.ip); });
                    if (indexClient !== -1) {
                        status = EnumClientRegistration.already_registered;
                    }
                    else {
                        this.mEventsMeetingRooms[indexMeetingRoom].clients.push({ ip: pClient.ip, mac: pClient.mac });
                        this.writeEventsConfig();
                        status = EnumClientRegistration.not_yet_registered;
                    }
                    CLogger_1.CLogger.debug('(CEvents:registerDevice:#1):' + JSON.stringify(pClient) + ' | ' + status);
                    this.updateMeetingRoomDeviceEvent(pClient, JSON.stringify({ force_update: 'false', events: this.mEventsMeetingRooms[indexMeetingRoom].events }));
                }
                else {
                    status = EnumClientRegistration.meeting_room_error;
                    CLogger_1.CLogger.error('(CEvents:registerDevice:#2):' + JSON.stringify(pClient) + ' | ' + status);
                }
                return [2 /*return*/, status];
            });
        });
    };
    /**
    * Retreive daily events from a meeting room calendar and store data into mEventsMeetingRooms local storage
    * param pCalendarID: technical ID of the calendar (email address)
    */
    CEvents.retreiveEventsFromCalendar = function (pCalendarID) {
        return __awaiter(this, void 0, void 0, function () {
            var index, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        index = this.mEventsMeetingRooms.findIndex(function (element) { return element.calendar_id === pCalendarID; });
                        if (!(index !== -1)) return [3 /*break*/, 2];
                        /*retreive daily events and save into the local storage*/
                        _a = this.mEventsMeetingRooms[index];
                        return [4 /*yield*/, this.mEventsCalendarProvider.getEvents(pCalendarID)];
                    case 1:
                        /*retreive daily events and save into the local storage*/
                        _a.events = _b.sent();
                        _b.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    /**
    * Callback push notification web hook. Call from the provider when a change occures into the meeting room calendar.
    * Immediatly, get the daily event from the calendar and update all clients
    * param pMeetingRoomID: Meeting room ID
    */
    CEvents.callbackPushNotification = function (pMeetingRoomID) {
        return __awaiter(this, void 0, void 0, function () {
            var index, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        index = this.mEventsMeetingRooms.findIndex(function (element) { return (element.meeting_room_id === pMeetingRoomID); });
                        if (!(index !== -1)) return [3 /*break*/, 2];
                        /*retreive daily events and save into the local storage*/
                        _a = this.mEventsMeetingRooms[index];
                        return [4 /*yield*/, this.mEventsCalendarProvider.getEvents(this.mEventsMeetingRooms[index].calendar_id)];
                    case 1:
                        /*retreive daily events and save into the local storage*/
                        _a.events = _b.sent();
                        /*update all clients linked to the meeting room*/
                        this.updateMeetingRoomAllDevices(this.mEventsMeetingRooms[index].meeting_room_id, false);
                        _b.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    /**
    * Update all devices clients linked to a meeting room with daily events
    * param pMeetingRoomId: Meeting room ID
    * param pbForceUpdate: true to force device client to refresh the display anyway.
    * If false, the device will update the display only id a changed(diaplayed) occured, this to avoid refreshing and make the screen blinking for nothing
    */
    CEvents.updateMeetingRoomAllDevices = function (pMeetingRoomId, pbForceUpdate) {
        return __awaiter(this, void 0, void 0, function () {
            var meetingRoom;
            var _this = this;
            return __generator(this, function (_a) {
                meetingRoom = this.mEventsMeetingRooms.find(function (element) { return (element.meeting_room_id === pMeetingRoomId); });
                if (meetingRoom !== undefined) {
                    meetingRoom.clients.forEach(function (client) { return __awaiter(_this, void 0, void 0, function () {
                        var retValue, err_2;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, this.updateMeetingRoomDeviceEvent(client, JSON.stringify({ force_update: (pbForceUpdate ? 'true' : 'false'), events: meetingRoom.events }))];
                                case 1:
                                    retValue = _a.sent();
                                    CLogger_1.CLogger.debug('(CEvents:updateMeetingRoomAllDevices:#1) client IP: ' + client.ip + ', result: ' + retValue);
                                    return [3 /*break*/, 3];
                                case 2:
                                    err_2 = _a.sent();
                                    CLogger_1.CLogger.error('(CEvents:updateMeetingRoomAllDevices:21) client IP: ' + client.ip + ', error: ' + err_2);
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                }
                ;
                return [2 /*return*/];
            });
        });
    };
    /**
    * Update one device with a daily events list
    * param pClient:
    *		{
    *			"ip": "<IP address of the device>"
    *			"mac": "<MAC address of the device>"
    *		}
    * param pEvents:
    *		{
    *			"force_update": "<true or false>"		"true" to force device client to refresh the screen
    *			"events":
    *				[
    *						{
    *							"start_time": "<e.g.: 18:30>",
    *							"stop_time": "<e.g.: 19:00>",
    *							"date": "<e.g.: 16/04/2020>",
    *							"topic": "<subject of the event>"
    *						},
    *						.....
    *				}
    *		}
    */
    CEvents.updateMeetingRoomDeviceEvent = function (pClient, pEvents) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        _this.sendEventsToDevice(pClient.ip, pEvents).then(function (value) {
                            resolve(value);
                        })
                            .catch(function (err) {
                            reject(err);
                        });
                    })];
            });
        });
    };
    /**
    * Update all devices clients regardless of the meeting rooms
    */
    CEvents.updateAllMeetingRoomDevices = function (pbForceUpdate) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                this.mEventsMeetingRooms.forEach(function (meetingRoom) { return __awaiter(_this, void 0, void 0, function () {
                    var _this = this;
                    return __generator(this, function (_a) {
                        meetingRoom.clients.forEach(function (client) { return __awaiter(_this, void 0, void 0, function () {
                            var retValue, err_3;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        _a.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, this.updateMeetingRoomDeviceEvent(client, JSON.stringify({ force_update: (pbForceUpdate ? 'true' : 'false'), events: meetingRoom.events }))];
                                    case 1:
                                        retValue = _a.sent();
                                        CLogger_1.CLogger.debug('(CEvents:updateAllMeetingRoomDevices:#1) client IP: ' + client.ip + ', result: ' + retValue);
                                        return [3 /*break*/, 3];
                                    case 2:
                                        err_3 = _a.sent();
                                        CLogger_1.CLogger.error('(CEvents:updateAllMeetingRoomDevices:21) client IP: ' + client.ip + ', error: ' + err_3);
                                        return [3 /*break*/, 3];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); });
                        return [2 /*return*/];
                    });
                }); });
                return [2 /*return*/];
            });
        });
    };
    /**
    * Send an events list to a device
    * param pclienIP: IP address of the device
    * param pData: stringified events list
    */
    CEvents.sendEventsToDevice = function (pclienIP, pData) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var options = {
                hostname: pclienIP,
                port: _this.mParams.tcp_devices_port,
                path: '/events',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': pData.length,
                    'Authorization': 'Bearer ' + _this.mParams.tcp_devices_token
                }
            };
            var request = http.request(options, function (res) {
                var chunksData = [];
                res.on('data', function (data) {
                    chunksData.push(data);
                });
                res.on('end', function (data) {
                    var body = Buffer.concat(chunksData);
                    resolve(body.toString('utf8'));
                });
            });
            request.on('error', function (error) {
                reject(error);
            });
            request.write(pData);
            request.end();
        });
    };
    /*******************************************************************************************************************
    *
    *		UTILITIES
    *
    *******************************************************************************************************************/
    /**
    * Retreive the list of all meeting rooms from the provider, including name and email address
    * return data :
    *		[
    *			{
    *				name: <name of the meeting room>
    *				address: <email address of the calendare related to the meeting room>
    *			},
    *			...
    *		]
    */
    CEvents.getMeetingCalendarResources = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.mEventsCalendarProvider.getResources().then(function (data) {
                resolve(data);
            })
                .catch(function (err) {
                reject.log(err);
            });
        });
    };
    /**
    * Unregister push notifications for all meeting room calendars.
    */
    CEvents.unregisterAllPushNotification = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, meetingRoom, err_4;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _i = 0, _a = this.mEventsMeetingRooms;
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 7];
                        meetingRoom = _a[_i];
                        if (!meetingRoom.hasOwnProperty('push_channel_notification_id')) return [3 /*break*/, 6];
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.mEventsCalendarProvider.unregisterPushNotification(meetingRoom.push_channel_notification_id, meetingRoom.meeting_room_id)];
                    case 3:
                        _b.sent();
                        delete meetingRoom.push_channel_notification_id;
                        this.writeEventsConfig();
                        return [3 /*break*/, 5];
                    case 4:
                        err_4 = _b.sent();
                        CLogger_1.CLogger.error('(CEvents:unregisterAllPushNotification:#1): ' + err_4);
                        return [3 /*break*/, 5];
                    case 5:
                        ;
                        _b.label = 6;
                    case 6:
                        _i++;
                        return [3 /*break*/, 1];
                    case 7:
                        ;
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
    * Retreive current events config, including last downloaded daily events
    * return this.mEventsMeetingRooms:
    *				[
    *					{
    *						"meeting_room_name": "<name og the meeting room>",
    *						"meeting_room_id": "<ID of the meeting room>",
    *						"calendar_id": "<ID (=email address) of the meeting room calendar>",
    *						"clients":
    *						[
    *							{
    *								"ip": "<IP address of the display client>",
    *								"mac": "<MAC address of the display client>"
    *				            },
    *							....
    *						],
    *						"events":
    *						[
    *							{
    *								"start_time": "<e.g.: 18:30>",
    *								"stop_time": "<e.g.: 19:00>",
    *								"date": "<e.g.: 16/04/2020>",
    *								"topic": "<subject of the event>"
    *							},
    *							...
    *						],
    *						"push_channel_notification_id": "<push notification channel ID from the event provider>"
    *					}
    *				]
    */
    CEvents.getEventsConfig = function () {
        return this.mEventsMeetingRooms;
    };
    /**
    * retreive push notification channel details
    * param pCalendarID: ID (=email address) of the meeting room calendar
    * return
    *		[
    *			{
    *				"id": "<push notification channel ID>",
    *				"expiration": "<expiration date and time, e.g.: "19/04/2020 01:59">"
    *			}
    *		}
    */
    CEvents.getPushNotificationSubscriptions = function (pCalendarID) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.mEventsCalendarProvider.getPushNotificationSubscriptions(pCalendarID).then(function (data) {
                resolve(data);
            })
                .catch(function (err) {
                reject(err);
            });
        });
    };
    /**
    * unregister a push notification channel. Be carrefull, push_channel_notification_id key from events seetings won't be affected. This is just a tool !
    * param pChannelID: channel ID
    * param pMeetingRoomId: meeting room ID (meeting_room_id of events config)
    * return <depending on on the provider>
    */
    CEvents.unregisterPushNotification = function (pChannelID, pMeetingRoomId) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.mEventsCalendarProvider.unregisterPushNotification(pChannelID, pMeetingRoomId).then(function (value) {
                resolve(value);
            })
                .catch(function (err) {
                reject(err);
            });
        });
    };
    /* Meetings room events seetings: a copy of CONFIG_FILE_NAME.event_config_path, populated on the fly with daily calendars events */
    CEvents.mEventsMeetingRooms = [];
    /*Express module manging https push notification web hook*/
    CEvents.mExpressModule = express();
    /*global params*/
    CEvents.mParams = {};
    return CEvents;
}());
exports.CEvents = CEvents;
//# sourceMappingURL=CEvents.js.map
