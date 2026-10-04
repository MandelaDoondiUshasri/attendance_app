import io
import os
from decimal import Decimal
from datetime import datetime, date
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

from core.models import OrganizationSettings


def number_to_words(amount):
    """
    Converts a decimal or integer amount to Indian Rupee word representation.
    e.g. 14516.13 -> 'Fourteen Thousand Five Hundred Sixteen and Thirteen Paise Only'
    """
    units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
             "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
             "Seventeen", "Eighteen", "Nineteen"]
    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    def _convert_hundred(n):
        res = ""
        if n >= 100:
            res += units[n // 100] + " Hundred "
            n %= 100
        if n >= 20:
            res += tens[n // 10] + (" " + units[n % 10] if n % 10 != 0 else "")
        elif n > 0:
            res += units[n]
        return res.strip()

    try:
        val = Decimal(str(amount))
        rupees = int(val)
        paise = int(round((val - rupees) * 100))

        if rupees == 0 and paise == 0:
            return "Zero Rupees Only"

        words = []
        if rupees >= 10000000:  # Crores
            cr = rupees // 10000000
            words.append(_convert_hundred(cr) + " Crore")
            rupees %= 10000000

        if rupees >= 100000:  # Lakhs
            lakh = rupees // 100000
            words.append(_convert_hundred(lakh) + " Lakh")
            rupees %= 100000

        if rupees >= 1000:  # Thousands
            th = rupees // 1000
            words.append(_convert_hundred(th) + " Thousand")
            rupees %= 1000

        if rupees > 0:
            words.append(_convert_hundred(rupees))

        rupee_str = " ".join(words).strip()
        if rupee_str:
            rupee_str = "Rupees " + rupee_str

        if paise > 0:
            paise_str = _convert_hundred(paise) + " Paise"
            if rupee_str:
                return f"{rupee_str} and {paise_str} Only"
            return f"{paise_str} Only"

        return f"{rupee_str} Only"
    except Exception:
        return f"Rupees {amount}"


class PayslipPDFGenerator:
    """
    Generates professional corporate monthly payslip PDFs using ReportLab.
    """

    @classmethod
    def generate_pdf(cls, payslip) -> bytes:
        """
        Builds the PDF binary data for a given Payslip model instance.
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=0.5 * inch,
            rightMargin=0.5 * inch,
            topMargin=0.4 * inch,
            bottomMargin=0.4 * inch
        )

        settings = OrganizationSettings.get_settings()
        emp = payslip.employee

        month_name = date(payslip.year, payslip.month, 1).strftime('%B')
        payroll_period = f"{month_name} {payslip.year}"

        # Color Palette
        PRIMARY = colors.HexColor('#0F172A')       # Slate 900
        SECONDARY = colors.HexColor('#1E293B')     # Slate 800
        BRAND = colors.HexColor('#4F46E5')         # Indigo 600
        BRAND_LIGHT = colors.HexColor('#EEF2FF')   # Indigo 50
        ACCENT_EMERALD = colors.HexColor('#059669') # Emerald 600
        ACCENT_ROSE = colors.HexColor('#E11D48')    # Rose 600
        BORDER_GRAY = colors.HexColor('#CBD5E1')    # Slate 300
        BG_LIGHT = colors.HexColor('#F8FAFC')       # Slate 50
        TEXT_MUTED = colors.HexColor('#64748B')     # Slate 500

        # Typography Styles
        styles = getSampleStyleSheet()

        company_title_style = ParagraphStyle(
            'CompanyTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=16,
            leading=19,
            textColor=PRIMARY
        )

        company_sub_style = ParagraphStyle(
            'CompanySub',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8,
            leading=11,
            textColor=TEXT_MUTED
        )

        slip_title_style = ParagraphStyle(
            'SlipTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=12,
            leading=14,
            textColor=BRAND,
            alignment=TA_RIGHT
        )

        slip_meta_style = ParagraphStyle(
            'SlipMeta',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8,
            leading=11,
            textColor=SECONDARY,
            alignment=TA_RIGHT
        )

        section_heading_style = ParagraphStyle(
            'SectionHeading',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=9,
            leading=11,
            textColor=PRIMARY
        )

        cell_label_style = ParagraphStyle(
            'CellLabel',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8,
            leading=10,
            textColor=TEXT_MUTED
        )

        cell_value_style = ParagraphStyle(
            'CellValue',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8.5,
            leading=11,
            textColor=PRIMARY
        )

        table_header_style = ParagraphStyle(
            'TableHeader',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8.5,
            leading=11,
            textColor=colors.white
        )

        table_data_style = ParagraphStyle(
            'TableData',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8,
            leading=10,
            textColor=PRIMARY
        )

        table_data_bold = ParagraphStyle(
            'TableDataBold',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8,
            leading=10,
            textColor=PRIMARY
        )

        table_data_right = ParagraphStyle(
            'TableDataRight',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8,
            leading=10,
            textColor=PRIMARY,
            alignment=TA_RIGHT
        )

        table_data_right_bold = ParagraphStyle(
            'TableDataRightBold',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8.5,
            leading=11,
            textColor=PRIMARY,
            alignment=TA_RIGHT
        )

        net_words_style = ParagraphStyle(
            'NetWords',
            parent=styles['Normal'],
            fontName='Helvetica-Oblique',
            fontSize=8,
            leading=10,
            textColor=SECONDARY
        )

        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=7,
            leading=9,
            textColor=TEXT_MUTED,
            alignment=TA_CENTER
        )

        story = []

        # -------------------------------------------------------------
        # 1. HEADER SECTION (Company Info Left, Payslip Meta Right)
        # -------------------------------------------------------------
        comp_name = settings.company_name or 'FRG Enterprise'
        comp_addr = getattr(settings, 'company_address', '') or 'Plot No. 42, Hitech City, Hyderabad, Telangana'
        comp_contact = []
        if getattr(settings, 'contact_email', None):
            comp_contact.append(settings.contact_email)
        if getattr(settings, 'contact_phone', None):
            comp_contact.append(settings.contact_phone)
        contact_str = " | ".join(comp_contact)

        left_header = [
            Paragraph(comp_name.upper(), company_title_style),
            Paragraph(comp_addr, company_sub_style),
        ]
        if contact_str:
            left_header.append(Paragraph(contact_str, company_sub_style))

        status_display = payslip.get_status_display().upper()
        right_header = [
            Paragraph("SALARY STATEMENT / PAYSLIP", slip_title_style),
            Paragraph(f"<b>Pay Period:</b> {payroll_period}", slip_meta_style),
            Paragraph(f"<b>Ref ID:</b> {payslip.payslip_reference}", slip_meta_style),
            Paragraph(f"<b>Status:</b> {status_display}", slip_meta_style),
        ]

        header_table = Table(
            [[left_header, right_header]],
            colWidths=[3.8 * inch, 3.4 * inch]
        )
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))
        story.append(header_table)
        story.append(Spacer(1, 10))
        story.append(HRFlowable(width="100%", thickness=1.5, color=BRAND, spaceBefore=0, spaceAfter=8))

        # -------------------------------------------------------------
        # 2. EMPLOYEE DETAILS GRID
        # -------------------------------------------------------------
        joining_str = emp.joining_date.strftime('%d-%b-%Y') if emp.joining_date else 'N/A'
        dept_str = emp.department.name if emp.department else 'Unassigned'
        desig_str = emp.designation.title if emp.designation else 'Unassigned'
        shift_str = 'Half-Day Shift (4h)' if emp.is_half_day else 'Full-Day Shift (8h)'

        emp_details_data = [
            [
                Paragraph("<b>Employee ID</b>", cell_label_style),
                Paragraph(emp.employee_id, cell_value_style),
                Paragraph("<b>Department</b>", cell_label_style),
                Paragraph(dept_str, cell_value_style),
            ],
            [
                Paragraph("<b>Employee Name</b>", cell_label_style),
                Paragraph(emp.full_name, cell_value_style),
                Paragraph("<b>Designation</b>", cell_label_style),
                Paragraph(desig_str, cell_value_style),
            ],
            [
                Paragraph("<b>Email</b>", cell_label_style),
                Paragraph(emp.email, cell_value_style),
                Paragraph("<b>Date of Joining</b>", cell_label_style),
                Paragraph(joining_str, cell_value_style),
            ],
            [
                Paragraph("<b>Work Mode</b>", cell_label_style),
                Paragraph(emp.get_work_mode_display(), cell_value_style),
                Paragraph("<b>Shift Policy</b>", cell_label_style),
                Paragraph(shift_str, cell_value_style),
            ],
        ]

        emp_table = Table(
            emp_details_data,
            colWidths=[1.3 * inch, 2.3 * inch, 1.3 * inch, 2.3 * inch]
        )
        emp_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
            ('BOX', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(emp_table)
        story.append(Spacer(1, 10))

        # -------------------------------------------------------------
        # 3. ATTENDANCE & LEAVE SUMMARY (6 Metrics Across)
        # -------------------------------------------------------------
        story.append(Paragraph("ATTENDANCE & LEAVE GOVERNANCE SUMMARY", section_heading_style))
        story.append(Spacer(1, 4))

        att_summary_data = [
            [
                Paragraph("<b>Calendar Days</b>", cell_label_style),
                Paragraph("<b>Working Days</b>", cell_label_style),
                Paragraph("<b>Present Days</b>", cell_label_style),
                Paragraph("<b>Casual Leave (CL)</b>", cell_label_style),
                Paragraph("<b>Optional Leave (OL)</b>", cell_label_style),
                Paragraph("<b>Loss of Pay (LOP)</b>", cell_label_style),
            ],
            [
                Paragraph(str(payslip.total_calendar_days), cell_value_style),
                Paragraph(f"{payslip.company_working_days}d", cell_value_style),
                Paragraph(f"{payslip.present_days}d", cell_value_style),
                Paragraph(f"{payslip.casual_leave_days}d", cell_value_style),
                Paragraph(f"{payslip.optional_leave_days}d", cell_value_style),
                Paragraph(f"<font color='#E11D48'><b>{payslip.lop_days}d</b></font>", cell_value_style),
            ]
        ]

        att_table = Table(
            att_summary_data,
            colWidths=[1.2 * inch, 1.2 * inch, 1.2 * inch, 1.2 * inch, 1.2 * inch, 1.2 * inch]
        )
        att_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F1F5F9')),
            ('BOX', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        story.append(att_table)
        story.append(Spacer(1, 12))

        # -------------------------------------------------------------
        # 4. SALARY BREAKDOWN (Earnings vs Deductions)
        # -------------------------------------------------------------
        story.append(Paragraph("SALARY COMPUTATION & DEDUCTIONS BREAKDOWN", section_heading_style))
        story.append(Spacer(1, 4))

        # Left Column: Earnings
        earnings_rows = [
            [Paragraph("EARNINGS", table_header_style), Paragraph("AMOUNT (INR)", table_header_style)],
            [Paragraph("Basic / Monthly Fixed Salary", table_data_style), Paragraph(f"Rs. {payslip.monthly_salary:,.2f}", table_data_right)],
            [Paragraph("Statutory / Standard Allowances", table_data_style), Paragraph("Rs. 0.00", table_data_right)],
            [Paragraph("Overtime / Performance Incentive", table_data_style), Paragraph("Rs. 0.00", table_data_right)],
            [Paragraph("<b>GROSS EARNINGS</b>", table_data_bold), Paragraph(f"<b>Rs. {payslip.gross_salary:,.2f}</b>", table_data_right_bold)],
        ]

        earnings_table = Table(earnings_rows, colWidths=[2.3 * inch, 1.3 * inch])
        earnings_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), BRAND),
            ('BACKGROUND', (0, -1), (-1, -1), BRAND_LIGHT),
            ('BOX', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))

        # Right Column: Deductions
        lop_deduction_val = payslip.lop_deduction
        deduction_rows = [
            [Paragraph("DEDUCTIONS", table_header_style), Paragraph("AMOUNT (INR)", table_header_style)],
            [
                Paragraph(f"Loss of Pay (LOP: {payslip.lop_days}d @ Rs.{payslip.per_day_salary:,.2f}/day)", table_data_style),
                Paragraph(f"Rs. {lop_deduction_val:,.2f}", table_data_right)
            ],
            [Paragraph("Provident Fund (PF) Contribution", table_data_style), Paragraph("Rs. 0.00", table_data_right)],
            [Paragraph("Professional Tax / TDS Deduction", table_data_style), Paragraph("Rs. 0.00", table_data_right)],
            [Paragraph("<b>TOTAL DEDUCTIONS</b>", table_data_bold), Paragraph(f"<b>Rs. {payslip.total_deductions:,.2f}</b>", table_data_right_bold)],
        ]

        deductions_table = Table(deduction_rows, colWidths=[2.3 * inch, 1.3 * inch])
        deductions_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#DC2626')),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#FEE2E2')),
            ('BOX', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))

        breakdown_master = Table([[earnings_table, deductions_table]], colWidths=[3.6 * inch, 3.6 * inch])
        breakdown_master.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))
        story.append(breakdown_master)
        story.append(Spacer(1, 10))

        # -------------------------------------------------------------
        # 5. NET PAYABLE BANNER & AMOUNT IN WORDS
        # -------------------------------------------------------------
        net_words = number_to_words(payslip.net_salary)

        net_box_data = [
            [
                Paragraph("<b>NET PAYABLE SALARY:</b>", ParagraphStyle('NetLabel', fontName='Helvetica-Bold', fontSize=10, textColor=colors.HexColor('#065F46'))),
                Paragraph(f"<b>Rs. {payslip.net_salary:,.2f}</b>", ParagraphStyle('NetVal', fontName='Helvetica-Bold', fontSize=13, alignment=TA_RIGHT, textColor=colors.HexColor('#065F46'))),
            ],
            [
                Paragraph(f"<b>Amount in Words:</b> {net_words}", net_words_style),
                Paragraph("", net_words_style)
            ]
        ]

        net_table = Table(net_box_data, colWidths=[4.2 * inch, 3.0 * inch])
        net_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#D1FAE5')), # Emerald 100
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#10B981')),     # Emerald 500
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('SPAN', (0, 1), (1, 1)),
        ]))
        story.append(net_table)
        story.append(Spacer(1, 14))

        # -------------------------------------------------------------
        # 6. SIGN-OFF, AUDIT TRAIL & SYSTEM FOOTER
        # -------------------------------------------------------------
        gen_by = payslip.generated_by.get_full_name() or payslip.generated_by.email if payslip.generated_by else 'System Payroll Engine'
        gen_time = payslip.generated_at.strftime('%d-%b-%Y %H:%M') if payslip.generated_at else datetime.now().strftime('%d-%b-%Y')
        rel_by = payslip.released_by.get_full_name() or payslip.released_by.email if payslip.released_by else (payslip.verified_by.get_full_name() if payslip.verified_by else 'HR Management')
        rel_time = payslip.released_at.strftime('%d-%b-%Y %H:%M') if payslip.released_at else 'Pending Release'

        auth_box_data = [
            [
                Paragraph(f"<b>Generated By:</b> {gen_by} ({gen_time})", ParagraphStyle('Audit1', fontName='Helvetica', fontSize=7.5, textColor=TEXT_MUTED)),
                Paragraph(f"<b>Authorized & Released By:</b> {rel_by} ({rel_time})", ParagraphStyle('Audit2', fontName='Helvetica', fontSize=7.5, textColor=TEXT_MUTED, alignment=TA_RIGHT)),
            ]
        ]
        auth_table = Table(auth_box_data, colWidths=[3.6 * inch, 3.6 * inch])
        auth_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(auth_table)
        story.append(Spacer(1, 8))

        story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_GRAY, spaceBefore=0, spaceAfter=6))
        story.append(Paragraph(
            "This is a digitally generated official payroll document issued by the enterprise attendance & salary management system. "
            "Confidential • For Employee Record Only.",
            footer_style
        ))

        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes
