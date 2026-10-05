/**
 * Report Cards Component
 * Shows all selected companies with individual radar charts
 */
function ReportCards({ data, selectedCompanies, chartData, selectedPillar, selectedElement, shouldAnimate, justAddedTicker }) {
    // Sort companies by the active selection: indicator > pillar > overall
    const sortedCompanies = useMemo(() => {
        return [...selectedCompanies].sort((a, b) => {
            const getScore = (comp) => {
                if (selectedElement && selectedPillar !== 'Overall Board Score') {
                    return comp.pillar_scores?.[selectedPillar]?.indicators?.[selectedElement] ?? -Infinity;
                }
                if (selectedPillar === 'Overall Board Score') {
                    return comp.overall_score ?? -Infinity;
                }
                return comp.pillar_scores?.[selectedPillar]?.t_score ?? -Infinity;
            };
            return getScore(b) - getScore(a);
        });
    }, [selectedCompanies, selectedPillar, selectedElement]);

    if (selectedCompanies.length === 0) {
        return (
            <div className="report-cards-container">
                <ChartHeader selectedPillar={selectedPillar} selectedElement={selectedElement} />
                <div className="empty-state">
                    <p>Select companies to see individual performance reports</p>
                </div>
            </div>
        );
    }

    const gridCols = Math.min(sortedCompanies.length, 3);

    return (
        <div className="report-cards-container">
            <ChartHeader selectedPillar={selectedPillar} selectedElement={selectedElement} />
            <div className="report-cards-grid" style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
                {sortedCompanies.map((company, cardIdx) => {
                    const originalIndex = selectedCompanies.findIndex(c => c.ticker === company.ticker);
                    const companyColor = COMPANY_COLORS[originalIndex % COMPANY_COLORS.length];
                    return (
                        <ReportCard
                            key={company.ticker}
                            company={company}
                            color={companyColor}
                            chartData={chartData}
                            selectedPillar={selectedPillar}
                            selectedElement={selectedElement}
                            animDelay={null}
                            allCompanies={data.companies}
                            justAddedTicker={justAddedTicker}
                        />
                    );
                })}
            </div>
        </div>
    );
}

/**
 * Individual Report Card Component
 * Shows a single company with a radar chart
 */
function ReportCard({ company, color, chartData, selectedPillar, selectedElement, allCompanies, animDelay = 0, justAddedTicker, showHistogram = true, radarSize = 195, labelPad = 0 }) {
    const svgRef = useRef();
    const histSvgRef = useRef();

    // Overall rank (from pre-baked JSON data)
    const overallRank = company.overall_rank ?? '—';

    // Pillar rank (from pre-baked JSON data)
    const pillarRank = useMemo(() => {
        if (selectedPillar === 'Overall Board Score') return null;
        return company.pillar_scores?.[selectedPillar]?.rank ?? '—';
    }, [company, selectedPillar]);

    // Indicator rank (from pre-baked JSON data)
    const indicatorRank = useMemo(() => {
        if (!selectedElement || selectedPillar === 'Overall Board Score') return null;
        return company.pillar_scores?.[selectedPillar]?.indicator_ranks?.[selectedElement] ?? '—';
    }, [company, selectedPillar, selectedElement]);

    // Backward-compat: companyRank used by footer
    const companyRank = indicatorRank || pillarRank || overallRank;

    useEffect(() => {
        if (!svgRef.current || !chartData) return;

        // Clear previous chart
        d3.select(svgRef.current).selectAll('*').remove();

        const size = radarSize;
        const margin = 59 * (radarSize / 195);
        const radius = (size - margin * 2) / 2;

        // labelPad expands the canvas (not the radar) so side-pillar labels/highlight boxes aren't clipped.
        const pad = labelPad || 0;
        const svg = d3.select(svgRef.current)
            .attr('viewBox', `${-pad} ${-pad} ${size + 2 * pad} ${size + 2 * pad}`)
            .attr('width', size + 2 * pad)
            .attr('height', size + 2 * pad)
            .append('g')
            .attr('transform', `translate(${size / 2},${size / 2})`);

        // Find company data in chartData
        const companyData = chartData.companies.find(c => c.ticker === company.ticker);
        if (!companyData) return;

        const maxValue = chartData.maxValue;
        const minValue = chartData.minValue;

        // Pillar keys now match display names — highlight directly
        const highlightPillar = (selectedPillar !== 'Overall Board Score')
            ? (PILLAR_ELEMENTS[selectedPillar]?.name || null)
            : null;

        // Scale for radar chart
        const rScale = d3.scaleLinear()
            .domain([minValue, maxValue])
            .range([0, radius]);

        // Draw circular grid lines
        const gridLevels = 4;
        for (let i = 1; i <= gridLevels; i++) {
            const levelValue = minValue + (maxValue - minValue) * (i / gridLevels);
            svg.append('circle')
                .attr('r', rScale(levelValue))
                .attr('fill', 'none')
                .attr('stroke', '#ddd')
                .attr('stroke-width', 1);
        }

        // Draw axes
        companyData.data.forEach(d => {
            const angle = d.angle - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            svg.append('line')
                .attr('x1', 0)
                .attr('y1', 0)
                .attr('x2', x)
                .attr('y2', y)
                .attr('stroke', '#ddd')
                .attr('stroke-width', 1);
        });

        // Draw baseline (S&P 500 average) polygon in grey
        const baselinePoints = chartData.baseline.map(d => {
            const angle = d.angle - Math.PI / 2;
            const r = rScale(d.value ?? 0);
            return [Math.cos(angle) * r, Math.sin(angle) * r];
        });

        svg.append('polygon')
            .attr('points', baselinePoints.map(p => p.join(',')).join(' '))
            .attr('fill', '#999999')
            .attr('fill-opacity', 0.15)
            .attr('stroke', '#999999')
            .attr('stroke-width', 1.5)
            .attr('stroke-opacity', 0.5);

        // Draw company shape — only connect vertices with data
        const validData = companyData.data.filter(d => d.value != null);
        const hasGaps = validData.length < companyData.data.length;

        if (validData.length >= 3) {
            // Enough points for a filled polygon
            const companyPoints = validData.map(d => {
                const angle = d.angle - Math.PI / 2;
                const r = rScale(d.value);
                return [Math.cos(angle) * r, Math.sin(angle) * r];
            });

            svg.append('polygon')
                .attr('points', companyPoints.map(p => p.join(',')).join(' '))
                .attr('fill', color)
                .attr('fill-opacity', 0.2)
                .attr('stroke', color)
                .attr('stroke-width', 0.5)
                .attr('stroke-dasharray', hasGaps ? '4,3' : 'none');
        } else if (validData.length === 2) {
            // Two points — draw a line between them
            const pts = validData.map(d => {
                const angle = d.angle - Math.PI / 2;
                const r = rScale(d.value);
                return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
            });
            svg.append('line')
                .attr('x1', pts[0].x).attr('y1', pts[0].y)
                .attr('x2', pts[1].x).attr('y2', pts[1].y)
                .attr('stroke', '#0A2239').attr('stroke-width', 1.5)
                .attr('stroke-dasharray', '4,3');
        }

        // Dashed lines from center to missing-data axes
        companyData.data.filter(d => d.value == null).forEach(d => {
            const angle = d.angle - Math.PI / 2;
            const x = Math.cos(angle) * radius * 0.5;
            const y = Math.sin(angle) * radius * 0.5;
            svg.append('line')
                .attr('x1', 0).attr('y1', 0)
                .attr('x2', x).attr('y2', y)
                .attr('stroke', '#ccc').attr('stroke-width', 1)
                .attr('stroke-dasharray', '2,3');
        });

        // Draw dots on valid vertices
        validData.forEach(d => {
            const angle = d.angle - Math.PI / 2;
            const r = rScale(d.value);
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;

            svg.append('circle')
                .attr('cx', x)
                .attr('cy', y)
                .attr('r', 2)
                .attr('fill', '#0A2239')
                .attr('stroke', '#fff')
                .attr('stroke-width', 0.5);
        });

        // Add pillar labels with proper text anchoring
        companyData.data.forEach(d => {
            const angle = d.angle - Math.PI / 2;
            const labelRadius = radius + 16;
            const x = Math.cos(angle) * labelRadius;
            const y = Math.sin(angle) * labelRadius;

            // Check if this pillar should be highlighted
            const isHighlighted = highlightPillar && d.pillar === highlightPillar;
            const isMissing = d.value == null;

            // Determine text anchor based on position
            let textAnchor = 'middle';
            if (Math.abs(Math.cos(angle)) > 0.5) {
                textAnchor = Math.cos(angle) > 0 ? 'start' : 'end';
            }

            const text = svg.append('text')
                .attr('x', x)
                .attr('y', y)
                .attr('text-anchor', textAnchor)
                .attr('dominant-baseline', 'middle')
                .attr('font-size', isHighlighted ? '9px' : '8px')
                .attr('font-weight', isHighlighted ? '600' : 'normal')
                .attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif')
                .attr('fill', isMissing ? '#bbb' : (isHighlighted ? '#0A2239' : '#2C2C2C'));

            // Split label into words for wrapping
            const words = d.pillar.split(' ');
            if (words.length > 1) {
                words.forEach((word, i) => {
                    text.append('tspan')
                        .attr('x', x)
                        .attr('dy', i === 0 ? '-0.4em' : '1em')
                        .text(word);
                });
            } else {
                text.text(d.pillar);
            }

            // Add background box for highlighted labels
            if (isHighlighted) {
                // Get bounding box of the text
                const bbox = text.node().getBBox();
                const padding = 3;

                // Insert rectangle before the text
                svg.insert('rect', () => text.node())
                    .attr('x', bbox.x - padding)
                    .attr('y', bbox.y - padding)
                    .attr('width', bbox.width + padding * 2)
                    .attr('height', bbox.height + padding * 2)
                    .attr('fill', '#FFFFFF')
                    .attr('stroke', color)
                    .attr('stroke-width', 0.75)
                    .attr('rx', 2)
                    .attr('ry', 2);

                // Black text on white background
                text.attr('fill', '#2C2C2C');
            }
        });

    }, [company, color, chartData, selectedPillar, radarSize, labelPad]);

    // Histogram of S&P 500 distribution with company score highlighted
    useEffect(() => {
        if (!histSvgRef.current || !allCompanies || !showHistogram) return;

        d3.select(histSvgRef.current).selectAll('*').remove();

        // Gather scores — use indicator if selected, otherwise pillar
        const scores = allCompanies.map(c => {
            if (selectedElement && selectedPillar !== 'Overall Board Score') {
                return c.pillar_scores?.[selectedPillar]?.indicators?.[selectedElement] ?? null;
            }
            if (selectedPillar === 'Overall Board Score') return c.overall_score ?? null;
            return c.pillar_scores?.[selectedPillar]?.t_score ?? null;
        }).filter(s => s !== null && s !== undefined && !isNaN(s));

        let companyScore;
        if (selectedElement && selectedPillar !== 'Overall Board Score') {
            companyScore = company.pillar_scores?.[selectedPillar]?.indicators?.[selectedElement] ?? null;
        } else if (selectedPillar === 'Overall Board Score') {
            companyScore = company.overall_score ?? null;
        } else {
            companyScore = company.pillar_scores?.[selectedPillar]?.t_score ?? null;
        }

        const w = 160;
        const h = 90;
        const margin = { top: 19, right: 6, bottom: 16, left: 6 };
        const innerW = w - margin.left - margin.right;
        const innerH = h - margin.top - margin.bottom;

        const svg = d3.select(histSvgRef.current)
            .attr('viewBox', `0 0 ${w} ${h}`)
            .attr('width', w)
            .attr('height', h)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // X scale — default [20, 80], expand only if data exceeds that range
        const dataMin = d3.min(scores) ?? 20;
        const dataMax = d3.max(scores) ?? 80;
        const xLo = Math.min(20, Math.floor(dataMin - 2));
        const xHi = Math.max(80, Math.ceil(dataMax + 2));
        const xDomain = [xLo, xHi];

        const xScale = d3.scaleLinear()
            .domain(xDomain)
            .range([0, innerW]);

        // Bin the data — fixed 2.5-point bin width for visual consistency across pillars
        const fixedBinWidth = 2.5;
        const thresholds = d3.range(xDomain[0], xDomain[1], fixedBinWidth);
        const binner = d3.bin()
            .domain(xDomain)
            .thresholds(thresholds);
        const bins = binner(scores);

        // Distribution parameters
        const n = scores.length;
        const binWidth = fixedBinWidth;
        const uniqueValues = new Set(scores).size;
        const isContinuous = uniqueValues >= 10;

        // KDE (Kernel Density Estimation) for continuous data
        let kdePeak = 0;
        let kdePoints = [];
        if (isContinuous) {
            // Silverman's rule of thumb for bandwidth
            const stdDev = d3.deviation(scores) || 10;
            const iqr = (d3.quantile(scores.slice().sort((a,b) => a-b), 0.75) || 60) -
                        (d3.quantile(scores.slice().sort((a,b) => a-b), 0.25) || 40);
            const bandwidth = 0.9 * Math.min(stdDev, iqr / 1.34) * Math.pow(n, -0.2);

            // Gaussian kernel
            const kernel = (x) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

            // Evaluate KDE at evenly spaced points
            const step = 0.5;
            kdePoints = d3.range(xDomain[0], xDomain[1] + step, step).map(x => {
                const density = d3.mean(scores, s => kernel((x - s) / bandwidth)) / bandwidth;
                return { x, y: density * n * binWidth };
            });
            kdePeak = d3.max(kdePoints, d => d.y) || 0;
        }

        // Y scale — fit both bars and KDE curve
        const barMax = d3.max(bins, d => d.length) || 1;
        const yMax = Math.max(barMax, kdePeak) * 1.05;
        const yScale = d3.scaleLinear()
            .domain([0, yMax])
            .range([innerH, 0]);

        // Draw bars
        bins.forEach(bin => {
            if (bin.length === 0) return;
            const isHighlighted = companyScore != null && companyScore >= bin.x0 && companyScore < bin.x1;
            svg.append('rect')
                .attr('x', xScale(bin.x0) + 0.5)
                .attr('y', yScale(bin.length))
                .attr('width', Math.max(0, xScale(bin.x1) - xScale(bin.x0) - 1))
                .attr('height', innerH - yScale(bin.length))
                .attr('fill', isHighlighted ? color : '#0A2239')
                .attr('opacity', isHighlighted ? 0.85 : 0.15);
        });

        if (isContinuous) {
            // KDE curve (red) — traces actual data shape
            /* TEMPORARILY DISABLED for visual comparison
            svg.append('path')
                .datum(kdePoints)
                .attr('d', d3.line()
                    .x(d => xScale(d.x))
                    .y(d => yScale(d.y))
                    .curve(d3.curveBasis)
                )
                .attr('fill', 'none')
                .attr('stroke', '#CC3333')
                .attr('stroke-width', 1.5)
                .attr('opacity', 0.85);
            */

            // Detect uniform distribution: low kurtosis AND flat histogram
            // (bins with counts have low coefficient of variation)
            const scoreMean = d3.mean(scores);
            const scoreVariance = d3.mean(scores, s => Math.pow(s - scoreMean, 2));
            const m4 = d3.mean(scores, s => Math.pow(s - scoreMean, 4));
            const excessKurtosis = (m4 / (scoreVariance * scoreVariance)) - 3;
            const nonEmptyBins = bins.filter(b => b.length > 0);
            const binMean = d3.mean(nonEmptyBins, b => b.length);
            const binStd = Math.sqrt(d3.mean(nonEmptyBins, b => Math.pow(b.length - binMean, 2)));
            const binCV = binMean > 0 ? binStd / binMean : 1;
            if (excessKurtosis < -1 && binCV < 0.25) {
                svg.append('text')
                    .attr('x', innerW - 2)
                    .attr('y', 0)
                    .attr('text-anchor', 'end')
                    .attr('font-size', '9px')
                    .attr('font-style', 'italic')
                    .attr('fill', '#697380')
                    .text('Uniform distribution');
            }
        } else {
            // Non-Gaussian label for discrete/categorical data
            svg.append('text')
                .attr('x', innerW - 2)
                .attr('y', 0)
                .attr('text-anchor', 'end')
                .attr('font-size', '9px')
                .attr('font-style', 'italic')
                .attr('fill', '#697380')
                .text('Discrete distribution');
        }


        // Score marker: tick + label below axis
        if (companyScore != null) {
            const sx = xScale(companyScore);
            svg.append('line')
                .attr('x1', sx).attr('x2', sx)
                .attr('y1', innerH).attr('y2', innerH + 4)
                .attr('stroke', color).attr('stroke-width', 1);

            svg.append('text')
                .attr('x', sx)
                .attr('y', innerH + 14)
                .attr('text-anchor', 'middle')
                .attr('font-size', '9px')
                .attr('font-weight', '600')
                .attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif')
                .attr('fill', color)
                .text(companyScore.toFixed(1));
        } else {
            // No data — show "No data" label centered
            svg.append('text')
                .attr('x', innerW / 2)
                .attr('y', innerH + 14)
                .attr('text-anchor', 'middle')
                .attr('font-size', '9px')
                .attr('font-style', 'italic')
                .attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif')
                .attr('fill', '#999')
                .text('No data');
        }

        // Min/max range labels
        svg.append('text')
            .attr('x', 0).attr('y', innerH - 6)
            .attr('font-size', '9px').attr('fill', '#888')
            .attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif')
            .text(xDomain[0]);
        svg.append('text')
            .attr('x', innerW).attr('y', innerH - 6)
            .attr('text-anchor', 'end')
            .attr('font-size', '9px').attr('fill', '#888')
            .attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif')
            .text(xDomain[1]);

    }, [company, color, allCompanies, selectedPillar, selectedElement]);

    const overallScore = company.overall_score ?? null;
    const pillarName = selectedPillar !== 'Overall Board Score'
        ? (PILLAR_ELEMENTS[selectedPillar]?.name || selectedPillar) : null;
    const pillarScore = pillarName
        ? (company.pillar_scores?.[selectedPillar]?.t_score ?? null) : null;
    const indicatorName = selectedElement && pillarName
        ? (PILLAR_ELEMENTS[selectedPillar]?.elements?.[selectedElement]?.name || selectedElement) : null;
    const indicatorScore = indicatorName
        ? (company.pillar_scores?.[selectedPillar]?.indicators?.[selectedElement] ?? null) : null;

    // Footer shows the most specific level selected
    const footerLabel = indicatorName || pillarName || 'Overall Score';
    const hasIndicatorData = indicatorName && indicatorScore != null;
    const footerValue = indicatorName
        ? (hasIndicatorData ? indicatorScore : null)
        : (pillarScore != null ? pillarScore : overallScore);
    const footerRank = hasIndicatorData ? indicatorRank : (indicatorName ? '–' : companyRank);

    return (
        <div className={`report-card${company.ticker === justAddedTicker ? ' selection-pulse' : ''}`} style={animDelay != null ? {animation: `cardFadeIn 0.4s ease ${animDelay}ms both`} : {}}>
            <div className="report-card-header">
                <div className="report-card-company">
                    <div className="report-card-ticker" style={{ color: color }}>{company.ticker}</div>
                    <div className="report-card-name">{company.name}</div>
                    <div className="report-card-overall">
                        Overall #{overallRank} • {overallScore != null ? overallScore.toFixed(1) : '--'}
                    </div>
                    {pillarName && (
                        <div className="report-card-overall">
                            {pillarName} #{pillarRank} • {pillarScore != null ? pillarScore.toFixed(1) : '--'}
                        </div>
                    )}
                    {indicatorName && (
                        <div className="report-card-overall">
                            {indicatorScore != null
                                ? `${indicatorName} #${indicatorRank} • ${indicatorScore.toFixed(1)}`
                                : `${indicatorName} – Insufficient data`}
                        </div>
                    )}
                </div>
            </div>
            <div className="report-card-chart">
                <svg ref={svgRef}></svg>
            </div>
            {showHistogram && (
                <div className="report-card-histogram">
                    <svg ref={histSvgRef}></svg>
                </div>
            )}
            {/* footer labels removed — info now shown in upper card area */}
        </div>
    );
}


