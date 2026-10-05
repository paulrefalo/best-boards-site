/**
 * Shared chart utilities — adaptive axis labels
 *
 * Measures available width per label and picks the best rendering strategy:
 *   1. Horizontal + word-wrap   (plenty of room)
 *   2. Abbreviated horizontal   (medium room)
 *   3. Rotated –45° abbreviated (narrow / mobile)
 */

// ── Label abbreviation helpers ────────────────────────────────────────

const ABBREVIATIONS = [
    [/ Score$/i, ''],
    [/ Exposure$/i, ' Exp.'],
    [/Operating /i, 'Op. '],
    [/Geopolitical /i, 'Geo. '],
    [/Leadership /i, 'Lead. '],
    [/Supply.Chain /i, 'Supply Ch. '],
];

function abbreviateLabel(text) {
    let short = text;
    for (const [re, replacement] of ABBREVIATIONS) {
        short = short.replace(re, replacement);
    }
    return short.trim();
}

// ── Adaptive label renderer ───────────────────────────────────────────

/**
 * Render x-axis labels adaptively based on available space.
 *
 * @param {d3.Selection} svg   – the <g> drawing group (already translated)
 * @param {Array} items        – [{label, xCenter, key}]
 * @param {Object} opts
 *   bandwidth    – pixel width available per label
 *   yBaseline    – y coordinate where labels start (typically height + gap)
 *   fontSize     – base font size (default 12)
 *   fontFamily   – (default 'acumin-pro, IBM Plex Sans, sans-serif')
 *   fill         – text color (default '#2C2C2C')
 *   selectedElement – if set, dim labels whose key !== selectedElement
 */
function renderAdaptiveLabels(svg, items, opts = {}) {
    const {
        bandwidth,
        yBaseline,
        fontSize: baseFontSize = 12,
        fontFamily = 'acumin-pro, IBM Plex Sans, sans-serif',
        fill = '#2C2C2C',
        selectedElement = null,
    } = opts;

    // Rough character width for this font size
    const charWidth = baseFontSize * 0.58;

    // Available horizontal chars per label
    const availableChars = Math.floor(bandwidth / charWidth);

    // Determine strategy
    const longestLabel = Math.max(...items.map(i => i.label.length));
    const longestAbbrev = Math.max(...items.map(i => abbreviateLabel(i.label).length));

    // Strategy thresholds (pixels per label)
    const WRAP_THRESHOLD = 70;   // below this, wrapping causes overlap
    const ROTATE_THRESHOLD = 42; // below this, must rotate

    let strategy;
    if (bandwidth >= WRAP_THRESHOLD && availableChars >= longestLabel * 0.5) {
        strategy = 'wrap';          // full text, word-wrapped
    } else if (bandwidth >= ROTATE_THRESHOLD) {
        strategy = 'abbreviate';    // shortened text, horizontal
    } else {
        strategy = 'rotate';        // shortened text, –45°
    }

    const fontSize = strategy === 'rotate' ? Math.max(9, baseFontSize - 2) : baseFontSize;

    items.forEach(item => {
        const dimmed = selectedElement && item.key !== selectedElement;
        const focused = selectedElement && item.key === selectedElement;
        const opacity = dimmed ? 0.3 : 1;
        const labelWeight = focused ? '700' : 'normal';
        const labelSize = focused ? baseFontSize + 1 : (dimmed ? baseFontSize - 1 : baseFontSize);

        if (strategy === 'rotate') {
            const displayText = abbreviateLabel(item.label);
            svg.append('text')
                .attr('x', item.xCenter)
                .attr('y', yBaseline)
                .attr('text-anchor', 'end')
                .attr('font-size', `${labelSize}px`)
                .attr('font-weight', labelWeight)
                .attr('font-family', fontFamily)
                .attr('fill', fill)
                .attr('transform', `rotate(-45, ${item.xCenter}, ${yBaseline})`)
                .style('opacity', opacity)
                .text(displayText);

        } else if (strategy === 'abbreviate') {
            const displayText = abbreviateLabel(item.label);
            const words = displayText.split(' ');

            const labelGroup = svg.append('text')
                .attr('x', item.xCenter)
                .attr('y', yBaseline)
                .attr('text-anchor', 'middle')
                .attr('font-size', `${labelSize}px`)
                .attr('font-weight', labelWeight)
                .attr('font-family', fontFamily)
                .attr('fill', fill)
                .style('opacity', opacity);

            words.forEach((word, i) => {
                labelGroup.append('tspan')
                    .attr('x', item.xCenter)
                    .attr('dy', i === 0 ? 0 : '1.1em')
                    .text(word);
            });

        } else {
            const words = item.label.split(' ');

            const labelGroup = svg.append('text')
                .attr('x', item.xCenter)
                .attr('y', yBaseline)
                .attr('text-anchor', 'middle')
                .attr('font-size', `${labelSize}px`)
                .attr('font-weight', labelWeight)
                .attr('font-family', fontFamily)
                .attr('fill', fill)
                .style('opacity', opacity);

            words.forEach((word, i) => {
                labelGroup.append('tspan')
                    .attr('x', item.xCenter)
                    .attr('dy', i === 0 ? 0 : '1.1em')
                    .text(word);
            });
        }
    });

    return strategy;
}

/**
 * Render column header labels adaptively (for heatmap-style charts).
 * Headers sit above a data area and stack upward.
 *
 * @param {d3.Selection} svg
 * @param {Array} items        – [{label, xCenter, key}]
 * @param {Object} opts
 *   colWidth      – pixel width of each column
 *   lineHeight    – line height for multi-line (default 13)
 *   fontSize      – base font size (default 10)
 *   fontFamily
 *   fill
 *   selectedElement
 */
function renderAdaptiveHeaders(svg, items, opts = {}) {
    const {
        colWidth,
        lineHeight = 13,
        fontSize: baseFontSize = 10,
        fontFamily = 'acumin-pro, IBM Plex Sans, sans-serif',
        fill = '#2C2C2C',
        selectedElement = null,
    } = opts;

    const charWidth = baseFontSize * 0.58;
    const availableChars = Math.floor(colWidth / charWidth);
    const ROTATE_THRESHOLD = 35;

    const useRotation = colWidth < ROTATE_THRESHOLD;
    const useAbbrev = availableChars < Math.max(...items.map(i => abbreviateLabel(i.label).length));
    const fontSize = useRotation ? Math.max(8, baseFontSize - 1) : baseFontSize;

    items.forEach(item => {
        const dimmed = selectedElement && item.key !== selectedElement;
        const opacity = dimmed ? 0.5 : 1;

        if (useRotation) {
            const displayText = abbreviateLabel(item.label);
            svg.append('text')
                .attr('x', item.xCenter)
                .attr('y', -6)
                .attr('text-anchor', 'start')
                .attr('font-size', `${fontSize}px`)
                .attr('font-weight', '600')
                .attr('font-family', fontFamily)
                .attr('fill', fill)
                .attr('transform', `rotate(-45, ${item.xCenter}, ${-6})`)
                .style('opacity', opacity)
                .text(displayText);
        } else {
            const displayText = useAbbrev ? abbreviateLabel(item.label) : item.label;
            const words = displayText.split(' ');
            const startY = -6 - (words.length - 1) * lineHeight;

            const headerGroup = svg.append('text')
                .attr('x', item.xCenter)
                .attr('y', startY)
                .attr('text-anchor', 'middle')
                .attr('font-size', `${fontSize}px`)
                .attr('font-weight', '600')
                .attr('font-family', fontFamily)
                .attr('fill', fill)
                .style('opacity', opacity);

            words.forEach((word, i) => {
                headerGroup.append('tspan')
                    .attr('x', item.xCenter)
                    .attr('dy', i === 0 ? 0 : lineHeight)
                    .text(word);
            });
        }
    });

    return useRotation ? 'rotate' : (useAbbrev ? 'abbreviate' : 'wrap');
}

// ── Shared pillar descriptions ────────────────────────────────────────

const PILLAR_DESCRIPTIONS = {
    'Overall Board Score': 'A composite score combining all four pillars — Knowledge & Experience, Group Dynamics, Governance & Risk, and Financial — by an equal-weight geometric mean to gauge each board\'s overall strength.',
    'Knowledge & Experience': 'Measures the depth and mix of director expertise — AI and technology, executive leadership, innovation, international, regulatory/legal, and financial — as a per-director density across the board.',
    'Group Dynamics': 'Captures how the board functions as a group: investor deference, dissimilarity that guards against an echo chamber, and a sector-expertise sweet spot.',
    'Governance & Risk': 'Assesses governance quality and risk oversight, spanning board governance, audit and litigation risk, controversy, activist resilience, and shareholder support.',
    'Financial': 'Evaluates long-run shareholder value creation through 3- and 10-year total shareholder returns measured against industry-group peers.',
    'Future Fitness': 'The WSJ Best Companies for the Future score as a fifth pillar — AI readiness, innovation, talent, financial fitness, resilience and agility — rewarding boards that oversee future-ready companies.'
};

/**
 * Unified chart header — pillar name, optional element breadcrumb, description blurb.
 * Usage: <ChartHeader selectedPillar={...} selectedElement={...} />
 */
function ChartHeader({ selectedPillar, selectedElement }) {
    const pillarDisplayName = selectedPillar === 'Overall Board Score'
        ? 'Overall Board Score'
        : PILLAR_ELEMENTS[selectedPillar]?.name || selectedPillar;
    const elementDisplayName = selectedElement
        ? (PILLAR_ELEMENTS[selectedPillar]?.elements?.[selectedElement]?.name || selectedElement)
        : null;
    const description = selectedElement
        ? (PILLAR_ELEMENTS[selectedPillar]?.elements?.[selectedElement]?.description || '')
        : (PILLAR_DESCRIPTIONS[selectedPillar] || '');

    return (
        <div className="chart-unified-header">
            <h3 className="chart-unified-title">
                {pillarDisplayName}
                {elementDisplayName && <span className="chart-unified-breadcrumb"> → {elementDisplayName}</span>}
            </h3>
            {/* description blurb removed */}
        </div>
    );
}

// ── Sweep-in animation helper ────────────────────────────────────────

/**
 * Animate all direct child elements of an SVG <g> with a left-to-right
 * staggered fade-in, like a stock ticker feed.
 *
 * Call this AFTER all elements have been drawn in the group.
 *
 * @param {d3.Selection} group  – the <g> container whose children to animate
 * @param {Object} opts
 *   duration  – total sweep duration in ms (default 420)
 *   stagger   – max per-element delay in ms (default 300)
 *   xExtent   – [minX, maxX] range for stagger; auto-detected if omitted
 */
function sweepIn(group, opts = {}) {
    const {
        duration = 420,
        stagger = 300,
    } = opts;

    // Collect all direct child elements with a measurable x position
    const nodes = [];
    const children = group.node().children;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const el = d3.select(child);
        // Try data-x attribute first (set explicitly by charts)
        let x = parseFloat(el.attr('data-x'));
        if (isNaN(x)) x = parseFloat(el.attr('x')) || 0;
        if (!x) {
            const cx = parseFloat(el.attr('cx'));
            if (!isNaN(cx)) x = cx;
        }
        if (!x) {
            const transform = el.attr('transform') || '';
            const m = transform.match(/translate\(\s*([\d.]+)/);
            if (m) x = parseFloat(m[1]);
        }
        nodes.push({ el: child, x });
    }

    if (nodes.length === 0) return;

    const xs = nodes.map(n => n.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const range = maxX - minX || 1;

    nodes.forEach(({ el, x }) => {
        const pct = (x - minX) / range;        // 0 (left) → 1 (right)
        const delay = pct * stagger;
        const sel = d3.select(el);
        const targetOpacity = sel.style('opacity');   // preserve existing (e.g. dimmed)

        sel
            .style('opacity', 0)
            .transition()
            .delay(delay)
            .duration(duration)
            .style('opacity', targetOpacity);
    });
}
