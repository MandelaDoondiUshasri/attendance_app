from django.urls import path
from tracking.views import (
    LocUpdateView, LocStatusView, LocStopView,
    ScreenTimeHeartbeatView, ScreenTimeSummaryView
)

urlpatterns = [
    path('update/', LocUpdateView.as_view(), name='loc-update'),
    path('status/', LocStatusView.as_view(), name='loc-status'),
    path('stop/', LocStopView.as_view(), name='loc-stop'),
    
    # Employee Screen Time Tracking
    path('screen-time/heartbeat/', ScreenTimeHeartbeatView.as_view(), name='screentime-heartbeat'),
    path('screen-time/summary/', ScreenTimeSummaryView.as_view(), name='screentime-summary'),
]
