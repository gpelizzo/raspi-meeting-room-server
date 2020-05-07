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

const fs = require("fs");
const http = require('http');
const https = require('https');
const express = require('express');
const body = require('body-parser');

import { CGoogleGSuite } from './CGoogleGSuite';
import { CMicrosoftGraph } from './CMicrosoftGraph';
import { IEventsProvider } from './IEventsProvider';
import { CLogger } from './CLogger';

enum EVT_PROVIDER {
	google_gsuite = 'google',
	microsoft_graph = 'microsoft'
}

export enum EnumClientRegistration {
	already_registered = 'Client is already registered',
	not_yet_registered = 'Client has not yet been registered',
	meeting_room_error = 'Meeting ID does not exist'
}

/**
* 	Manage calendars events gathering and dispatching 
*/
export class CEvents {
		
	/*Event calendar provider. c.f. EVT_PROVIDER */
	private static mEventsCalendarProvider: IEventsProvider;
	/* Meetings room events seetings: a copy of CONFIG_FILE_NAME.event_config_path, populated on the fly with daily calendars events */
	private static mEventsMeetingRooms: any = [];
	/*Express module manging https push notification web hook*/
	private static mExpressModule = express();
	/*global params*/
	private static mParams: any = {};
	
	/**
	* Initialize class
	* param pParams: global params, including SSL certificats path for https server (push notification web hook), web hook URL, events provider and so on
	*/
	public static async init(pParams: any) {
		this.mParams = pParams;
		
		/*retreive calendars settings, including display clients. Set mEventsMeetingRooms*/
		this.readEventsConfig();
		
		/*initialize https server for push notification*/
		const httpsServer = https.createServer({
		  key: fs.readFileSync(this.mParams.ssl_key_path),
		  cert: fs.readFileSync(this.mParams.ssl_cert_path),
		}, this.mExpressModule);

		this.mExpressModule.use(body.json());
		
		httpsServer.listen(this.mParams.push_notifications_web_hook_port, () => {
			CLogger.info('(CEvents:init:#1) HTTPS Server running on port ' + this.mParams.push_notifications_web_hook_port);
		});
		
		/*set events calendars provider */
		switch (this.mParams.event_provider) {
			case EVT_PROVIDER.google_gsuite:
				this.mEventsCalendarProvider = new CGoogleGSuite(this.mParams);
			break;
			
			case EVT_PROVIDER.microsoft_graph:
				this.mEventsCalendarProvider = new CMicrosoftGraph(this.mParams);
			break;
			
			default:
				/*add here a log */
				return;
			break;
		}
		
		/*start listening push notifications. It has to start before push notification channel registration, because if events provider is Microsoft, 
		during push notification registration process, web hook url is verified*/
		this.run();

		/*retreive daily events for all calendars and set push notifications web hook for each of them.*/
		let bUpdated: boolean = false;
		for (let meetingRoom of this.mEventsMeetingRooms) {
			try {
				await this.retreiveEventsFromCalendar(meetingRoom.calendar_id);
				await this.mEventsCalendarProvider.registerPushNotification(meetingRoom.calendar_id, meetingRoom.meeting_room_id).then((pushNotificationChannelID: any) => {
					meetingRoom.push_channel_notification_id = pushNotificationChannelID;
					bUpdated = true;
				});
				
			} catch(err) {
				CLogger.error('(CEvents:init:#2): ' + err);
			}

		};
		
		/*if at least one push notification channel has been registered, then update events configuration file*/
		if (bUpdated) {
			this.writeEventsConfig();
		}
	}
	
	/**
	* Listen HTTPS push notification and forward to events provider module
	*/
	private static async run() {
		
		this.mExpressModule.post('/', (req: any, res: any) => {
			this.mEventsCalendarProvider.callbackPushNotification(req, res, this.callbackPushNotification.bind(this));
		});
	}
	
	/**
	* Read events config file and copy to mEventsMeetingRooms.
	*/
	private static readEventsConfig() {
		try {
			let fileContent = fs.readFileSync(this.mParams.event_config_path);
			
			if (fileContent !== undefined) {
				this.mEventsMeetingRooms = JSON.parse(fileContent);
			} else {
				CLogger.error('(CEvents:readEventsConfig:#1) Error reading config file');
			}
		} catch(err) {
			CLogger.error('(CEvents:readEventsConfig:#2) can\'t read events config file: ' + err);
		}
	}
	
	/**
	* Write events config from mEventsMeetingRooms to file.
	*/
	private static writeEventsConfig() {
		//this is a workaround because for an unknowned reason, array copy by value does no work. It always copy by reference then delete meetingRoom['events'] also affects this.mEventsMeetingRooms  e.g;:  
		//let tempEventsConfig = this.mEventsMeetingRooms.slice(0));
		//or
		//let tempEventsConfig = [...this.mEventsMeetingRooms];
		//both does not copy by value only 
		let tempEventsConfig = JSON.parse(JSON.stringify(this.mEventsMeetingRooms));
		
		/*store all params excpeted daily events*/
		for (let meetingRoom of tempEventsConfig) {
			delete meetingRoom['events'];
		}
		
		let data = JSON.stringify(tempEventsConfig, null, 2);
		try {
			fs.writeFileSync(this.mParams.event_config_path, data);
		} catch (err) {
			CLogger.error('(CEvents:writeEventsConfig:#1) can\'t write events config file :' + err);
		}
	}
	
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
	public static async registerDevice(pClient: any) {
		const indexMeetingRoom = this.mEventsMeetingRooms.findIndex((meetingRoom: any) => (meetingRoom.meeting_room_id === pClient.meeting_room_id));
		
		let status: EnumClientRegistration;
		
		if (indexMeetingRoom !== -1) {
			const indexClient = this.mEventsMeetingRooms[indexMeetingRoom].clients.findIndex((client: any) => (client.ip === pClient.ip));
			
			if (indexClient !== -1) {
				status =  EnumClientRegistration.already_registered
			} else {
				this.mEventsMeetingRooms[indexMeetingRoom].clients.push({ip: pClient.ip, mac: pClient.mac});
				this.writeEventsConfig();
				status =  EnumClientRegistration.not_yet_registered
			}		
			
			CLogger.debug('(CEvents:registerDevice:#1):' + JSON.stringify(pClient) + ' | ' + status);
			
			this.updateMeetingRoomDeviceEvent(pClient, {force_update: 'false', events: this.mEventsMeetingRooms[indexMeetingRoom].events});
		} else {
			status = EnumClientRegistration.meeting_room_error;
			CLogger.error('(CEvents:registerDevice:#2):' + JSON.stringify(pClient) + ' | ' + status);
		}
		
		return status;
	}
	
	/**
	* Retreive daily events from a meeting room calendar and store data into mEventsMeetingRooms local storage 
	* param pCalendarID: technical ID of the calendar (email address) 
	*/
	private static async retreiveEventsFromCalendar(pCalendarID: string) {
		/*ensure that meeting room ID (email address) is part of the settings*/
		const index = this.mEventsMeetingRooms.findIndex((element: any) => element.calendar_id === pCalendarID);
		if (index !== -1) {
			/*retreive daily events and save into the local storage*/
			this.mEventsMeetingRooms[index].events = await this.mEventsCalendarProvider.getEvents(pCalendarID);
		}
	}

	/**
	* Callback push notification web hook. Call from the provider when a change occures into the meeting room calendar.
	* Immediatly, get the daily event from the calendar and update all clients
	* param pMeetingRoomID: Meeting room ID  
	*/
	public static async callbackPushNotification(pMeetingRoomID: string) {
		/*ensure that the mmeting room ID is part of the settings*/
		const index = this.mEventsMeetingRooms.findIndex((element: any) => (element.meeting_room_id === pMeetingRoomID));
		if (index !== -1) {
			/*retreive daily events and save into the local storage*/
			this.mEventsMeetingRooms[index].events = await this.mEventsCalendarProvider.getEvents(this.mEventsMeetingRooms[index].calendar_id);
			/*update all clients linked to the meeting room*/
			this.updateMeetingRoomAllDevices(this.mEventsMeetingRooms[index].meeting_room_id, false);
		}
	}	

	/**
	* Update all devices clients linked to a meeting room with daily events
	* param pMeetingRoomId: Meeting room ID  
	* param pbForceUpdate: true to force device client to refresh the display anyway. 
	* If false, the device will update the display only id a changed(diaplayed) occured, this to avoid refreshing and make the screen blinking for nothing 
	*/
	private static async updateMeetingRoomAllDevices(pMeetingRoomId: string, pbForceUpdate: boolean) {
		const meetingRoom = this.mEventsMeetingRooms.find((element: any) => (element.meeting_room_id === pMeetingRoomId));
		
		if (meetingRoom !== undefined) {
			meetingRoom.clients.forEach(async (client: any) => {
				try {
					const retValue = await this.updateMeetingRoomDeviceEvent(client, {force_update: (pbForceUpdate ? 'true' : 'false'), events: meetingRoom.events});
					CLogger.debug('(CEvents:updateMeetingRoomAllDevices:#1) client IP: ' + client.ip + ', result: ' + retValue);
				} catch(err) {
					CLogger.error('(CEvents:updateMeetingRoomAllDevices:#2) client IP: ' + client.ip + ', error: ' + err);
				}
			});	
		};
	}	
	
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
	private static async updateMeetingRoomDeviceEvent(pClient: any, pEvents: any) {
		return new Promise((resolve: any, reject: any) => {
				this.sendEventsToDevice(pClient.ip, pEvents).then((value: any) => {
					resolve(value);
				})
				.catch((err: any) => {
					reject(err);
				});
		});
	}

	/**
	* Update all devices clients regardless of the meeting rooms
	*/
	public static async updateAllMeetingRoomDevices(pbForceUpdate: boolean) {
		this.mEventsMeetingRooms.forEach(async (meetingRoom: any) => {
			meetingRoom.clients.forEach(async (client: any) => {
				try {
					const retValue = await this.updateMeetingRoomDeviceEvent(client, {force_update: (pbForceUpdate ? 'true' : 'false'), events: meetingRoom.events});
					CLogger.debug('(CEvents:updateAllMeetingRoomDevices:#1) client IP: ' + client.ip + ', result: ' + retValue);
				} catch(err) {
					CLogger.error('(CEvents:updateAllMeetingRoomDevices:#2) client IP: ' + client.ip + ', error: ' + err);
				}
			});	
		});
	}
	
	/**
	* Send an events list to a device
	* param pclienIP: IP address of the device
	* param pData: stringified events list
	*/
	private static sendEventsToDevice(pclienIP: string, pData: any) {
		return new Promise((resolve: any, reject: any) => {			
			const options: any = {
				hostname: pclienIP,
				port: this.mParams.tcp_devices_port,
				path: '/events',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer ' + this.mParams.tcp_devices_token
				}
			};
		
			const request = http.request(options, (res: any) => {
				let chunksData: any = [];
				res.on('data', (data: any) => {
					chunksData.push(data);
				});
				
				res.on('end', (data: any) => {
					let body: any = Buffer.concat(chunksData);
					resolve(body.toString('utf8'));
				});
			});
			
			request.on('error', (error: any) => {
				reject(error);
			})
			
			request.write(JSON.stringify(pData));
			request.end()
		});
	}
	
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
	public static getMeetingCalendarResources(): any {
		return new Promise((resolve: any, reject: any) => {
			this.mEventsCalendarProvider.getResources().then((data: any) => {
				resolve(data);
			})
			.catch((err: any) => {
				reject.log(err);
			});	
		});
	}
	
	/**
	* Unregister push notifications for all meeting room calendars.
	*/
	public static async unregisterAllPushNotification() {
		for (let meetingRoom of this.mEventsMeetingRooms) {
			if (meetingRoom.hasOwnProperty('push_channel_notification_id')) {
				try {
					await this.mEventsCalendarProvider.unregisterPushNotification(meetingRoom.push_channel_notification_id, meetingRoom.meeting_room_id);
					delete meetingRoom.push_channel_notification_id;
					this.writeEventsConfig();

				} catch(err) {
					CLogger.error('(CEvents:unregisterAllPushNotification:#1): ' + err);
				};
			}
		};
	}
	
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
	public static getEventsConfig() {
		return this.mEventsMeetingRooms;
	}
	
	
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
	public static getPushNotificationSubscriptions(pCalendarID: string) {
		return new Promise((resolve: any, reject: any) => {
			this.mEventsCalendarProvider.getPushNotificationSubscriptions(pCalendarID).then((data: any) => {
				resolve(data);
			})
			.catch((err: any) => {
				reject(err);
			});
		});
	}
	
	/**
	* unregister a push notification channel. Be carrefull, push_channel_notification_id key from events seetings won't be affected. This is just a tool !
	* param pChannelID: channel ID
	* param pMeetingRoomId: meeting room ID (meeting_room_id of events config)
	* return <depending on on the provider>
	*/
	public static unregisterPushNotification(pChannelID: string, pMeetingRoomId: string) {
		return new Promise((resolve: any, reject: any) => {
			this.mEventsCalendarProvider.unregisterPushNotification(pChannelID, pMeetingRoomId).then((value: any) => {
				resolve(value);
			})
			.catch((err: any) => {
				reject(err);
			});
		});
	}
}