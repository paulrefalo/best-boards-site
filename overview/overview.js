/**
 * Best Boards 2026 — Overview (3-panel explorer)
 *   Row 1: Landscape (scatter), full width — click a bubble to make it the "active" board.
 *   Row 2: [ Bar chart of selected companies ]  [ Radar report card of the active board ].
 * The left panel (leaderboard + selected list) drives the selected set; clicking a selected
 * row or a landscape bubble sets the active board (shown visually distinct in both).
 *
 * Reuses the compare-page components: SelectedCompaniesTable, ScatterPlot, GroupedBarChart,
 * ReportCard, ChartHeader (loaded from ../compare/*).
 */
const MAX_COMPANIES = 500;

// Pillars selectable on this page (Overall is always the scatter X-axis, so it isn't a Y choice).
const OV_PILLARS = PILLAR_ORDER;   // 5 board pillars

function Overview() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [selectedCompanies, setSelectedCompanies] = useState([]);
    const [activeTicker, setActiveTicker] = useState(null);
    const [selectedPillar, setSelectedPillar] = useState('Knowledge & Experience');
    const [selectedElement, setSelectedElement] = useState(null);
    const [hoveredElement, setHoveredElement] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [justAddedTicker, setJustAddedTicker] = useState(null);

    // animate charts when the pillar OR indicator changes (not on company add/remove)
    const prevPillar = useRef(selectedPillar);
    const prevElement = useRef(selectedElement);
    const shouldAnimate = prevPillar.current !== selectedPillar || prevElement.current !== selectedElement;
    prevPillar.current = selectedPillar;
    prevElement.current = selectedElement;

    useEffect(() => {
        fetch('../compare/boards_dashboard_data.json')
            .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
            .then(json => {
                setData(json);
                setLoading(false);
                // Seed with 8 recognizable boards spread across the four quadrants (Overall × Knowledge&Experience),
                // so the initial bar chart reads with good balance:
                //   strong/strong: NVDA, PLTR · strong overall/lower K&E: GS, GE
                //   lower overall/strong K&E: BA, COIN · lower/lower: AAPL, DIS
                const SEED = ['NVDA', 'PLTR', 'GS', 'GE', 'BA', 'COIN', 'AAPL', 'DIS'];
                const seeded = SEED.map(t => json.companies.find(c => c.ticker === t)).filter(Boolean);
                setSelectedCompanies(seeded);
                setActiveTicker(seeded[0]?.ticker ?? null);
            })
            .catch(err => { setLoadError(err.message || 'Failed to load data'); setLoading(false); });
    }, []);

    // ── Selection helpers ──
    const addCompany = (company) => {
        setSelectedCompanies(prev => {
            if (prev.length >= MAX_COMPANIES || prev.some(c => c.ticker === company.ticker)) return prev;
            return [...prev, company];
        });
        setJustAddedTicker(company.ticker);
        setTimeout(() => setJustAddedTicker(null), 1500);
    };
    const removeCompany = (ticker) => {
        setSelectedCompanies(prev => prev.filter(c => c.ticker !== ticker));
        setActiveTicker(prev => prev === ticker ? null : prev);
    };
    const clearAll = () => { setSelectedCompanies([]); setActiveTicker(null); };

    const getSortScore = (comp) => {
        const val = selectedPillar === 'Overall Board Score' ? comp.overall_score : comp.pillar_scores?.[selectedPillar]?.t_score;
        return (val != null && !isNaN(val)) ? val : -Infinity;
    };
    const loadTopN = (n) => { if (data) setSelectedCompanies([...data.companies].sort((a, b) => getSortScore(b) - getSortScore(a)).slice(0, Math.min(n, MAX_COMPANIES))); };
    const loadBottomN = (n) => { if (data) setSelectedCompanies([...data.companies].filter(c => getSortScore(c) > -Infinity).sort((a, b) => getSortScore(a) - getSortScore(b)).slice(0, Math.min(n, MAX_COMPANIES))); };
    const loadBySector = (sector) => { if (data && sector) setSelectedCompanies(data.companies.filter(c => c.sector === sector).slice(0, MAX_COMPANIES)); };

    // Click a bubble or a list row → active board (adding it to the selected set if new).
    const onSelectActive = (ticker) => {
        if (!data) return;
        setSelectedCompanies(prev => {
            if (prev.some(c => c.ticker === ticker)) return prev;
            const c = data.companies.find(x => x.ticker === ticker);
            return c ? [...prev, c] : prev;
        });
        setActiveTicker(ticker);
    };

    // Radar report-card chartData (baseline + selected companies' pillar values)
    const chartData = useMemo(() => {
        if (!data) return null;
        const pillars = PILLAR_ORDER;
        const names = pillars.map(p => PILLAR_ELEMENTS[p].name);
        const baseline = pillars.map((pillar, i) => {
            const scores = data.companies.map(c => c.pillar_scores[pillar]?.t_score).filter(s => s !== undefined && s !== null);
            const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 50;
            return { pillar: names[i], value: avg, angle: (i * 2 * Math.PI) / pillars.length };
        });
        const companies = selectedCompanies.map(company => ({
            ticker: company.ticker, name: company.name,
            data: pillars.map((pillar, i) => ({ pillar: names[i], value: company.pillar_scores[pillar]?.t_score ?? null, angle: (i * 2 * Math.PI) / pillars.length })),
        }));
        return { baseline, companies, pillars: names, maxValue: 80, minValue: 20 };
    }, [data, selectedCompanies]);

    const activeCompany = useMemo(() => (data && activeTicker) ? data.companies.find(c => c.ticker === activeTicker) : null, [data, activeTicker]);
    const activeColor = useMemo(() => {
        const idx = selectedCompanies.findIndex(c => c.ticker === activeTicker);
        return idx >= 0 ? COMPANY_COLORS[idx % COMPANY_COLORS.length] : COMPANY_COLORS[0];
    }, [selectedCompanies, activeTicker]);

    const renderMasthead = () => (
        <div className="masthead">
            <div className="masthead-brand">
                <a href="https://leadershipinstitute.wsj.com" target="_blank" rel="noopener noreferrer">
                    <img src="../resources/wsjli.svg" alt="WSJ Leadership Institute" className="masthead-logo" />
                </a>
            </div>
            <nav className="masthead-nav">
                <a href="../methodology/index.html" className="nav-link">Methodology</a>
                <a href="./index.html" className="nav-link active">Explore</a>
                <a href="../datatable/index.html" className="nav-link">Data Table</a>
            </nav>
            <a href="https://www.dowjones.com" target="_blank" rel="noopener noreferrer"><img src="../resources/dowjones_logo_green.svg" alt="Dow Jones" className="masthead-dj-logo" /></a>
        </div>
    );

    if (loading) return <div className="dashboard">{renderMasthead()}<div className="empty-state"><p>Loading…</p></div></div>;
    if (loadError) return <div className="dashboard">{renderMasthead()}<div className="empty-state"><p>Could not load data: {loadError}</p></div></div>;

    return (
        <div className="dashboard">
            {renderMasthead()}

            <div className="header">
                <h1>Best Boards 2026</h1>
                <div className="header-sponsor">
                    <span className="sponsor-label">Sponsored by</span>
                    <img src="../resources/hs-box-logo.png?v=1" alt="Heidrick & Struggles" />
                </div>
            </div>

            {/* Dataset Selection — pillar + indicator selector (mirrors the Compare page).
                Overall isn't offered here because it's always the Landscape X-axis. */}
            <div className="controls" style={{ position: 'static' }}>
                    <div className="category-selector-container">
                        <div className="selector-group">
                            {(() => {
                                const displayPillar = selectedPillar;
                                const activeIndicator = hoveredElement || selectedElement;
                                const info = whatsMeasuredFor(displayPillar, activeIndicator);
                                const showElements = !!PILLAR_ELEMENTS[displayPillar];
                                return (
                                    <div className="selector-group-flow">
                                        <div className="selector-group-buttons">
                                            <div className="pillar-float">
                                                <div className="selector-group-header">
                                                    <div className="section-tag">Dataset Selection</div>
                                                </div>
                                                <div className="selector-group-label">Pillar</div>
                                                <div className="pillar-selector">
                                                    {OV_PILLARS.map(pillar => (
                                                        <button
                                                            key={pillar}
                                                            className={`pillar-btn ${selectedPillar === pillar ? 'active' : ''}`}
                                                            onClick={() => { setSelectedPillar(pillar); setSelectedElement(null); }}
                                                        >
                                                            {PILLAR_ELEMENTS[pillar].name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="indicator-float" style={showElements ? {} : { visibility: 'hidden' }}>
                                                <div className="selector-group-label">Indicator</div>
                                                <div className="element-selector">
                                                    {(INDICATOR_ORDER[displayPillar] || Object.keys(PILLAR_ELEMENTS[displayPillar].elements)).map(element => (
                                                        <button
                                                            key={element}
                                                            className={`element-btn ${selectedElement === element ? 'active' : ''}`}
                                                            onClick={() => setSelectedElement(selectedElement === element ? null : element)}
                                                            onMouseEnter={() => setHoveredElement(element)}
                                                            onMouseLeave={() => setHoveredElement(null)}
                                                        >
                                                            {PILLAR_ELEMENTS[displayPillar].elements[element].name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="whats-measured-inline" style={info ? {} : { visibility: 'hidden' }}>
                                            <span className="whats-measured-indicator">{activeIndicator || ' '}</span>
                                            {info ? ' — ' : ''}
                                            {info ? info.measured : ' '}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
            </div>

            <div className="main-content">
                <div className="comparison-grid">
                    {/* Left: company selection (leaderboard + selected list; selected rows set the active board) */}
                    <div className="left-panel">
                        <div className="s2-header-row"><div className="section-tag">Company Selection</div></div>
                        <SelectedCompaniesTable
                            selectedCompanies={selectedCompanies}
                            removeCompany={removeCompany}
                            clearAll={clearAll}
                            selectedPillar={selectedPillar}
                            selectedElement={selectedElement}
                            data={data}
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            addCompany={addCompany}
                            loadTopN={loadTopN}
                            loadBottomN={loadBottomN}
                            loadBySector={loadBySector}
                            maxCompanies={MAX_COMPANIES}
                            justAddedTicker={justAddedTicker}
                            activeTicker={activeTicker}
                            onSelectActive={onSelectActive}
                        />
                    </div>

                    {/* Right: two plots — bar comparison + radar of the active board */}
                    <div className="right-panel">
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch', flexWrap: 'wrap' }}>
                            <div className="chart-panel" style={{ flex: '1 1 340px', minWidth: '300px' }}>
                                <div className="chart-panel-content">
                                    <GroupedBarChart
                                        data={data}
                                        selectedCompanies={selectedCompanies}
                                        selectedPillar={selectedPillar}
                                        selectedElement={selectedElement}
                                        shouldAnimate={shouldAnimate}
                                        rowHeight={26}
                                    />
                                </div>
                            </div>
                            <div className="chart-panel" style={{ flex: '1 1 300px', minWidth: '280px' }}>
                                <div className="chart-panel-content">
                                    {activeCompany ? (
                                        <div className="report-cards-grid" style={{ gridTemplateColumns: '1fr' }}>
                                            <ReportCard
                                                key={activeCompany.ticker}
                                                company={activeCompany}
                                                color={activeColor}
                                                chartData={chartData}
                                                selectedPillar={selectedPillar}
                                                selectedElement={selectedElement}
                                                animDelay={null}
                                                allCompanies={data.companies}
                                                justAddedTicker={justAddedTicker}
                                                showHistogram={false}
                                                radarSize={200}
                                                labelPad={38}
                                            />
                                        </div>
                                    ) : (
                                        <div className="empty-state"><p>Click a board in the selected list to see its profile.</p></div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <footer className="wsjli-footer">
                <span>&copy; Copyright 2026 Dow Jones &amp; Company, Inc. All Rights Reserved.</span>
            </footer>
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Overview />);
