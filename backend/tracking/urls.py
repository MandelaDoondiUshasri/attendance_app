from django.urls import path
from tracking.views import LocUpdateView
urlpatterns = [
    path('update/', LocUpdateView.as_view(), name='loc-update'),
]
