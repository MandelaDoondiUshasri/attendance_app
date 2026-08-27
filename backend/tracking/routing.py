from django.urls import path
from tracking.consumers import CeoTrackConsumer
websocket_urlpatterns = [
    path('ws/ceo/live/', CeoTrackConsumer.as_asgi()),
]
