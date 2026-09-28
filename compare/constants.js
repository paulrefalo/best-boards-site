/**
 * WSJ Best Boards 2026 — Board Comparison Dashboard
 * React constants: pillar/indicator definitions, colors, and "what's measured" copy.
 * Pillar keys and indicator keys MUST match boards_dashboard_data.json exactly.
 */

const { useState, useEffect, useMemo, useRef } = React;

// Company comparison colors — colorblind-safe palette (Wong 2011). Cycles if >7 companies selected.
const COMPANY_COLORS = [
    '#0072B2', // Deep blue
    '#D55E00', // Vermillion
    '#009E73', // Blue-green
    '#E69F00', // Amber
    '#56B4E9', // Sky blue
    '#0A2239', // Navy
    '#9B7A2F', // Dark gold
];

const BASELINE_COLOR = '#697380'; // Slate

// Pillar definitions matching the data structure.
// Keys match the JSON pillar_scores keys exactly — no mapping needed.
const PILLAR_ELEMENTS = {
    'Knowledge & Experience': {
        name: 'Knowledge & Experience',
        elements: {
            'AI & Technology': { name: 'AI & Technology', description: 'Density of directors with AI and technology expertise' },
            'Executive Leadership': { name: 'Executive Leadership', description: 'Density of directors with CEO/CFO or senior operating experience' },
            'Innovation': { name: 'Innovation', description: 'Density of directors with innovation, R&D or product backgrounds' },
            'International': { name: 'International', description: 'Density of directors with global or cross-border experience' },
            'Regulatory & Legal': { name: 'Regulatory & Legal', description: 'Density of directors with regulatory, legal or compliance expertise' },
            'Financial Expertise': { name: 'Financial Expertise', description: 'Density of directors with financial, accounting or investing expertise' }
        }
    },
    'Group Dynamics': {
        name: 'Group Dynamics',
        elements: {
            'Investor Deference': { name: 'Investor Deference', description: 'Degree to which the board is grounded and non-deferential (investor trust signal)' },
            'Board Dissimilarity': { name: 'Board Dissimilarity', description: 'How un-alike directors are to one another — less similarity guards against an echo chamber' },
            'Sector Sweet-Spot': { name: 'Sector Sweet-Spot', description: 'Share of directors with sector expertise sits in the credible-but-not-insular sweet spot' }
        }
    },
    'Governance & Risk': {
        name: 'Governance & Risk',
        elements: {
            'Board Governance': { name: 'Board Governance', description: 'Board-governance quality score' },
            'Audit & Litigation Risk': { name: 'Audit & Litigation Risk', description: 'Audit and litigation risk exposure (higher = lower risk)' },
            'Controversy': { name: 'Controversy', description: 'Company controversy level (higher = fewer/less severe controversies)' },
            'Activist Resilience': { name: 'Activist Resilience', description: 'Resilience to activist campaigns (higher = less vulnerable)' },
            'Shareholder Support': { name: 'Shareholder Support', description: 'Shareholder vote support for directors, scored on a penalty threshold' }
        }
    },
    'Financial': {
        name: 'Financial',
        elements: {
            '3-Yr Excess Return (Industry)': { name: '3-Yr Excess Return (Industry)', description: '3-year total shareholder return in excess of the GICS industry-group benchmark' },
            '10-Yr Excess Return (Industry)': { name: '10-Yr Excess Return (Industry)', description: '10-year total shareholder return in excess of the GICS industry-group benchmark' },
            '3-Yr Excess Return (S&P 500)': { name: '3-Yr Excess Return (S&P 500)', description: '3-year total shareholder return in excess of the S&P 500 (reported for context)' },
            '10-Yr Excess Return (S&P 500)': { name: '10-Yr Excess Return (S&P 500)', description: '10-year total shareholder return in excess of the S&P 500 (reported for context)' }
        }
    },
    'Future Fitness': {
        name: 'Future Fitness',
        elements: {
            'AI Readiness': { name: 'AI Readiness', description: 'How prepared the company is to adopt and scale AI (WSJ Best Companies for the Future)' },
            'Innovation': { name: 'Innovation', description: 'Capacity for breakthrough thinking — R&D, patents, frontier skills' },
            'Talent Readiness': { name: 'Talent Readiness', description: 'Ability to attract, develop and retain talent' },
            'Financial Fitness': { name: 'Financial Fitness', description: 'Financial health and forward momentum' },
            'Resilience': { name: 'Resilience', description: 'Ability to withstand disruption — supply chain, geopolitical, climate' },
            'Agility': { name: 'Agility', description: 'Organizational speed, adaptability and culture' }
        }
    }
};

// Canonical pillar order — matches the Best Boards workbook.
const PILLAR_ORDER = [
    'Knowledge & Experience',
    'Group Dynamics',
    'Governance & Risk',
    'Financial',
    'Future Fitness',
];

// Canonical indicator order per pillar.
const INDICATOR_ORDER = {
    'Knowledge & Experience': ['AI & Technology', 'Executive Leadership', 'Innovation', 'International', 'Regulatory & Legal', 'Financial Expertise'],
    'Group Dynamics': ['Investor Deference', 'Board Dissimilarity', 'Sector Sweet-Spot'],
    'Governance & Risk': ['Board Governance', 'Audit & Litigation Risk', 'Controversy', 'Activist Resilience', 'Shareholder Support'],
    'Financial': ['3-Yr Excess Return (Industry)', '10-Yr Excess Return (Industry)', '3-Yr Excess Return (S&P 500)', '10-Yr Excess Return (S&P 500)'],
    'Future Fitness': ['AI Readiness', 'Innovation', 'Talent Readiness', 'Financial Fitness', 'Resilience', 'Agility'],
};

// "What's Measured" — provider + short description. Nested by PILLAR so that indicators sharing a name
// across pillars (e.g. "Innovation" in both Knowledge & Experience and Future Fitness) don't collide.
// Resolve via whatsMeasuredFor(pillar, indicator).  NOTE: these definitions are placeholders pending
// review — see Indicator_Definitions_for_review.docx.
const WHATS_MEASURED = {
    'Knowledge & Experience': {
        'AI & Technology': {
            provider: 'Bendable Labs (LLM read of proxy bios)',
            measured: 'A large language model read each director’s biography to flag AI and technology expertise. The board’s score is the share of directors carrying that skill (per-director density).',
        },
        'Executive Leadership': {
            provider: 'Bendable Labs (LLM read of proxy bios)',
            measured: 'Directors with top-operating experience — chief executive, chief financial or comparable senior leadership roles — were identified from their bios, and the board’s score reflects how prevalent that experience is.',
        },
        'Innovation': {
            provider: 'Bendable Labs (LLM read of proxy bios)',
            measured: 'Directors with innovation, research-and-development or product-building backgrounds were flagged, and the board scored on how many of its members bring that experience.',
        },
        'International': {
            provider: 'Bendable Labs (LLM read of proxy bios)',
            measured: 'Directors with meaningful international or cross-border experience were identified, and the board scored on the density of that global perspective.',
        },
        'Regulatory & Legal': {
            provider: 'Bendable Labs (LLM read of proxy bios)',
            measured: 'Directors with regulatory, legal or compliance expertise were flagged from their bios, and the board scored on how well represented that expertise is.',
        },
        'Financial Expertise': {
            provider: 'Bendable Labs (LLM read of proxy bios)',
            measured: 'Directors with financial, accounting or investing expertise were identified, and the board scored on the prevalence of that financial acumen.',
        },
    },
    'Group Dynamics': {
        'Investor Deference': {
            provider: 'Free Float Analytics',
            measured: 'A measure of how deferential the board is toward management. Low deference signals independent-minded directors and is read as a sign of investor trust; the metric weights 40% of the pillar.',
        },
        'Board Dissimilarity': {
            provider: 'Free Float Analytics',
            measured: 'How different directors are from one another across background and profile. Less similarity guards against an insider echo chamber, so more dissimilar boards score higher; it weights 30% of the pillar.',
        },
        'Sector Sweet-Spot': {
            provider: 'Bendable Labs (skills matrix)',
            measured: 'The share of the board with deep sector expertise. Boards score best when roughly a third to a half of directors are sector experts — enough to be credible without becoming an insider echo chamber; it weights 30% of the pillar.',
        },
    },
    'Governance & Risk': {
        'Board Governance': {
            provider: 'Diligent',
            measured: 'Diligent’s board-governance quality score, capturing board structure and practices. It carries the largest weight in the pillar (30%).',
        },
        'Audit & Litigation Risk': {
            provider: 'Ideagen',
            measured: 'An assessment of audit and litigation risk. Scored so that lower risk earns a higher mark; it weights 25% of the pillar.',
        },
        'Controversy': {
            provider: 'Sustainalytics',
            measured: 'The level and severity of company controversies. Fewer and less-severe controversies score higher; the metric weights 20% of the pillar.',
        },
        'Activist Resilience': {
            provider: 'Diligent (DMI)',
            measured: 'Diligent’s activist-vulnerability measure, expressed so that boards less exposed to activist campaigns score higher. It weights 15% of the pillar.',
        },
        'Shareholder Support': {
            provider: 'Diligent',
            measured: 'Shareholder vote support for directors, scored as a penalty threshold — full marks at 90%+ support, declining toward zero by 70%. It weights 10% of the pillar.',
        },
    },
    'Financial': {
        '3-Yr Excess Return (Industry)': {
            provider: 'FactSet',
            measured: 'Three-year total shareholder return measured against the company’s GICS industry-group benchmark, so credit reflects out-performance of true peers rather than a hot sector.',
        },
        '10-Yr Excess Return (Industry)': {
            provider: 'FactSet',
            measured: 'Ten-year total shareholder return measured against the company’s GICS industry-group benchmark — the long-horizon view of peer-relative performance.',
        },
        '3-Yr Excess Return (S&P 500)': {
            provider: 'FactSet',
            measured: 'Three-year total shareholder return in excess of the S&P 500. Computed for context; it carries no weight in the pillar score, which is 100% industry-relative.',
        },
        '10-Yr Excess Return (S&P 500)': {
            provider: 'FactSet',
            measured: 'Ten-year total shareholder return in excess of the S&P 500. Computed for context; it carries no weight in the pillar score, which is 100% industry-relative.',
        },
    },
    'Future Fitness': {
        'AI Readiness': {
            provider: 'WSJ Best Companies for the Future',
            measured: 'How prepared the company is to adopt and scale AI, from board-level governance and spending to workforce readiness and digital positioning.',
        },
        'Innovation': {
            provider: 'WSJ Best Companies for the Future',
            measured: 'The company’s capacity for breakthrough thinking, including R&D investment, patent strength, frontier skills and an innovation-friendly culture.',
        },
        'Talent Readiness': {
            provider: 'WSJ Best Companies for the Future',
            measured: 'How well the company attracts, develops and retains talent — workplace flexibility, employee wellbeing, skills-based hiring and Gen Z appeal.',
        },
        'Financial Fitness': {
            provider: 'WSJ Best Companies for the Future',
            measured: 'Financial health and forward momentum — balance-sheet strength, profitability, growth trajectory and competitive position.',
        },
        'Resilience': {
            provider: 'WSJ Best Companies for the Future',
            measured: 'The company’s ability to withstand disruption, from supply-chain readiness and geopolitical risk to climate-transition alignment.',
        },
        'Agility': {
            provider: 'WSJ Best Companies for the Future',
            measured: 'Organizational speed and adaptability through overhead efficiency, adaptive culture and values-driven leadership.',
        },
    },
};

// Resolve a "what's measured" entry, disambiguating by pillar. Falls back to a cross-pillar search
// if the pillar is unknown (returns the first match).
function whatsMeasuredFor(pillar, indicator) {
    if (!indicator) return null;
    const byPillar = WHATS_MEASURED[pillar];
    if (byPillar && byPillar[indicator]) return byPillar[indicator];
    for (const p in WHATS_MEASURED) {
        if (WHATS_MEASURED[p][indicator]) return WHATS_MEASURED[p][indicator];
    }
    return null;
}
