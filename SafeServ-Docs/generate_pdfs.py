#!/usr/bin/env python3
"""Generate SafeServ business PDFs: GTM Plan, Competitor Analysis, Feature Guide."""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable,
)
from reportlab.lib import colors

# ── Brand colours ──────────────────────────────────────────────────────────
CHARCOAL = HexColor("#2D2D2D")
CREAM    = HexColor("#FAF8F5")
ACCENT   = HexColor("#6B8F71")
WARM     = HexColor("#C4956A")
DANGER   = HexColor("#C0392B")
LIGHT_BG = HexColor("#F5F3F0")
MID_GREY = HexColor("#888888")
LIGHT_LINE = HexColor("#E0DDD8")

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ── Styles ─────────────────────────────────────────────────────────────────
def make_styles():
    s = {}
    s['title'] = ParagraphStyle('Title', fontName='Helvetica-Bold', fontSize=28, leading=34,
                                 textColor=CHARCOAL, alignment=TA_LEFT, spaceAfter=4*mm)
    s['subtitle'] = ParagraphStyle('Subtitle', fontName='Helvetica', fontSize=12, leading=16,
                                    textColor=MID_GREY, spaceAfter=10*mm)
    s['h1'] = ParagraphStyle('H1', fontName='Helvetica-Bold', fontSize=18, leading=24,
                              textColor=CHARCOAL, spaceBefore=10*mm, spaceAfter=4*mm)
    s['h2'] = ParagraphStyle('H2', fontName='Helvetica-Bold', fontSize=13, leading=17,
                              textColor=CHARCOAL, spaceBefore=6*mm, spaceAfter=3*mm)
    s['h3'] = ParagraphStyle('H3', fontName='Helvetica-Bold', fontSize=11, leading=14,
                              textColor=ACCENT, spaceBefore=4*mm, spaceAfter=2*mm)
    s['body'] = ParagraphStyle('Body', fontName='Helvetica', fontSize=10, leading=15,
                                textColor=CHARCOAL, alignment=TA_JUSTIFY, spaceAfter=3*mm)
    s['bullet'] = ParagraphStyle('Bullet', fontName='Helvetica', fontSize=10, leading=15,
                                  textColor=CHARCOAL, leftIndent=12*mm, bulletIndent=5*mm,
                                  spaceAfter=1.5*mm)
    s['small'] = ParagraphStyle('Small', fontName='Helvetica', fontSize=8, leading=11,
                                 textColor=MID_GREY)
    s['table_header'] = ParagraphStyle('TH', fontName='Helvetica-Bold', fontSize=9, leading=12,
                                        textColor=white)
    s['table_cell'] = ParagraphStyle('TC', fontName='Helvetica', fontSize=9, leading=12,
                                      textColor=CHARCOAL)
    s['table_cell_bold'] = ParagraphStyle('TCB', fontName='Helvetica-Bold', fontSize=9, leading=12,
                                           textColor=CHARCOAL)
    s['highlight'] = ParagraphStyle('Highlight', fontName='Helvetica', fontSize=10, leading=15,
                                     textColor=CHARCOAL, backColor=LIGHT_BG,
                                     borderPadding=(6, 8, 6, 8), spaceAfter=4*mm)
    return s

def header_footer(canvas, doc, title_text):
    canvas.saveState()
    # Header line
    canvas.setStrokeColor(LIGHT_LINE)
    canvas.setLineWidth(0.5)
    canvas.line(20*mm, A4[1] - 15*mm, A4[0] - 20*mm, A4[1] - 15*mm)
    # Header text
    canvas.setFont('Helvetica-Bold', 8)
    canvas.setFillColor(ACCENT)
    canvas.drawString(20*mm, A4[1] - 13*mm, "SafeServ")
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(MID_GREY)
    canvas.drawRightString(A4[0] - 20*mm, A4[1] - 13*mm, title_text)
    # Footer
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(MID_GREY)
    canvas.drawString(20*mm, 12*mm, "SafeServ | Confidential")
    canvas.drawRightString(A4[0] - 20*mm, 12*mm, f"Page {doc.page}")
    canvas.restoreState()

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=LIGHT_LINE, spaceAfter=4*mm, spaceBefore=2*mm)

def bullet(text, styles):
    return Paragraph(f"<bullet>&bull;</bullet> {text}", styles['bullet'])

def make_table(headers, rows, col_widths, styles):
    """Create a styled table."""
    data = [[Paragraph(h, styles['table_header']) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), styles['table_cell']) for c in row])

    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), CHARCOAL),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, LIGHT_BG]),
        ('GRID', (0, 0), (-1, -1), 0.4, LIGHT_LINE),
    ]))
    return t


# ════════════════════════════════════════════════════════════════════════════
# 1. GTM PLAN
# ════════════════════════════════════════════════════════════════════════════
def build_gtm():
    path = os.path.join(OUTPUT_DIR, "GTM_Plan.pdf")
    doc = SimpleDocTemplate(path, pagesize=A4,
                            leftMargin=20*mm, rightMargin=20*mm,
                            topMargin=22*mm, bottomMargin=20*mm)
    S = make_styles()
    story = []

    # Cover
    story.append(Spacer(1, 30*mm))
    story.append(Paragraph("SafeServ", S['title']))
    story.append(Paragraph("Go-To-Market Plan 2026", ParagraphStyle('CoverSub', fontName='Helvetica',
                            fontSize=16, leading=20, textColor=ACCENT, spaceAfter=8*mm)))
    story.append(hr())
    story.append(Paragraph("The all-in-one food safety and operations platform for UK hospitality.", S['body']))
    story.append(Paragraph("Prepared March 2026 | Confidential", S['small']))
    story.append(PageBreak())

    # Executive Summary
    story.append(Paragraph("Executive Summary", S['h1']))
    story.append(Paragraph(
        "SafeServ is a modern, mobile-first food safety and operations management platform built specifically for "
        "UK cafes, restaurants, and quick-service restaurants (QSRs). It replaces fragmented paper-based compliance "
        "systems and disconnected staff tools with a single app that handles everything from HACCP temperature logs "
        "to staff rota management.", S['body']))
    story.append(Paragraph(
        "The UK food hygiene compliance software market is growing rapidly, driven by tightening enforcement from "
        "Environmental Health Officers (EHOs), rising insurance requirements, and operators' desire to digitise. "
        "SafeServ enters this market with key differentiators: a venue-level pricing model (not per-user), "
        "PIN-based authentication that eliminates friction for shift workers, OCR-powered delivery scanning, "
        "full offline capability, and a genuinely modern interface.", S['body']))
    story.append(hr())

    # Target Market
    story.append(Paragraph("Target Market", S['h1']))
    story.append(Paragraph("Primary Segment: Independent Cafes and Small Restaurant Groups (1-10 sites)", S['h2']))
    story.append(bullet("Approximately 95,000 cafes and 45,000 restaurants in the UK", S))
    story.append(bullet("Majority still use paper-based food safety records and manual processes", S))
    story.append(bullet("Price-sensitive operators who need value for money", S))
    story.append(bullet("Staff turnover is high, making ease of onboarding critical", S))

    story.append(Paragraph("Secondary Segment: Quick-Service Restaurants and Small Chains", S['h2']))
    story.append(bullet("Multi-site operators needing consistency across locations", S))
    story.append(bullet("Higher compliance burden due to volume and EHO scrutiny", S))
    story.append(bullet("Already digitally aware but frustrated with expensive, clunky incumbent tools", S))

    story.append(Paragraph("Market Sizing", S['h2']))
    story.append(make_table(
        ["Metric", "Value"],
        [
            ["Total addressable market (UK food businesses)", "~500,000"],
            ["Serviceable addressable market (cafes, restaurants, QSRs)", "~200,000"],
            ["Serviceable obtainable market (Year 1 target)", "200-500 venues"],
            ["Average revenue per venue", "GBP 50-80/month"],
            ["Year 1 ARR target", "GBP 120,000-480,000"],
        ],
        [85*mm, 85*mm], S
    ))
    story.append(hr())

    # Pricing
    story.append(Paragraph("Pricing Strategy", S['h1']))
    story.append(Paragraph(
        "SafeServ uses a per-venue flat-rate model, not per-user licensing. This is a major differentiator: "
        "competitors like Trail and Checkit charge per user, which punishes larger teams and creates friction "
        "around who gets access. SafeServ's model means every staff member can use the app at no extra cost.", S['body']))

    story.append(make_table(
        ["Tier", "Price/Month", "Includes"],
        [
            ["Starter", "GBP 39/month", "All compliance features, up to 15 staff, 1 venue"],
            ["Professional", "GBP 59/month", "Everything + rota, timesheets, OCR scanning, priority support"],
            ["Multi-Site", "GBP 49/venue/month", "All features, centralised reporting, 3+ venues"],
        ],
        [30*mm, 35*mm, 105*mm], S
    ))
    story.append(Spacer(1, 3*mm))
    story.append(bullet("14-day free trial, no credit card required", S))
    story.append(bullet("Annual billing discount: 2 months free (pay for 10, get 12)", S))
    story.append(bullet("Onboarding and data migration included at no extra charge", S))
    story.append(hr())

    # Distribution
    story.append(Paragraph("Distribution Channels", S['h1']))

    story.append(Paragraph("Direct Sales", S['h2']))
    story.append(bullet("Founder-led sales to local cafes in Northern Ireland and Republic of Ireland initially", S))
    story.append(bullet("In-person demos and onboarding at the venue during quiet hours", S))
    story.append(bullet("Referral incentive: 1 month free for both referrer and new customer", S))

    story.append(Paragraph("Digital Marketing", S['h2']))
    story.append(bullet("SEO targeting: 'food safety app UK', 'HACCP digital records', 'EHO audit software'", S))
    story.append(bullet("Content marketing: blog posts on EHO preparation, HACCP compliance tips", S))
    story.append(bullet("Social media targeting cafe owners on Instagram and LinkedIn", S))

    story.append(Paragraph("Partnerships", S['h2']))
    story.append(bullet("Food safety consultants who advise cafes on compliance", S))
    story.append(bullet("Wholesale suppliers (e.g. Henderson's, Musgrave) as a value-add for their customers", S))
    story.append(bullet("EHO-friendly positioning: share anonymised compliance data to build trust", S))
    story.append(PageBreak())

    # Launch Phases
    story.append(Paragraph("Launch Phases", S['h1']))

    phases = [
        ("Phase 1: Pilot (Months 1-2)", [
            "Deploy with 1-3 cafes in Belfast for real-world testing",
            "Daily feedback loop with pilot users; iterate rapidly",
            "Focus on reliability, offline performance, and core compliance workflows",
            "Goal: validated product, 3 reference customers, video testimonials",
        ]),
        ("Phase 2: Local Launch (Months 3-6)", [
            "Expand to 20-50 venues across Northern Ireland",
            "Founder-led sales: attend hospitality meetups, visit cafes in person",
            "Launch website, begin SEO and content marketing",
            "Hire first part-time support person",
            "Goal: GBP 2,000+ MRR, <5% monthly churn",
        ]),
        ("Phase 3: UK Expansion (Months 6-12)", [
            "Expand to major UK cities: London, Manchester, Edinburgh, Birmingham",
            "Launch self-serve sign-up with automated onboarding",
            "Partner with 2-3 food safety consultancies for channel distribution",
            "Introduce multi-site tier for small chains",
            "Goal: 200+ venues, GBP 10,000+ MRR",
        ]),
        ("Phase 4: Scale (Year 2)", [
            "Build integrations (Xero, accounting, POS systems)",
            "Launch API for enterprise customers",
            "Explore international markets (Ireland, EU English-speaking)",
            "Goal: 1,000+ venues, GBP 50,000+ MRR, raise seed round if needed",
        ]),
    ]

    for phase_title, items in phases:
        story.append(Paragraph(phase_title, S['h2']))
        for item in items:
            story.append(bullet(item, S))

    story.append(hr())

    # Key Metrics
    story.append(Paragraph("Key Metrics and KPIs", S['h1']))
    story.append(make_table(
        ["Metric", "Target (Year 1)", "How We Measure"],
        [
            ["Monthly Recurring Revenue", "GBP 10,000+", "Stripe dashboard"],
            ["Active Venues", "200+", "Supabase venue count"],
            ["Monthly Churn Rate", "<5%", "Cancelled subscriptions / total"],
            ["Daily Active Users", "60%+ of registered staff", "App analytics"],
            ["NPS Score", "50+", "Quarterly survey"],
            ["Time to First Value", "<15 minutes", "Onboarding completion tracking"],
            ["Support Response Time", "<2 hours", "Help desk metrics"],
            ["EHO Audit Pass Rate", "95%+ for SafeServ venues", "Customer feedback"],
        ],
        [45*mm, 40*mm, 85*mm], S
    ))

    story.append(Spacer(1, 8*mm))
    story.append(Paragraph(
        "SafeServ's go-to-market strategy is deliberately lean and founder-led in the early stages. "
        "The product sells itself once cafe owners see the EHO Audit Trail and realise they can be "
        "inspection-ready in minutes rather than hours. Our job is to get SafeServ in front of enough "
        "operators and let the product do the talking.", S['body']))

    doc.build(story, onFirstPage=lambda c, d: header_footer(c, d, "Go-To-Market Plan"),
              onLaterPages=lambda c, d: header_footer(c, d, "Go-To-Market Plan"))
    print(f"  Created: {path}")


# ════════════════════════════════════════════════════════════════════════════
# 2. COMPETITOR ANALYSIS
# ════════════════════════════════════════════════════════════════════════════
def build_competitor():
    path = os.path.join(OUTPUT_DIR, "Competitor_Analysis.pdf")
    doc = SimpleDocTemplate(path, pagesize=A4,
                            leftMargin=20*mm, rightMargin=20*mm,
                            topMargin=22*mm, bottomMargin=20*mm)
    S = make_styles()
    story = []

    # Cover
    story.append(Spacer(1, 30*mm))
    story.append(Paragraph("SafeServ", S['title']))
    story.append(Paragraph("Competitive Analysis", ParagraphStyle('CoverSub', fontName='Helvetica',
                            fontSize=16, leading=20, textColor=ACCENT, spaceAfter=8*mm)))
    story.append(hr())
    story.append(Paragraph(
        "How SafeServ compares to existing food safety and operations platforms in the UK market.", S['body']))
    story.append(Paragraph("Prepared March 2026 | Confidential", S['small']))
    story.append(PageBreak())

    # Market Overview
    story.append(Paragraph("Market Overview", S['h1']))
    story.append(Paragraph(
        "The UK food safety compliance software market is served by several established players, most of which "
        "were built for enterprise chains and have trickled down to smaller operators. This creates a gap: "
        "the tools are either too expensive, too complex, or too limited for independent cafes and small groups. "
        "SafeServ is purpose-built for this underserved segment.", S['body']))
    story.append(hr())

    # Competitor Profiles
    story.append(Paragraph("Competitor Profiles", S['h1']))

    competitors = [
        ("Trail", "Digital checklists and task management for hospitality",
         ["Strong brand recognition in UK hospitality",
          "Good checklist/task workflow",
          "Integrations with some POS systems"],
         ["Per-user pricing makes it expensive for larger teams",
          "No built-in rota or staff scheduling",
          "No OCR/delivery scanning capability",
          "Limited offline functionality",
          "No fridge temperature logging built in"]),

        ("Navitas Safety", "Food safety compliance and HACCP management",
         ["Strong HACCP focus and compliance expertise",
          "Good reporting and audit trail",
          "Established in enterprise food manufacturing"],
         ["Enterprise-focused, complex for small cafes",
          "High price point, typically requires annual contracts",
          "Dated user interface",
          "No staff operations features (rota, timesheets)",
          "Per-user licensing model"]),

        ("Food Alert", "Food safety management and EHO audit preparation",
         ["Dedicated EHO preparation tools",
          "Good template library for UK compliance",
          "Phone-based customer support"],
         ["Primarily document management, not operational",
          "No real-time temperature monitoring integration",
          "No staff scheduling or operational features",
          "Interface feels dated compared to modern apps",
          "No offline capability"]),

        ("Checkit", "IoT temperature monitoring and compliance platform",
         ["Excellent automated temperature monitoring via IoT sensors",
          "Real-time alerts for temperature excursions",
          "Strong enterprise customer base"],
         ["Requires hardware investment (IoT sensors)",
          "Very expensive for small operators",
          "Per-device and per-user pricing",
          "No staff management features",
          "Overkill for a single cafe with 2-3 fridges"]),

        ("Comply2Serve / iAuditor (SafetyCulture)", "General inspection and audit platform",
         ["Flexible inspection template builder",
          "Large template marketplace",
          "Cross-industry applicability"],
         ["Generic platform, not food-safety specific",
          "Requires significant configuration for HACCP use",
          "No built-in temperature logging workflow",
          "No staff operations features",
          "Per-user pricing, expensive at scale"]),
    ]

    for name, desc, strengths, weaknesses in competitors:
        story.append(Paragraph(name, S['h2']))
        story.append(Paragraph(f"<i>{desc}</i>", S['body']))
        story.append(Paragraph("Strengths:", S['h3']))
        for s in strengths:
            story.append(bullet(s, S))
        story.append(Paragraph("Weaknesses:", S['h3']))
        for w in weaknesses:
            story.append(bullet(w, S))
        story.append(hr())

    story.append(PageBreak())

    # Feature Comparison
    story.append(Paragraph("Feature Comparison Matrix", S['h1']))
    story.append(Paragraph(
        "The following table compares core capabilities across SafeServ and key competitors.", S['body']))

    feat_data = [
        ["Fridge Temperature Logging",     "Yes",     "No",    "Yes",      "Yes (IoT)", "No"],
        ["Cleaning Schedules",              "Yes",     "Yes",   "Limited",  "No",        "Yes"],
        ["Delivery Checks + OCR Scan",      "Yes",     "No",    "No",       "No",        "No"],
        ["Probe Calibration Records",       "Yes",     "No",    "No",       "Yes",       "No"],
        ["Corrective Actions Log",          "Yes",     "Yes",   "Yes",      "Yes",       "Yes"],
        ["Allergen Registry",               "Yes",     "No",    "Limited",  "No",        "No"],
        ["EHO Audit Trail + Export",        "Yes",     "No",    "Yes",      "Yes",       "Limited"],
        ["Staff Rota / Scheduling",         "Yes",     "No",    "No",       "No",        "No"],
        ["Timesheets / Clock In-Out",       "Yes",     "No",    "No",       "No",        "No"],
        ["Staff Training Tracker",          "Yes",     "No",    "Limited",  "No",        "No"],
        ["Time-Off Requests",               "Yes",     "No",    "No",       "No",        "No"],
        ["Shift Swap Requests",             "Yes",     "No",    "No",       "No",        "No"],
        ["Offline Mode",                    "Yes",     "No",    "No",       "No",        "Limited"],
        ["PIN-Based Auth (No Logins)",      "Yes",     "No",    "No",       "No",        "No"],
        ["Per-Venue Pricing",               "Yes",     "No",    "No",       "No",        "No"],
        ["Real-Time Notifications",         "Yes",     "Yes",   "Limited",  "Yes",       "Yes"],
        ["Opening/Closing Checklists",      "Yes",     "Yes",   "Yes",      "No",        "Yes"],
        ["CSV Data Export",                 "Yes",     "Yes",   "Yes",      "Yes",       "Yes"],
        ["Skills-Based Scheduling",          "Yes",     "No",    "No",       "No",        "No"],
        ["AI Rota Builder",                 "Yes",     "No",    "No",       "No",        "No"],
        ["Break Cover Management",          "Yes",     "No",    "No",       "No",        "No"],
        ["Modern Mobile-First UI",          "Yes",     "Yes",   "No",       "No",        "Partial"],
        ["PWA (No App Store Required)",     "Yes",     "No",    "No",       "No",        "No"],
    ]

    hdr = ["Feature", "SafeServ", "Trail", "Food Alert", "Checkit", "iAuditor"]
    col_w = [52*mm, 22*mm, 18*mm, 24*mm, 22*mm, 22*mm]

    data = [[Paragraph(h, S['table_header']) for h in hdr]]
    for row in feat_data:
        cells = []
        for j, c in enumerate(row):
            if j == 0:
                cells.append(Paragraph(c, S['table_cell']))
            elif c == "Yes":
                cells.append(Paragraph(f"<font color='#6B8F71'><b>{c}</b></font>", S['table_cell']))
            elif c == "No":
                cells.append(Paragraph(f"<font color='#C0392B'>{c}</font>", S['table_cell']))
            else:
                cells.append(Paragraph(f"<font color='#C4956A'>{c}</font>", S['table_cell']))
        data.append(cells)

    t = Table(data, colWidths=col_w, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), CHARCOAL),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, LIGHT_BG]),
        ('GRID', (0, 0), (-1, -1), 0.3, LIGHT_LINE),
        # Highlight SafeServ column
        ('BACKGROUND', (1, 1), (1, -1), HexColor("#F0F7F1")),
    ]))
    story.append(t)
    story.append(PageBreak())

    # SafeServ Advantages
    story.append(Paragraph("SafeServ's Key Advantages", S['h1']))

    advantages = [
        ("All-in-One Platform",
         "SafeServ is the only product that combines full food safety compliance (HACCP temps, cleaning, "
         "deliveries, probe calibration, corrective actions, allergens, training) with complete staff operations "
         "(rota, timesheets, shift swaps, time-off). Competitors force venues to buy and manage multiple separate tools."),

        ("Per-Venue Pricing, Not Per-User",
         "Every competitor charges per user, which means cafe owners either limit who can access the system or "
         "pay significantly more as they add staff. SafeServ charges a flat rate per venue, so every single "
         "staff member can log temps, complete checklists, and check the rota at no additional cost."),

        ("PIN-Based Authentication",
         "Cafe staff do not have individual email addresses or want to manage passwords. SafeServ uses a simple "
         "4-digit PIN system with no email required. Staff tap their name, enter their PIN, and they are in. "
         "This eliminates the single biggest barrier to adoption in hospitality: login friction."),

        ("OCR Delivery Scanning",
         "SafeServ is the only platform that lets staff photograph a delivery docket and automatically extract "
         "line items using OCR. Items are categorised once (chilled, frozen, ambient) and remembered for future "
         "deliveries from the same supplier. This turns a 10-minute manual process into a 30-second scan."),

        ("Full Offline Support",
         "Kitchens have poor Wi-Fi. Walk-in fridges have no signal. SafeServ works completely offline, queuing "
         "all data and syncing automatically when the connection returns. Most competitors fail silently when "
         "offline, losing critical compliance data."),

        ("Modern, Mobile-First Interface",
         "SafeServ is built as a Progressive Web App with a clean, modern UI designed for phone screens. "
         "It looks and feels like a consumer app, not enterprise software from 2015. This matters for adoption: "
         "staff actually want to use it."),

        ("EHO Audit Trail",
         "SafeServ's EHO Audit page gives managers a single view of their entire compliance posture with "
         "traffic-light status indicators and one-click CSV export of all records. When an EHO walks in, "
         "the manager can pull up everything they need in seconds."),

        ("AI-Powered Rota Builder with Skills Matching",
         "SafeServ includes a constraint-based AI rota builder that automatically generates optimal weekly schedules. "
         "Managers set minimum staffing levels, required roles, and required skills (e.g. Barista, Till) per day, "
         "and the builder assigns staff based on their skills, availability, contracted hours, and fairness balancing. "
         "No competitor offers intelligent scheduling with skill matching for the cafe market."),

        ("Break Cover Management",
         "SafeServ supports a three-state availability system: available, unavailable, and break cover. Managers "
         "can mark staff who are willing to come in for short lunchtime shifts to cover breaks. The AI rota builder "
         "automatically assigns break cover staff to 11:00-14:00 shifts, solving a common scheduling pain point "
         "that no other platform addresses."),

        ("Instant Deployment",
         "SafeServ is a PWA that requires no app store download. Managers share a URL, staff add it to their "
         "home screen, and they are ready to go. No IT department needed, no MDM, no app store approval delays."),
    ]

    for title, desc in advantages:
        story.append(Paragraph(title, S['h2']))
        story.append(Paragraph(desc, S['body']))

    story.append(hr())

    # Pricing Comparison
    story.append(Paragraph("Pricing Comparison", S['h1']))
    story.append(Paragraph(
        "Estimated monthly cost for a typical cafe with 12 staff members:", S['body']))

    story.append(make_table(
        ["Platform", "Pricing Model", "Est. Monthly Cost (12 staff)", "Notes"],
        [
            ["SafeServ", "Per venue", "GBP 59", "All features, unlimited users"],
            ["Trail", "Per user", "GBP 120-180", "Limited to checklists, no compliance"],
            ["Checkit", "Per device + user", "GBP 200-400+", "Requires IoT hardware purchase"],
            ["Food Alert", "Per site + modules", "GBP 80-150", "Compliance only, no operations"],
            ["iAuditor", "Per user", "GBP 100-200", "Generic, needs heavy configuration"],
        ],
        [30*mm, 32*mm, 50*mm, 58*mm], S
    ))

    story.append(Spacer(1, 6*mm))
    story.append(Paragraph(
        "SafeServ delivers 2-4x more functionality at 50-80% lower cost than any competitor. "
        "The per-venue model makes costs predictable and eliminates the 'who gets a licence?' conversation.", S['body']))

    doc.build(story, onFirstPage=lambda c, d: header_footer(c, d, "Competitive Analysis"),
              onLaterPages=lambda c, d: header_footer(c, d, "Competitive Analysis"))
    print(f"  Created: {path}")


# ════════════════════════════════════════════════════════════════════════════
# 3. FEATURE GUIDE
# ════════════════════════════════════════════════════════════════════════════
def build_feature_guide():
    path = os.path.join(OUTPUT_DIR, "SafeServ_Feature_Guide.pdf")
    doc = SimpleDocTemplate(path, pagesize=A4,
                            leftMargin=20*mm, rightMargin=20*mm,
                            topMargin=22*mm, bottomMargin=20*mm)
    S = make_styles()
    story = []

    # Cover
    story.append(Spacer(1, 30*mm))
    story.append(Paragraph("SafeServ", S['title']))
    story.append(Paragraph("Complete Feature Guide", ParagraphStyle('CoverSub', fontName='Helvetica',
                            fontSize=16, leading=20, textColor=ACCENT, spaceAfter=8*mm)))
    story.append(hr())
    story.append(Paragraph(
        "A comprehensive guide to every feature in SafeServ, for training and reference.", S['body']))
    story.append(Paragraph("Version 1.0 | March 2026", S['small']))
    story.append(PageBreak())

    # TOC
    story.append(Paragraph("Contents", S['h1']))
    toc_items = [
        "1. Getting Started: PIN Login",
        "2. Manager Dashboard and Widgets",
        "3. Opening and Closing Checklists",
        "4. Fridge Temperature Logging",
        "5. Allergen Registry",
        "6. Cleaning Schedules",
        "7. Delivery Checks with OCR Scanning",
        "8. Probe Calibration",
        "9. Corrective Actions",
        "10. EHO Audit Trail and Data Export",
        "11. Staff Rota and Shift Swaps",
        "12. Timesheets and Hours Tracking",
        "13. Staff Training and Certificates",
        "14. Time-Off Requests",
        "15. Notifications",
        "16. Offline Mode",
        "17. Settings and Venue Configuration",
    ]
    for item in toc_items:
        story.append(Paragraph(item, ParagraphStyle('TOC', fontName='Helvetica', fontSize=10,
                                leading=18, textColor=CHARCOAL, leftIndent=5*mm)))
    story.append(PageBreak())

    # ── Features ───────────────────────────────────────────────────────────
    features = [
        ("1. Getting Started: PIN Login", [
            ("How It Works",
             "SafeServ uses a simple PIN-based login system. There are no email addresses or passwords required. "
             "When the app loads, staff see a list of names. They tap their name and enter their 4-digit PIN."),
            ("Roles",
             "There are three roles: Owner, Manager, and Staff. Owners and Managers have full access to all features "
             "including settings, audit trails, and staff management. Staff members see a simplified view focused on "
             "their daily tasks: their shift, checklists, cleaning tasks, and the rota."),
            ("Security",
             "PINs are hashed using bcrypt before storage. Sessions expire automatically. Managers can reset any "
             "staff member's PIN from the Settings page."),
        ]),

        ("2. Manager Dashboard and Widgets", [
            ("Overview",
             "The Manager Dashboard is a customisable overview of your venue's status. It displays widgets that "
             "each show a real-time summary of a different area: compliance score, fridge alerts, cleaning status, "
             "who is on shift, open corrective actions, and more."),
            ("Customisation",
             "Tap 'Customise' in the top-right corner to open the widget picker. You can add or remove any of the "
             "10 available widgets and reorder them with up/down arrows. Your layout is saved per user, so each "
             "manager can have their own preferred view."),
            ("Available Widgets",
             "Compliance Score, Fridge Status, Cleaning Overdue, Staff On Shift, Open Corrective Actions, "
             "Expiring Training, Today's Deliveries, Weekly Labour Hours, Pending Shift Swaps, Probe Calibration Due."),
        ]),

        ("3. Opening and Closing Checklists", [
            ("Purpose",
             "Opening and closing checklists ensure consistent procedures every day. Managers define the tasks "
             "(e.g., 'Check fire exits', 'Turn on display fridge', 'Cash up till') and staff complete them at "
             "the start or end of each shift."),
            ("Completing a Checklist",
             "Navigate to the Checks page. You will see today's opening and closing tasks. Tap a task to mark "
             "it complete. You can add an optional note if something needs flagging (e.g., 'Back door lock is stiff'). "
             "Managers can see who completed each task and when."),
        ]),

        ("4. Fridge Temperature Logging", [
            ("Why It Matters",
             "UK food safety regulations require fridge and freezer temperatures to be logged at least twice daily "
             "(opening and closing). EHOs will check these records during inspections. Out-of-range temperatures "
             "must be flagged and corrective action taken."),
            ("Logging a Temperature",
             "Go to Temp Logs, select a fridge from the list, and enter the reading from the thermometer display. "
             "The app automatically flags readings outside the fridge's acceptable range (typically 0-5 degrees C for "
             "fridges, -18 degrees C or below for freezers). Add notes if anything is unusual."),
            ("History",
             "The Fridge History page shows all past readings with colour-coded pass/fail status. Managers can "
             "filter by fridge and date range. This data exports to CSV for EHO inspections."),
        ]),

        ("5. Allergen Registry", [
            ("Purpose",
             "UK law (Natasha's Law) requires food businesses to provide full ingredient and allergen information "
             "for pre-packed for direct sale (PPDS) food. SafeServ's allergen registry stores all menu items with "
             "their allergen profiles using the 14 recognised UK allergens."),
            ("Managing Items",
             "Managers can add food items with their name, description, and allergen selections. Each of the 14 "
             "allergens (celery, cereals containing gluten, crustaceans, eggs, fish, lupin, milk, molluscs, mustard, "
             "nuts, peanuts, sesame, soybeans, sulphur dioxide) can be toggled. Staff can search and view allergen "
             "information when customers ask."),
        ]),

        ("6. Cleaning Schedules", [
            ("Setup",
             "Managers create cleaning tasks with a title, description, and frequency (daily, weekly, fortnightly, "
             "monthly, or quarterly). Examples: 'Clean coffee machine' (daily), 'Deep clean walk-in fridge' (weekly), "
             "'Descale dishwasher' (monthly)."),
            ("Completing Tasks",
             "Staff see a list of cleaning tasks with their due status. Overdue tasks are highlighted. Tap a task "
             "to mark it complete with optional notes. The completion is timestamped with who did it and when."),
            ("Monitoring",
             "The manager dashboard widget shows overdue cleaning tasks. The notification bell alerts when tasks "
             "fall behind schedule. The EHO Audit page shows cleaning completion rates."),
        ]),

        ("7. Delivery Checks with OCR Scanning", [
            ("The Problem",
             "Every delivery must be checked for temperature, packaging, and use-by dates. Manually recording "
             "this is tedious and often skipped. SafeServ makes it fast with OCR scanning."),
            ("How to Use",
             "When a delivery arrives: (1) Select the supplier or add a new one. (2) Take a photo of the delivery "
             "docket. SafeServ's OCR engine reads the docket and extracts line items automatically. (3) Categorise "
             "items as chilled, frozen, ambient, or dry (only needed the first time per supplier). (4) Enter "
             "temperature readings for chilled/frozen items. (5) Confirm packaging and use-by checks. (6) Submit."),
            ("Smart Memory",
             "SafeServ remembers each supplier's item categories. After the first delivery, future deliveries from "
             "the same supplier auto-populate the checklist. This turns a 10-minute process into 30 seconds."),
        ]),

        ("8. Probe Calibration", [
            ("Why Calibrate",
             "Thermometer probes drift over time. UK food safety guidance recommends calibrating probes at least "
             "monthly using the ice water method (0 degrees C) or boiling water method (100 degrees C)."),
            ("Recording a Calibration",
             "Go to Probe Cal., select or name your probe, choose the method (ice or boiling water), enter the "
             "actual reading from the probe. SafeServ automatically calculates the deviation and whether it passes "
             "within the acceptable tolerance. A live preview shows the result as you type."),
            ("Records",
             "All calibration records are stored with date, probe name, method, expected vs actual reading, and "
             "pass/fail status. These are exportable to CSV and included in the EHO Audit Trail."),
        ]),

        ("9. Corrective Actions", [
            ("Purpose",
             "When something goes wrong (a temperature excursion, a cleaning failure, a pest sighting), it must "
             "be documented along with the corrective action taken. This is a core HACCP requirement."),
            ("Logging an Issue",
             "Go to Actions, tap 'Report Issue'. Enter a title, select a category (temperature, cleaning, delivery, "
             "pest, equipment, food safety, staff, other), set the severity (minor, major, critical), and describe "
             "what happened and what action was taken."),
            ("Resolution",
             "Open issues appear in the list with colour-coded severity badges. Managers can mark issues as resolved "
             "with notes on the resolution. Critical open issues trigger notifications and affect the compliance score."),
        ]),

        ("10. EHO Audit Trail and Data Export", [
            ("The Audit Page",
             "The EHO Audit Trail is a read-only dashboard that pulls together all compliance data into one view. "
             "It is designed to be shown directly to an Environmental Health Officer during an inspection."),
            ("What It Shows",
             "Six compliance sections, each with a traffic-light status (green/amber/red): Temperature Monitoring "
             "(pass rate, failed readings), Cleaning Schedule (active tasks, completion count), Delivery Checks "
             "(checks performed, failures), Probe Calibration (calibrations, failures, last date), Corrective Actions "
             "(total, open, critical open), Staff Training (valid certs, expired certs)."),
            ("Data Export",
             "Each section has a CSV export button. There is also a 'Download All Reports' button that exports "
             "everything at once. The date range can be set to 7, 30, or 90 days. All exports include timestamps, "
             "who performed the action, and relevant details."),
        ]),

        ("11. Staff Rota and Shift Swaps", [
            ("Building the Rota",
             "Managers build the weekly rota by assigning shifts to staff. Each shift has a date, start time, "
             "end time, and optional role label (e.g., 'Barista', 'Floor'). The rota view supports 1 to 4 weeks "
             "at a time, making it easy to plan ahead."),
            ("Staff View",
             "Staff see the full rota and can identify their own shifts. They can also see who else is working "
             "each day, making it easy to arrange informal swaps."),
            ("Shift Swaps",
             "Staff can request a shift swap directly in the app. They select the shift they want to swap and "
             "choose a colleague to swap with. The request goes to the manager for approval. Managers see pending "
             "swap requests in the notification bell and in the Rota page."),
        ]),

        ("12. Timesheets and Hours Tracking", [
            ("Clock In / Clock Out",
             "Staff clock in and out from the My Shift page on the dashboard. The app records the exact time "
             "and calculates hours worked automatically."),
            ("Manager View",
             "The Hours page (manager only) shows a summary of all staff hours for the selected week. Managers "
             "can see who clocked in late, total hours per person, and compare actual hours against scheduled shifts."),
        ]),

        ("13. Staff Training and Certificates", [
            ("Tracking Certificates",
             "Managers add training records for each staff member: title (e.g., 'Level 2 Food Hygiene'), "
             "category, issue date, expiry date, and optional notes. Files can be uploaded to store digital "
             "copies of certificates."),
            ("Expiry Monitoring",
             "SafeServ automatically tracks expiry dates. Expired certificates are flagged as critical notifications. "
             "Certificates expiring within 30 days show as warnings. The EHO Audit page shows the overall "
             "training status. EHOs commonly check that all food handlers have valid food hygiene certificates."),
        ]),

        ("14. Time-Off Requests", [
            ("Requesting Time Off",
             "Staff go to the Time Off page and tap 'Request'. They select start and end dates and enter an "
             "optional reason (e.g., 'Holiday', 'Dentist appointment'). The request is submitted as 'pending'."),
            ("Calendar View",
             "The calendar shows all time-off across the team. Pending requests appear in orange, approved "
             "requests in green, and rejected requests in red. Tapping any day shows the detail of who is off. "
             "This makes it easy to see coverage gaps before approving new requests."),
            ("Manager Approval",
             "Managers see pending requests in a dedicated panel below the calendar. They can approve or reject "
             "each request with an optional note. Approval sends a notification. The notification bell shows "
             "how many requests are awaiting review."),
        ]),

        ("15. Notifications", [
            ("How They Work",
             "The notification bell in the header shows a red badge with the count of active alerts. Tapping it "
             "opens a dropdown with all current notifications, sorted by severity (critical first)."),
            ("What Gets Flagged",
             "Fridge temperatures out of range (critical), unchecked fridges after 10am (warning), expired training "
             "certificates (critical), certificates expiring within 30 days (warning), overdue cleaning tasks (warning "
             "or critical if 3+), open critical corrective actions (critical), open major actions (warning), "
             "probe calibration overdue for 30+ days (warning), pending shift swap requests (warning), "
             "pending time-off requests (warning), late clock-ins today (warning), incomplete tasks from yesterday (warning)."),
        ]),

        ("16. Offline Mode", [
            ("How It Works",
             "SafeServ is a Progressive Web App (PWA) that caches all pages and assets locally. When the device "
             "loses internet connection (common in kitchens and walk-in fridges), the app continues to work normally."),
            ("Data Queuing",
             "Any data entered while offline (temperature logs, cleaning completions, etc.) is stored in a local "
             "queue. When the connection returns, SafeServ automatically syncs all queued records to the server."),
            ("Visual Indicators",
             "A red banner shows 'You are offline' when disconnected. An amber banner shows the count of pending "
             "offline records. Staff can also manually trigger a sync by tapping the banner."),
        ]),

        ("17. Settings and Venue Configuration", [
            ("What Managers Can Configure",
             "The Settings page (manager only) allows configuration of: staff members (add, edit, deactivate, "
             "reset PINs), fridges (add, set temperature ranges, deactivate), venue name and logo, app preferences."),
            ("Staff Management",
             "Add new staff with a name, role (owner/manager/staff), and PIN. Deactivate staff who leave rather "
             "than deleting them, to preserve historical records. Managers can toggle which features staff see "
             "(e.g., show/hide allergen registry or temperature logs for specific staff)."),
        ]),
    ]

    for title, sections in features:
        story.append(Paragraph(title, S['h1']))
        for sub_title, content in sections:
            story.append(Paragraph(sub_title, S['h2']))
            story.append(Paragraph(content, S['body']))
        story.append(hr())
        story.append(PageBreak())

    # Quick Reference
    story.append(Paragraph("Quick Reference: Daily Workflow", S['h1']))
    story.append(Paragraph("A typical day using SafeServ:", S['body']))

    workflow = [
        ("Opening", [
            "Log in with your PIN",
            "Complete opening checklist (Checks page)",
            "Log opening fridge temperatures (Temp Logs)",
            "Check the rota for today's team (Rota page)",
        ]),
        ("During Service", [
            "Check in deliveries using OCR scan (Deliveries)",
            "Complete cleaning tasks as they come due (Cleaning)",
            "Log any issues via Corrective Actions if needed",
            "Check allergen information for customer queries (Allergens)",
        ]),
        ("Closing", [
            "Log closing fridge temperatures",
            "Complete closing checklist",
            "Clock out",
            "Review dashboard for any outstanding items (Managers)",
        ]),
    ]

    for period, tasks in workflow:
        story.append(Paragraph(period, S['h2']))
        for t in tasks:
            story.append(bullet(t, S))

    story.append(Spacer(1, 8*mm))
    story.append(hr())
    story.append(Paragraph(
        "For support or questions, contact the SafeServ team. This guide covers all features as of "
        "Version 1.0 (March 2026).", S['body']))

    doc.build(story, onFirstPage=lambda c, d: header_footer(c, d, "Feature Guide"),
              onLaterPages=lambda c, d: header_footer(c, d, "Feature Guide"))
    print(f"  Created: {path}")


# ── Main ───────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("Generating SafeServ PDFs...")
    build_gtm()
    build_competitor()
    build_feature_guide()
    print("Done!")
