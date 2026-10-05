/**
 * Lollipop Chart Component
 * Horizontal lollipop: each selected company is a row with a line from 50 to their score
 * Animated: rows migrate to new sorted positions, dots slide to new scores
 */
function GroupedBarChart({ data, selectedCompanies, selectedPillar, selectedElement, shouldAnimate, rowHeight = 32 }) {
    const svgRef = useRef();
    const containerRef = useRef();
    const tooltipRef = useRef();
    const prevBarData = useRef(null);

    useEffect(() => {
        if (!svgRef.current || !data) return;

        const totalWidth = (() => {
            if (!containerRef.current) return 700;
            const cs = window.getComputedStyle(containerRef.current);
            const hPad = parseFloat(cs.paddingLeft || 0) + parseFloat(cs.paddingRight || 0);
            return containerRef.current.clientWidth - hPad;
        })();

        if (!selectedCompanies || selectedCompanies.length === 0) {
            d3.select(svgRef.current).selectAll('*').remove();
            prevBarData.current = null;
            return;
        }

        // ── Build row data ────────────────────────────────────────────
        const rowData = selectedCompanies.map((company, idx) => {
            let score = null;
            try {
                if (selectedElement) {
                    const pd = company.pillar_scores?.[selectedPillar];
                    if (pd?.indicators) {
                        const v = pd.indicators[selectedElement];
                        if (v != null && !isNaN(v)) score = v;
                    }
                } else if (selectedPillar === 'Overall Board Score') {
                    const v = company.overall_score;
                    score = (v != null && !isNaN(v)) ? v : null;
                } else {
                    const v = company.pillar_scores?.[selectedPillar]?.t_score;
                    score = (v != null && !isNaN(v)) ? v : null;
                }
            } catch (e) { /* score stays null */ }

            return {
                ticker: company.ticker,
                name: company.name,
                score,
                color: COMPANY_COLORS[idx % COMPANY_COLORS.length]
            };
        }).filter(d => d.score != null).sort((a, b) => b.score - a.score);

        // ── S&P 500 average — inserted as a row ──────────────────────
        let sp500Avg = 50;
        if (data.companies) {
            const allScores = data.companies.map(c => {
                try {
                    if (selectedElement) {
                        return c.pillar_scores?.[selectedPillar]?.indicators?.[selectedElement];
                    } else if (selectedPillar === 'Overall Board Score') {
                        return c.overall_score || null;
                    } else {
                        return c.pillar_scores?.[selectedPillar]?.t_score;
                    }
                } catch (e) { return null; }
            }).filter(v => v != null && !isNaN(v));
            if (allScores.length > 0) sp500Avg = allScores.reduce((a, b) => a + b, 0) / allScores.length;
        }

        // Insert S&P 500 Avg as a benchmark row
        const benchmarkRow = { ticker: 'S\u2009&\u2009P 500 Avg', name: 'S&P 500 Average', score: sp500Avg, color: '#0A2239', isBenchmark: true };
        let inserted = false;
        const finalData = [];
        for (const d of rowData) {
            if (!inserted && sp500Avg >= d.score) {
                finalData.push(benchmarkRow);
                inserted = true;
            }
            finalData.push(d);
        }
        if (!inserted) finalData.push(benchmarkRow);

        // ── Layout ────────────────────────────────────────────────────
        const margin = { top: 40, right: 20, bottom: 12, left: 20 };
        const rowH = rowHeight;
        const rowGap = 3;
        const chartHeight = finalData.length * (rowH + rowGap);
        const height = margin.top + chartHeight + margin.bottom;
        const width = totalWidth;
        const innerW = width - margin.left - margin.right;

        // ── Scales ────────────────────────────────────────────────────
        const minVal = Math.min(d3.min(finalData, d => d.score), sp500Avg);
        const maxVal = Math.max(d3.max(finalData, d => d.score), sp500Avg);
        const extent = Math.max(maxVal - 50, 50 - minVal, 8);
        const domainMin = Math.max(0, 50 - extent - 3);
        const domainMax = Math.min(100, 50 + extent + 3);

        const x = d3.scaleLinear().domain([domainMin, domainMax]).range([0, innerW]);
        const midX = x(50);

        // ── Transition setup ──────────────────────────────────────────
        const prev = prevBarData.current;
        const canTransition = shouldAnimate && prev && prev.length > 0;
        const prevMap = {};
        if (prev) prev.forEach((d, i) => { prevMap[d.ticker] = { y: i * (rowH + rowGap), score: d.score }; });

        const dur = 400;
        const ease = d3.easeCubicInOut;

        const svg = d3.select(svgRef.current).attr('width', width);
        if (canTransition) {
            svg.transition().duration(dur).attr('height', height);
        } else {
            svg.attr('height', height);
        }

        // ── Static layer (axis, gridlines) ────────────────────────────
        svg.selectAll('.lp-static').remove();
        const staticG = svg.append('g').attr('class', 'lp-static')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Tick values
        const tickValues = [];
        const step = extent > 20 ? 10 : 5;
        for (let v = Math.ceil(domainMin / step) * step; v <= domainMax; v += step) tickValues.push(v);

        const topAxis = staticG.append('g')
            .call(d3.axisTop(x).tickValues(tickValues).tickSize(0).tickPadding(8));
        topAxis.select('.domain').remove();
        topAxis.selectAll('text')
            .style('font-family', "'acumin-pro', 'IBM Plex Sans', sans-serif")
            .style('font-size', '11px').style('fill', '#8B8178')
            .style('font-weight', d => d === 50 ? '700' : '400');

        // Midline at 50
        staticG.append('line').attr('x1', midX).attr('x2', midX)
            .attr('y1', 0).attr('y2', chartHeight)
            .attr('stroke', '#8B8178').attr('stroke-width', 1);

        // Gridlines
        tickValues.filter(v => v !== 50).forEach(v => {
            staticG.append('line').attr('x1', x(v)).attr('x2', x(v))
                .attr('y1', 0).attr('y2', chartHeight)
                .attr('stroke', '#E0DDD3').attr('stroke-width', 0.5);
        });

        // Label at 50
        staticG.append('text').attr('x', midX).attr('y', -22)
            .attr('text-anchor', 'middle')
            .style('font-family', "'acumin-pro', 'IBM Plex Sans', sans-serif")
            .style('font-size', '12px').style('font-weight', '600').style('fill', '#8B8178')
            .text('t-score');

        // ── Data layer — keyed join ───────────────────────────────────
        let dataG = svg.select('.lp-data');
        if (dataG.empty()) dataG = svg.append('g').attr('class', 'lp-data');
        dataG.attr('transform', `translate(${margin.left},${margin.top})`);

        const tooltip = d3.select(tooltipRef.current);
        const rows = dataG.selectAll('.lp-row').data(finalData, d => d.ticker);

        // EXIT
        rows.exit().transition().duration(dur).style('opacity', 0).remove();

        // ENTER
        const enter = rows.enter().append('g').attr('class', 'lp-row')
            .attr('transform', (d, i) => {
                if (canTransition && prevMap[d.ticker]) return `translate(0,${prevMap[d.ticker].y})`;
                return `translate(0,${i * (rowH + rowGap)})`;
            })
            .style('opacity', canTransition ? 0 : 1);

        // Bar rect
        const barHeight = rowH - 6;
        const barY = 3;
        enter.append('rect').attr('class', 'lp-bar')
            .attr('y', barY).attr('height', barHeight)
            .attr('rx', 2)
            .style('cursor', 'pointer');

        // Ticker label
        enter.append('text').attr('class', 'lp-ticker')
            .attr('y', rowH / 2).attr('dominant-baseline', 'central')
            .style('font-family', "'acumin-pro', 'IBM Plex Sans', sans-serif")
            .style('font-size', '11px').style('font-weight', '700');

        // Score label
        enter.append('text').attr('class', 'lp-score')
            .attr('y', rowH / 2).attr('dominant-baseline', 'central')
            .style('font-family', "'acumin-pro', 'IBM Plex Sans', sans-serif")
            .style('font-size', '11px').style('font-weight', '600');

        // ENTER + UPDATE
        const merged = enter.merge(rows);

        // Phase 1: migrate rows to new y
        if (canTransition) {
            merged.transition('move').duration(dur).ease(ease)
                .attr('transform', (d, i) => `translate(0,${i * (rowH + rowGap)})`)
                .style('opacity', 1);
        } else {
            merged.attr('transform', (d, i) => `translate(0,${i * (rowH + rowGap)})`).style('opacity', 1);
        }

        // Phase 2: update positions within rows
        const barDelay = canTransition ? dur * 0.4 : 0;
        const barDur = canTransition ? 300 : 0;

        merged.each(function(d) {
            const row = d3.select(this);
            const isAbove = d.score >= 50;
            const dotX = x(d.score);
            const stemStart = midX;

            // Company color for bars; navy for benchmark
            const rowColor = d.isBenchmark ? '#0A2239' : d.color;
            const barX = isAbove ? midX : x(d.score);
            const barW = Math.max(Math.abs(dotX - midX), 1);

            // Bar
            const bar = row.select('.lp-bar');
            bar.attr('fill', rowColor).attr('opacity', d.isBenchmark ? 0.85 : 0.75);
            if (canTransition) {
                const prevD = prevMap[d.ticker];
                if (prevD) {
                    const prevAbove = prevD.score >= 50;
                    const prevBarX = prevAbove ? midX : x(prevD.score);
                    const prevBarW = Math.max(Math.abs(x(prevD.score) - midX), 1);
                    bar.attr('x', prevBarX).attr('width', prevBarW);
                } else {
                    bar.attr('x', midX).attr('width', 0);
                }
                bar.transition('grow').delay(barDelay).duration(barDur).ease(d3.easeCubicOut)
                    .attr('x', barX).attr('width', barW);
            } else {
                bar.attr('x', midX).attr('width', 0)
                    .transition('grow').duration(barDur).ease(d3.easeCubicOut)
                    .attr('x', barX).attr('width', barW);
            }

            // Hover
            const hoverColor = d.isBenchmark ? '#0F1D33' : d3.color(rowColor).darker(0.4);
            bar.on('mouseover', function(event) {
                d3.select(this).attr('opacity', 1);
                tooltip.style('display', 'block')
                    .style('left', (event.offsetX + 12) + 'px')
                    .style('top', (event.offsetY - 10) + 'px')
                    .html(`<strong style="color:${rowColor}">${d.ticker}</strong> ${d.name}<br/>t-score: <strong>${d.score.toFixed(1)}</strong>`);
            })
            .on('mouseout', function() {
                d3.select(this).attr('opacity', d.isBenchmark ? 0.85 : 0.75);
                tooltip.style('display', 'none');
            });

            // ── Score + Ticker labels (overflow-aware, GICS-style) ──
            const scoreEl = row.select('.lp-score');
            const tickerEl = row.select('.lp-ticker');
            const scoreText = d.score.toFixed(1);
            const gap = 6;
            const pad = 5;

            tickerEl.style('font-weight', d.isBenchmark ? '800' : '700');
            scoreEl.style('font-weight', d.isBenchmark ? '700' : '600');

            scoreEl.text(scoreText);
            tickerEl.text(d.ticker);
            const scoreW = scoreEl.node().getComputedTextLength ? scoreEl.node().getComputedTextLength() : 30;
            const tickerW = tickerEl.node().getComputedTextLength ? tickerEl.node().getComputedTextLength() : 40;
            const totalLabelW = gap + scoreW + pad + tickerW;

            // Place labels at bar end; flip if they'd overflow
            const barEnd = isAbove ? barX + barW : barX;
            const spaceRight = innerW - barEnd;
            const spaceLeft = barEnd;
            let labelSide;
            if (isAbove) {
                labelSide = (totalLabelW < spaceRight) ? 'right' : 'left';
            } else {
                labelSide = (totalLabelW < spaceLeft) ? 'left' : 'right';
            }

            const textColor = rowColor;
            const tickerColor = d.isBenchmark ? '#0A2239' : '#555';
            const flipped = (isAbove && labelSide === 'left') || (!isAbove && labelSide === 'right');

            let scoreX, tickerX;
            if (labelSide === 'right') {
                const anchor = flipped ? midX + gap : barEnd + gap;
                scoreX = anchor;
                tickerX = anchor + scoreW + pad;
                scoreEl.attr('text-anchor', 'start');
                tickerEl.attr('text-anchor', 'start');
            } else {
                const anchor = flipped ? midX - gap : barEnd - gap;
                scoreX = anchor;
                tickerX = anchor - scoreW - pad;
                scoreEl.attr('text-anchor', 'end');
                tickerEl.attr('text-anchor', 'end');
            }

            scoreEl.style('fill', textColor);
            tickerEl.style('fill', tickerColor);

            if (canTransition) {
                scoreEl.transition('grow').delay(barDelay).duration(barDur).attr('x', scoreX);
                tickerEl.transition('grow').delay(barDelay).duration(barDur).attr('x', tickerX);
            } else {
                scoreEl.attr('x', scoreX);
                tickerEl.attr('x', tickerX);
            }
        });

        prevBarData.current = finalData;

    }, [data, selectedCompanies, selectedPillar, selectedElement, shouldAnimate, rowHeight]);

    return (
        <div className="grouped-bar-container" ref={containerRef} style={{position:'relative'}}>
            <ChartHeader selectedPillar={selectedPillar} selectedElement={selectedElement} />
            <div style={{position:'relative'}}>
                <svg ref={svgRef}></svg>
                <div ref={tooltipRef} className="chart-tooltip" style={{display:'none'}}></div>
            </div>
        </div>
    );
}
