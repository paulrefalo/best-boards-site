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
            'Deference': { name: 'Deference', description: 'This assesses the likelihood that dissent against management would be difficult given the social and economic dynamics of the board.' },
            'Similarity': { name: 'Similarity', description: 'Using demographic markers (race, gender, age), experience markers (roles, knowledge, schooling) and connections (overlapping networks), this examines where a board may have a blind spot because of similarities that could negate fresh perspectives.' },
            'Industry Expertise': { name: 'Industry Expertise', description: 'Using a large language model, a company’s latest proxy statement was examined to determine how much relevant industry experience or expertise each board member has.' }
        }
    },
    'Governance & Risk': {
        name: 'Governance & Risk',
        elements: {
            'Governance Score': { name: 'Governance Score', description: 'Twenty different data points were used to assess the composition of the board and its committees, with an eye on a company’s decision-making ability, transparency and accountability, as well as its level of governance risk.' },
            'Audit and Litigation Risk': { name: 'Audit and Litigation Risk', description: 'This assesses whether a company has any notable open litigation in various areas (environmental, labor, regulatory, shareholder actions, etc.) and any red flags related to its audits (financial restatements, change in accounting estimates, inordinately high audit fees, etc.).' },
            'Controversy Rating': { name: 'Controversy Rating', description: 'This assesses a company’s involvement in incidents with negative environmental, social and governance implications, with a focus on the impact to stakeholders and the financial risk to the company.' },
            'Activist Vulnerability': { name: 'Activist Vulnerability', description: 'A multiple logistic regression analysis of activist investor investment was used to assess the likelihood that a company becomes a target.' },
            'Shareholder Support': { name: 'Shareholder Support', description: 'The vote tallies for each board member during their most recent election were averaged, and a graduated penalty was applied for totals under 90%.' }
        }
    },
    'Financial': {
        name: 'Financial',
        elements: {
            '3-Yr Excess Return (Industry)': { name: '3-Yr Excess Return (Industry)', description: '3-year total shareholder return vs the company\'s industry-group peers' },
            '10-Yr Excess Return (Industry)': { name: '10-Yr Excess Return (Industry)', description: '10-year total shareholder return vs the company\'s industry-group peers' }
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
    'Group Dynamics': ['Deference', 'Similarity', 'Industry Expertise'],
    'Governance & Risk': ['Governance Score', 'Audit and Litigation Risk', 'Controversy Rating', 'Activist Vulnerability', 'Shareholder Support'],
    'Financial': ['3-Yr Excess Return (Industry)', '10-Yr Excess Return (Industry)'],
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
            measured: 'This assesses the likelihood that dissent against management would be difficult given the social and economic dynamics of the board.',
        },
        'Similarity': {
            provider: 'Free Float Analytics',
            measured: 'Using demographic markers (race, gender, age), experience markers (roles, knowledge, schooling) and connections (overlapping networks), this examines where a board may have a blind spot because of similarities that could negate fresh perspectives.',
        },
        'Industry Expertise': {
            provider: 'Bendable Labs (skills matrix)',
            measured: 'Using a large language model, a company’s latest proxy statement was examined to determine how much relevant industry experience or expertise each board member has.',
        },
    },
    'Governance & Risk': {
        'Governance Score': {
            provider: 'Diligent',
            measured: 'Twenty different data points were used to assess the composition of the board and its committees, with an eye on a company’s decision-making ability, transparency and accountability, as well as its level of governance risk.',
        },
        'Audit and Litigation Risk': {
            provider: 'Ideagen',
            measured: 'This assesses whether a company has any notable open litigation in various areas (environmental, labor, regulatory, shareholder actions, etc.) and any red flags related to its audits (financial restatements, change in accounting estimates, inordinately high audit fees, etc.).',
        },
        'Controversy Rating': {
            provider: 'Sustainalytics',
            measured: 'This assesses a company’s involvement in incidents with negative environmental, social and governance implications, with a focus on the impact to stakeholders and the financial risk to the company.',
        },
        'Activist Vulnerability': {
            provider: 'Diligent (DMI)',
            measured: 'A multiple logistic regression analysis of activist investor investment was used to assess the likelihood that a company becomes a target.',
        },
        'Shareholder Support': {
            provider: 'Diligent',
            measured: 'The vote tallies for each board member during their most recent election were averaged, and a graduated penalty was applied for totals under 90%.',
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
