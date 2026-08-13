from datetime import datetime
from html import escape
from io import BytesIO
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import Flowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .report_language import report_text, report_user_name, report_user_title

def _labels(lang):
    return {
        "generated_by": report_text(lang, "meta.generated_by"),
        "generated_at": report_text(lang, "meta.generated_at"),
        "page": report_text(lang, "meta.page"),
        "signature": report_text(lang, "meta.signature"),
        "name": report_text(lang, "meta.name"),
        "title": report_text(lang, "meta.title"),
        "date": report_text(lang, "meta.date"),
        "contact": report_text(lang, "meta.contact"),
        "email": report_text(lang, "meta.email"),
    }


def _logo_path():
    candidates = [
        Path(settings.BASE_DIR) / "static" / "logos" / "LogoIR.png",
        Path(settings.BASE_DIR) / "media" / "logos" / "LogoIR.png",
        Path(settings.BASE_DIR).parent / "frontend" / "src" / "assets" / "images" / "logos" / "LogoIR.png",
        Path(settings.BASE_DIR).parent
        / "material-dashboard-react-main"
        / "src"
        / "assets"
        / "images"
        / "logos"
        / "LogoIR.png",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def _brand_logo_path():
    candidates = [
        Path(settings.BASE_DIR) / "static" / "logos" / "IkiminaRehoboth_logos.png",
        Path(settings.BASE_DIR) / "media" / "logos" / "IkiminaRehoboth_logos.png",
        Path(settings.BASE_DIR).parent / "frontend" / "src" / "assets" / "images" / "logos" / "IkiminaRehoboth_logos.png",
        Path(settings.BASE_DIR).parent
        / "material-dashboard-react-main"
        / "src"
        / "assets"
        / "images"
        / "logos"
        / "IkiminaRehoboth_logos.png",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return _logo_path()


def _draw_email_icon(canvas, x, y, size, color):
    canvas.saveState()
    canvas.setStrokeColor(color)
    canvas.setLineWidth(1.1)
    canvas.roundRect(x, y, size, size * 0.72, 0.06 * cm, stroke=1, fill=0)
    canvas.line(x, y + size * 0.72, x + size * 0.5, y + size * 0.34)
    canvas.line(x + size, y + size * 0.72, x + size * 0.5, y + size * 0.34)
    canvas.restoreState()


def _draw_phone_icon(canvas, x, y, size, color):
    canvas.saveState()
    canvas.setStrokeColor(color)
    canvas.setLineWidth(1.2)
    canvas.arc(x + size * 0.10, y + size * 0.10, x + size * 0.55, y + size * 0.55, 210, 90)
    canvas.arc(x + size * 0.42, y + size * 0.25, x + size * 0.88, y + size * 0.70, 30, 90)
    canvas.line(x + size * 0.28, y + size * 0.20, x + size * 0.40, y + size * 0.33)
    canvas.line(x + size * 0.60, y + size * 0.46, x + size * 0.74, y + size * 0.57)
    canvas.restoreState()


def _draw_bank_icon(canvas, x, y, size, color):
    canvas.saveState()
    canvas.setStrokeColor(color)
    canvas.setFillColor(color)
    canvas.setLineWidth(1.0)
    canvas.line(x + size * 0.08, y + size * 0.64, x + size * 0.92, y + size * 0.64)
    canvas.line(x + size * 0.18, y + size * 0.64, x + size * 0.50, y + size * 0.88)
    canvas.line(x + size * 0.50, y + size * 0.88, x + size * 0.82, y + size * 0.64)
    for column_x in (0.24, 0.42, 0.60, 0.78):
        canvas.line(x + size * column_x, y + size * 0.24, x + size * column_x, y + size * 0.62)
    canvas.line(x + size * 0.12, y + size * 0.22, x + size * 0.88, y + size * 0.22)
    canvas.restoreState()


def _draw_icon_badge(canvas, x, y, badge_size, icon_drawer, icon_color):
    canvas.saveState()
    canvas.setFillColor(colors.HexColor("#eef6ff"))
    canvas.setStrokeColor(colors.HexColor("#d6e4f2"))
    canvas.setLineWidth(0.75)
    canvas.roundRect(x, y, badge_size, badge_size, 0.10 * cm, fill=1, stroke=1)
    inset = badge_size * 0.20
    icon_drawer(
        canvas,
        x + inset,
        y + inset,
        badge_size - (inset * 2),
        icon_color,
    )
    canvas.restoreState()


class _CompanyPanel(Flowable):
    def __init__(self, lang, width):
        super().__init__()
        self.lang = lang
        self.width = width
        self.height = 5.45 * cm
        self.brand_logo = _brand_logo_path()

    def wrap(self, available_width, available_height):
        return self.width, self.height

    def draw(self):
        canvas = self.canv
        card_height = self.height
        card_width = self.width - 0.05 * cm
        canvas.setFillColor(colors.HexColor("#f9fcff"))
        canvas.setStrokeColor(colors.HexColor("#d6e4f2"))
        canvas.setLineWidth(0.9)
        canvas.roundRect(0, 0, card_width, card_height, 0.18 * cm, fill=1, stroke=1)
        canvas.setFillColor(colors.HexColor("#1674b7"))
        canvas.roundRect(0, card_height - 0.18 * cm, 4.0 * cm, 0.18 * cm, 0.08 * cm, fill=1, stroke=0)
        canvas.setFillColor(colors.HexColor("#9bc53d"))
        canvas.roundRect(4.1 * cm, card_height - 0.18 * cm, 1.5 * cm, 0.18 * cm, 0.08 * cm, fill=1, stroke=0)

        logo_width = 0
        logo_x = 0.25 * cm
        logo_y = card_height - 3.55 * cm

        if self.brand_logo:
            image_width, image_height = ImageReader(str(self.brand_logo)).getSize()
            scale = min(min(card_width - 0.35 * cm, 8.9 * cm) / image_width, 3.25 * cm / image_height)
            logo_width = image_width * scale
            canvas.drawImage(
                str(self.brand_logo),
                logo_x,
                logo_y,
                width=logo_width,
                height=image_height * scale,
                mask="auto",
                preserveAspectRatio=True,
            )

        info_center_x = logo_x + min(max(logo_width * 0.30, 2.55 * cm), 3.35 * cm)
        line_left_x = logo_x + 0.18 * cm
        text_left_x = logo_x + 0.62 * cm
        details_top_y = max(logo_y + 0.56 * cm, 1.92 * cm)

        canvas.setFillColor(colors.HexColor("#1f1f1f"))
        canvas.setFont("Helvetica-Bold", 8.5)
        canvas.drawCentredString(
            info_center_x,
            details_top_y,
            report_text(self.lang, "company.registration"),
        )
        canvas.drawCentredString(
            info_center_x,
            details_top_y - 0.42 * cm,
            report_text(self.lang, "company.address"),
        )

        canvas.setStrokeColor(colors.HexColor("#9bc53d"))
        canvas.setLineWidth(1.0)
        canvas.line(line_left_x, details_top_y - 0.78 * cm, line_left_x, details_top_y - 2.05 * cm)

        icon_color = colors.HexColor("#1674b7")
        badge_size = 0.42 * cm
        icon_x = text_left_x - 0.44 * cm
        email_y = details_top_y - 1.11 * cm
        phone_y = details_top_y - 1.55 * cm
        bank_y = details_top_y - 1.99 * cm
        _draw_icon_badge(canvas, icon_x, email_y, badge_size, _draw_email_icon, icon_color)
        _draw_icon_badge(canvas, icon_x, phone_y, badge_size, _draw_phone_icon, icon_color)
        _draw_icon_badge(canvas, icon_x, bank_y, badge_size, _draw_bank_icon, icon_color)

        canvas.setFillColor(colors.HexColor("#1f1f1f"))
        canvas.setFont("Helvetica", 8.2)
        canvas.drawString(text_left_x + 0.08 * cm, details_top_y - 0.98 * cm, report_text(self.lang, "company.email_line"))
        canvas.drawString(text_left_x + 0.08 * cm, details_top_y - 1.42 * cm, report_text(self.lang, "company.phone_line"))
        canvas.drawString(text_left_x + 0.08 * cm, details_top_y - 1.86 * cm, report_text(self.lang, "company.bank_line"))


def _stamp_path():
    candidates = [
        Path(settings.BASE_DIR) / "static" / "logos" / "StampIR.png",
        Path(settings.BASE_DIR) / "static" / "logos" / "stamp.png",
        Path(settings.BASE_DIR) / "media" / "logos" / "StampIR.png",
        Path(settings.BASE_DIR) / "media" / "logos" / "stamp.png",
        Path(settings.BASE_DIR).parent / "frontend" / "src" / "assets" / "images" / "logos" / "StampIR.png",
        Path(settings.BASE_DIR).parent / "frontend" / "src" / "assets" / "images" / "logos" / "stamp.png",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return _logo_path()


def _build_meta_table(styles, labels, generated_by=None, filters=None, summary=None, available_width=None):
    rows = []
    if generated_by:
        rows.append(
            [
                Paragraph(escape(labels["generated_by"]), styles["MetaLabel"]),
                Paragraph(escape(str(generated_by)), styles["MetaValue"]),
            ]
        )
    rows.append(
        [
            Paragraph(escape(labels["generated_at"]), styles["MetaLabel"]),
            Paragraph(datetime.now().strftime("%Y-%m-%d %H:%M:%S"), styles["MetaValue"]),
        ]
    )

    if filters:
        for key, value in filters.items():
            if value not in (None, "", []):
                rows.append(
                    [
                        Paragraph(escape(str(key)), styles["MetaLabel"]),
                        Paragraph(escape(str(value)), styles["MetaValue"]),
                    ]
                )

    if summary:
        for key, value in summary.items():
            if value not in (None, "", []):
                rows.append(
                    [
                        Paragraph(escape(str(key)), styles["MetaLabel"]),
                        Paragraph(escape(str(value)), styles["MetaValue"]),
                    ]
                )

    if not rows:
        return None

    total_width = available_width or 16.6 * cm
    label_width = min(max(total_width * 0.4, 4.2 * cm), 5.4 * cm)
    value_width = max(total_width - label_width, 5.5 * cm)

    table = Table(rows, colWidths=[label_width, value_width])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f8fbff")]),
                ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#d6e4f2")),
                ("INNERGRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#eaf1f7")),
                ("LINEBEFORE", (0, 0), (0, -1), 2.0, colors.HexColor("#1674b7")),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    return table


def _build_company_panel(styles, lang, available_width):
    return _CompanyPanel(lang, available_width)


def _build_title_band(styles, title, subtitle, available_width):
    content = [Paragraph(title, styles["ReportTitle"])]
    if subtitle:
        content.append(Spacer(1, 0.08 * cm))
        content.append(Paragraph(subtitle, styles["ReportSubtitle"]))

    title_table = Table(
        [["", content]],
        colWidths=[0.26 * cm, max(available_width - 0.26 * cm, 5.0 * cm)],
    )
    title_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#1674b7")),
                ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#d6e4f2")),
                ("LEFTPADDING", (0, 0), (0, 0), 0),
                ("RIGHTPADDING", (0, 0), (0, 0), 0),
                ("TOPPADDING", (0, 0), (0, 0), 0),
                ("BOTTOMPADDING", (0, 0), (0, 0), 0),
                ("LEFTPADDING", (1, 0), (1, 0), 12),
                ("RIGHTPADDING", (1, 0), (1, 0), 12),
                ("TOPPADDING", (1, 0), (1, 0), 9),
                ("BOTTOMPADDING", (1, 0), (1, 0), 8),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    return title_table


def _build_header(
    styles,
    labels,
    title,
    lang,
    *,
    generated_by=None,
    filters=None,
    summary=None,
    subtitle=None,
    available_width=None,
):
    story = []
    content_width = available_width or 18.0 * cm
    company_width = min(max(content_width * 0.57, 10.2 * cm), 14.0 * cm)
    meta_width = max(content_width - company_width, 6.4 * cm)

    intro_table = Table(
        [
            [
                _build_company_panel(styles, lang, company_width - 0.2 * cm),
                _build_meta_table(
                    styles,
                    labels,
                    generated_by=generated_by,
                    filters=filters,
                    summary=summary,
                    available_width=meta_width - 0.2 * cm,
                ),
            ]
        ],
        colWidths=[company_width, meta_width],
    )
    intro_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (0, 0), (0, 0), "LEFT"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (0, 0), 12),
                ("LEFTPADDING", (1, 0), (1, 0), 6),
            ]
        )
    )
    story.append(intro_table)
    story.append(Spacer(1, 0.24 * cm))
    story.append(_build_title_band(styles, title, subtitle, content_width))
    story.append(Spacer(1, 0.26 * cm))
    return story


def _estimate_col_widths(headers, rows, available_width):
    text_rows = [[str(cell) if cell is not None else "" for cell in row] for row in rows]
    widths = []
    for index, header in enumerate(headers):
        candidates = [str(header)] + [row[index] for row in text_rows if len(row) > index]
        max_width = max(stringWidth(value[:40], "Helvetica", 8.2) for value in candidates) + 18
        widths.append(max(max_width, 54))

    total = sum(widths)
    if total <= available_width:
        return widths

    scale = available_width / total
    scaled = [max(48, width * scale) for width in widths]
    overflow = sum(scaled) - available_width
    if overflow > 0:
        scaled[-1] = max(48, scaled[-1] - overflow)
    return scaled


def _build_table(styles, headers, rows, available_width):
    wrapped_rows = [
        [Paragraph(str(cell) if cell is not None else "-", styles["TableCell"]) for cell in row]
        for row in rows
    ]
    header_row = [Paragraph(f"<b>{header}</b>", styles["TableHeader"]) for header in headers]
    col_widths = _estimate_col_widths(headers, rows, available_width)

    table = Table([header_row] + wrapped_rows, colWidths=col_widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a73e8")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.2),
                ("LEADING", (0, 0), (-1, -1), 10),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#dbe4f0")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fbff")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return table


def _build_signatures_table(styles, labels, signatures):
    if not signatures:
        return None

    rows = [[
        Paragraph(f"<b>{labels['signature']}</b>", styles["TableCell"]),
        Paragraph(f"<b>{labels['name']}</b>", styles["TableCell"]),
        Paragraph(f"<b>{labels['title']}</b>", styles["TableCell"]),
        Paragraph(f"<b>{labels['date']}</b>", styles["TableCell"]),
    ]]

    for item in signatures:
        rows.append(
            [
                Paragraph("________________________", styles["TableCell"]),
                Paragraph(str(item.get("name") or "-"), styles["TableCell"]),
                Paragraph(str(item.get("title") or "-"), styles["TableCell"]),
                Paragraph(str(item.get("date") or "-"), styles["TableCell"]),
            ]
        )

    table = Table(rows, colWidths=[4.4 * cm, 5.1 * cm, 5.1 * cm, 3.0 * cm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f4f7fb")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#dbe4f0")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e6edf6")),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return table


def _resolve_generated_by(generated_by=None, acting_user=None):
    if generated_by:
        return str(generated_by)
    if acting_user:
        return report_user_name(acting_user)
    return None


def _get_user_employee(user):
    if not user:
        return None

    try:
        employee = user.employee
    except ObjectDoesNotExist:
        employee = None
    if employee:
        return employee

    try:
        member = user.member_profile
    except ObjectDoesNotExist:
        member = None
    if not member:
        return None

    try:
        return member.employee
    except ObjectDoesNotExist:
        return None


def _get_user_phone(user):
    if not user:
        return ""

    employee = _get_user_employee(user)
    if employee:
        if getattr(employee, "external_phone", ""):
            return str(employee.external_phone).strip()
        if employee.member and getattr(employee.member, "phone", ""):
            return str(employee.member.phone).strip()

    try:
        member = user.member_profile
    except ObjectDoesNotExist:
        member = None
    if member and getattr(member, "phone", ""):
        return str(member.phone).strip()

    return ""


def _resolve_manager_user(acting_user=None):
    if acting_user and str(getattr(acting_user, "role", "")).upper() == "MANAGER":
        return acting_user

    User = get_user_model()
    manager = User.objects.filter(role="MANAGER", is_active=True).first()
    if manager:
        return manager

    return acting_user


def _resolve_manager_contact(user):
    if not user:
        return {"phone": "", "email": ""}

    return {
        "phone": _get_user_phone(user),
        "email": str(getattr(user, "email", "") or "").strip(),
    }


def _resolve_signatures(
    *,
    lang,
    signatures=None,
    acting_user=None,
    generated_by=None,
    generated_title=None,
    signature_date=None,
):
    if signatures:
        return signatures

    signatory_name = _resolve_generated_by(generated_by=generated_by, acting_user=acting_user)
    if not signatory_name:
        return []

    signatory_title = generated_title or report_user_title(lang, acting_user, default="")
    signatory_date = signature_date or datetime.now().strftime("%Y-%m-%d")
    return [
        {
            "name": signatory_name,
            "title": signatory_title or "-",
            "date": signatory_date,
        }
    ]


def _resolve_footer_signatory(
    *,
    lang,
    acting_user=None,
    signatures=None,
    generated_by=None,
    generated_title=None,
    signature_date=None,
):
    manager_user = _resolve_manager_user(acting_user=acting_user)
    contact = _resolve_manager_contact(manager_user)

    if signatures:
        signature = signatures[0] or {}
        return {
            "name": signature.get("name") or report_user_name(manager_user) or generated_by or "-",
            "phone": contact.get("phone", ""),
            "email": contact.get("email", ""),
            "title": signature.get("title") or generated_title or report_user_title(lang, manager_user, default="-"),
            "date": signature.get("date") or signature_date or datetime.now().strftime("%Y-%m-%d"),
            "stamp_path": _stamp_path(),
        }

    if not manager_user:
        return None

    return {
        "name": report_user_name(manager_user) or generated_by or "-",
        "phone": contact.get("phone", ""),
        "email": contact.get("email", ""),
        "title": generated_title or report_user_title(lang, manager_user, default="-"),
        "date": signature_date or datetime.now().strftime("%Y-%m-%d"),
        "stamp_path": _stamp_path(),
    }


def _page_number_factory(labels, lang, footer_signatory=None):
    def _page_number(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor("#dbe4f0"))
        canvas.line(doc.leftMargin, 1.5 * cm, doc.pagesize[0] - doc.rightMargin, 1.5 * cm)
        canvas.setFillColor(colors.HexColor("#5b6572"))
        canvas.setFont("Helvetica", 8)
        canvas.drawString(doc.leftMargin, 1.0 * cm, report_text(lang, "company.name"))

        if footer_signatory:
            right_edge = doc.pagesize[0] - doc.rightMargin
            block_left = right_edge - 7.8 * cm
            manager_label = report_text(lang, "value.role_manager")
            phone_value = footer_signatory.get("phone") or "-"
            email_value = footer_signatory.get("email") or "-"
            canvas.setFont("Helvetica-Bold", 8)
            canvas.drawString(
                block_left,
                3.25 * cm,
                f"{manager_label}: {footer_signatory.get('name') or '-'}",
            )
            canvas.setFont("Helvetica", 8)
            canvas.drawString(
                block_left,
                2.80 * cm,
                f"{labels['contact']}: {phone_value}",
            )
            canvas.drawString(
                block_left,
                2.35 * cm,
                f"{labels['email']}: {email_value}",
            )
            canvas.drawString(
                block_left,
                1.90 * cm,
                f"{labels['signature']}: ____________________",
            )
            stamp_path = footer_signatory.get("stamp_path")
            if stamp_path:
                try:
                    canvas.drawImage(
                        str(stamp_path),
                        right_edge - 1.85 * cm,
                        1.65 * cm,
                        width=1.35 * cm,
                        height=1.35 * cm,
                        preserveAspectRatio=True,
                        mask="auto",
                    )
                except Exception:
                    pass

        canvas.setFont("Helvetica", 8)
        canvas.drawRightString(
            doc.pagesize[0] - doc.rightMargin,
            1.0 * cm,
            f"{labels['page']} {canvas.getPageNumber()}",
        )
        canvas.restoreState()

    return _page_number


def build_pdf_report_response(
    *,
    filename,
    title,
    headers,
    rows,
    generated_by=None,
    generated_title=None,
    filters=None,
    summary=None,
    subtitle=None,
    landscape_mode=True,
    lang="en",
    signatures=None,
    acting_user=None,
    signature_date=None,
):
    buffer = BytesIO()
    page_size = landscape(A4) if landscape_mode else A4
    footer_signatory = _resolve_footer_signatory(
        lang=lang,
        acting_user=acting_user,
        signatures=signatures,
        generated_by=generated_by,
        generated_title=generated_title,
        signature_date=signature_date,
    )
    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_size,
        leftMargin=1.2 * cm,
        rightMargin=1.2 * cm,
        topMargin=1.0 * cm,
        bottomMargin=4.0 * cm if footer_signatory else 2.0 * cm,
    )

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="ReportTitle",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16.8,
            leading=19,
            textColor=colors.HexColor("#173f76"),
            spaceAfter=1,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ReportSubtitle",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.9,
            leading=10.8,
            textColor=colors.HexColor("#607080"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="CompanyInfo",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=10,
            textColor=colors.HexColor("#1f1f1f"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="MetaLabel",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8.2,
            leading=10,
            textColor=colors.HexColor("#344767"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="MetaValue",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.2,
            leading=10,
            textColor=colors.HexColor("#22313f"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="Muted",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.6,
            leading=10.5,
            textColor=colors.HexColor("#5b6572"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="TableHeader",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8.2,
            leading=10,
            textColor=colors.white,
        )
    )
    styles.add(
        ParagraphStyle(
            name="TableCell",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.2,
            leading=10,
            textColor=colors.HexColor("#344767"),
        )
    )

    labels = _labels(lang)
    resolved_generated_by = _resolve_generated_by(generated_by=generated_by, acting_user=acting_user)
    story = []
    story.extend(
        _build_header(
            styles,
            labels,
            title,
            lang,
            generated_by=resolved_generated_by,
            filters=filters or {},
            summary=summary or {},
            subtitle=subtitle,
            available_width=doc.width,
        )
    )
    story.append(_build_table(styles, headers, rows, doc.width))

    page_number = _page_number_factory(labels, lang, footer_signatory=footer_signatory)
    doc.build(story, onFirstPage=page_number, onLaterPages=page_number)
    pdf = buffer.getvalue()
    buffer.close()

    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    response.write(pdf)
    return response
