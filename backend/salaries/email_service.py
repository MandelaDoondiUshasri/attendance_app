import logging
import calendar
import os
import sys
import threading
import time
from decimal import Decimal
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from django.db import close_old_connections
from core.models import OrganizationSettings
from notifications.services import NotificationService
from notifications.models import NotificationType
from salaries.pdf_generator import PayslipPDFGenerator

logger = logging.getLogger(__name__)


def _get_portal_url(request=None):
    """
    Resolve frontend portal base URL.
    Checks request Origin header, environment variable, or fallback.
    """
    if request:
        origin = request.headers.get('origin')
        if origin:
            return origin.rstrip('/')

    env_url = os.getenv('FRONTEND_URL')
    if env_url:
        return env_url.rstrip('/')

    return 'http://localhost:5173' if settings.DEBUG else 'https://frgenterprise.com'


def _build_payslip_email_html(payslip, portal_url, org_settings):
    """
    Build a modern, responsive, executive-styled HTML email body for payslip release notification.
    """
    emp = payslip.employee
    emp_name = emp.full_name if emp else 'Valued Team Member'
    emp_id = emp.employee_id if emp else 'N/A'
    dept = emp.department.name if emp and emp.department else 'General'
    m_name = calendar.month_name[payslip.month]

    company_name = org_settings.company_name or 'FRG Enterprise'
    company_address = org_settings.company_address or 'Enterprise Headquarters'
    contact_email = org_settings.contact_email or settings.DEFAULT_FROM_EMAIL
    contact_phone = org_settings.contact_phone or ''

    gross_formatted = f"₹{payslip.gross_salary:,.2f}"
    deductions_formatted = f"₹{payslip.total_deductions:,.2f}"
    net_formatted = f"₹{payslip.net_salary:,.2f}"

    payslip_url = f"{portal_url}/employee/payslips"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payslip Released - {m_name} {payslip.year}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #334155;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 30px 15px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 30px; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #c7d2fe; text-transform: uppercase; margin-bottom: 4px;">
                      Official Payroll Communication
                    </div>
                    <div style="font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                      {company_name}
                    </div>
                    <div style="font-size: 13px; color: #e0e7ff; margin-top: 4px;">
                      Salary Statement & Payslip Release
                    </div>
                  </td>
                  <td align="right" valign="top">
                    <div style="background-color: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 8px; padding: 6px 12px; display: inline-block;">
                      <span style="font-size: 11px; font-weight: 700; color: #ffffff; font-family: monospace;">{m_name[:3].upper()} {payslip.year}</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 30px 24px 30px;">
              <p style="font-size: 16px; font-weight: 600; color: #0f172a; margin: 0 0 12px 0;">
                Dear {emp_name},
              </p>
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
                Your official salary payslip for the pay period <strong>{m_name} {payslip.year}</strong> has been processed, verified, and officially released by HR Management.
              </p>

              <!-- Salary Summary Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; background-color: #f1f5f9;">
                    <span style="font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">
                      Compensation Overview
                    </span>
                  </td>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; background-color: #f1f5f9; text-align: right;">
                    <span style="font-size: 11px; font-family: monospace; color: #64748b;">
                      Ref: {payslip.payslip_reference}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding: 16px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Employee Name</td>
                        <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right;">{emp_name} ({emp_id})</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Department</td>
                        <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right;">{dept}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Pay Period</td>
                        <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right;">{m_name} {payslip.year}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Gross Earnings</td>
                        <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right;">{gross_formatted}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #dc2626;">Total Deductions / LOP</td>
                        <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #dc2626; text-align: right;">- {deductions_formatted}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding-top: 12px; border-top: 2px dashed #cbd5e1;"></td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 15px; font-weight: 700; color: #0f172a;">Net Payable Salary</td>
                        <td style="padding: 6px 0; font-size: 20px; font-weight: 800; color: #059669; text-align: right; font-family: monospace;">{net_formatted}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Action Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="{payslip_url}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-size: 14px; font-weight: 700; letter-spacing: 0.2px; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.3);">
                      View & Download Payslip in Portal &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Attachment Note -->
              <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 12px 16px; margin-bottom: 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td valign="top" style="width: 24px;">
                      <span style="font-size: 16px;">&#128206;</span>
                    </td>
                    <td style="font-size: 12px; line-height: 1.5; color: #065f46;">
                      <strong>PDF Document Attached:</strong> An official, digitally signed PDF copy of this payslip (<code>Payslip_{payslip.payslip_reference}.pdf</code>) is attached to this email for your offline records.
                    </td>
                  </tr>
                </table>
              </div>

              <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin: 0;">
                For any questions or payroll queries, please contact Human Resources at
                <a href="mailto:{contact_email}" style="color: #4f46e5; text-decoration: underline;">{contact_email}</a>
                {f' or {contact_phone}' if contact_phone else ''}.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 30px; text-align: center;">
              <p style="font-size: 12px; font-weight: 600; color: #475569; margin: 0 0 4px 0;">
                {company_name}
              </p>
              <p style="font-size: 11px; color: #94a3b8; margin: 0 0 12px 0;">
                {company_address}
              </p>
              <p style="font-size: 10px; color: #94a3b8; margin: 0; line-height: 1.5;">
                Confidentiality Notice: This communication and any accompanying attachments are intended solely for the designated recipient and contain sensitive salary information. If you have received this message in error, please immediately notify the sender and delete it.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    return html


def _build_payslip_email_plaintext(payslip, portal_url, org_settings):
    """
    Build a clean plaintext alternative for email clients without HTML support.
    """
    emp = payslip.employee
    emp_name = emp.full_name if emp else 'Team Member'
    m_name = calendar.month_name[payslip.month]
    company_name = org_settings.company_name or 'FRG Enterprise'
    contact_email = org_settings.contact_email or settings.DEFAULT_FROM_EMAIL

    return f"""=======================================================
{company_name.upper()} - OFFICIAL PAYSLIP RELEASE NOTIFICATION
=======================================================

Dear {emp_name},

Your official salary payslip for {m_name} {payslip.year} has been released.

PAYSLIP DETAILS:
- Employee: {emp_name} ({emp.employee_id if emp else 'N/A'})
- Pay Period: {m_name} {payslip.year}
- Reference ID: {payslip.payslip_reference}
- Gross Earnings: ₹{payslip.gross_salary:,.2f}
- Total Deductions: ₹{payslip.total_deductions:,.2f}
- Net Payable Salary: ₹{payslip.net_salary:,.2f}

You can view and download your full salary statement on the portal:
{portal_url}/employee/payslips

A PDF copy is also attached to this email.

For payroll questions, contact HR at {contact_email}.

-------------------------------------------------------
Confidential document intended solely for the recipient.
"""


def send_payslip_email(payslip, portal_url=None):
    """
    Send the official payslip email with attached PDF.
    Guaranteed fail-safe: logs any exceptions without raising, so payroll workflow is never blocked.
    """
    emp = payslip.employee
    if not emp:
        logger.warning(f"Cannot send payslip email: Payslip {payslip.id} has no employee.")
        return False

    recipient_email = emp.email or (emp.user.email if emp.user else None)
    if not recipient_email:
        logger.warning(f"Cannot send payslip email: Employee {emp.full_name} has no email address.")
        return False

    try:
        org_settings = OrganizationSettings.get_settings()
        company_name = org_settings.company_name or 'FRG Enterprise'
        sender_address = (
            getattr(settings, 'DEFAULT_FROM_EMAIL', None)
            or os.getenv('DEFAULT_FROM_EMAIL')
            or getattr(settings, 'EMAIL_HOST_USER', None)
            or 'noreply@frgenterprise.com'
        )
        from_email = f"{company_name} <{sender_address}>"

        if not portal_url:
            portal_url = _get_portal_url()

        m_name = calendar.month_name[payslip.month]
        subject = f"Official Payslip Released: {m_name} {payslip.year} - {payslip.payslip_reference}"

        html_body = _build_payslip_email_html(payslip, portal_url, org_settings)
        text_body = _build_payslip_email_plaintext(payslip, portal_url, org_settings)

        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=from_email,
            to=[recipient_email]
        )
        msg.attach_alternative(html_body, "text/html")

        # Attach PDF payslip
        pdf_data = None
        try:
            if payslip.pdf_file and hasattr(payslip.pdf_file, 'path') and os.path.exists(payslip.pdf_file.path):
                with open(payslip.pdf_file.path, 'rb') as f:
                    pdf_data = f.read()
            elif payslip.pdf_file:
                # In case storage backend is Cloudinary or remote storage
                payslip.pdf_file.open('rb')
                pdf_data = payslip.pdf_file.read()
                payslip.pdf_file.close()
        except Exception as e:
            logger.warning(f"Could not read cached PDF file for payslip {payslip.id}: {e}")

        if not pdf_data:
            try:
                pdf_data = PayslipPDFGenerator.generate_pdf(payslip)
            except Exception as e:
                logger.error(f"Failed to generate PDF for email attachment (payslip {payslip.id}): {e}")

        if pdf_data:
            pdf_filename = f"Payslip_{payslip.payslip_reference}.pdf"
            msg.attach(filename=pdf_filename, content=pdf_data, mimetype="application/pdf")

        try:
            msg.send(fail_silently=False)
        except Exception as send_err:
            logger.warning(f"Initial send with formatted from_email failed ({send_err}), retrying with bare address {sender_address}...")
            msg.from_email = sender_address
            msg.send(fail_silently=False)

        logger.info(f"Successfully sent payslip email to {recipient_email} for {payslip.payslip_reference}.")
        return True

    except Exception as e:
        logger.error(f"Failed to send payslip email to {recipient_email} (Payslip {payslip.id}): {e}", exc_info=True)
        return False


def _safe_send_single_worker(payslip_id, portal_url):
    """Worker function for single asynchronous email send."""
    close_old_connections()
    try:
        from salaries.models import Payslip
        payslip = Payslip.objects.select_related('employee', 'employee__user', 'employee__department').filter(id=payslip_id).first()
        if payslip:
            send_payslip_email(payslip, portal_url)
    except Exception as e:
        logger.error(f"Error in async email worker for payslip {payslip_id}: {e}", exc_info=True)
    finally:
        close_old_connections()


def _safe_send_bulk_worker(payslip_ids, portal_url):
    """Worker function for bulk asynchronous email send with rate pacing."""
    close_old_connections()
    try:
        from salaries.models import Payslip
        payslips = list(Payslip.objects.select_related('employee', 'employee__user', 'employee__department').filter(id__in=payslip_ids))
        for p in payslips:
            try:
                send_payslip_email(p, portal_url)
            except Exception as ex:
                logger.error(f"Bulk worker failed for payslip {p.id}: {ex}")
            time.sleep(0.1)  # Brief pause between emails to avoid hitting SMTP bursts
    except Exception as e:
        logger.error(f"Error in bulk email worker: {e}", exc_info=True)
    finally:
        close_old_connections()


class PayslipNotificationDispatcher:
    """
    Authoritative service that guarantees every employee is notified both:
    1. IN-APP via NotificationService (creating immediate interactive alert & push notifications).
    2. BY EMAIL via EmailMultiAlternatives with rich HTML and attached official PDF payslip.
    """

    @classmethod
    def notify_payslip_released(cls, payslip, request=None, async_email=True):
        """
        Dispatches both In-App notification and Email notification for a single released payslip.
        """
        if not payslip:
            return

        m_name = calendar.month_name[payslip.month]

        # 1. IN-APP NOTIFICATION (Immediate)
        if payslip.employee and payslip.employee.user:
            try:
                NotificationService.create_notification(
                    recipient=payslip.employee.user,
                    title="Monthly Payslip Released",
                    message=(
                        f"Your official payslip for {m_name} {payslip.year} has been released "
                        f"(Net Salary: ₹{payslip.net_salary:,.2f}). "
                        f"You can now view and download it from your dashboard."
                    ),
                    notification_type=NotificationType.PAYSLIP_RELEASED
                )
            except Exception as e:
                logger.error(f"In-app notification failed for employee {payslip.employee.id}: {e}", exc_info=True)

        # 2. EMAIL NOTIFICATION
        portal_url = _get_portal_url(request)

        # In testing environments, run synchronously so test runners can verify mail.outbox
        is_locmem = getattr(settings, 'EMAIL_BACKEND', '').endswith('locmem.EmailBackend')
        is_test = 'test' in sys.argv or is_locmem

        if async_email and not is_test:
            thread = threading.Thread(
                target=_safe_send_single_worker,
                args=(payslip.id, portal_url),
                daemon=True,
                name=f"PayslipEmailWorker-{payslip.id}"
            )
            thread.start()
        else:
            send_payslip_email(payslip, portal_url)

    @classmethod
    def notify_bulk_payslips_released(cls, payslips, request=None, async_email=True):
        """
        Dispatches In-App notifications and bulk email notifications for multiple released payslips.
        """
        if not payslips:
            return

        portal_url = _get_portal_url(request)
        payslip_ids = []

        for p in payslips:
            payslip_ids.append(p.id)
            m_name = calendar.month_name[p.month]

            # In-app notification immediately
            if p.employee and p.employee.user:
                try:
                    NotificationService.create_notification(
                        recipient=p.employee.user,
                        title="Monthly Payslip Released",
                        message=(
                            f"Your official payslip for {m_name} {p.year} has been released. "
                            f"You can now view and download it from your dashboard."
                        ),
                        notification_type=NotificationType.PAYSLIP_RELEASED
                    )
                except Exception as e:
                    logger.error(f"In-app notification failed in bulk release for payslip {p.id}: {e}")

        # In testing environments, run synchronously
        is_locmem = getattr(settings, 'EMAIL_BACKEND', '').endswith('locmem.EmailBackend')
        is_test = 'test' in sys.argv or is_locmem

        if async_email and not is_test:
            thread = threading.Thread(
                target=_safe_send_bulk_worker,
                args=(payslip_ids, portal_url),
                daemon=True,
                name=f"BulkPayslipEmailWorker-{len(payslip_ids)}"
            )
            thread.start()
        else:
            for p in payslips:
                send_payslip_email(p, portal_url)

    @classmethod
    def send_email_now(cls, payslip, request=None):
        """
        Send official payslip email synchronously and return boolean success status.
        """
        portal_url = _get_portal_url(request)
        return send_payslip_email(payslip, portal_url=portal_url)
