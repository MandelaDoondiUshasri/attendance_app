from django.urls import path
from tracking.views import LocUpdateView, LocStatusView, LocStopView

urlpatterns = [
    path('update/', LocUpdateView.as_view(), name='loc-update'),
    path('status/', LocStatusView.as_view(), name='loc-status'),
    path('stop/', LocStopView.as_view(), name='loc-stop'),
]
