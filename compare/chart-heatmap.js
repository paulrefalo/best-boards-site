/**
 * Heatmap Component
 * Matrix of companies (rows) vs pillars or indicators (cols), cells colored by score
 */
function Heatmap({ data, selectedCompanies, selectedPillar, selectedElement, shouldAnimate }) {
    const svgRef = useRef();
    const containerRef = useRef();
    const tooltipRef = useRef();

    useEffect(() => {
        if (!svgRef.current || !data || selectedCompanies.length === 0) {
            d3.select(svgRef.current).selectAll('*').remove();
            return;
        }

        d3.select(svgRef.current).selectAll('*').remove();

        // Define columns based on selected pillar
        let columns;
        if (selectedPillar === 'Overall Board Score') {
            columns = PILLAR_ORDER.map(key => ({
                key, label: PILLAR_ELEMENTS[key].name
            }));
        } else {
            const orderedKeys = INDICATOR_ORDER[selectedPillar] || Object.keys(PILLAR_ELEMENTS[selectedPillar].elements);
            columns = orderedKeys.map(key => ({
                key, label: PILLAR_ELEMENTS[selectedPillar].elements[key].name, pillar: selectedPillar
            }));
        }

        // Get score for a company+column (null for missing data)
        const getScore = (company, col) => {
            let val;
            if (!col.pillar) {
                val = company.pillar_scores?.[col.key]?.t_score;
            } else {
                val = company.pillar_scores?.[col.pillar]?.indicators?.[col.key];
            }
            return (val != null && !isNaN(val)) ? val : null;
        };

        // Build data matrix
        const matrix = selectedCompanies.map(company => ({
            ticker: company.ticker,
            name: company.name,
            scores: columns.map(col => ({ col, score: getScore(company, col) }))
        }));

        // Dimensions — fit columns into available container width
        const rowHeight = 31;
        const labelWidth = 72;
        const headerHeight = 120; // room for legend + 50px gap before cells
        const margin = { top: headerHeight, right: 20, bottom: 20, left: labelWidth };
        // Subtract container padding so the SVG never exceeds the content box
        const availableWidth = (() => {
            if (!containerRef.current) return 580;
            const cs = window.getComputedStyle(containerRef.current);
            const hPad = parseFloat(cs.paddingLeft || 0) + parseFloat(cs.paddingRight || 0);
            return containerRef.current.clientWidth - hPad - margin.left - margin.right;
        })();
        const colWidth = Math.max(45, availableWidth / columns.length);
        const width = colWidth * columns.length;
        const height = rowHeight * selectedCompanies.length;

        const svg = d3.select(svgRef.current)
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Diverging color scale: red (low) → sand (mid) → blue (high) — colorblind-safe
        const colorScale = d3.scaleLinear()
            .domain([20, 35, 50, 65, 80])
            .range(['#A42D2D', '#D36135', '#DDB94E', '#4A7C8C', '#1A5276'])
            .clamp(true);

        // Draw cells — grouped by column for left-to-right sweep animation
        const tooltip = d3.select(tooltipRef.current);
        const dataLayer = svg.append('g').attr('class', 'data-layer');

        // Zebra stripe backgrounds (behind everything, not animated)
        matrix.forEach((row, rowIdx) => {
            svg.insert('rect', ':first-child')
                .attr('x', 0)
                .attr('y', rowIdx * rowHeight)
                .attr('width', width)
                .attr('height', rowHeight)
                .attr('fill', rowIdx % 2 === 0 ? '#FAFAFA' : '#FFFFFF')
                .attr('stroke', 'none');
        });

        // Create one <g> per column for sweep stagger
        const colGroups = columns.map((col, colIdx) => {
            return dataLayer.append('g')
                .attr('data-x', colIdx * colWidth + colWidth / 2);
        });

        matrix.forEach((row, rowIdx) => {
            row.scores.forEach((cell, colIdx) => {
                const x = colIdx * colWidth;
                const y = rowIdx * rowHeight;
                const g = colGroups[colIdx];

                const dimmed = selectedElement && cell.col.key !== selectedElement;

                const hasData = cell.score != null;
                const safeScore = hasData ? cell.score : 50; // 50 = neutral gray for missing

                g.append('rect')
                    .attr('x', x + 1)
                    .attr('y', y + 1)
                    .attr('width', colWidth - 2)
                    .attr('height', rowHeight - 2)
                    .attr('fill', hasData ? colorScale(safeScore) : '#E0DDD3')
                    .attr('rx', 2)
                    .style('opacity', dimmed ? 0.5 : 1)
                    .style('cursor', 'pointer')
                    .on('mouseenter', function(event) {
                        d3.select(this).style('opacity', 1).attr('stroke', '#0A2239').attr('stroke-width', 1.5);
                        tooltip
                            .style('display', 'block')
                            .style('left', (event.offsetX + 12) + 'px')
                            .style('top', (event.offsetY - 10) + 'px')
                            .html(`<strong>${row.ticker}</strong> — ${row.name}<br/><span class="tooltip-label">${cell.col.label}</span><br/><span class="tooltip-score">${hasData ? cell.score.toFixed(1) : '--'}</span>`);
                    })
                    .on('mouseleave', function() {
                        d3.select(this).style('opacity', dimmed ? 0.5 : 1).attr('stroke', 'none');
                        tooltip.style('display', 'none');
                    });

                // Score text
                const textColor = hasData ? ((cell.score < 40 || cell.score > 58) ? '#FFFFFF' : '#0A2239') : '#888';
                g.append('text')
                    .attr('x', x + colWidth / 2)
                    .attr('y', y + rowHeight / 2)
                    .attr('text-anchor', 'middle')
                    .attr('dominant-baseline', 'middle')
                    .attr('font-size', '10px')
                    .attr('font-weight', '600')
                    .attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif')
                    .attr('fill', textColor)
                    .style('opacity', dimmed ? 0.5 : 1)
                    .attr('pointer-events', 'none')
                    .text(hasData ? cell.score.toFixed(1) : '--');
            });

            // Row ticker label (not animated)
            svg.append('text')
                .attr('x', -8)
                .attr('y', rowIdx * rowHeight + rowHeight / 2)
                .attr('text-anchor', 'end')
                .attr('dominant-baseline', 'middle')
                .attr('font-size', '12px')
                .attr('font-weight', '600')
                .attr('font-family', 'Crimson Text, serif')
                .attr('fill', '#0A2239')
                .text(row.ticker);
        });

        // Sweep columns in left-to-right (skip when element selected)
        if (shouldAnimate && !selectedElement) sweepIn(dataLayer, { duration: 250, stagger: 180 });

        // Column headers — adaptive (abbreviate/rotate on narrow screens)
        const headerItems = columns.map((col, colIdx) => ({
            label: col.label,
            xCenter: colIdx * colWidth + colWidth / 2,
            key: col.key,
        }));
        renderAdaptiveHeaders(svg, headerItems, {
            colWidth,
            selectedElement,
        });

        // Color scale legend
        const legendWidth = 140;
        const legendX = width - legendWidth;
        const legendY = -headerHeight + 6;

        const defs = svg.append('defs');
        const grad = defs.append('linearGradient').attr('id', 'heatmap-gradient');
        grad.append('stop').attr('offset', '0%').attr('stop-color', '#A42D2D');
        grad.append('stop').attr('offset', '25%').attr('stop-color', '#D36135');
        grad.append('stop').attr('offset', '50%').attr('stop-color', '#DDB94E');
        grad.append('stop').attr('offset', '75%').attr('stop-color', '#4A7C8C');
        grad.append('stop').attr('offset', '100%').attr('stop-color', '#1A5276');

        svg.append('rect')
            .attr('x', legendX)
            .attr('y', legendY)
            .attr('width', legendWidth)
            .attr('height', 10)
            .attr('fill', 'url(#heatmap-gradient)')
            .attr('rx', 2);

        svg.append('text').attr('x', legendX).attr('y', legendY + 22)
            .attr('font-size', '10px').attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif').attr('fill', '#666').text('20');
        svg.append('text').attr('x', legendX + legendWidth / 2).attr('y', legendY + 22)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px').attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif').attr('fill', '#666').text('50 (avg)');
        svg.append('text').attr('x', legendX + legendWidth).attr('y', legendY + 22)
            .attr('text-anchor', 'end')
            .attr('font-size', '10px').attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif').attr('fill', '#666').text('80');

    }, [data, selectedCompanies, selectedPillar, selectedElement]);

    if (selectedCompanies.length === 0) {
        return (
            <div className="chart-container">
                <ChartHeader selectedPillar={selectedPillar} selectedElement={selectedElement} />
                <div className="empty-state">
                    <p>Select companies to see the heatmap</p>
                </div>
            </div>
        );
    }

    return (
        <div className="chart-container" ref={containerRef} style={{position:'relative'}}>
            <ChartHeader selectedPillar={selectedPillar} selectedElement={selectedElement} />
            <svg ref={svgRef}></svg>
            <div ref={tooltipRef} className="chart-tooltip" />
        </div>
    );
}

