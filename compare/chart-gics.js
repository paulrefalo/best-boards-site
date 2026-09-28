/**
 * GICS Horizontal Bar Chart Component
 * Shows average t-scores by GICS Sector, Industry Group, or Industry
 * WSJ-style horizontal bar chart with 50 as the midpoint
 *
 * Animation: bars migrate to their new sorted position, then grow/shrink.
 * Labels: >=50  →  [bar→] score  Name      (right of bar)
 *         <50   →  Name  score  [←bar]     (left of bar)
 */
function GICSBarChart({ data, selectedCompanies, selectedPillar, selectedElement, shouldAnimate }) {
    const svgRef = useRef();
    const containerRef = useRef();
    const tooltipRef = useRef();
    // Persist refs across renders so D3 can do keyed updates
    const prevBarData = useRef(null);
    const gRef = useRef(null);       // <g> inside SVG for the chart area

    useEffect(() => {
        if (!svgRef.current || !data || !data.companies) return;

        const totalWidth = (() => {
            if (!containerRef.current) return 700;
            const cs = window.getComputedStyle(containerRef.current);
            const hPad = parseFloat(cs.paddingLeft || 0) + parseFloat(cs.paddingRight || 0);
            return containerRef.current.clientWidth - hPad;
        })();

        // ── Gather scores by GICS grouping ────────────────────────────
        const groupScores = {};
        const groupCompanies = {};
        const groupSelectedDetails = {};  // { groupName: [{ticker, name, score, color}] }
        const companies = data.companies;

        // Build a lookup for selected company colors
        const selectedColorMap = {};
        selectedCompanies.forEach((c, idx) => {
            selectedColorMap[c.ticker] = COMPANY_COLORS[idx % COMPANY_COLORS.length];
        });

        companies.forEach(company => {
            const groupKey = company.sector || 'Unknown';

            let score = null;
            try {
                if (selectedElement) {
                    const pillarData = company.pillar_scores?.[selectedPillar];
                    if (pillarData?.indicators) {
                        score = pillarData.indicators[selectedElement];
                    }
                } else if (selectedPillar === 'Overall Board Score') {
                    score = company.overall_score || null;
                } else {
                    score = company.pillar_scores?.[selectedPillar]?.t_score;
                }
            } catch (e) { /* skip */ }

            if (score == null || isNaN(score)) return;

            if (!groupScores[groupKey]) {
                groupScores[groupKey] = [];
                groupCompanies[groupKey] = new Set();
                groupSelectedDetails[groupKey] = [];
            }
            groupScores[groupKey].push(score);
            groupCompanies[groupKey].add(company.ticker);

            // Track selected company details for markers
            if (selectedColorMap[company.ticker]) {
                groupSelectedDetails[groupKey].push({
                    ticker: company.ticker,
                    name: company.name,
                    score: score,
                    color: selectedColorMap[company.ticker]
                });
            }
        });

        const barData = Object.entries(groupScores)
            .map(([name, scores]) => ({
                name,
                avg: scores.reduce((a, b) => a + b, 0) / scores.length,
                count: scores.length,
                hasSelected: selectedCompanies.some(c => groupCompanies[name]?.has(c.ticker)),
                selectedDetails: groupSelectedDetails[name] || []
            }))
            .sort((a, b) => b.avg - a.avg);

        if (barData.length === 0) return;

        // ── Insert S&P 500 average bar ────────────────────────────────
        const allScores = barData.map(d => d.avg);
        // Weighted average across all groups (weight by company count)
        const totalCount = barData.reduce((s, d) => s + d.count, 0);
        const sp500Avg = barData.reduce((s, d) => s + d.avg * d.count, 0) / totalCount;
        const sp500Bar = { name: 'S\u2009&\u2009P 500 Avg', avg: sp500Avg, count: totalCount, hasSelected: false, isBenchmark: true, selectedDetails: [] };
        // Insert at correct sorted position
        let inserted = false;
        const finalData = [];
        for (const d of barData) {
            if (!inserted && sp500Avg >= d.avg) {
                finalData.push(sp500Bar);
                inserted = true;
            }
            finalData.push(d);
        }
        if (!inserted) finalData.push(sp500Bar);

        // ── Layout ────────────────────────────────────────────────────
        const margin = { top: 40, right: 20, bottom: 12, left: 20 };
        const barHeight = 26;
        const barGap = 4;
        const rowH = barHeight + barGap;
        const chartHeight = finalData.length * rowH;
        const height = margin.top + chartHeight + margin.bottom;
        const width = totalWidth;
        const innerW = width - margin.left - margin.right;

        // ── Scales ────────────────────────────────────────────────────
        const minVal = d3.min(barData, d => d.avg);
        const maxVal = d3.max(barData, d => d.avg);
        const extent = Math.max(maxVal - 50, 50 - minVal, 8);
        const domainMin = Math.max(0, 50 - extent - 3);
        const domainMax = Math.min(100, 50 + extent + 3);

        const x = d3.scaleLinear()
            .domain([domainMin, domainMax])
            .range([0, innerW]);

        const midX = x(50);

        // ── Colors — site palette ─────────────────────────────────────
        const aboveColor = '#4A7C8C';     // data-teal
        const belowColor = '#697380';     // data-slate
        const benchmarkColor = '#0A2239'; // primary-navy (black bar)
        const highlightAbove = '#3A6A78';
        const highlightBelow = '#555D66';

        // ── Determine if we can do a keyed transition ─────────────────
        const prev = prevBarData.current;
        const canTransition = shouldAnimate && prev && prev.length > 0;
        // Build a map of previous y-positions and widths by name
        const prevMap = {};
        if (prev) {
            prev.forEach((d, i) => {
                prevMap[d.name] = { y: i * rowH, avg: d.avg };
            });
        }

        const svg = d3.select(svgRef.current)
            .attr('width', width);

        // Animate height
        if (canTransition) {
            svg.transition().duration(500).attr('height', height);
        } else {
            svg.attr('height', height);
        }

        // ── Static layer (axis, gridlines) — always rebuilt ───────────
        svg.selectAll('.gics-static').remove();
        svg.selectAll('.gics-footnote').remove();
        const staticG = svg.append('g')
            .attr('class', 'gics-static')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Tick values
        const tickValues = [];
        const step = extent > 20 ? 10 : 5;
        for (let v = Math.ceil(domainMin / step) * step; v <= domainMax; v += step) {
            tickValues.push(v);
        }

        const topAxis = staticG.append('g')
            .call(d3.axisTop(x)
                .tickValues(tickValues)
                .tickSize(0)
                .tickPadding(8)
            );
        topAxis.select('.domain').remove();
        topAxis.selectAll('text')
            .style('font-family', "'acumin-pro', 'IBM Plex Sans', sans-serif")
            .style('font-size', '11px')
            .style('fill', '#8B8178')
            .style('font-weight', d => d === 50 ? '700' : '400');

        // Midline
        staticG.append('line')
            .attr('x1', midX).attr('x2', midX)
            .attr('y1', 0).attr('y2', chartHeight)
            .attr('stroke', '#8B8178')
            .attr('stroke-width', 1);

        // Gridlines
        tickValues.filter(v => v !== 50).forEach(v => {
            staticG.append('line')
                .attr('x1', x(v)).attr('x2', x(v))
                .attr('y1', 0).attr('y2', chartHeight)
                .attr('stroke', '#E0DDD3')
                .attr('stroke-width', 0.5);
        });

        // Midpoint label
        staticG.append('text')
            .attr('x', midX)
            .attr('y', -22)
            .attr('text-anchor', 'middle')
            .style('font-family', "'acumin-pro', 'IBM Plex Sans', sans-serif")
            .style('font-size', '12px')
            .style('font-weight', '600')
            .style('fill', '#8B8178')
            .text('t-score');

        // ── Data layer — keyed join for transitions ───────────────────
        // Ensure a persistent <g> for data rows
        let dataG = svg.select('.gics-data');
        if (dataG.empty()) {
            dataG = svg.append('g').attr('class', 'gics-data');
        }
        dataG.attr('transform', `translate(${margin.left},${margin.top})`);

        const tooltip = d3.select(tooltipRef.current);
        const dur = 500;

        // Join rows by name
        const rows = dataG.selectAll('.gics-row')
            .data(finalData, d => d.name);

        // ── EXIT ──────────────────────────────────────────────────────
        rows.exit()
            .transition().duration(dur)
            .style('opacity', 0)
            .remove();

        // ── ENTER ─────────────────────────────────────────────────────
        const enter = rows.enter()
            .append('g')
            .attr('class', 'gics-row')
            .attr('transform', (d, i) => {
                // If transitioning, start at previous position or off-screen
                if (canTransition && prevMap[d.name]) {
                    return `translate(0,${prevMap[d.name].y})`;
                }
                return `translate(0,${i * rowH})`;
            })
            .style('opacity', canTransition ? 0 : 1);

        // Bar rect
        enter.append('rect')
            .attr('class', 'gics-bar')
            .attr('y', 1)
            .attr('height', barHeight - 2)
            .attr('rx', 1)
            .style('cursor', 'pointer');

        // Score text
        enter.append('text')
            .attr('class', 'gics-score')
            .attr('dominant-baseline', 'central')
            .attr('y', barHeight / 2)
            .style('font-family', "'acumin-pro', 'IBM Plex Sans', sans-serif")
            .style('font-size', '11px')
            .style('font-weight', '600');

        // Name text
        enter.append('text')
            .attr('class', 'gics-name')
            .attr('dominant-baseline', 'central')
            .attr('y', barHeight / 2)
            .style('font-family', "'acumin-pro', 'IBM Plex Sans', sans-serif")
            .style('font-size', '12px');

        // ── ENTER + UPDATE (merge) ────────────────────────────────────
        const merged = enter.merge(rows);

        // Phase 1: migrate rows to new y-position
        if (canTransition) {
            merged
                .transition('move').duration(dur).ease(d3.easeCubicInOut)
                .attr('transform', (d, i) => `translate(0,${i * rowH})`)
                .style('opacity', 1);
        } else {
            merged
                .attr('transform', (d, i) => `translate(0,${i * rowH})`)
                .style('opacity', 1);
        }

        // Phase 2: grow/shrink bars (starts after move finishes if transitioning)
        const barDelay = canTransition ? dur * 0.6 : 0;
        const barDur = canTransition ? 400 : 0;

        merged.each(function(d) {
            const row = d3.select(this);
            const isAbove = d.avg >= 50;
            const isBench = d.isBenchmark;
            const barX = isAbove ? midX : x(d.avg);
            const barW = Math.max(Math.abs(x(d.avg) - midX), 1);
            const fillColor = isBench ? benchmarkColor : (isAbove ? aboveColor : belowColor);
            const hoverColor = isBench ? '#0F1D33' : (isAbove ? highlightAbove : highlightBelow);

            // ── Bar ───────────────────────────────────────────────
            const bar = row.select('.gics-bar');
            if (canTransition) {
                // Start from midline (zero width) or previous width
                const prevD = prevMap[d.name];
                if (prevD) {
                    const prevAbove = prevD.avg >= 50;
                    const prevBarX = prevAbove ? midX : x(Math.max(prevD.avg, domainMin));
                    const prevBarW = Math.max(Math.abs(x(Math.min(Math.max(prevD.avg, domainMin), domainMax)) - midX), 1);
                    bar.attr('x', prevBarX).attr('width', prevBarW);
                } else {
                    bar.attr('x', midX).attr('width', 0);
                }
                bar.attr('fill', fillColor)
                    .transition('resize').delay(barDelay).duration(barDur).ease(d3.easeCubicOut)
                    .attr('x', barX)
                    .attr('width', barW);
            } else {
                bar.attr('x', barX).attr('width', barW).attr('fill', fillColor);
            }

            // Hover
            bar.on('mouseover', function(event) {
                d3.select(this).attr('fill', hoverColor);
                tooltip
                    .style('display', 'block')
                    .html(`<strong>${d.name}</strong><br/>Avg t-score: <strong>${d.avg.toFixed(2)}</strong><br/>Companies: ${d.count}`);
                // Clamp tooltip within container bounds
                const container = containerRef.current;
                const tipNode = tooltipRef.current;
                if (container && tipNode) {
                    const cRect = container.getBoundingClientRect();
                    const tW = tipNode.offsetWidth;
                    const tH = tipNode.offsetHeight;
                    let left = event.offsetX + 12;
                    let top = event.offsetY - 10;
                    if (left + tW > cRect.width) left = event.offsetX - tW - 12;
                    if (top + tH > cRect.height) top = cRect.height - tH - 4;
                    if (top < 0) top = 4;
                    tooltip.style('left', left + 'px').style('top', top + 'px');
                } else {
                    tooltip.style('left', (event.offsetX + 12) + 'px').style('top', (event.offsetY - 10) + 'px');
                }
            })
            .on('mouseout', function() {
                d3.select(this).attr('fill', fillColor);
                tooltip.style('display', 'none');
            });

            // ── Score + Name labels (overflow-aware) ──────────────
            const scoreEl = row.select('.gics-score');
            const nameEl = row.select('.gics-name');
            const scoreText = d.avg.toFixed(1);
            const gap = 5;   // bar-to-score gap
            const pad = 6;   // score-to-name gap
            const scoreColor = isBench ? benchmarkColor : (isAbove ? aboveColor : belowColor);

            // Render text first to measure widths
            scoreEl.text(scoreText).style('fill', scoreColor);
            nameEl.text(d.name)
                .style('fill', isBench ? benchmarkColor : '#555')
                .style('font-weight', isBench ? '700' : '400');

            const scoreW = scoreEl.node().getComputedTextLength ? scoreEl.node().getComputedTextLength() : 30;
            const nameW = nameEl.node().getComputedTextLength ? nameEl.node().getComputedTextLength() : 60;
            const totalLabelW = scoreW + pad + nameW + gap;

            // Decide label placement — 3 strategies:
            // 1. Default: outside the bar end (right for >=50, left for <50)
            // 2. If overflow: white text inside the bar (flipped side)
            // 3. If bar too short for white text: other side of 50, normal text
            const spaceRight = innerW - x(d.avg);
            const spaceLeft = x(d.avg);
            const barWidth = Math.abs(x(d.avg) - midX);
            let scoreX, nameX, textFill, nameFill;
            const normalScoreColor = scoreColor;
            const normalNameColor = isBench ? benchmarkColor : '#555';

            if (isAbove) {
                if (totalLabelW < spaceRight) {
                    // Case 1: fits right of bar end
                    scoreX = x(d.avg) + gap;
                    nameX = scoreX + scoreW + pad;
                    scoreEl.attr('text-anchor', 'start');
                    nameEl.attr('text-anchor', 'start');
                    textFill = normalScoreColor; nameFill = normalNameColor;
                } else if (totalLabelW < barWidth) {
                    // Case 2: fits inside bar — white text, anchored left from bar end
                    scoreX = x(d.avg) - gap;
                    nameX = scoreX - scoreW - pad;
                    scoreEl.attr('text-anchor', 'end');
                    nameEl.attr('text-anchor', 'end');
                    textFill = '#fff'; nameFill = '#fff';
                } else {
                    // Case 3: bar too short — push left of 50 midline, normal text
                    scoreX = midX - gap;
                    nameX = scoreX - scoreW - pad;
                    scoreEl.attr('text-anchor', 'end');
                    nameEl.attr('text-anchor', 'end');
                    textFill = normalScoreColor; nameFill = normalNameColor;
                }
            } else {
                if (totalLabelW < spaceLeft) {
                    // Case 1: fits left of bar end
                    scoreX = x(d.avg) - gap;
                    nameX = scoreX - scoreW - pad;
                    scoreEl.attr('text-anchor', 'end');
                    nameEl.attr('text-anchor', 'end');
                    textFill = normalScoreColor; nameFill = normalNameColor;
                } else if (totalLabelW < barWidth) {
                    // Case 2: fits inside bar — white text, anchored right from bar end
                    scoreX = x(d.avg) + gap;
                    nameX = scoreX + scoreW + pad;
                    scoreEl.attr('text-anchor', 'start');
                    nameEl.attr('text-anchor', 'start');
                    textFill = '#fff'; nameFill = '#fff';
                } else {
                    // Case 3: bar too short — push right of 50 midline, normal text
                    scoreX = midX + gap;
                    nameX = scoreX + scoreW + pad;
                    scoreEl.attr('text-anchor', 'start');
                    nameEl.attr('text-anchor', 'start');
                    textFill = normalScoreColor; nameFill = normalNameColor;
                }
            }

            scoreEl.style('fill', textFill);
            nameEl.style('fill', nameFill);

            if (canTransition) {
                scoreEl.transition('resize').delay(barDelay).duration(barDur).attr('x', scoreX);
                nameEl.transition('resize').delay(barDelay).duration(barDur).attr('x', nameX);
            } else {
                scoreEl.attr('x', scoreX);
                nameEl.attr('x', nameX);
            }

        });

        // ── Footnote ─────────────────────────────────────────────────
        svg.append('text')
            .attr('class', 'gics-footnote')
            .attr('x', width - margin.right)
            .attr('y', height - 2)
            .attr('text-anchor', 'end')
            .attr('font-size', '10px')
            .attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif')
            .attr('fill', '#999')
            .text('Some datasets are relativized. Sector averages converge to 50 by design.');

        // Save for next render
        prevBarData.current = finalData;

    }, [data, selectedCompanies, selectedPillar, selectedElement, shouldAnimate]);

    return (
        <div className="gics-chart-container" ref={containerRef}>
            <ChartHeader selectedPillar={selectedPillar} selectedElement={selectedElement} />
            <div style={{ position: 'relative' }}>
                <svg ref={svgRef}></svg>
                <div ref={tooltipRef} className="chart-tooltip" style={{display:'none'}}></div>
            </div>
        </div>
    );
}
