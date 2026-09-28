/**
 * Box Plot Component — D3 enter/update/exit for smooth transitions
 * Keyed joins on categories and dots; no full DOM teardown.
 */
function BoxPlot({ data, selectedCompanies, selectedPillar, selectedElement, shouldAnimate }) {
    const svgRef = useRef();
    const containerRef = useRef();
    const tooltipRef = useRef();
    const prevState = useRef(null);
    const layersRef = useRef(null);  // persistent D3 layer selections

    useEffect(() => {
        if (!svgRef.current || !data || !data.companies) return;

        // ── Categories ────────────────────────────────────────────────
        let categories;
        if (selectedPillar === 'Overall Board Score') {
            categories = [
                ...PILLAR_ORDER.map(key => ({
                    key, label: PILLAR_ELEMENTS[key].name, isPillar: true
                })),
                { key: 'Overall', label: 'Overall Board Score', isPillar: true }
            ];
        } else {
            const pillarElements = PILLAR_ELEMENTS[selectedPillar].elements;
            const orderedKeys = INDICATOR_ORDER[selectedPillar] || Object.keys(pillarElements);
            categories = orderedKeys.map(key => ({
                key, label: pillarElements[key].name, isPillar: false, pillar: selectedPillar
            }));
        }

        // ── Selected companies ────────────────────────────────────────
        const selectedTickers = new Set(selectedCompanies.map(c => c.ticker));
        const selectedColorMap = {};
        selectedCompanies.forEach((company, idx) => {
            selectedColorMap[company.ticker] = COMPANY_COLORS[idx % COMPANY_COLORS.length];
        });

        // ── Score computation ─────────────────────────────────────────
        const categoryData = categories.map(cat => {
            const scores = data.companies.map(company => {
                let score = null;
                try {
                    if (cat.isPillar) {
                        score = cat.key === 'Overall'
                            ? (company.overall_score ?? null)
                            : (company.pillar_scores?.[cat.key]?.t_score ?? null);
                    } else if (cat.pillar) {
                        score = company.pillar_scores?.[cat.pillar]?.indicators?.[cat.key] ?? null;
                    }
                } catch (e) { score = null; }
                return { company, score, category: cat.key };
            }).filter(d => d.score != null && !isNaN(d.score));

            const values = scores.map(d => d.score).sort(d3.ascending);
            if (values.length === 0) return null;

            const q1 = d3.quantile(values, 0.25) || 50;
            const median = d3.quantile(values, 0.5) || 50;
            const q3 = d3.quantile(values, 0.75) || 50;
            const iqr = q3 - q1;
            return {
                category: cat.key, label: cat.label, scores,
                q1, median, q3,
                min: Math.max(d3.min(values) || 0, q1 - 1.5 * iqr),
                max: Math.min(d3.max(values) || 100, q3 + 1.5 * iqr)
            };
        }).filter(Boolean);

        // ── Layout ────────────────────────────────────────────────────
        const totalWidth = (() => {
            if (!containerRef.current) return 700;
            const cs = window.getComputedStyle(containerRef.current);
            return containerRef.current.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
        })();

        if (categoryData.length === 0) {
            d3.select(svgRef.current).selectAll('*').remove();
            layersRef.current = null;
            d3.select(svgRef.current).attr('width', totalWidth).attr('height', 200)
                .append('text').attr('x', totalWidth / 2).attr('y', 100)
                .attr('text-anchor', 'middle').attr('font-size', '14px')
                .attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif').attr('fill', '#666')
                .text('No data available for this selection');
            return;
        }

        const baseHeight = 570;
        const margin = { top: 34, right: 50, bottom: 100, left: 50 };
        const width = totalWidth - margin.left - margin.right;
        const height = baseHeight - margin.top - margin.bottom;

        const xScale = d3.scaleBand().domain(categoryData.map(c => c.category)).range([0, width]).padding(0.2);
        // Scale must cover ALL data points, not just whisker fences
        // Y-scale: symmetric around 50, default 0–100, expands if needed
        const allScores = categoryData.flatMap(d => d.scores.map(s => s.score));
        const dataMin = d3.min(allScores) ?? 0;
        const dataMax = d3.max(allScores) ?? 100;
        const loFloor = Math.min(dataMin - 5, 0);
        const hiCeil = Math.max(dataMax + 5, 100);
        const spread = Math.max(50 - loFloor, hiCeil - 50);
        const yScale = d3.scaleLinear().domain([50 - spread, 50 + spread]).range([height, 0]);
        const boxWidth = xScale.bandwidth();
        const boxThickness = Math.min(boxWidth * 0.5, 30);
        const y50 = yScale(50);

        // ── Jitter helper ─────────────────────────────────────────────
        const getJitter = (ticker, categoryKey, maxJitter) => {
            let hash = 0;
            const str = ticker + categoryKey;
            for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash = hash & hash; }
            return ((Math.abs(hash) % 1000) / 1000 - 0.5) * maxJitter;
        };

        // ── Transition config ─────────────────────────────────────────
        const prev = prevState.current;
        const canAnimate = shouldAnimate && !selectedElement && prev;
        const dur = 600;
        const ease = d3.easeCubicOut;

        // ── Create persistent layers (once) ───────────────────────────
        const svgEl = d3.select(svgRef.current)
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);

        let layers = layersRef.current;
        if (!layers) {
            svgEl.selectAll('*').remove();
            const g = svgEl.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
            layers = {
                gridlines: g.append('g').attr('class', 'bp-gridlines'),
                baseline: g.append('line').attr('class', 'bp-baseline'),
                baselineLabel: g.append('text').attr('class', 'bp-baseline-label'),
                data: g.append('g').attr('class', 'bp-data'),
                labels: g.append('g').attr('class', 'bp-labels'),
                axisLeft: g.append('g').attr('class', 'bp-axis-left'),
                axisBottom: g.append('g').attr('class', 'bp-axis-bottom'),
                xLabels: g.append('g').attr('class', 'bp-xlabels'),
            };
            // Style baseline once — position is constant (always height/2)
            layers.baseline
                .attr('x1', 0).attr('x2', width)
                .attr('y1', height / 2).attr('y2', height / 2)
                .attr('stroke', '#0A2239').attr('stroke-width', 1).attr('opacity', 0.35);
            layers.baselineLabel
                .attr('x', width + 4).attr('y', height / 2 + 4)
                .attr('font-size', '10px').attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif')
                .attr('fill', '#0A2239').attr('opacity', 0.5).text('50');
            // t-score label at top of y-axis
            g.selectAll('.bp-tscore-label').remove();
            g.append('text').attr('class', 'bp-tscore-label')
                .attr('x', -8).attr('y', -14)
                .attr('text-anchor', 'start')
                .attr('font-size', '12px').attr('font-weight', '600')
                .attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif')
                .attr('fill', '#8B8178').text('t-score');
            // Bottom axis position is fixed
            layers.axisBottom.attr('transform', `translate(0,${height})`);
            layersRef.current = layers;
        }

        // ── Axes: transition y-axis labels, keep x-axis stable ────────
        // Adaptive ticks — drop values too close to domain edges
        const tickCount = spread > 60 ? 6 : 8;
        const domainLo = 50 - spread, domainHi = 50 + spread;

        // ── Horizontal gridlines ──────────────────────────────────────
        layers.gridlines.selectAll('line').remove();
        const gridTicks = yScale.ticks(tickCount).filter(d => d !== 50);
        gridTicks.forEach(t => {
            layers.gridlines.append('line')
                .attr('x1', 0).attr('x2', width)
                .attr('y1', yScale(t)).attr('y2', yScale(t))
                .attr('stroke', '#E0DDD3').attr('stroke-width', 0.5);
        });
        const axisGen = d3.axisLeft(yScale)
            .ticks(tickCount)
            .tickValues(yScale.ticks(tickCount).filter(d => d > domainLo + 10 && d < domainHi - 10));
        if (canAnimate) {
            layers.axisLeft.transition().duration(dur).ease(ease).call(axisGen);
        } else {
            layers.axisLeft.call(axisGen);
        }
        layers.axisBottom.call(d3.axisBottom(xScale).tickFormat(() => ''));

        layers.xLabels.selectAll('*').remove();
        renderAdaptiveLabels(layers.xLabels, categoryData.map(cat => ({
            label: cat.label,
            xCenter: xScale(cat.category) + boxWidth / 2,
            key: cat.category,
        })), { bandwidth: boxWidth, yBaseline: height + 25, selectedElement });

        const tooltip = d3.select(tooltipRef.current);
        const maxJitter = Math.min(boxWidth * 0.6, 40);
        const capHalf = boxThickness / 3;

        // ═══════════════════════════════════════════════════════════════
        //  KEYED JOIN: category groups
        // ═══════════════════════════════════════════════════════════════
        const catJoin = layers.data.selectAll('.bp-cat')
            .data(categoryData, d => d.category);

        // EXIT categories
        catJoin.exit()
            .transition().duration(dur).style('opacity', 0)
            .remove();

        // ENTER categories — create group with sub-elements
        const catEnter = catJoin.enter().append('g').attr('class', 'bp-cat')
            .style('opacity', 0);
        catEnter.append('line').attr('class', 'bp-whi-lo');
        catEnter.append('line').attr('class', 'bp-whi-hi');
        catEnter.append('line').attr('class', 'bp-cap-lo');
        catEnter.append('line').attr('class', 'bp-cap-hi');
        catEnter.append('rect').attr('class', 'bp-box');
        catEnter.append('line').attr('class', 'bp-med');
        catEnter.append('text').attr('class', 'bp-discrete');

        // MERGE
        const catMerge = catEnter.merge(catJoin);

        // Update each category
        catMerge.each(function(cat) {
            const g = d3.select(this);
            const xCenter = xScale(cat.category) + boxWidth / 2;
            const dimmed = selectedElement && cat.category !== selectedElement;
            const t = canAnimate ? g.transition().duration(dur).ease(ease) : g;
            t.style('opacity', dimmed ? 0.3 : 1);

            const yMin = yScale(cat.min), yMax = yScale(cat.max);
            const yQ1 = yScale(cat.q1), yQ3 = yScale(cat.q3);
            const yMed = yScale(cat.median);

            // Discrete detection
            const uniqueScores = new Set(cat.scores.map(d => d.score));
            const isDiscrete = uniqueScores.size < 30;

            // Is this an entering category (just created) or an existing one?
            const isEntering = !g.select('.bp-box').attr('y');

            // Transition only existing elements; entering ones snap to position
            const tw = (sel, attrs) => {
                if (canAnimate && !isEntering) {
                    const s = sel.transition().duration(dur).ease(ease);
                    for (const [k, v] of Object.entries(attrs)) s.attr(k, v);
                } else {
                    for (const [k, v] of Object.entries(attrs)) sel.attr(k, v);
                }
                return sel;
            };

            // Whisker low
            tw(g.select('.bp-whi-lo')
                .attr('x1', xCenter).attr('x2', xCenter)
                .attr('stroke', '#999').attr('stroke-width', 1.5),
                { y1: yMin, y2: yQ1 });

            // Whisker high
            tw(g.select('.bp-whi-hi')
                .attr('x1', xCenter).attr('x2', xCenter)
                .attr('stroke', '#999').attr('stroke-width', 1.5),
                { y1: yQ3, y2: yMax });

            // Cap low
            tw(g.select('.bp-cap-lo')
                .attr('x1', xCenter - capHalf).attr('x2', xCenter + capHalf)
                .attr('stroke', '#999').attr('stroke-width', 1.5),
                { y1: yMin, y2: yMin });

            // Cap high
            tw(g.select('.bp-cap-hi')
                .attr('x1', xCenter - capHalf).attr('x2', xCenter + capHalf)
                .attr('stroke', '#999').attr('stroke-width', 1.5),
                { y1: yMax, y2: yMax });

            // Box
            tw(g.select('.bp-box')
                .attr('x', xCenter - boxThickness / 2).attr('width', boxThickness)
                .attr('fill', '#E0DDD3').attr('stroke', BASELINE_COLOR).attr('stroke-width', 1.5),
                { y: yQ3, height: Math.max(yQ1 - yQ3, 0) });

            // Median
            tw(g.select('.bp-med')
                .attr('x1', xCenter - boxThickness / 2).attr('x2', xCenter + boxThickness / 2)
                .attr('stroke', BASELINE_COLOR).attr('stroke-width', 2.5),
                { y1: yMed, y2: yMed });

            // Discrete annotation
            g.select('.bp-discrete')
                .attr('x', xCenter).attr('y', 10)
                .attr('text-anchor', 'middle')
                .attr('font-size', '8px').attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif')
                .attr('fill', '#B8925A').attr('opacity', isDiscrete ? (dimmed ? 0.3 : 0.7) : 0)
                .text(isDiscrete ? `${uniqueScores.size} discrete values` : '');

            // ── Dots: keyed by ticker ─────────────────────────────────
            cat.scores.forEach(d => {
                d.jitterX = xCenter + getJitter(d.company.ticker, cat.category, maxJitter);
                d.jitterY = isDiscrete ? getJitter(d.company.ticker, cat.category + '_y', 1.0) : 0;
            });

            // ── Cloud dots: all companies at low opacity ────────────────
            const cloudData = cat.scores.filter(d => !selectedTickers.has(d.company.ticker));
            const cloudJoin = g.selectAll('.bp-cloud')
                .data(cloudData, d => d.company.ticker);

            cloudJoin.exit().remove();

            const cloudEnter = cloudJoin.enter().append('circle')
                .attr('class', 'bp-cloud')
                .attr('r', 2)
                .attr('fill', '#999')
                .attr('stroke', 'none')
                .attr('cx', d => d.jitterX)
                .attr('cy', d => yScale(d.score + d.jitterY))
                .attr('opacity', 0);

            if (canAnimate) {
                cloudEnter.transition().duration(dur).ease(ease).attr('opacity', 0.15);
            } else {
                cloudEnter.attr('opacity', 0.15);
            }

            cloudJoin.each(function(d) {
                const dot = d3.select(this);
                dot.attr('cx', d.jitterX);
                if (canAnimate) {
                    dot.transition().duration(dur).ease(ease)
                        .attr('cy', yScale(d.score + d.jitterY))
                        .attr('opacity', dimmed ? 0.06 : 0.15);
                } else {
                    dot.attr('cy', yScale(d.score + d.jitterY))
                        .attr('opacity', dimmed ? 0.06 : 0.15);
                }
            });

            // ── Selected company dots: ticker colors ─────────────────
            const dotData = cat.scores.filter(d => selectedTickers.has(d.company.ticker));
            const dotJoin = g.selectAll('.bp-dot')
                .data(dotData, d => d.company.ticker);

            dotJoin.exit()
                .transition().duration(dur / 2).attr('opacity', 0)
                .remove();

            const dotEnter = dotJoin.enter().append('circle')
                .attr('class', 'bp-dot')
                .attr('r', 4)
                .attr('stroke', '#ffffff').attr('stroke-width', 0.5)
                .attr('fill', d => selectedColorMap[d.company.ticker])
                .attr('cx', d => d.jitterX)
                .attr('cy', d => yScale(d.score + d.jitterY))
                .attr('opacity', 0);

            if (canAnimate) {
                dotEnter.transition().duration(dur).ease(ease).attr('opacity', 1);
            } else {
                dotEnter.attr('opacity', 1);
            }

            dotJoin.each(function(d) {
                const dot = d3.select(this);
                const targetCy = yScale(d.score + d.jitterY);
                dot.attr('fill', selectedColorMap[d.company.ticker]).attr('cx', d.jitterX);
                if (canAnimate) {
                    dot.transition().duration(dur).ease(ease)
                        .attr('cy', targetCy).attr('opacity', 1);
                } else {
                    dot.attr('cy', targetCy).attr('opacity', 1);
                }
            });

            // Hover events on selected dots
            dotEnter.merge(dotJoin)
                .on('mouseenter', function(event, d) {
                    d3.select(this).attr('r', 6).attr('opacity', 1);
                    tooltip.style('display', 'block')
                        .style('left', (event.offsetX + 12) + 'px')
                        .style('top', (event.offsetY - 10) + 'px')
                        .html(`<strong>${d.company.ticker}</strong> — ${d.company.name}<br/><span class="tooltip-label">${cat.label}</span><br/><span class="tooltip-score">${d.score.toFixed(1)}</span>`);
                })
                .on('mouseleave', function(event, d) {
                    d3.select(this).attr('r', 4).attr('opacity', 1);
                    tooltip.style('display', 'none');
                });
        });

        // ═══════════════════════════════════════════════════════════════
        //  LABELS — rebuilt each time (small count, collision logic)
        // ═══════════════════════════════════════════════════════════════
        layers.labels.selectAll('*').remove();

        categoryData.forEach(cat => {
            const xCenter = xScale(cat.category) + boxWidth / 2;
            const dimmed = selectedElement && cat.category !== selectedElement;
            const uniqueScores = new Set(cat.scores.map(d => d.score));
            const isDiscrete = uniqueScores.size < 30;

            const selectedScores = cat.scores
                .filter(d => selectedTickers.has(d.company.ticker))
                .sort((a, b) => b.score - a.score);

            if (selectedScores.length === 0) return;

            const labelFontSize = 12;
            const labelH = 15;
            const labelJitterRange = Math.min(boxWidth * 0.35, 28);
            const labelOpacity = dimmed ? 0.25 : 1;

            const labelPositions = selectedScores.map((d, idx) => {
                const side = idx % 2 === 0 ? -1 : 1;
                const jY = isDiscrete ? getJitter(d.company.ticker, cat.category + '_y', 1.0) : 0;
                const labelX = d.jitterX + side * labelJitterRange * (0.4 + 0.6 * Math.abs(getJitter(d.company.ticker, cat.category + '_lx', 1)));
                const clampedX = Math.max(xScale(cat.category) + 4, Math.min(xScale(cat.category) + boxWidth - 4, labelX));
                const dotY = yScale(d.score + jY);
                return { d, baseY: dotY - 8, finalY: dotY - 8, dotY, labelX: clampedX };
            });

            for (let pass = 0; pass < 8; pass++) {
                for (let i = 1; i < labelPositions.length; i++) {
                    const overlap = (labelPositions[i - 1].finalY + labelH) - labelPositions[i].finalY;
                    if (overlap > 0) {
                        labelPositions[i - 1].finalY -= overlap / 2 + 1;
                        labelPositions[i].finalY += overlap / 2 + 1;
                    }
                }
            }

            labelPositions.forEach(lp => {
                const d = lp.d;
                const color = selectedColorMap[d.company.ticker];
                const nudged = Math.abs(lp.finalY - lp.baseY) > 2 || Math.abs(lp.labelX - d.jitterX) > 3;

                if (nudged) {
                    layers.labels.append('line')
                        .attr('x1', d.jitterX).attr('x2', lp.labelX)
                        .attr('y1', lp.dotY - 4).attr('y2', lp.finalY + 3)
                        .attr('stroke', color).attr('stroke-width', 0.75)
                        .attr('opacity', dimmed ? 0.15 : 0.5);
                }

                layers.labels.append('text')
                    .attr('x', lp.labelX).attr('y', lp.finalY)
                    .attr('text-anchor', 'middle')
                    .attr('font-size', `${labelFontSize}px`).attr('font-weight', '600')
                    .attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif')
                    .attr('fill', color)
                    .attr('opacity', labelOpacity)
                    .text(d.company.ticker);
            });
        });

        // ── Save state ────────────────────────────────────────────────
        prevState.current = { categoryData };

    }, [data, selectedCompanies, selectedPillar, selectedElement]);

    return (
        <div className="box-plot-container" ref={containerRef} style={{position:'relative'}}>
            <ChartHeader selectedPillar={selectedPillar} selectedElement={selectedElement} />
            <svg ref={svgRef}></svg>
            <div ref={tooltipRef} className="chart-tooltip" />
        </div>
    );
}
