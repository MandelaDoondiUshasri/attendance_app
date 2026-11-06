import json
import urllib.parse
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


class CeoTrackConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for CEO/HR live tracking map.
    Connects to 'ceo_alerts_{company_id}' group and receives real-time employee location updates.
    Strictly isolated per tenant company.
    """

    @database_sync_to_async
    def get_authenticated_user(self, token_str):
        try:
            from rest_framework_simplejwt.tokens import AccessToken
            from accounts.models import User
            validated = AccessToken(token_str)
            user_id = validated['user_id']
            return User.objects.select_related('company').get(id=user_id)
        except Exception:
            return None

    async def connect(self):
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        params = urllib.parse.parse_qs(query_string)
        token_list = params.get('token')

        user = None
        if token_list and token_list[0]:
            user = await self.get_authenticated_user(token_list[0])

        if not user or not user.is_authenticated:
            # Fallback to session user
            scope_user = self.scope.get('user')
            if scope_user and scope_user.is_authenticated:
                user = scope_user

        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        # Restrict to management roles
        if user.role not in ['CEO', 'HR', 'SYSTEM_ADMIN', 'SUPER_ADMIN']:
            await self.close(code=4003)
            return

        company = getattr(user, 'company', None)
        company_id = str(company.id) if company else None
        is_master = (getattr(company, 'is_master_tenant', False) or getattr(company, 'slug', '') == 'frg') if company else False

        if company_id:
            self.grp = f'ceo_alerts_{company_id}'
        elif user.role == 'SUPER_ADMIN':
            self.grp = 'ceo_alerts_superadmin'
        else:
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.grp, self.channel_name)
        await self.accept()

        # Send all currently-active employee locations for THIS company only
        from tracking.engine import get_all_active_locations
        try:
            locations = await database_sync_to_async(get_all_active_locations)(
                company_id=company_id,
                is_master=is_master
            )
            for loc in locations:
                msg = {
                    'eid': loc.get('eid', ''),
                    'name': loc.get('name', ''),
                    'lat': loc.get('lat', 0),
                    'lon': loc.get('lon', 0),
                    'ts': loc.get('ts', 0),
                    'img': loc.get('img', ''),
                    'status': loc.get('status', 'live'),
                    'accuracy': loc.get('accuracy'),
                    'speed': loc.get('speed'),
                }
                await self.send(text_data=json.dumps(msg))
        except Exception as e:
            print(f"Error sending initial locations: {e}")

    async def disconnect(self, code):
        if hasattr(self, 'grp'):
            await self.channel_layer.group_discard(self.grp, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        pass  # Read-only; no incoming data expected

    async def ceo_alert(self, event):
        """Handle location update events from the tracking engine."""
        msg = {'eid': event.get('eid', '')}
        if event.get('status') == 'offline':
            msg['status'] = 'offline'
        else:
            msg['name'] = event.get('name', '')
            msg['lat'] = event.get('lat', 0)
            msg['lon'] = event.get('lon', 0)
            msg['ts'] = event.get('ts', 0)
            msg['img'] = event.get('img', '')
            msg['status'] = event.get('status', 'live')
            if event.get('accuracy') is not None:
                msg['accuracy'] = event['accuracy']
            if event.get('speed') is not None:
                msg['speed'] = event['speed']
        await self.send(text_data=json.dumps(msg))
