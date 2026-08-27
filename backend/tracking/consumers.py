import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

class CeoTrackConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.grp = 'ceo_alerts'
        await self.channel_layer.group_add(self.grp, self.channel_name)
        await self.accept()

        # Send initial active locations
        from tracking.engine import get_all_active_locations
        try:
            locations = await database_sync_to_async(get_all_active_locations)()
            for loc in locations:
                msg = {
                    'eid': loc.get('eid', ''),
                    'name': loc.get('name', ''),
                    'lat': loc.get('lat', 0),
                    'lon': loc.get('lon', 0),
                    'ts': loc.get('ts', 0),
                    'img': loc.get('img', '')
                }
                await self.send(text_data=json.dumps(msg))
        except Exception as e:
            print(f"Error sending initial locations: {e}")

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.grp, self.channel_name)
    async def receive(self, text_data=None, bytes_data=None):
        pass
    async def ceo_alert(self, event):
        msg = {}
        msg['eid'] = event.get('eid', '')
        if event.get('status') == 'offline':
            msg['status'] = 'offline'
        else:
            msg['name'] = event.get('name', '')
            msg['lat'] = event.get('lat', 0)
            msg['lon'] = event.get('lon', 0)
            msg['ts'] = event.get('ts', 0)
            msg['img'] = event.get('img', '')
        await self.send(text_data=json.dumps(msg))
