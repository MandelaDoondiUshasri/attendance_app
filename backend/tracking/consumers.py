import json
from channels.generic.websocket import AsyncWebsocketConsumer
class CeoTrackConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.grp = 'ceo_alerts'
        await self.channel_layer.group_add(self.grp, self.channel_name)
        await self.accept()
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
