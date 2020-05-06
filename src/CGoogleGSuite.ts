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

const { google } = require("googleapis");
const fs = require("fs");
const moment = require('moment'); 

import { IEventsProvider } from './IEventsProvider';
import { CLogger } from './CLogger';

/**
* 	Peforms IEventsProvider operations for Google Gsuite - Meeting Rooms events calendars
*/
export class CGoogleGSuite implements IEventsProvider {
	private mJWT: any;
	private mWebHookAddr: string = '';
	private mCustomerID: string = '';
	private mImpersonateUser: string = '';
	
	/**
	*	Class constructor
	*	param pParams: required parameters in order to manage API operations. Only keys below are mandatory
	*		{
	*			...
	*			"google_customer_id": "<Google Gsuite customer ID>",
	*			"google_private_key": "<path to JSON Google API private key>",
	*			"push_notification_web_hook_addr": "Push notification URL",
	*			"push_notifications_web_hook_port": "Push notification port",
	*			"impersonate_user_email": "<email address of one Google Gsuite admin>"
	*			...	
	*		}
	*/
	constructor(pParams: any) {
		/*buid web hook URL and set global params*/
		this.mWebHookAddr = pParams.push_notification_web_hook_addr + ':' + pParams.push_notifications_web_hook_port.toString();
		this.mCustomerID = pParams.google_customer_id;
		this.mImpersonateUser = pParams.impersonate_user_email;
		
		/*retreive Google API json private key*/
		const privateKey = JSON.parse(fs.readFileSync(pParams.google_private_key, 'utf8'));

		/*obtain Google API token */
		this.mJWT  = new google.auth.JWT(
		   privateKey.client_email,
		   null,
		   privateKey.private_key,
		   [
				'https://www.googleapis.com/auth/admin.directory.resource.calendar.readonly',
				'https://www.googleapis.com/auth/calendar.readonly'
		   ],
		   this.mImpersonateUser
		);
	}
	
	/**
	*	Push notification callback. This member function is called by https listener server when a push notification occures
	*/
	public callbackPushNotification(pRequest: any, pResponse: any, pCallBack: any): void {
		CLogger.debug('(CGoogleGSuite:callbackPushNotification:#1) ' + JSON.stringify(pRequest.headers));
		//const pushNotificationChannelID = pRequest.headers['x-goog-resource-id'];
		const meetingRoomId = pRequest.headers['x-goog-channel-id'];
		pResponse.status(200).send('ok');
		
		pCallBack(meetingRoomId);
	}
	
	/**
	* Retreive the list of registred push notification channels for a calendar => Unfortunatly Google API does not allow this request
	* return error
	*/
	public getPushNotificationSubscriptions(pCalendarID: string): any {
		return new Promise((resolve: any, reject: any) => {
			reject('(CGoogleGSuite: getPushNotificationSubscriptions) is not supported by Google API');
		});
	}
	
	/**
	* Unregister a push notification channel
	* param pChannelID: channel ID
	* param pMeetingRoomId: meeting room ID (meeting_room_id of events config)
	* return: Google API result
	*/
	public unregisterPushNotification(pChannelID: string, pMeetingRoomID: string): any {
		return new Promise((resolve: any, reject: any) => {
			this.mJWT.authorize((err: any, tokens: any) => {
				if (err) {
					CLogger.error('(CGoogleGSuite:unregisterPushNotification:#1) ' + err);
					reject(err);
				} else {
					const calendarService = google.calendar({
						version: 'v3', 
						auth: this.mJWT
					});
				
					calendarService.channels.stop({
						resource :{
							id: pMeetingRoomID,
							resourceId: pChannelID
						}
					}, function(err: any, res: any) {
						if (err) {
							CLogger.error('(CGoogleGSuite:unregisterPushNotification:#3) ' + err);
							reject(err);
						} else {
							CLogger.debug('(CGoogleGSuite:unregisterPushNotification:#1) ' + JSON.stringify(res));
							resolve(res);
						}
					});
				}
			});	
		});
	}
	
	/**
	* Register a push notification channel
	* param pCalendarId: calendar ID (= email address)
	* param pResourceID: meeting room ID (meeting_room_id of events config)
	* return: Google API result
	*
	* IMPORTANT: expiration time can't be set precisally, e.g. 23:59:59:. It always add 1 hour !
	*/
	public registerPushNotification(pCalendarId: string, pResourceID: string): any {
		return new Promise((resolve: any, reject: any) => {
			this.mJWT.authorize((err: any, tokens: any) => {
				if (err) {
					CLogger.error('(CGoogleGSuite:registerPushNotification:#1) ' + err);
					reject(err);
				} else {
					const calendarService = google.calendar({
						version: 'v3', 
						auth: this.mJWT
					});
					
					calendarService.events.watch({
						calendarId: pCalendarId,
						resource :{
							id: pResourceID,
							type: 'web_hook',
							address: this.mWebHookAddr,
							params: {
								ttl: '36000'
							},
							expiration: moment.utc('23:59:59', 'hh:mm:ss').valueOf()
						}
					}, function(err: any, res: any) {
						if (err) {
							CLogger.error('(CGoogleGSuite:registerPushNotification:#2) ' + err);
							reject(err);
						} else {
							CLogger.debug('(CGoogleGSuite:registerPushNotification:#3) ' + res.data.resourceId);
							resolve(res.data.resourceId);
						}
					});
				}
			});	
		});
	}
	
	
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
	public getEvents(pCalendarId: string): any {
		const mnt_start = moment('00:00:00', 'hh:mm:ss');
		const mnt_stop = moment('23:59:59', 'hh:mm:ss');

		return new Promise((resolve: any, reject: any) => {
			this.mJWT.authorize((err: any, tokens: any) => {
				if (err) {
					CLogger.error('(CGoogleGSuite:getEvents:#1) ' + err);
					reject(err);
				} else {
					const calendarService = google.calendar({
						version: 'v3', 
						auth: this.mJWT
					});
				
					calendarService.events.list({
						calendarId: pCalendarId,
						timeMax: mnt_stop.format(),
						timeMin: mnt_start.format()
					}, function(err: any, res: any) {
						if (err) {
							CLogger.error('(CGoogleGSuite:getEvents:#2) ' + err);
							reject(err);
						} else {
							let eventsArray: any = [];
							res.data.items.forEach((item: any) => {
								eventsArray.push(
								{
									start_time: moment(item.start.dateTime).format('HH:mm'), 
									stop_time: moment(item.end.dateTime).format('HH:mm'), 
									date: moment().format('DD/MM/YYYY'),
									topic: item.summary
								});
							});
							
							CLogger.debug('(CGoogleGSuite:getEvents:#3) ' + JSON.stringify(eventsArray));
							resolve(eventsArray);
						}
					});
				}
			});	
		});			
	}
	
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
	public getResources(): any {
		return new Promise((resolve: any, reject: any) => {
			this.mJWT.authorize((err: any, tokens: any) => {
				if (err) {
					CLogger.error('(CGoogleGSuite:getResources:#1) ' + err);
					reject(err);
				} else {
					const sdkService = google.admin({
						version: 'directory_v1', 
						auth: this.mJWT
					});
				
					sdkService.resources.calendars.list({
						customer: this.mCustomerID
					}, function(err: any, res: any) {
						if (err) {
							CLogger.error('(CGoogleGSuite:getResources:#2) ' + err);
							reject(err);
						} else {
							let retValue: any = [];
							res.data.items.forEach((item: any) => {
								retValue.push({name: item.resourceName, address: item.resourceEmail});
							});
			
							CLogger.debug('(CGoogleGSuite:getResources:#3) ' + JSON.stringify(retValue));
							resolve(retValue);
						}
					});
				}
			});	
		});
	}
}