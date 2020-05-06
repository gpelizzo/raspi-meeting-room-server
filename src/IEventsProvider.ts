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

/**
* Calendars events provider's interface
* Member functions below are mandatory. Each function shall return a Promise
*/
export interface IEventsProvider {
	/**
	* Register a push notification channel
	* param pCalendarId: calendar ID (= email address)
	* param pResourceID: meeting room ID (meeting_room_id of events config)
	* return: <Depends on the provider, but content doesn't care. Only status is handle: success or failure>
	*/
	registerPushNotification(pCalendarId: string, pResourceID: string): any;
	
	
	/**
	* Unregister a push notification channel
	* param pChannelID: channel ID
	* param pMeetingRoomId: meeting room ID (meeting_room_id of events config)
	* return: <Depends on the provider, but content doesn't care. Only status is handle: success or failure>
	*/
	unregisterPushNotification(pChannelID: string, pMeetingRoomID: string): any;
	
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
	getEvents(pCalendarId: string): any;
	
	/**
	* retreive the list of all meeting room calendars
	* return 
	*	[
	*			{
	*				name: <name of the meeting room>
	*				address: <email address of the calendare related to the meeting room> 
	*			},
	*			...
	*		]
	*/
	getResources(): any;
	
	/**
	*	Handle events push notification, and perfom required operations
	*/
	callbackPushNotification(pRequest: any, pResponse: any, pCallBack: any): void;
	
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
	getPushNotificationSubscriptions(pCalendarID: string): any;
}