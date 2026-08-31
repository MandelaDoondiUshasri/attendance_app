from leaves.models import LeaveRequest
from wfh.models import WFHRequest

def check_leave_wfh_overlap(employee, start_date, end_date, is_half_day, half_day_period, exclude_wfh_id=None, exclude_leave_id=None):
    wfh_qs = WFHRequest.objects.filter(
        employee=employee,
        status__in=['PENDING', 'APPROVED'],
        start_date__lte=end_date,
        end_date__gte=start_date
    )
    if exclude_wfh_id:
        wfh_qs = wfh_qs.exclude(pk=exclude_wfh_id)
        
    leave_qs = LeaveRequest.objects.filter(
        employee=employee,
        status__in=['PENDING', 'APPROVED'],
        start_date__lte=end_date,
        end_date__gte=start_date
    )
    if exclude_leave_id:
        leave_qs = leave_qs.exclude(pk=exclude_leave_id)
        
    if is_half_day:
        for wfh in wfh_qs:
            if not wfh.is_half_day:
                return "You already have a full-day WFH request for this date."
            if wfh.half_day_period == half_day_period:
                return "You already have a half-day WFH request for this session."
        
        for lv in leave_qs:
            if not lv.is_half_day:
                return "You already have a full-day Leave request for this date."
            if lv.half_day_period == half_day_period:
                return "You already have a half-day Leave request for this session."
                
    else:
        if wfh_qs.exists():
            return "You already have an existing WFH request in this date range."
        if leave_qs.exists():
            return "You already have an existing Leave request in this date range."
            
    return None
