/**
 * Best Boards 2026 — Board Comparison Dashboard
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
            'AI & Technology': { name: 'AI & Technology', description: 'Share of directors with AI/technology experience or expertise' },
            'Executive Leadership': { name: 'Executive Leadership', description: 'Share of directors with executive leadership experience' },
            'Innovation': { name: 'Innovation', description: 'Share of directors with innovation experience or expertise' },
            'International': { name: 'International', description: 'Share of directors with international experience or expertise' },
            'Regulatory & Legal': { name: 'Regulatory & Legal', description: 'Share of directors with regulatory/legal experience or expertise' },
            'Financial Expertise': { name: 'Financial Expertise', description: 'Share of directors with financial experience or expertise' }
        }
    },
    'Group Dynamics': {
        name: 'Group Dynamics',
        elements: {
            'Deference': { name: 'Deference', description: 'Whether the board is free to dissent from management' },
            'Board Dissimilarity': { name: 'Board Dissimilarity', description: 'How different directors are from one another in background and connections' },
            'Industry expertise': { name: 'Industry expertise', description: 'Whether the share of directors with sector expertise sits in the ideal 30–50% range' }
        }
    },
    'Governance & Risk': {
        name: 'Governance & Risk',
        elements: {
            'Governance score': { name: 'Governance score', description: 'Overall quality of the board\'s composition, structure and practices' },
            'Audit & Litigation Soundness': { name: 'Audit & Litigation Soundness', description: 'Freedom from audit red flags and notable litigation' },
            'Controversy Avoidance': { name: 'Controversy Avoidance', description: 'Freedom from significant ESG controversies' },
            'Activist Resilience': { name: 'Activist Resilience', description: 'How resistant the board is to activist investor campaigns' },
            'Shareholder Support': { name: 'Shareholder Support', description: 'Shareholder vote support for directors in their most recent election' }
        }
    },
    'Financial': {
        name: 'Financial',
        elements: {
            '3-Yr Excess Return (Industry)': { name: '3-Yr Excess Return (Industry)', description: '3-year total shareholder return vs the company\'s industry-group peers' },
            '10-Yr Excess Return (Industry)': { name: '10-Yr Excess Return (Industry)', description: '10-year total shareholder return vs the company\'s industry-group peers' },
            '3-Yr Excess Return (S&P 500)': { name: '3-Yr Excess Return (S&P 500)', description: '3-year total shareholder return vs the S&P 500' },
            '10-Yr Excess Return (S&P 500)': { name: '10-Yr Excess Return (S&P 500)', description: '10-year total shareholder return vs the S&P 500' }
        }
    },
    'Future Fitness': {
        name: 'Future Fitness',
        elements: {
            'AI Readiness': { name: 'AI Readiness', description: 'How prepared the company is to adopt and scale AI' },
            'Innovation': { name: 'Innovation', description: 'The company\'s capacity for innovation' },
            'Talent Readiness': { name: 'Talent Readiness', description: 'How well the company attracts, develops and retains talent' },
            'Financial Fitness': { name: 'Financial Fitness', description: 'The company\'s financial health and momentum' },
            'Resilience': { name: 'Resilience', description: 'The company\'s ability to withstand disruption' },
            'Agility': { name: 'Agility', description: 'The company\'s organizational speed and adaptability' }
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
    'Group Dynamics': ['Deference', 'Board Dissimilarity', 'Industry expertise'],
    'Governance & Risk': ['Governance score', 'Audit & Litigation Soundness', 'Controversy Avoidance', 'Activist Resilience', 'Shareholder Support'],
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
            measured: 'Share of directors with AI/technology experience or expertise.',
        },
        'Executive Leadership': {
            provider: 'Bendable Labs (LLM read of proxy bios)',
            measured: 'Share of directors with executive leadership experience.',
        },
        'Innovation': {
            provider: 'Bendable Labs (LLM read of proxy bios)',
            measured: 'Share of directors with innovation experience or expertise.',
        },
        'International': {
            provider: 'Bendable Labs (LLM read of proxy bios)',
            measured: 'Share of directors with international experience or expertise.',
        },
        'Regulatory & Legal': {
            provider: 'Bendable Labs (LLM read of proxy bios)',
            measured: 'Share of directors with regulatory/legal experience or expertise.',
        },
        'Financial Expertise': {
            provider: 'Bendable Labs (LLM read of proxy bios)',
            measured: 'Share of directors with financial experience or expertise.',
        },
    },
    'Group Dynamics': {
        'Deference': {
            provider: 'Free Float Analytics',
            measured: 'Whether the board is free to dissent from management. Weights 40% of the pillar.',
        },
        'Board Dissimilarity': {
            provider: 'Free Float Analytics',
            measured: 'How different directors are from one another in background and connections. Weights 30% of the pillar.',
        },
        'Industry expertise': {
            provider: 'Bendable Labs (skills matrix)',
            measured: 'Whether the share of directors with sector expertise sits in the ideal 30–50% range. Weights 30% of the pillar.',
        },
    },
    'Governance & Risk': {
        'Governance score': {
            provider: 'Diligent',
            measured: 'Overall quality of the board\'s composition, structure and practices. Weights 30% of the pillar.',
        },
        'Audit & Litigation Soundness': {
            provider: 'Ideagen',
            measured: 'Freedom from audit red flags and notable open litigation. Weights 25% of the pillar.',
        },
        'Controversy Avoidance': {
            provider: 'Sustainalytics',
            measured: 'Freedom from significant ESG controversies. Weights 20% of the pillar.',
        },
        'Activist Resilience': {
            provider: 'Diligent (DMI)',
            measured: 'How resistant the board is to activist investor campaigns. Weights 15% of the pillar.',
        },
        'Shareholder Support': {
            provider: 'Diligent',
            measured: 'Shareholder vote support for directors in their most recent election. Weights 10% of the pillar.',
        },
    },
    'Financial': {
        '3-Yr Excess Return (Industry)': {
            provider: 'FactSet',
            measured: 'Three-year total shareholder return vs the company\'s industry-group peers.',
        },
        '10-Yr Excess Return (Industry)': {
            provider: 'FactSet',
            measured: 'Ten-year total shareholder return vs the company\'s industry-group peers.',
        },
        '3-Yr Excess Return (S&P 500)': {
            provider: 'FactSet',
            measured: 'Three-year total shareholder return vs the S&P 500.',
        },
        '10-Yr Excess Return (S&P 500)': {
            provider: 'FactSet',
            measured: 'Ten-year total shareholder return vs the S&P 500.',
        },
    },
    'Future Fitness': {
        'AI Readiness': {
            provider: 'WSJ Best Companies for the Future',
            measured: 'How prepared the company is to adopt and scale AI.',
        },
        'Innovation': {
            provider: 'WSJ Best Companies for the Future',
            measured: 'The company\'s capacity for innovation.',
        },
        'Talent Readiness': {
            provider: 'WSJ Best Companies for the Future',
            measured: 'How well the company attracts, develops and retains talent.',
        },
        'Financial Fitness': {
            provider: 'WSJ Best Companies for the Future',
            measured: 'The company\'s financial health and momentum.',
        },
        'Resilience': {
            provider: 'WSJ Best Companies for the Future',
            measured: 'The company\'s ability to withstand disruption.',
        },
        'Agility': {
            provider: 'WSJ Best Companies for the Future',
            measured: 'The company\'s organizational speed and adaptability.',
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
