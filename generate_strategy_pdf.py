from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import Flowable

# ── Colours ──────────────────────────────────────────────
NAVY   = colors.HexColor('#1a1f2e')
AMBER  = colors.HexColor('#f59e0b')
LIGHT  = colors.HexColor('#f9fafb')
BORDER = colors.HexColor('#e5e7eb')
MUTED  = colors.HexColor('#6b7280')
DARK   = colors.HexColor('#374151')
WHITE  = colors.white

W, H = A4

# ── Styles ────────────────────────────────────────────────
def make_styles():
    return {
        'h1': ParagraphStyle('h1',
            fontName='Helvetica-Bold', fontSize=26, leading=30,
            textColor=WHITE, spaceAfter=4),
        'sub': ParagraphStyle('sub',
            fontName='Helvetica', fontSize=11, leading=14,
            textColor=colors.HexColor('#9ca3af')),
        'section_title': ParagraphStyle('section_title',
            fontName='Helvetica-Bold', fontSize=14, leading=18,
            textColor=NAVY, spaceAfter=2),
        'section_sub': ParagraphStyle('section_sub',
            fontName='Helvetica', fontSize=9, leading=12,
            textColor=MUTED, spaceAfter=10),
        'label': ParagraphStyle('label',
            fontName='Helvetica-Bold', fontSize=8, leading=10,
            textColor=AMBER, spaceBefore=0, spaceAfter=3),
        'card_title': ParagraphStyle('card_title',
            fontName='Helvetica-Bold', fontSize=11, leading=14,
            textColor=NAVY, spaceAfter=3),
        'card_body': ParagraphStyle('card_body',
            fontName='Helvetica', fontSize=9, leading=13,
            textColor=DARK),
        'body': ParagraphStyle('body',
            fontName='Helvetica', fontSize=9.5, leading=14,
            textColor=DARK),
        'highlight': ParagraphStyle('highlight',
            fontName='Helvetica', fontSize=10, leading=15,
            textColor=WHITE),
        'highlight_bold': ParagraphStyle('highlight_bold',
            fontName='Helvetica-Bold', fontSize=10, leading=15,
            textColor=AMBER),
        'pullquote': ParagraphStyle('pullquote',
            fontName='Helvetica', fontSize=12, leading=18,
            textColor=colors.HexColor('#d1d5db'), alignment=TA_CENTER),
        'attr': ParagraphStyle('attr',
            fontName='Helvetica', fontSize=8, leading=10,
            textColor=MUTED, alignment=TA_CENTER, spaceAfter=0),
        'col_head': ParagraphStyle('col_head',
            fontName='Helvetica-Bold', fontSize=8, leading=10,
            textColor=MUTED),
        'cell': ParagraphStyle('cell',
            fontName='Helvetica', fontSize=8.5, leading=12,
            textColor=DARK),
        'cell_bold': ParagraphStyle('cell_bold',
            fontName='Helvetica-Bold', fontSize=8.5, leading=12,
            textColor=NAVY),
        'opp_title': ParagraphStyle('opp_title',
            fontName='Helvetica-Bold', fontSize=10, leading=13,
            textColor=NAVY, spaceAfter=2),
        'opp_body': ParagraphStyle('opp_body',
            fontName='Helvetica', fontSize=8.5, leading=12,
            textColor=DARK),
        'chan_title': ParagraphStyle('chan_title',
            fontName='Helvetica-Bold', fontSize=9.5, leading=13,
            textColor=NAVY),
        'chan_body': ParagraphStyle('chan_body',
            fontName='Helvetica', fontSize=8.5, leading=12,
            textColor=DARK),
        'ret_title': ParagraphStyle('ret_title',
            fontName='Helvetica-Bold', fontSize=9.5, leading=13,
            textColor=NAVY),
        'ret_body': ParagraphStyle('ret_body',
            fontName='Helvetica', fontSize=8.5, leading=12,
            textColor=DARK),
        'footer': ParagraphStyle('footer',
            fontName='Helvetica', fontSize=8, leading=10,
            textColor=MUTED, alignment=TA_CENTER),
    }

S = make_styles()

# ── Custom Flowables ──────────────────────────────────────

class ColorRect(Flowable):
    """Filled rectangle background for header."""
    def __init__(self, w, h, fill):
        super().__init__()
        self.w, self.h, self.fill = w, h, fill
    def draw(self):
        self.canv.setFillColor(self.fill)
        self.canv.rect(0, 0, self.w, self.h, stroke=0, fill=1)
    def wrap(self, *args): return self.w, self.h

class AmberBar(Flowable):
    """Thin amber accent line."""
    def __init__(self, w):
        super().__init__()
        self.w = w
    def draw(self):
        self.canv.setFillColor(AMBER)
        self.canv.rect(0, 0, self.w, 3, stroke=0, fill=1)
    def wrap(self, *args): return self.w, 3

class SectionHeader(Flowable):
    """Icon + title block for each section."""
    def __init__(self, icon, title, subtitle, icon_bg, avail_w):
        super().__init__()
        self.icon, self.title, self.subtitle = icon, title, subtitle
        self.icon_bg = icon_bg
        self.avail_w = avail_w
    def draw(self):
        c = self.canv
        # icon box
        c.setFillColor(self.icon_bg)
        c.roundRect(0, -2, 32, 32, 6, stroke=0, fill=1)
        c.setFillColor(NAVY)
        c.setFont('Helvetica-Bold', 16)
        c.drawCentredString(16, 8, self.icon)
        # title
        c.setFillColor(NAVY)
        c.setFont('Helvetica-Bold', 14)
        c.drawString(42, 16, self.title)
        c.setFillColor(MUTED)
        c.setFont('Helvetica', 8.5)
        c.drawString(42, 5, self.subtitle)
    def wrap(self, *args): return self.avail_w, 34

class RetentionItem(Flowable):
    """Numbered retention row."""
    def __init__(self, num, title, body, avail_w):
        super().__init__()
        self.num, self.title, self.body = num, title, body
        self.avail_w = avail_w
        self._h = None
    def wrap(self, aw, ah):
        self._w = aw
        # estimate height from body text
        chars_per_line = (aw - 52) / 5.2
        lines = max(1, len(self.body) / chars_per_line)
        self._h = max(36, 14 + lines * 12 + 6)
        return aw, self._h
    def draw(self):
        c = self.canv
        h = self._h
        # background
        c.setFillColor(LIGHT)
        c.setStrokeColor(BORDER)
        c.roundRect(0, 0, self.avail_w, h, 6, stroke=1, fill=1)
        # number badge
        c.setFillColor(NAVY)
        c.roundRect(10, h/2-11, 22, 22, 5, stroke=0, fill=1)
        c.setFillColor(AMBER)
        c.setFont('Helvetica-Bold', 11)
        c.drawCentredString(21, h/2-4, str(self.num))
        # title
        c.setFillColor(NAVY)
        c.setFont('Helvetica-Bold', 9.5)
        c.drawString(42, h - 14, self.title)
        # body
        c.setFillColor(DARK)
        c.setFont('Helvetica', 8.5)
        # simple word wrap
        words = self.body.split()
        line, lines = '', []
        max_w = self.avail_w - 52
        for w in words:
            test = (line + ' ' + w).strip()
            if c.stringWidth(test, 'Helvetica', 8.5) < max_w:
                line = test
            else:
                lines.append(line)
                line = w
        if line: lines.append(line)
        y = h - 27
        for ln in lines:
            c.drawString(42, y, ln)
            y -= 12

# ── Build document ────────────────────────────────────────

def build():
    path = '/Users/darraghguy/Desktop/Pelikn/pelikn-strategy.pdf'
    doc = SimpleDocTemplate(
        path,
        pagesize=A4,
        leftMargin=18*mm, rightMargin=18*mm,
        topMargin=0, bottomMargin=14*mm,
        title='Pelikn — Business Strategy Brief',
        author='Pelikn'
    )

    aw = W - 36*mm   # available width
    story = []

    # ── HEADER ───────────────────────────────────────────
    # Navy background block
    header_h = 52*mm
    header_data = [[
        Paragraph('<b>P</b>', ParagraphStyle('lm',
            fontName='Helvetica-Bold', fontSize=16,
            textColor=NAVY, alignment=TA_CENTER)),
        [
            Paragraph('Pelikn', ParagraphStyle('ln',
                fontName='Helvetica-Bold', fontSize=14,
                textColor=WHITE)),
            Spacer(1, 3),
            Paragraph('Growth &amp; Retention Strategy Brief', S['h1']),
            Paragraph(
                'Why customers choose us, how we reach them, and what keeps them.',
                S['sub']),
        ]
    ]]
    t = Table(header_data, colWidths=[14*mm, aw - 14*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), NAVY),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 14*mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10*mm),
        ('LEFTPADDING', (0, 0), (0, 0), 0),
        ('LEFTPADDING', (1, 0), (1, 0), 10),
        ('BACKGROUND', (0, 0), (0, 0), AMBER),
        ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (0, 0), 16),
        ('TEXTCOLOR', (0, 0), (0, 0), NAVY),
        ('ROUNDEDCORNERS', [0, 0, 0, 0]),
    ]))
    story.append(t)
    story.append(AmberBar(aw))
    story.append(Spacer(1, 6*mm))

    # ── SECTION 1: Why They Choose Us ───────────────────
    story.append(KeepTogether([
        SectionHeader('🎯', 'Why They Choose Us',
            'The emotional and rational sale',
            colors.HexColor('#fef3c7'), aw),
        Spacer(1, 4*mm),
    ]))

    # Highlight block
    highlight_data = [[
        Paragraph(
            '<b>The core hook is fear reduction.</b>  '
            'Venue owners live with a low-level dread of EHO inspections. '
            'Pelikn turns "am I compliant?" from a gnawing uncertainty into a one-tap PDF export.',
            S['highlight'])
    ]]
    ht = Table(highlight_data, colWidths=[aw])
    ht.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), NAVY),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
    ]))
    story.append(ht)
    story.append(Spacer(1, 4*mm))

    # 4-card grid
    cards = [
        ('EMOTIONAL', 'Peace of mind',
         'Pass your next EHO inspection. All records captured automatically, audit-ready PDF in one tap.'),
        ('RATIONAL', 'Replaces 3+ tools',
         'Paper logs + spreadsheet rotas + timesheet apps — gone. One PWA, no App Store needed.'),
        ('FINANCIAL', '£5/month entry point',
         'Cheaper than a compliance binder refill. No per-user fees. Less than £1/day for Pro.'),
        ('COMPETITIVE', 'UK-specific by design',
         'EHO, FSA, Natasha\'s Law, HACCP — built for British venues, not a generic US SaaS.'),
    ]
    half = (aw - 5) / 2
    def make_card(label, title, body):
        return [
            Paragraph(label, S['label']),
            Paragraph(title, S['card_title']),
            Paragraph(body, S['card_body']),
        ]

    card_data = [
        [make_card(*cards[0]), make_card(*cards[1])],
        [make_card(*cards[2]), make_card(*cards[3])],
    ]
    ct = Table(card_data, colWidths=[half, half], spaceBefore=0)
    ct.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT),
        ('BOX', (0, 0), (0, 0), 0.5, BORDER),
        ('BOX', (1, 0), (1, 0), 0.5, BORDER),
        ('BOX', (0, 1), (0, 1), 0.5, BORDER),
        ('BOX', (1, 1), (1, 1), 0.5, BORDER),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [LIGHT]),
    ]))
    story.append(ct)
    story.append(Spacer(1, 7*mm))

    # ── SECTION 2: How We Approach Them ─────────────────
    story.append(KeepTogether([
        SectionHeader('📣', 'How We Approach Them',
            'Segment by urgency, not size',
            colors.HexColor('#dbeafe'), aw),
        Spacer(1, 4*mm),
    ]))

    # Segment table
    seg_head = [
        Paragraph('SEGMENT', S['col_head']),
        Paragraph('TRIGGER', S['col_head']),
        Paragraph('LEAD WITH', S['col_head']),
    ]
    seg_rows = [
        [Paragraph('Pre-EHO panic\nInspection coming up', S['cell_bold']),
         Paragraph('Fear of failure', S['cell']),
         Paragraph('Audit-ready PDF in one tap. 15-min setup. → Starter', S['cell'])],
        [Paragraph('Post-EHO failure\nJust got a bad score', S['cell_bold']),
         Paragraph('Shame + urgency', S['cell']),
         Paragraph('"Never fail again." Compliance-first → upgrade path', S['cell'])],
        [Paragraph('Rota chaos\nGrowing team', S['cell_bold']),
         Paragraph('Spreadsheet pain', S['cell']),
         Paragraph('AI rota builder + shift swaps → Pro from day one', S['cell'])],
        [Paragraph('Multi-site ops\n2+ venues', S['cell_bold']),
         Paragraph('No unified view', S['cell']),
         Paragraph('HQ dashboard + £15/extra venue. Biggest LTV.', S['cell'])],
    ]
    col_ws = [aw * 0.28, aw * 0.22, aw * 0.50]
    st = Table([seg_head] + seg_rows, colWidths=col_ws)
    st.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f3f4f6')),
        ('LINEBELOW', (0, 0), (-1, 0), 0.5, BORDER),
        ('LINEBELOW', (0, 1), (-1, -2), 0.5, colors.HexColor('#f3f4f6')),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER),
        ('ROUNDEDCORNERS', [6, 6, 6, 6]),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT]),
    ]))
    story.append(st)
    story.append(Spacer(1, 4*mm))
    story.append(HRFlowable(width=aw, color=BORDER, thickness=0.5))
    story.append(Spacer(1, 4*mm))

    # Channels
    channels = [
        ('Google Ads on "EHO inspection checklist"',
         'Captures intent at the moment of panic — highest-converting traffic you can buy.'),
        ('Instagram / TikTok for hospitality owners',
         'Short demo videos: "Watch us pass an EHO audit in 30 seconds." Shareable and cheap to produce.'),
        ('EHO consultants & food safety trainers',
         'They recommend tools to every client they train. One referral partner = dozens of signups.'),
        ('Local hospitality Facebook groups',
         'Tight communities where owners share recommendations. Word of mouth travels fast.'),
        ('QR table cards as a Trojan horse',
         'Customers scan allergen QR codes and see "Powered by Pelikn." Every diner is a potential referral.'),
    ]
    for title, body in channels:
        row = [[
            Paragraph('•', ParagraphStyle('dot',
                fontName='Helvetica-Bold', fontSize=14,
                textColor=AMBER, alignment=TA_CENTER)),
            [Paragraph(title, S['chan_title']),
             Paragraph(body, S['chan_body'])],
        ]]
        ct2 = Table(row, colWidths=[8*mm, aw - 8*mm])
        ct2.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), LIGHT),
            ('BOX', (0, 0), (-1, -1), 0.5, BORDER),
            ('ROUNDEDCORNERS', [6, 6, 6, 6]),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (0, 0), 6),
            ('LEFTPADDING', (1, 0), (1, 0), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ]))
        story.append(ct2)
        story.append(Spacer(1, 2.5*mm))

    story.append(Spacer(1, 4*mm))

    # ── SECTION 3: How We Retain Them ───────────────────
    story.append(KeepTogether([
        SectionHeader('🔒', 'How We Retain Them',
            'Built-in gravity at every layer',
            colors.HexColor('#d1fae5'), aw),
        Spacer(1, 4*mm),
    ]))

    retention = [
        ('Daily habit formation',
         'Temperature logs, opening/closing checklists, and cleaning schedules mean staff use the app every single shift. Muscle memory within a week.'),
        ('Compliance lock-in',
         'Once you\'ve passed an EHO inspection using Pelikn\'s records, switching means rebuilding your entire compliance paper trail. Nobody does that voluntarily.'),
        ('Operational gravity (Pro)',
         'Rota + timesheets + training + time-off in one place. Switching costs compound with every week of data stored.'),
        ('Multi-venue gravity',
         'A 3-site group at £55/month has all cross-venue compliance and staffing in one dashboard. The switching cost is enormous.'),
        ('Push notifications',
         'Training certificate expiry alerts, rota changes, and time-off approvals keep the app present even on quiet days.'),
    ]
    for i, (title, body) in enumerate(retention):
        story.append(RetentionItem(i + 1, title, body, aw))
        story.append(Spacer(1, 2.5*mm))

    story.append(Spacer(1, 4*mm))
    story.append(HRFlowable(width=aw, color=BORDER, thickness=0.5))
    story.append(Spacer(1, 3*mm))

    # Opportunities sub-grid
    story.append(Paragraph(
        'OPPORTUNITIES TO STRENGTHEN RETENTION',
        ParagraphStyle('oplabel',
            fontName='Helvetica-Bold', fontSize=8,
            textColor=MUTED, spaceAfter=8)))

    opps = [
        ('Monthly compliance score email',
         '"Your venue scored 98% this month." Creates a feedback loop owners would miss if they cancelled.'),
        ('Year-over-year EHO readiness trend',
         '"You\'re more compliant than 6 months ago" validates the subscription cost every renewal cycle.'),
        ('Staff-side value',
         'If staff love shift swaps and time-off, they become internal advocates who resist a switch.'),
        ('QR allergen page as referral engine',
         'Add a subtle "Get this for your venue" CTA on every public allergen page.'),
    ]
    ohalf = (aw - 5) / 2
    def make_opp(t, b):
        return [Paragraph(t, S['opp_title']), Paragraph(b, S['opp_body'])]

    opp_data = [
        [make_opp(*opps[0]), make_opp(*opps[1])],
        [make_opp(*opps[2]), make_opp(*opps[3])],
    ]
    ot = Table(opp_data, colWidths=[ohalf, ohalf])
    ot.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT),
        ('BOX', (0, 0), (0, 0), 0.5, BORDER),
        ('BOX', (1, 0), (1, 0), 0.5, BORDER),
        ('BOX', (0, 1), (0, 1), 0.5, BORDER),
        ('BOX', (1, 1), (1, 1), 0.5, BORDER),
        ('LINEBEFORE', (0, 0), (0, -1), 3, AMBER),
        ('LINEBEFORE', (1, 0), (1, -1), 3, AMBER),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(ot)
    story.append(Spacer(1, 7*mm))

    # ── PULL QUOTE ───────────────────────────────────────
    pq_content = [[
        Paragraph(
            '<b><font color="#f59e0b">Sell on fear</font></b> (EHO inspection)  →  '
            '<b><font color="#f59e0b">Onboard on simplicity</font></b> (15-min setup, no app store)  →  '
            '<b><font color="#f59e0b">Retain on daily habit + data gravity.</font></b>',
            S['pullquote']),
        Spacer(1, 6),
        Paragraph('Pelikn Strategic Summary  ·  May 2026', S['attr']),
    ]]
    pqt = Table([[pq_content]], colWidths=[aw])
    pqt.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), NAVY),
        ('ROUNDEDCORNERS', [10, 10, 10, 10]),
        ('TOPPADDING', (0, 0), (-1, -1), 18),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 18),
        ('LEFTPADDING', (0, 0), (-1, -1), 20),
        ('RIGHTPADDING', (0, 0), (-1, -1), 20),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ]))
    story.append(pqt)

    doc.build(story)
    print(f'PDF saved to {path}')

build()
