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
from reportlab.graphics.shapes import Drawing, Rect, String
from PIL import Image as PILImage

from core.models import OrganizationSettings
from salaries.models import Payroll, PFContribution, EmployeePFProfile


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
    Complies strictly with 2026 EPFO rules:
    - Dedicated Employee Statutory Information (UAN, PF Number, EPF/EPS status).
    - Clear separation of Employee Deductions vs. Employer Statutory Contributions.
    - Verified Net Salary = Gross Earned - Employee Deductions.
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
            leftMargin=0.45 * inch,
            rightMargin=0.45 * inch,
            topMargin=0.35 * inch,
            bottomMargin=0.35 * inch
        )

        styles = getSampleStyleSheet()
        settings = OrganizationSettings.get_settings()
        emp = payslip.employee

        # Look for linked or contemporary Payroll and PF records
        payroll = Payroll.objects.filter(employee=emp, year=payslip.year, month=payslip.month).first()
        pf_contrib = PFContribution.objects.filter(employee=emp, year=payslip.year, month=payslip.month).first()
        pf_prof = getattr(emp, 'pf_profile', None)

        month_name = date(payslip.year, payslip.month, 1).strftime('%B')
        payroll_period = f"{month_name} {payslip.year}"

        # Color Palette
        BRAND = colors.HexColor('#1E3A8A')       # Deep Corporate Navy
        BRAND_LIGHT = colors.HexColor('#EFF6FF') # Ice Blue
        PRIMARY = colors.HexColor('#0F172A')     # Slate 900
        SECONDARY = colors.HexColor('#334155')   # Slate 700
        TEXT_MUTED = colors.HexColor('#64748B')  # Slate 500
        BORDER_GRAY = colors.HexColor('#CBD5E1') # Slate 300
        BG_LIGHT = colors.HexColor('#F8FAFC')    # Slate 50
        ACCENT_GREEN = colors.HexColor('#059669')# Emerald 600

        # Styles
        company_title_style = ParagraphStyle(
            'CompanyTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=13,
            leading=16,
            textColor=PRIMARY
        )

        company_sub_style = ParagraphStyle(
            'CompanySub',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=7.5,
            leading=10,
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
            fontSize=8.5,
            leading=11,
            textColor=BRAND
        )

        cell_label_style = ParagraphStyle(
            'CellLabel',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=7.5,
            leading=9.5,
            textColor=TEXT_MUTED
        )

        cell_value_style = ParagraphStyle(
            'CellValue',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8,
            leading=10,
            textColor=PRIMARY
        )

        table_header_style = ParagraphStyle(
            'TableHeader',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8,
            leading=10,
            textColor=colors.white
        )

        table_data_style = ParagraphStyle(
            'TableData',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=7.5,
            leading=9.5,
            textColor=PRIMARY
        )

        table_data_bold = ParagraphStyle(
            'TableDataBold',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=7.5,
            leading=9.5,
            textColor=PRIMARY
        )

        table_data_right = ParagraphStyle(
            'TableDataRight',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=7.5,
            leading=9.5,
            textColor=PRIMARY,
            alignment=TA_RIGHT
        )

        table_data_right_bold = ParagraphStyle(
            'TableDataRightBold',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8,
            leading=10,
            textColor=PRIMARY,
            alignment=TA_RIGHT
        )

        net_words_style = ParagraphStyle(
            'NetWords',
            parent=styles['Normal'],
            fontName='Helvetica-Oblique',
            fontSize=7.5,
            leading=9.5,
            textColor=SECONDARY
        )

        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=6.5,
            leading=8.5,
            textColor=TEXT_MUTED,
            alignment=TA_CENTER
        )

        story = []

        # -------------------------------------------------------------
        # 1. HEADER SECTION (Logo & Info Left, Payslip Meta Right)
        # -------------------------------------------------------------
        comp_name = settings.company_name or 'FRG Enterprise'
        comp_addr = getattr(settings, 'company_address', '') or 'Plot No. 42, Hitech City, Hyderabad, Telangana - 500081'
        comp_contact = []
        if getattr(settings, 'contact_email', None):
            comp_contact.append(settings.contact_email)
        if getattr(settings, 'contact_phone', None):
            comp_contact.append(settings.contact_phone)
        contact_str = " | ".join(comp_contact)

        logo_flowable = None
        has_logo_file = False

        if settings.company_logo and hasattr(settings.company_logo, 'path'):
            try:
                logo_path = settings.company_logo.path
                if os.path.exists(logo_path):
                    with PILImage.open(logo_path) as pil_img:
                        orig_w, orig_h = pil_img.size

                    if orig_w > 0 and orig_h > 0:
                        max_w = 40.0
                        max_h = 40.0
                        scale = min(max_w / orig_w, max_h / orig_h)
                        logo_flowable = Image(logo_path, width=orig_w * scale, height=orig_h * scale)
                        has_logo_file = True
            except Exception:
                has_logo_file = False

        if not has_logo_file:
            words = [w for w in comp_name.strip().split() if w]
            initials = "".join(w[0] for w in words[:3]).upper() if words else "FRG"
            box_size = 38
            d = Drawing(box_size, box_size)
            d.add(Rect(0, 0, box_size, box_size, rx=6, ry=6, fillColor=BRAND, strokeColor=None))
            d.add(String(box_size / 2.0, (box_size / 2.0) - 4, initials, textAnchor='middle', fontName='Helvetica-Bold', fontSize=11, fillColor=colors.white))
            logo_flowable = d

        company_text_stack = [
            Paragraph(comp_name.upper(), company_title_style),
            Paragraph(comp_addr, company_sub_style),
        ]
        if contact_str:
            company_text_stack.append(Paragraph(contact_str, company_sub_style))

        brand_table = Table([[logo_flowable, company_text_stack]], colWidths=[0.65 * inch, 3.45 * inch])
        brand_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('RIGHTPADDING', (0, 0), (0, 0), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))

        status_display = payslip.get_status_display().upper()
        right_header = [
            Paragraph("SALARY STATEMENT / PAYSLIP", slip_title_style),
            Paragraph(f"<b>Pay Period:</b> {payroll_period}", slip_meta_style),
            Paragraph(f"<b>Ref ID:</b> {payslip.payslip_reference}", slip_meta_style),
            Paragraph(f"<b>Status:</b> {status_display}", slip_meta_style),
        ]

        header_table = Table([[brand_table, right_header]], colWidths=[4.1 * inch, 3.27 * inch])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))
        story.append(header_table)
        story.append(Spacer(1, 6))
        story.append(HRFlowable(width="100%", thickness=1.5, color=BRAND, spaceBefore=0, spaceAfter=6))

        # -------------------------------------------------------------
        # 2. EMPLOYEE & STATUTORY PF PROFILE DETAILS GRID
        # -------------------------------------------------------------
        joining_str = emp.joining_date.strftime('%d/%m/%Y') if emp.joining_date else 'N/A'
        dept_str = emp.department.name if emp.department else 'Unassigned'
        desig_str = emp.designation.title if emp.designation else 'Unassigned'

        uan_str = pf_prof.uan_number if (pf_prof and pf_prof.uan_number) else 'Not Applicable'
        pf_num_str = pf_prof.pf_account_number if (pf_prof and pf_prof.pf_account_number) else 'N/A'
        is_pf_member = "Active Member" if (pf_prof and pf_prof.pf_applicable and not pf_prof.pf_exclusion_status) else ("Excluded" if (pf_prof and pf_prof.pf_exclusion_status) else "Exempt")
        eps_status = "Covered" if (pf_prof and pf_prof.eps_member and pf_prof.is_eps_eligible_by_age(date(payslip.year, payslip.month, 1))) else "Non-Pensionable"

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
                Paragraph("<b>Date of Joining</b>", cell_label_style),
                Paragraph(joining_str, cell_value_style),
                Paragraph("<b>UAN Number</b>", cell_label_style),
                Paragraph(f"<font color='#1E3A8A'><b>{uan_str}</b></font>", cell_value_style),
            ],
            [
                Paragraph("<b>EPF Status</b>", cell_label_style),
                Paragraph(is_pf_member, cell_value_style),
                Paragraph("<b>EPS Pension Status</b>", cell_label_style),
                Paragraph(eps_status, cell_value_style),
            ],
        ]

        emp_table = Table(emp_details_data, colWidths=[1.3 * inch, 2.38 * inch, 1.3 * inch, 2.39 * inch])
        emp_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
            ('BOX', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 5),
            ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(emp_table)
        story.append(Spacer(1, 6))

        # -------------------------------------------------------------
        # 3. ATTENDANCE & LEAVE SUMMARY
        # -------------------------------------------------------------
        story.append(Paragraph("ATTENDANCE & LEAVE GOVERNANCE SUMMARY", section_heading_style))
        story.append(Spacer(1, 3))

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

        att_table = Table(att_summary_data, colWidths=[1.23 * inch] * 6)
        att_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F1F5F9')),
            ('BOX', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ]))
        story.append(att_table)
        story.append(Spacer(1, 8))

        # -------------------------------------------------------------
        # 4. SALARY COMPUTATION: EARNINGS VS DEDUCTIONS
        # -------------------------------------------------------------
        story.append(Paragraph("SALARY COMPUTATION & DEDUCTIONS BREAKDOWN", section_heading_style))
        story.append(Spacer(1, 3))

        # Calculate or extract component breakdowns
        if payroll:
            basic_val = payroll.basic_earned
            da_val = payroll.da_earned
            hra_val = payroll.hra_earned
            special_val = payroll.special_allowance_earned
            gross_val = payroll.gross_earned_salary
            ee_pf_val = payroll.employee_pf
            pt_val = payroll.professional_tax
            tds_val = payroll.tds
            esi_ee_val = payroll.esi_employee
            lop_val = payroll.lop_deduction
            tot_ded_val = payroll.total_employee_deductions
            net_val = payroll.net_salary

            er_epf_val = payroll.employer_epf
            er_eps_val = payroll.employer_eps
            er_edli_val = payroll.employer_edli
        else:
            gross_val = payslip.gross_salary
            basic_val = (gross_val * Decimal('0.50')).quantize(Decimal('0.01'))
            da_val = Decimal('0.00')
            hra_val = (gross_val * Decimal('0.40')).quantize(Decimal('0.01'))
            special_val = (gross_val - basic_val - hra_val).quantize(Decimal('0.01'))
            ee_pf_val = pf_contrib.employee_epf if pf_contrib else Decimal('0.00')
            pt_val = Decimal('0.00')
            tds_val = Decimal('0.00')
            esi_ee_val = Decimal('0.00')
            lop_val = payslip.lop_deduction
            tot_ded_val = payslip.total_deductions
            net_val = payslip.net_salary

            er_epf_val = pf_contrib.employer_epf if pf_contrib else Decimal('0.00')
            er_eps_val = pf_contrib.employer_eps if pf_contrib else Decimal('0.00')
            er_edli_val = pf_contrib.employer_edli if pf_contrib else Decimal('0.00')

        # Left Column: Earnings
        earnings_rows = [
            [Paragraph("EARNINGS", table_header_style), Paragraph("AMOUNT (INR)", table_header_style)],
            [Paragraph("Basic Salary", table_data_style), Paragraph(f"Rs. {basic_val:,.2f}", table_data_right)],
            [Paragraph("Dearness Allowance (DA)", table_data_style), Paragraph(f"Rs. {da_val:,.2f}", table_data_right)],
            [Paragraph("House Rent Allowance (HRA)", table_data_style), Paragraph(f"Rs. {hra_val:,.2f}", table_data_right)],
            [Paragraph("Special / Other Allowances", table_data_style), Paragraph(f"Rs. {special_val:,.2f}", table_data_right)],
            [Paragraph("<b>GROSS EARNINGS</b>", table_data_bold), Paragraph(f"<b>Rs. {gross_val:,.2f}</b>", table_data_right_bold)],
        ]

        earnings_table = Table(earnings_rows, colWidths=[2.38 * inch, 1.3 * inch])
        earnings_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), BRAND),
            ('BACKGROUND', (0, -1), (-1, -1), BRAND_LIGHT),
            ('BOX', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 3.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
            ('LEFTPADDING', (0, 0), (-1, -1), 5),
            ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ]))

        # Right Column: Employee Deductions
        deduction_rows = [
            [Paragraph("DEDUCTIONS", table_header_style), Paragraph("AMOUNT (INR)", table_header_style)],
            [Paragraph(f"Loss of Pay (LOP: {payslip.lop_days}d)", table_data_style), Paragraph(f"Rs. {lop_val:,.2f}", table_data_right)],
            [Paragraph("Employee PF Contribution (12%)", table_data_style), Paragraph(f"Rs. {ee_pf_val:,.2f}", table_data_right)],
            [Paragraph("Professional Tax (PT)", table_data_style), Paragraph(f"Rs. {pt_val:,.2f}", table_data_right)],
            [Paragraph("TDS / Tax / ESI Deductions", table_data_style), Paragraph(f"Rs. {(tds_val + esi_ee_val):,.2f}", table_data_right)],
            [Paragraph("<b>TOTAL DEDUCTIONS</b>", table_data_bold), Paragraph(f"<b>Rs. {tot_ded_val:,.2f}</b>", table_data_right_bold)],
        ]

        deductions_table = Table(deduction_rows, colWidths=[2.38 * inch, 1.3 * inch])
        deductions_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#DC2626')),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#FEE2E2')),
            ('BOX', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 3.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
            ('LEFTPADDING', (0, 0), (-1, -1), 5),
            ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ]))

        breakdown_master = Table([[earnings_table, deductions_table]], colWidths=[3.69 * inch, 3.69 * inch])
        breakdown_master.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))
        story.append(breakdown_master)
        story.append(Spacer(1, 8))

        # -------------------------------------------------------------
        # 5. NET PAYABLE BANNER & AMOUNT IN WORDS
        # -------------------------------------------------------------
        net_words = number_to_words(net_val)

        net_box_data = [
            [
                Paragraph("<b>NET PAYABLE SALARY:</b>", ParagraphStyle('NetLabel', fontName='Helvetica-Bold', fontSize=9.5, textColor=colors.HexColor('#065F46'))),
                Paragraph(f"<b>Rs. {net_val:,.2f}</b>", ParagraphStyle('NetVal', fontName='Helvetica-Bold', fontSize=12, alignment=TA_RIGHT, textColor=colors.HexColor('#065F46'))),
            ],
            [
                Paragraph(f"<b>Amount in Words:</b> {net_words}", net_words_style),
                Paragraph("", net_words_style)
            ]
        ]

        net_table = Table(net_box_data, colWidths=[4.38 * inch, 3.0 * inch])
        net_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#D1FAE5')), # Emerald 100
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#10B981')),     # Emerald 500
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 3.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('SPAN', (0, 1), (1, 1)),
        ]))
        story.append(net_table)
        story.append(Spacer(1, 8))

        # -------------------------------------------------------------
        # 6. EMPLOYER STATUTORY CONTRIBUTIONS (SEPARATE SECTION)
        # -------------------------------------------------------------
        story.append(Paragraph("EMPLOYER STATUTORY CONTRIBUTIONS (NOT DEDUCTED FROM SALARY)", section_heading_style))
        story.append(Spacer(1, 3))

        esi_er_val = getattr(payroll, 'esi_employer', Decimal('0.00')) if payroll else Decimal('0.00')
        tot_er_statutory = er_epf_val + er_eps_val + er_edli_val + esi_er_val
        er_contrib_data = [
            [
                Paragraph("<b>Employer EPF (3.67%)</b>", cell_label_style),
                Paragraph("<b>Employer EPS (8.33%)</b>", cell_label_style),
                Paragraph("<b>EDLI Scheme (0.50%)</b>", cell_label_style),
                Paragraph("<b>Employer ESI (3.25%)</b>", cell_label_style),
                Paragraph("<b>Total Employer Statutory</b>", cell_label_style),
            ],
            [
                Paragraph(f"Rs. {er_epf_val:,.2f}", cell_value_style),
                Paragraph(f"Rs. {er_eps_val:,.2f}", cell_value_style),
                Paragraph(f"Rs. {er_edli_val:,.2f}", cell_value_style),
                Paragraph(f"Rs. {esi_er_val:,.2f}", cell_value_style),
                Paragraph(f"<font color='#1E3A8A'><b>Rs. {tot_er_statutory:,.2f}</b></font>", cell_value_style),
            ]
        ]

        er_table = Table(er_contrib_data, colWidths=[1.47 * inch] * 5)
        er_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
            ('BOX', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ]))
        story.append(er_table)
        story.append(Spacer(1, 2))
        story.append(Paragraph(
            "<font size='6.5' color='#64748B'><i>* Note: Employer statutory contributions (EPF, EPS, EDLI, ESI) are paid directly by the enterprise and are never deducted from employee take-home pay.</i></font>",
            styles['Normal']
        ))
        story.append(Spacer(1, 6))

        # -------------------------------------------------------------
        # 6.5 ANNUAL SALARY SUMMARY & RECONCILIATION
        # -------------------------------------------------------------
        ann_ctc_val = getattr(payroll, 'annual_ctc', Decimal('0.00')) if payroll else Decimal('0.00')
        if not ann_ctc_val or ann_ctc_val == 0:
            ann_ctc_val = (gross_val + tot_er_statutory) * Decimal('12')
        ann_gross_val = getattr(payroll, 'annual_gross', Decimal('0.00')) if payroll else Decimal('0.00')
        if not ann_gross_val or ann_gross_val == 0:
            ann_gross_val = gross_val * Decimal('12')
        ann_pf_val = (ee_pf_val + er_epf_val + er_eps_val) * Decimal('12')
        ann_ded_val = tot_ded_val * Decimal('12')
        ann_net_val = net_val * Decimal('12')

        story.append(Paragraph("ANNUAL SALARY SUMMARY & RECONCILIATION", section_heading_style))
        story.append(Spacer(1, 2))

        ann_summary_data = [
            [
                Paragraph("<b>Annual CTC</b>", cell_label_style),
                Paragraph("<b>Annual Gross</b>", cell_label_style),
                Paragraph("<b>Annual PF (EE+ER)</b>", cell_label_style),
                Paragraph("<b>Annual Deductions</b>", cell_label_style),
                Paragraph("<b>Annual Net Pay</b>", cell_label_style),
            ],
            [
                Paragraph(f"Rs. {ann_ctc_val:,.2f}", cell_value_style),
                Paragraph(f"Rs. {ann_gross_val:,.2f}", cell_value_style),
                Paragraph(f"Rs. {ann_pf_val:,.2f}", cell_value_style),
                Paragraph(f"Rs. {ann_ded_val:,.2f}", cell_value_style),
                Paragraph(f"<font color='#065F46'><b>Rs. {ann_net_val:,.2f}</b></font>", cell_value_style),
            ]
        ]

        ann_table = Table(ann_summary_data, colWidths=[1.47 * inch] * 5)
        ann_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
            ('BOX', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(ann_table)
        story.append(Spacer(1, 6))

        # -------------------------------------------------------------
        # 7. SIGN-OFF, AUDIT TRAIL & SYSTEM FOOTER
        # -------------------------------------------------------------
        gen_by = payslip.generated_by.get_full_name() or payslip.generated_by.email if payslip.generated_by else 'System Payroll Engine'
        gen_time = payslip.generated_at.strftime('%d/%m/%Y %H:%M') if payslip.generated_at else datetime.now().strftime('%d/%m/%Y')
        rel_by = payslip.released_by.get_full_name() or payslip.released_by.email if payslip.released_by else (payslip.verified_by.get_full_name() if payslip.verified_by else 'HR Management')
        rel_time = payslip.released_at.strftime('%d/%m/%Y %H:%M') if payslip.released_at else 'Pending Release'

        auth_box_data = [
            [
                Paragraph(f"<b>Generated By:</b> {gen_by} ({gen_time})", ParagraphStyle('Audit1', fontName='Helvetica', fontSize=7, textColor=TEXT_MUTED)),
                Paragraph(f"<b>Authorized & Released By:</b> {rel_by} ({rel_time})", ParagraphStyle('Audit2', fontName='Helvetica', fontSize=7, textColor=TEXT_MUTED, alignment=TA_RIGHT)),
            ]
        ]
        auth_table = Table(auth_box_data, colWidths=[3.69 * inch, 3.69 * inch])
        auth_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 1.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5),
        ]))
        story.append(auth_table)
        story.append(Spacer(1, 6))

        story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_GRAY, spaceBefore=0, spaceAfter=4))
        story.append(Paragraph(
            "This is a digitally generated official payroll document issued by the enterprise attendance & salary management system. "
            "Confidential • For Employee Record Only.",
            footer_style
        ))

        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes
