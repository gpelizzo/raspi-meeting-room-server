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

const express = require('express');
const body = require('body-parser');
const fs = require("fs");

import { CEvents, EnumClientRegistration } from './CEvents';
import { CLogger } from './CLogger';

const CONFIG_FILE_NAME = 'config.json';

const REST_POST_REGISTER_DEVICE = '/register-device';
const REST_POST_UTILITIES_UNREGISTER_PUSH_NOTIFICATION_SUBSCRIPTION = '/utilities/unregister-push-notification-subscription';
const REST_GET_UTILITIES_RESOURCES = '/utilities/resources';
const REST_GET_UTILITIES_EVENTS_CONFIGS = '/utilities/events-config';
const REST_GET_UTILITIES_PUSH_NOTIFICATION_SUBSCRIPTIONS = '/utilities/push-notification-subscription';
const REST_DELETE_UTILITIES_PUSH_NOTIFICATION_SUBSCRIPTIONS = '/utilities/push-notification-subscription';

const APP_VERSION = '1.0.0';

/**
* 	Main class
*/
export class CMain {

	/* express module lisetening for display devices registration and services commands */
	private static mExpressModule = express();
	/* Application settings: a copy of CONFIG_FILE_NAME files */
	private static mAppConfig: any = {};
	/* events management module instance */	
	private static mEventsMeetingRoomsModule = CEvents;

	public static async init() {
		/* retreive application settings */
		this.readConfig();
		
		/* init global logger module */
		CLogger.init(this.mAppConfig.logs_path, this.mAppConfig.log_level);
		
		/* init listener for devices registration and services commands*/
		this.mExpressModule.use(body.json());
		this.mExpressModule.use(this.verifyToken().bind(this));
		
		/* init events management module */
		await this.mEventsMeetingRoomsModule.init(this.mAppConfig);
		
		/* start listener for devices registration and services commands */
		this.mExpressModule.listen(this.mAppConfig.tcp_server_port, () => {
			CLogger.info('(CMain:init:#1) Server started on port ' + this.mAppConfig.tcp_server_port);
		});
	}	
	
	/**
	* Read config parameters from file 
	*/
	private static readConfig() {
		let fileContent = fs.readFileSync(__dirname + '/' + CONFIG_FILE_NAME);
		this.mAppConfig = JSON.parse(fileContent);
	}
	
	/**
	* Token verification 
	*/
	private static verifyToken() {
		return ((req: any, res: any, next: any) => {
			if (!req.headers.hasOwnProperty("authorization")) {
				res.send({status: 'false', value: 'token is missing'});
				CLogger.error('(CMain:verifyToken:#1) token is missing');
				return;
			}
			if (req.headers.authorization.replace("Bearer ", "") === this.mAppConfig.tcp_server_token) {
				next();
			} else {
				res.send({status: 'false', value: 'token is incorrect'});
				CLogger.error('(CMain:verifyToken:#1) token is incorrect');
				return;
			}
		});
	}
	
	/**
	* Run listening for devices registration and services commands
	*/
	public static async run() {
		/*first, init all registered display devices with daily events*/
		await this.mEventsMeetingRoomsModule.updateAllMeetingRoomDevices(true);
		
		/**
		* Register display devive
		* param req.body:
		*  {
		*	 "ip": "<IP address of the client>",
		*	 "mac": "<MAC address of the client>",
		*	 "meeting_room_id": "<meeting room id the client is registered to>",
		*	 "date_time": "<date&time og the request, format 'DD/MM/YY HH:mm'>"
		*  }
		* return :
		* {
		*   "status": "<false if error, else, true>"
		*	"value": <EnumClientRegistration>
		* }
		*/
		this.mExpressModule.post(REST_POST_REGISTER_DEVICE, (req: any, res: any) => {
			this.mEventsMeetingRoomsModule.registerDevice(req.body).then((retValue: EnumClientRegistration) => {;
				res.send({status: 'true', value: retValue});
			});
		});
		
		/**----------------------------------------------------------------------------------------
		*										Utilities
		*------------------------------------------------------------------------------------------*/
		
		/**
		* Retreive the list of all meeting rooms from the provider, including name and email address
		* return :
		*	{
		*		"status": "<false if error, else, true>",
		*		"value" :
		*			[
		*				{
		*					"name": "<name of the meeting room>"
		*					"address": "<email address of the calendare related to the meeting room>"
		*				},
		*				...
		*			]
		*	}
		*/
		this.mExpressModule.get(REST_GET_UTILITIES_RESOURCES, (req: any, res: any) => {
			this.mEventsMeetingRoomsModule.getMeetingCalendarResources().then((data: any) => {
				
				res.send({status: 'true', value: data});
			})
			.catch((err: any) => {
				res.send('error: ' + err);
			});
		});
		
		/** 
		* Retreive current events config, including last downloaded daily events
		* return :
		*	{
		*		"status": "<false if error, else, true>",
		*		"value": 
		*			[
		*				{
		*					"meeting_room_name": "<name og the meeting room>",
		*					"meeting_room_id": "<ID of the meeting room>",
		*					"calendar_id": "<ID (=email address) of the meeting room calendar>",
		*					"clients": 
		*					[
		*						{
		*							"ip": "<IP address of the display client>",
		*							"mac": "<MAC address of the display client>"
		*		            	},
		*						....
		*					],	
		*					"events":
		*					[
		*						{
		*							"start_time": "<e.g.: 18:30>",
		*							"stop_time": "<e.g.: 19:00>",
		*							"date": "<e.g.: 16/04/2020>",
		*							"topic": "<subject of the event>"
		*						},
		*						...
		*					],
		*					"push_channel_notification_id": "<push notification channel ID from the event provider>"
		*				}
		*			]
		*	}
		*/
		this.mExpressModule.get(REST_GET_UTILITIES_EVENTS_CONFIGS, (req: any, res: any) => {
			res.send({status: 'true', value: this.mEventsMeetingRoomsModule.getEventsConfig()});
		});
		
		/**
		* retreive push notification channel details
		* param channelID: ID (=email address) of the meeting room calendar
		* return :
		*	{
		*		"status": "<false if error, else, true>",
		*		"value":
		*			[
		*				{
		*					"id": "<push notification channel ID>",
		*					"expiration": "<expiration date and time, e.g.: "19/04/2020 01:59">"
		*				}
		*			}
		*	}
		*/
		this.mExpressModule.get(REST_GET_UTILITIES_PUSH_NOTIFICATION_SUBSCRIPTIONS + '/:channelID', (req: any, res: any) => {
			this.mEventsMeetingRoomsModule.getPushNotificationSubscriptions(req.params.channelID).then((data: any) => {
				res.send({status: 'true', value: data});
			})
			.catch((err: any) => {
				res.send({status: 'false', value: err});
			})
		});
		
		/**
		* Unregister push notifications for all meeting room calendars.
		* return:
		*	{
		*		"status": "<false if error, else, true>",
		*		"value": "<empty>"
		*	}
		*/
		this.mExpressModule.delete(REST_DELETE_UTILITIES_PUSH_NOTIFICATION_SUBSCRIPTIONS, (req: any, res: any) => {
			this.mEventsMeetingRoomsModule.unregisterAllPushNotification().then((data: any) => {
				res.send({status: 'true', value: data});
			})
			.catch ((err: any) => {
				res.send({status: 'false', value: err});
			});
		});
		
		/**
		* unregister a push notification channel. Be carrefull, push_channel_notification_id key from events seetings won't be affected. This is just a tool !
		* param req.body.channel_id: channel ID
		* param req.body.resource_id: meeting room ID (meeting_room_id of events config)
		* return :
		*	{
		*		"status": "<false if error, else, true>",
		*		"value": <depending on on the provider>
		*	}
		*/
		this.mExpressModule.post(REST_POST_UTILITIES_UNREGISTER_PUSH_NOTIFICATION_SUBSCRIPTION, (req: any, res: any) => {
			this.mEventsMeetingRoomsModule.unregisterPushNotification(req.body.channel_id, req.body.resource_id).then((retValue: any) => {;
				res.send({status: 'true', value: retValue});
			})
			.catch((err: any) => {
				res.send({status: 'false', value: err});
			});
		});
	}
}

/**
* async function is mandatory because of await call
*/
async function start() {
	await CMain.init();
	CMain.run();
}

/**
* Main entry
*/
start();
