/**
 * Beeswarm Chart — HORIZONTAL histogram / bell-curve layout.
 *
 * Each board is a circle placed by its score on the X axis; circles stack vertically
 * (force-collide) up from a baseline, so denser score bands rise into a bell silhouette.
 *   • Color  = GICS sector (reuses SECTOR_COLORS from chart-scatter.js).
 *   • Size   = board size / director count (scaleSqrt), echoing the Landscape's size encoding.
 *   • Alpha  = translucent fill so dense piles read with depth (Landscape feel).
 * Selected boards are enlarged, ringed in their assigned color, and labeled above the swarm
 * with a leader line to their position.
 *
 * Persistent D3 layers (layersRef) + keyed joins let dots TWEEN: switching pillar/indicator
 * glides every dot to its new pile; selecting/deselecting restyles in place (positions cached).
 */
function BeeswarmChart({ data, selectedCompanies, selectedPillar, selectedElement, shouldAnimate }) {
    const svgRef = React.useRef();
    const containerRef = React.useRef();
    const tooltipRef = React.useRef();
    const posMapRef = React.useRef({});       // ticker → {x, y}  (cached layout)
    const layersRef = React.useRef(null);     // persistent SVG layers (so transitions survive re-renders)
    const prevDataKeyRef = React.useRef(null);
    const [focusSector, setFocusSector] = React.useState(null);   // click a legend sector to spotlight it

    React.useEffect(() => {
        if (!svgRef.current || !data || !data.companies) return;

        // ── Which score to plot ───────────────────────────────────────
        let scoreAccessor;
        if (selectedElement) {
            scoreAccessor = (c) => { try { return c.pillar_scores?.[selectedPillar]?.indicators?.[selectedElement] ?? null; } catch (e) { return null; } };
        } else if (selectedPillar && selectedPillar !== 'Overall Board Score') {
            scoreAccessor = (c) => { try { return c.pillar_scores?.[selectedPillar]?.t_score ?? null; } catch (e) { return null; } };
        } else {
            scoreAccessor = (c) => c.overall_score ?? null;
        }

        // ── Points (drop boards with no score for this view) ──────────
        const points = data.companies.map(company => {
            const score = scoreAccessor(company);
            if (score == null || isNaN(score)) return null;
            return {
                ticker: company.ticker, name: company.name, sector: company.sector, score,
                boardSize: company.board_size ?? null, company,
            };
        }).filter(Boolean);
        if (points.length === 0) return;

        // ── Dimensions ────────────────────────────────────────────────
        const totalWidth = (() => {
            if (!containerRef.current) return 760;
            const cs = window.getComputedStyle(containerRef.current);
            return containerRef.current.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
        })();
        const margin = { top: 64, right: 26, bottom: 48, left: 30 };
        const width = totalWidth - margin.left - margin.right;
        const totalHeight = 500;
        const height = totalHeight - margin.top - margin.bottom;
        if (width <= 0 || height <= 0) return;          // collapsed/hidden container — wait for layout
        const baseline = height;                         // dots pile upward from here

        // ── Scales / colors ───────────────────────────────────────────
        const allScores = points.map(d => d.score);
        const dataMin = d3.min(allScores) ?? 0, dataMax = d3.max(allScores) ?? 100;
        const spread = Math.max(50 - Math.min(dataMin - 5, 0), Math.max(dataMax + 5, 100) - 50);
        const xMin = 50 - spread, xMax = 50 + spread;
        const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, width]);

        // Size by board size (director count); falls back to a constant if the field is absent.
        const bsExtent = d3.extent(points, d => d.boardSize);
        const hasSize = bsExtent[0] != null && bsExtent[1] != null && bsExtent[0] !== bsExtent[1];
        const rScale = d3.scaleSqrt().domain(hasSize ? bsExtent : [1, 1]).range([3, 8.5]).clamp(true);
        const baseR = d => hasSize ? rScale(d.boardSize) : 4.5;

        const sectorFill = d => (typeof SECTOR_COLORS !== 'undefined' && SECTOR_COLORS[d.sector]) || '#B0AAA0';
        const palette = (typeof COMPANY_COLORS !== 'undefined' && COMPANY_COLORS) || ['#0072B2', '#D55E00', '#009E73', '#E69F00'];
        const selColor = {};
        selectedCompanies.forEach((c, i) => { selColor[c.ticker] = palette[i % palette.length]; });
        const selectedTickers = new Set(selectedCompanies.map(c => c.ticker));
        const medianScore = d3.median(allScores) || 50;
        points.forEach(d => { d.r = baseR(d); });

        // ── Look-and-feel tunables (dial these) ───────────────────────
        const ROW_H = 7.5;          // vertical spacing between stacked dots (px); < dot diameter = slight overlap
        const Y_JITTER = 3;         // px of random vertical scatter (ggplot geom_jitter feel)
        const X_JITTER = 6;         // px of random horizontal scatter around the true score position
        const BASE_ALPHA = 0.42;    // unselected fill opacity — lower = density shows through overlap

        // ── Layout: binned SYMMETRIC dot-violin (only recomputed on dataset change) ─
        // Group dots into thin score-bins; within a bin, stack dots SYMMETRICALLY above and below a center
        // line (slots 0, +1, -1, +2, -2, …) rather than all resting on the baseline — this is what removes
        // the baseline crowding. Sizes are shuffled so big dots don't wall up on one edge. Row height
        // auto-shrinks so the tallest stack fits. x stays honest (true score position + jitter).
        const centerY = height * 0.5;
        const dataKey = `${selectedPillar}|${selectedElement || ''}|${points.length}|${Math.round(totalWidth)}`;
        const datasetChanged = dataKey !== prevDataKeyRef.current;
        const cache = posMapRef.current;
        const haveCache = points.every(d => cache[d.ticker]);
        let halfPile = 0;                                          // tallest half-stack (px) — used to scale the KDE
        if (datasetChanged || !haveCache) {
            const binCount = Math.max(20, Math.min(90, Math.round(width / 11)));
            const colW = width / binCount;
            const bins = d3.group(points, d => Math.floor(Math.max(0, Math.min(width - 0.001, xScale(d.score))) / colW));
            const maxCount = d3.max(bins, ([, arr]) => arr.length) || 1;
            const availHalf = Math.min(centerY, height - centerY) - 6;
            const rowH = Math.min(ROW_H, availHalf / Math.max(1, maxCount / 2));   // shrink so the tallest stack fits
            halfPile = (maxCount / 2) * rowH;
            const newCache = {};
            bins.forEach(arr => {
                d3.shuffle(arr);                                  // mix sizes so no edge is a wall of big dots
                arr.forEach((d, i) => {
                    const slot = Math.ceil(i / 2) * (i % 2 === 1 ? 1 : -1);   // 0, +1, -1, +2, -2, …
                    d.x = Math.max(0, Math.min(width, xScale(d.score) + (Math.random() - 0.5) * 2 * X_JITTER));
                    d.y = Math.max(0, Math.min(baseline, centerY + slot * rowH + (Math.random() - 0.5) * 2 * Y_JITTER));
                    newCache[d.ticker] = { x: d.x, y: d.y };
                });
            });
            posMapRef.current = newCache;
            posMapRef.current._halfPile = halfPile;               // stash for the KDE scale
        } else {
            halfPile = cache._halfPile || height * 0.35;
            points.forEach(d => { d.x = cache[d.ticker].x; d.y = cache[d.ticker].y; });
        }
        prevDataKeyRef.current = dataKey;

        // ── Persistent scaffold (rebuild only if missing or width changed) ─
        let L = layersRef.current;
        if (!L || L.totalWidth !== totalWidth) {
            d3.select(svgRef.current).selectAll('*').remove();
            const svg = d3.select(svgRef.current)
                .attr('width', totalWidth).attr('height', totalHeight)
                .attr('viewBox', `0 0 ${totalWidth} ${totalHeight}`);
            const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
            L = layersRef.current = {
                totalWidth, g,
                gridG: g.append('g'), kdeG: g.append('g'), medianG: g.append('g'), axisG: g.append('g'),
                dotG: g.append('g'), labelG: g.append('g'), voronoiG: g.append('g'),
            };
        }

        const t = d3.transition().duration(datasetChanged ? 750 : 340).ease(d3.easeCubicOut);

        // Gridlines + x axis (redrawn; static)
        const ticks = xScale.ticks(8).filter(v => v >= xMin && v <= xMax);
        L.gridG.selectAll('line').data(ticks).join('line')
            .attr('x1', d => xScale(d)).attr('x2', d => xScale(d)).attr('y1', 0).attr('y2', baseline)
            .attr('stroke', '#EEEAE0').attr('stroke-width', 0.75);
        L.axisG.attr('transform', `translate(0,${baseline})`)
            .call(d3.axisBottom(xScale).tickValues(ticks).tickSize(4).tickPadding(6))
            .call(sel => sel.selectAll('text').attr('font-size', 10).attr('fill', '#666'))
            .call(sel => sel.selectAll('.domain, .tick line').attr('stroke', '#B8B2A6'));
        L.axisG.selectAll('text.axis-title').data([0]).join('text').attr('class', 'axis-title')
            .attr('x', width / 2).attr('y', 40).attr('text-anchor', 'middle')
            .attr('font-size', 11).attr('font-weight', 600).attr('fill', '#8B8178')
            .attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif')
            .text('t-score' + (selectedElement ? ` — ${selectedElement}` : (selectedPillar && selectedPillar !== 'Overall Board Score') ? ` — ${selectedPillar}` : ''));

        // Median reference (vertical)
        L.medianG.selectAll('line').data([medianScore]).join('line')
            .transition(t).attr('x1', d => xScale(d)).attr('x2', d => xScale(d)).attr('y1', 0).attr('y2', baseline)
            .attr('stroke', '#0A2239').attr('stroke-width', 1).attr('stroke-dasharray', '4,3').attr('opacity', 0.45);
        L.medianG.selectAll('text').data([medianScore]).join('text')
            .attr('y', -6).attr('text-anchor', 'middle').attr('font-size', 9).attr('fill', '#0A2239').attr('opacity', 0.6)
            .text(d => `median ${d.toFixed(1)}`).transition(t).attr('x', d => xScale(d));

        // ── KDE violin behind the swarm ───────────────────────────────
        // Gaussian KDE over the scores, drawn SYMMETRICALLY around the center line and scaled so its half-
        // thickness matches the tallest half-stack — a violin envelope around the dot cloud.
        const sd = d3.deviation(allScores) || 8;
        const bw = Math.max(2, 1.06 * sd * Math.pow(points.length, -0.2));   // Silverman's rule
        const gaussian = u => Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);
        const kdeAt = x => d3.mean(allScores, s => gaussian((x - s) / bw)) / bw;
        const grid = d3.range(xMin, xMax + 0.001, (xMax - xMin) / 140);
        const dens = grid.map(x => [x, kdeAt(x)]);
        const maxDens = d3.max(dens, d => d[1]) || 1;
        const halfScale = d3.scaleLinear().domain([0, maxDens]).range([0, Math.max(halfPile * 1.05, 30)]);
        const area = d3.area().x(d => xScale(d[0]))
            .y0(d => centerY + halfScale(d[1])).y1(d => centerY - halfScale(d[1])).curve(d3.curveBasis);
        const edge = sign => d3.line().x(d => xScale(d[0])).y(d => centerY + sign * halfScale(d[1])).curve(d3.curveBasis);
        L.kdeG.selectAll('path.kde-area').data([dens]).join('path').attr('class', 'kde-area')
            .attr('fill', '#0A2239').attr('fill-opacity', 0.05).attr('stroke', 'none')
            .transition(t).attr('d', area);
        L.kdeG.selectAll('path.kde-up').data([dens]).join('path').attr('class', 'kde-up')
            .attr('fill', 'none').attr('stroke', '#0A2239').attr('stroke-opacity', 0.26).attr('stroke-width', 1.1)
            .transition(t).attr('d', edge(-1));
        L.kdeG.selectAll('path.kde-dn').data([dens]).join('path').attr('class', 'kde-dn')
            .attr('fill', 'none').attr('stroke', '#0A2239').attr('stroke-opacity', 0.26).attr('stroke-width', 1.1)
            .transition(t).attr('d', edge(1));

        // ── Dots (keyed join → tween) ─────────────────────────────────
        const isSel = d => selectedTickers.has(d.ticker);
        const dim = d => focusSector && d.sector !== focusSector && !isSel(d);
        const fillOpacity = d => dim(d) ? 0.05 : (isSel(d) ? 1 : BASE_ALPHA);
        const rOf = d => isSel(d) ? d.r + 2 : d.r;
        const join = L.dotG.selectAll('circle').data(points, d => d.ticker);
        join.exit().transition(t).attr('r', 0).remove();
        const enter = join.enter().append('circle')
            .attr('cx', d => d.x).attr('cy', d => d.y).attr('r', 0)
            .attr('fill', sectorFill);
        enter.merge(join)
            .attr('fill', sectorFill)
            .attr('stroke', d => isSel(d) ? selColor[d.ticker] : 'none')
            .attr('stroke-width', d => isSel(d) ? 2.5 : 0)
            .transition(t)
            .attr('cx', d => d.x).attr('cy', d => d.y)
            .attr('r', rOf).attr('fill-opacity', fillOpacity);
        L.dotG.selectAll('circle').filter(isSel).raise();

        // ── Selected labels above swarm, with leader lines ────────────
        const labelY = -24, gap = 58;
        const sel = points.filter(isSel).sort((a, b) => a.x - b.x);
        let prevX = -Infinity;
        sel.forEach(d => { d.labelX = Math.max(d.x, prevX + gap); prevX = d.labelX; });
        if (sel.length) { const over = sel[sel.length - 1].labelX - width; if (over > 0) sel.forEach(d => { d.labelX -= over; }); }
        L.labelG.selectAll('*').remove();
        sel.forEach(d => {
            const col = selColor[d.ticker];
            L.labelG.append('line').attr('x1', d.labelX).attr('y1', labelY + 4).attr('x2', d.x).attr('y2', d.y - d.r - 2)
                .attr('stroke', col).attr('stroke-width', 1).attr('opacity', 0).transition(t).attr('opacity', 0.55);
            L.labelG.append('text').attr('x', d.labelX).attr('y', labelY).attr('text-anchor', 'middle')
                .attr('font-size', 10).attr('font-weight', 700).attr('fill', col)
                .attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif').text(d.ticker)
                .attr('opacity', 0).transition(t).attr('opacity', 1);
            L.labelG.append('text').attr('x', d.labelX).attr('y', labelY + 11).attr('text-anchor', 'middle')
                .attr('font-size', 8.5).attr('fill', '#888')
                .attr('font-family', 'acumin-pro, IBM Plex Sans, sans-serif').text(d.score.toFixed(1))
                .attr('opacity', 0).transition(t).attr('opacity', 1);
        });

        // ── Hover (voronoi) ───────────────────────────────────────────
        const container = containerRef.current;
        const tooltip = d3.select(tooltipRef.current);
        const enterHover = function (event, d) {
            L.dotG.selectAll('circle').filter(dd => dd.ticker === d.ticker)
                .attr('stroke', '#333').attr('stroke-width', 2).attr('fill-opacity', 1).raise();
            const rect = container.getBoundingClientRect();
            const sizeStr = d.boardSize != null ? `<br/>Board size: ${d.boardSize} directors` : '';
            tooltip.style('display', 'block')
                .style('left', `${event.clientX - rect.left + 14}px`).style('top', `${event.clientY - rect.top + 14}px`)
                .html(`<div style="font-weight:700;margin-bottom:2px">${d.name}</div>
                       <div style="color:#666">${d.ticker} · ${d.sector}<br/>Score: <strong>${d.score.toFixed(1)}</strong>${sizeStr}</div>`);
        };
        const moveHover = function (event) {
            const rect = container.getBoundingClientRect();
            tooltip.style('left', `${event.clientX - rect.left + 14}px`).style('top', `${event.clientY - rect.top + 14}px`);
        };
        const leaveHover = function (event, d) {
            L.dotG.selectAll('circle').filter(dd => dd.ticker === d.ticker)
                .attr('stroke', isSel(d) ? selColor[d.ticker] : 'none').attr('stroke-width', isSel(d) ? 2.5 : 0)
                .attr('fill-opacity', fillOpacity(d));
            tooltip.style('display', 'none');
        };
        const delaunay = d3.Delaunay.from(points, d => d.x, d => d.y);
        const voronoi = delaunay.voronoi([0, 0, width, height]);
        L.voronoiG.selectAll('path').data(points, d => d.ticker).join('path')
            .attr('d', (d, i) => voronoi.renderCell(i))
            .attr('fill', 'none').attr('pointer-events', 'all').attr('cursor', 'pointer')
            .on('mouseenter', enterHover).on('mousemove', moveHover).on('mouseleave', leaveHover);

    }, [data, selectedCompanies, selectedPillar, selectedElement, shouldAnimate, focusSector]);

    // Sector legend — only the sectors present, in canonical palette order.
    const legendSectors = React.useMemo(() => {
        if (typeof SECTOR_COLORS === 'undefined' || !data?.companies) return [];
        const present = new Set(data.companies.map(c => c.sector));
        return Object.keys(SECTOR_COLORS).filter(s => present.has(s));
    }, [data]);

    return (
        <div ref={containerRef} style={{ position: 'relative' }}>
            <ChartHeader selectedPillar={selectedPillar} selectedElement={selectedElement} />
            {legendSectors.length > 0 && (
                <div style={{
                    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px',
                    margin: '2px 0 6px', fontSize: '11px',
                    fontFamily: 'acumin-pro, IBM Plex Sans, sans-serif', color: '#555',
                }}>
                    {legendSectors.map(s => {
                        const active = focusSector === s;
                        const dimmed = focusSector && !active;
                        return (
                            <span
                                key={s}
                                onClick={() => setFocusSector(active ? null : s)}
                                title={active ? 'Click to clear focus' : `Focus ${s}`}
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
                    {focusSector && (
                        <button
                            onClick={() => setFocusSector(null)}
                            style={{
                                marginLeft: '2px', fontSize: '10px', color: '#666', cursor: 'pointer',
                                background: 'none', border: '1px solid #D8D3C7', borderRadius: '10px',
                                padding: '1px 8px', fontFamily: 'inherit',
                            }}
                        >clear ✕</button>
                    )}
                </div>
            )}
            <svg ref={svgRef}></svg>
            <div ref={tooltipRef} style={{
                display: 'none', position: 'absolute', pointerEvents: 'none',
                background: 'white', border: '1px solid #E0DDD3',
                borderRadius: '4px', padding: '8px 12px',
                fontSize: '12px', fontFamily: 'acumin-pro, IBM Plex Sans, sans-serif',
                boxShadow: '0 3px 12px rgba(0,0,0,0.15)', zIndex: 100, maxWidth: '250px',
            }} />
        </div>
    );
}
