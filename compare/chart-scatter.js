/**
 * Scatter Plot — Overall (x) vs Selected Pillar/Indicator (y)
 * Dot size: log(market cap). Dot color: GICS sector (colorblind-safe).
 * Selected companies highlighted with labels. Quadrant lines at 50,50.
 * Sector dropdown for focus filtering.
 */

// Sector colors — all 11 GICS sectors, colorblind-optimized
// Min pair distance >21 across normal/protanopia/deuteranopia.
// Sector dropdown filter provides additional disambiguation.
const SECTOR_COLORS = {
    'Industrials':             '#0072B2',  // Deep blue
    'Financials':              '#D55E00',  // Vermillion
    'Information Technology':  '#009E73',  // Blue-green
    'Health Care':             '#E69F00',  // Amber
    'Consumer Discretionary':  '#56B4E9',  // Sky blue
    'Consumer Staples':        '#0A2239',  // Navy
    'Communication Services':  '#9B7A2F',  // Dark gold
    'Real Estate':             '#AA8839',  // Dark sand
    'Utilities':               '#117733',  // Forest
    'Materials':               '#999933',  // Olive
    'Energy':                  '#882255',  // Wine
};

function ScatterPlot({ data, selectedCompanies, selectedPillar, selectedElement, shouldAnimate, onSelectActive, activeTicker, heightFactor = 1 }) {
    const containerRef = useRef();
    const tooltipRef = useRef();
    const [focusSector, setFocusSector] = useState('');

    // Detect data quality flags for the selected Y-axis indicator
    const dataFlags = useMemo(() => {
        if (!data || !data.companies) return [];
        const getY = selectedElement
            ? (c => c.pillar_scores?.[selectedPillar]?.indicators?.[selectedElement] ?? null)
            : (c => c.pillar_scores?.[selectedPillar]?.t_score ?? null);
        const yLabel = selectedElement
            ? (PILLAR_ELEMENTS[selectedPillar]?.elements?.[selectedElement]?.name || selectedElement)
            : (PILLAR_ELEMENTS[selectedPillar]?.name || selectedPillar);
        const allVals = data.companies.map(getY);
        const vals = allVals.filter(v => v != null && !isNaN(v));
        const total = data.companies.length;
        if (vals.length === 0) return [];

        const flags = [];

        // 1. Sparse data — significant share of companies missing this indicator
        const missingPct = ((total - vals.length) / total) * 100;
        if (missingPct >= 25) {
            flags.push(`${Math.round(missingPct)}% of companies lack ${yLabel} data — fewer points shown.`);
        }

        // 2. Clustered / low-cardinality — points stack on top of each other
        if (vals.length > 50) {
            const uniqueCount = new Set(vals).size;
            if (uniqueCount <= 30) {
                flags.push(`${yLabel} has limited unique values (${uniqueCount}) — points may overlap.`);
            } else {
                const freq = {};
                vals.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
                const top3 = Object.values(freq).sort((a, b) => b - a).slice(0, 3);
                const top3Share = top3.reduce((s, n) => s + n, 0) / vals.length;
                if (top3Share >= 0.25) {
                    flags.push(`${yLabel} scores are heavily clustered — many points overlap.`);
                }
            }
        }

        // 3. Skewed distribution — bulk of dots compressed into a narrow band
        const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
        const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
        if (std > 0) {
            const skew = vals.reduce((s, v) => s + ((v - mean) / std) ** 3, 0) / vals.length;
            if (Math.abs(skew) >= 1.5) {
                flags.push(`${yLabel} scores are heavily skewed — most cluster in a narrow range.`);
            }
        }

        // 4. Outliers beyond typical t-score range
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        if (min < 0 || max > 100) {
            flags.push(`${yLabel} has outliers extending beyond the typical 0–100 range.`);
        }

        return flags;
    }, [data, selectedPillar, selectedElement]);

    // Build sector list
    const sectors = useMemo(() => {
        if (!data || !data.companies) return [];
        const counts = {};
        data.companies.forEach(c => { const s = c.sector || 'Unknown'; counts[s] = (counts[s] || 0) + 1; });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
    }, [data]);

    useEffect(() => {
        if (!containerRef.current || !data || !data.companies) return;
        const container = containerRef.current;

        // ── Score accessors ──
        const getOverall = c => c.overall_score ?? null;
        const getPillarScore = c => c.pillar_scores?.[selectedPillar]?.t_score ?? null;
        const pillarLabel = PILLAR_ELEMENTS[selectedPillar]?.name || selectedPillar;
        let getY, yLabel;
        if (selectedElement) {
            getY = c => c.pillar_scores?.[selectedPillar]?.indicators?.[selectedElement] ?? null;
            yLabel = PILLAR_ELEMENTS[selectedPillar]?.elements?.[selectedElement]?.name || selectedElement;
        } else {
            getY = c => c.pillar_scores?.[selectedPillar]?.t_score ?? null;
            yLabel = PILLAR_ELEMENTS[selectedPillar]?.name || selectedPillar;
        }

        const selectedTickers = new Set(selectedCompanies.map(c => c.ticker));
        const selectedColorMap = {};
        selectedCompanies.forEach((c, i) => {
            selectedColorMap[c.ticker] = COMPANY_COLORS[i % COMPANY_COLORS.length];
        });

        // ── Build points ──
        const points = data.companies
            .map(c => ({
                ticker: c.ticker, name: c.name, sector: c.sector,
                boardSize: c.board_size ?? null,
                x: getOverall(c),
                y: getY(c),
                pillarScore: getPillarScore(c),
                isSelected: selectedTickers.has(c.ticker),
            }))
            .filter(d => d.x != null && d.y != null && !isNaN(d.x) && !isNaN(d.y));

        // ── Layout ──
        const totalWidth = (() => {
            const cs = window.getComputedStyle(container);
            return container.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
        })();
        const W = totalWidth, H = Math.max(300, Math.min(500, totalWidth * 0.7)) * heightFactor;
        const margin = { top: 28, right: 30, bottom: 55, left: 55 };
        const innerW = W - margin.left - margin.right;
        const innerH = H - margin.top - margin.bottom;

        // ── Scales ──
        const xExtent = d3.extent(points, d => d.x);
        const yExtent = d3.extent(points, d => d.y);
        const xPad = 3, yPad = 3;
        const xScale = d3.scaleLinear()
            .domain([Math.min(xExtent[0] - xPad, 15), Math.max(xExtent[1] + xPad, 85)])
            .range([0, innerW]);
        const yScale = d3.scaleLinear()
            .domain([Math.min(yExtent[0] - yPad, 15), Math.max(yExtent[1] + yPad, 85)])
            .range([innerH, 0]);

        // Dot size = board size (director count). scaleSqrt so area ~ board size.
        const bsExtent = d3.extent(points, d => d.boardSize);
        const hasSize = bsExtent[0] != null && bsExtent[1] != null && bsExtent[0] !== bsExtent[1];
        const rScale = d3.scaleSqrt()
            .domain(hasSize ? bsExtent : [1, 1])
            .range([3, 10]).clamp(true);
        const radiusOf = p => hasSize ? rScale(p.boardSize) : 5;

        // ── SVG ──
        d3.select(container).selectAll('svg').remove();
        const svg = d3.select(container).append('svg')
            .attr('width', W).attr('height', H)
            .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

        const tooltip = d3.select(tooltipRef.current);

        // ── Gridlines ──
        xScale.ticks(8).forEach(t => {
            svg.append('line')
                .attr('x1', xScale(t)).attr('x2', xScale(t))
                .attr('y1', 0).attr('y2', innerH)
                .attr('stroke', '#E0DDD3').attr('stroke-width', 0.5);
        });
        yScale.ticks(8).forEach(t => {
            svg.append('line')
                .attr('x1', 0).attr('x2', innerW)
                .attr('y1', yScale(t)).attr('y2', yScale(t))
                .attr('stroke', '#E0DDD3').attr('stroke-width', 0.5);
        });

        // ── Quadrant guides at the t-score average (50, 50) ──
        const x50 = xScale(50), y50 = yScale(50);
        const inX = x50 >= 0 && x50 <= innerW, inY = y50 >= 0 && y50 <= innerH;
        if (inX) svg.append('line')
            .attr('x1', x50).attr('x2', x50).attr('y1', 0).attr('y2', innerH)
            .attr('stroke', '#0A2239').attr('stroke-width', 1).attr('opacity', 0.38)
            .attr('stroke-dasharray', '5,3');
        if (inY) svg.append('line')
            .attr('x1', 0).attr('x2', innerW).attr('y1', y50).attr('y2', y50)
            .attr('stroke', '#0A2239').attr('stroke-width', 1).attr('opacity', 0.38)
            .attr('stroke-dasharray', '5,3');
        // "avg (50)" markers on each guide
        if (inX) svg.append('text').attr('x', x50 + 4).attr('y', 10)
            .attr('font-size', '9px').attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif')
            .attr('fill', '#0A2239').attr('opacity', 0.5).text('avg 50');
        if (inY) svg.append('text').attr('x', innerW - 4).attr('y', y50 - 4).attr('text-anchor', 'end')
            .attr('font-size', '9px').attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif')
            .attr('fill', '#0A2239').attr('opacity', 0.5).text('avg 50');

        // ── Axes ──
        const xAxisG = svg.append('g').attr('transform', `translate(0,${innerH})`).call(d3.axisBottom(xScale).ticks(8));
        xAxisG.select('.domain').attr('stroke', '#C8C2B6');
        xAxisG.selectAll('.tick line').attr('stroke', '#C8C2B6');
        xAxisG.selectAll('.tick text').attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif').attr('font-size', '11px').attr('fill', '#888');
        svg.append('text').attr('x', innerW / 2).attr('y', innerH + 42)
            .attr('text-anchor', 'middle').attr('font-size', '12px')
            .attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif').attr('fill', '#666')
            .text('Best Boards Overall Score');
        // t-score label below x-axis (under rightmost tick)
        svg.append('text').attr('x', innerW).attr('y', innerH + 34)
            .attr('text-anchor', 'end').attr('font-size', '12px').attr('font-weight', '600')
            .attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif').attr('fill', '#8B8178')
            .text('t-score');

        const yAxisG = svg.append('g').call(d3.axisLeft(yScale).ticks(8));
        yAxisG.select('.domain').attr('stroke', '#C8C2B6');
        yAxisG.selectAll('.tick line').attr('stroke', '#C8C2B6');
        yAxisG.selectAll('.tick text').attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif').attr('font-size', '11px').attr('fill', '#888');
        svg.append('text').attr('transform', 'rotate(-90)')
            .attr('x', -innerH / 2).attr('y', -40).attr('text-anchor', 'middle')
            .attr('font-size', '12px').attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif').attr('fill', '#666')
            .text(yLabel);
        // t-score label at top of y-axis
        svg.append('text').attr('x', -8).attr('y', -14)
            .attr('text-anchor', 'start').attr('font-size', '12px').attr('font-weight', '600')
            .attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif').attr('fill', '#8B8178')
            .text('t-score');

        // ── Dots ──
        const hasSectorFocus = focusSector && focusSector !== '';

        const drawDot = (p, layer, isSelected) => {
            const r = radiusOf(p);
            const sectorColor = SECTOR_COLORS[p.sector] || '#B0AAA0';
            const fill = isSelected ? (selectedColorMap[p.ticker] || sectorColor) : sectorColor;

            // Opacity logic: selected always bright; sector focus dims non-matching
            let opacity;
            if (isSelected) {
                opacity = 0.9;
            } else if (hasSectorFocus) {
                opacity = p.sector === focusSector ? 0.72 : 0.04;
            } else {
                opacity = 0.35;
            }

            const isActive = activeTicker && p.ticker === activeTicker;
            const restStroke = isActive ? '#0A2239' : (isSelected ? '#fff' : 'none');
            const restStrokeW = isActive ? 3 : (isSelected ? 1.5 : 0);
            const dot = layer.append('circle')
                .attr('cx', xScale(p.x)).attr('cy', yScale(p.y))
                .attr('r', isActive ? r + 2 : r)
                .attr('fill', fill)
                .attr('opacity', isActive ? 1 : opacity)
                .attr('stroke', restStroke)
                .attr('stroke-width', restStrokeW)
                .style('cursor', 'pointer');
            if (onSelectActive) dot.on('click', () => onSelectActive(p.ticker));
            if (isActive) dot.raise();
            dot
                .on('mouseenter', function(event) {
                    d3.select(this).attr('opacity', 1).attr('stroke', '#fff').attr('stroke-width', 2).raise();
                    const sizeStr = p.boardSize != null ? `${p.boardSize} directors` : '—';
                    const sectorDot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${sectorColor};margin-right:4px;vertical-align:middle"></span>`;
                    const pillarLine = selectedElement && p.pillarScore != null
                        ? `${pillarLabel}: <strong>${p.pillarScore.toFixed(1)}</strong><br/>`
                        : '';
                    tooltip
                        .html(`<strong>${p.ticker}</strong> — ${p.name}<br/>
                               ${sectorDot}<span class="tooltip-label">${p.sector}</span><br/>
                               Overall: <strong>${p.x.toFixed(1)}</strong><br/>
                               ${pillarLine}${yLabel}: <strong>${p.y.toFixed(1)}</strong><br/>
                               <span class="tooltip-label">Board size: ${sizeStr}</span>`)
                        .style('display', 'block');
                    // Boundary detection — keep tooltip inside the chart container
                    const ttNode = tooltipRef.current;
                    const cRect = container.getBoundingClientRect();
                    const ttW = ttNode.offsetWidth;
                    const ttH = ttNode.offsetHeight;
                    let tx = event.offsetX + 14;
                    let ty = event.offsetY - 14;
                    if (tx + ttW > cRect.width) tx = event.offsetX - ttW - 14;
                    if (ty + ttH > cRect.height) ty = cRect.height - ttH - 4;
                    if (ty < 0) ty = 4;
                    tooltip.style('left', tx + 'px').style('top', ty + 'px');
                })
                .on('mouseleave', function() {
                    d3.select(this)
                        .attr('opacity', isActive ? 1 : opacity)
                        .attr('stroke', restStroke)
                        .attr('stroke-width', restStrokeW);
                    tooltip.style('display', 'none');
                });
        };

        // Draw non-selected, then selected on top
        const nonSelected = points.filter(p => !p.isSelected);
        const selected = points.filter(p => p.isSelected);
        const bgLayer = svg.append('g');
        const fgLayer = svg.append('g');
        nonSelected.forEach(p => drawDot(p, bgLayer, false));
        selected.forEach(p => drawDot(p, fgLayer, true));

        // ── Labels for selected companies ──
        if (selected.length > 0) {
            const labelLayer = svg.append('g');
            const sorted = [...selected].sort((a, b) => xScale(a.x) - xScale(b.x));
            const labelFontSize = 11;
            const labelH = 14;

            const lps = sorted.map((p, i) => {
                const side = i % 2 === 0 ? -1 : 1;
                const baseY = yScale(p.y) - radiusOf(p) - 8;
                return { p, x: xScale(p.x), finalY: baseY + side * 4, baseY };
            });

            for (let pass = 0; pass < 10; pass++) {
                for (let i = 0; i < lps.length; i++) {
                    for (let j = i + 1; j < lps.length; j++) {
                        if (Math.abs(lps[i].x - lps[j].x) < 40 && Math.abs(lps[i].finalY - lps[j].finalY) < labelH) {
                            lps[i].finalY -= labelH / 2 + 1;
                            lps[j].finalY += labelH / 2 + 1;
                        }
                    }
                }
            }

            lps.forEach(lp => {
                const color = selectedColorMap[lp.p.ticker] || '#0A2239';
                if (Math.abs(lp.finalY - lp.baseY) > 3) {
                    labelLayer.append('line')
                        .attr('x1', lp.x).attr('x2', lp.x)
                        .attr('y1', lp.baseY + 6).attr('y2', lp.finalY + 3)
                        .attr('stroke', color).attr('stroke-width', 0.75).attr('opacity', 0.5);
                }
                labelLayer.append('text')
                    .attr('x', lp.x).attr('y', lp.finalY)
                    .attr('text-anchor', 'middle')
                    .attr('font-size', `${labelFontSize}px`).attr('font-weight', '600')
                    .attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif')
                    .attr('fill', color)
                    .text(lp.p.ticker);
            });
        }

        // (Sector legend now lives above the chart as a clickable HTML row — see render below.)

        // ── Bubble size legend (dot size = board size) ──
        if (hasSize) {
            const lo = bsExtent[0], hi = bsExtent[1], mid = Math.round((lo + hi) / 2);
            const vals = [...new Set([lo, mid, hi])];
            const rMax = rScale(hi);
            const legG = svg.append('g').attr('transform', `translate(${innerW - 128}, ${innerH - 22})`);
            legG.append('rect')
                .attr('x', -10).attr('y', -(rMax * 2 + 23)).attr('width', 148).attr('height', rMax * 2 + 31)
                .attr('fill', '#fff').attr('opacity', 0.85).attr('rx', 3)
                .attr('stroke', '#E0DDD3').attr('stroke-width', 0.5);
            legG.append('text').attr('x', -2).attr('y', -(rMax * 2 + 9))
                .attr('font-size', '9px').attr('font-weight', 600)
                .attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif').attr('fill', '#8B8178')
                .text('Board size (directors)');
            let lx = 4;
            vals.forEach(v => {
                const r = rScale(v);
                legG.append('circle')
                    .attr('cx', lx + r).attr('cy', -r - 2).attr('r', r)
                    .attr('fill', 'none').attr('stroke', '#8B8178').attr('stroke-width', 1);
                legG.append('text')
                    .attr('x', lx + r).attr('y', 10).attr('text-anchor', 'middle')
                    .attr('font-size', '9px').attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif')
                    .attr('fill', '#888').text(v);
                lx += 2 * r + 24;
            });
        }

        return () => { d3.select(container).selectAll('svg').remove(); };

    }, [data, selectedCompanies, selectedPillar, selectedElement, shouldAnimate, focusSector, activeTicker, onSelectActive, heightFactor]);

    // Build the "Overall vs. X" title
    const vsName = selectedElement
        ? (PILLAR_ELEMENTS[selectedPillar]?.elements?.[selectedElement]?.name || selectedElement)
        : (PILLAR_ELEMENTS[selectedPillar]?.name || selectedPillar);

    // Sector legend — only the sectors present, in canonical palette order (click to focus).
    const legendSectors = React.useMemo(() => {
        if (typeof SECTOR_COLORS === 'undefined' || !data?.companies) return [];
        const present = new Set(data.companies.map(c => c.sector));
        return Object.keys(SECTOR_COLORS).filter(s => present.has(s));
    }, [data]);

    return (
        <div className="scatter-container" style={{ position: 'relative', width: '100%' }}>
            <div className="chart-unified-header">
                <h3 className="chart-unified-title">
                    Overall Board Score <span className="chart-unified-breadcrumb">vs.</span> {vsName}
                </h3>
            </div>
            {legendSectors.length > 0 && (
                <div style={{
                    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px',
                    margin: '2px 8px 8px 0', paddingLeft: '55px', fontSize: '11px',
                    fontFamily: 'acumin-pro, IBM Plex Sans, sans-serif', color: '#555',
                }}>
                    <span style={{ fontStyle: 'italic', color: '#999', marginRight: '2px' }}>
                        Click to highlight a sector:
                    </span>
                    {legendSectors.map(s => {
                        const active = focusSector === s;
                        const dimmed = focusSector && focusSector !== '' && !active;
                        return (
                            <span
                                key={s}
                                onClick={() => setFocusSector(active ? '' : s)}
                                title={active ? 'Click to clear' : `Highlight ${s}`}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap',
                                    cursor: 'pointer', userSelect: 'none',
                                    opacity: dimmed ? 0.4 : 1,
                                    fontWeight: active ? 700 : 400,
                                    color: active ? '#0A2239' : '#555',
                                }}
                            >
                                <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: SECTOR_COLORS[s], display: 'inline-block', marginRight: '5px', outline: active ? '2px solid #0A2239' : 'none', outlineOffset: '1px' }} />
                                {s}
                            </span>
                        );
                    })}
                </div>
            )}

            <div ref={containerRef} style={{ position: 'relative' }}>
                <div ref={tooltipRef} className="chart-tooltip" style={{ display: 'none' }} />
            </div>

            {dataFlags.length > 0 && (
                <div style={{
                    textAlign: 'right', margin: '4px 8px 0 0',
                    fontSize: '10px', fontStyle: 'italic',
                    fontFamily: 'acumin-pro, IBM Plex Sans, sans-serif', color: '#999'
                }}>
                    {dataFlags.map((flag, i) => (
                        <div key={i}>Note: {flag}</div>
                    ))}
                </div>
            )}
        </div>
    );
}
