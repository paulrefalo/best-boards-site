const MAX_COMPANIES = 500; // no practical limit
const STORAGE_KEY = 'wsjli-compare-state';

// ── State persistence helpers ──

function parseURLState() {
    const params = new URLSearchParams(window.location.search);
    if (params.toString() === '') return null; // no URL state
    return {
        tickers:  params.get('companies')  ? params.get('companies').split(',').filter(Boolean) : null,
        pillar:   params.get('pillar')      || null,
        element:  params.get('element')     || null,
        chart:    params.get('chart')       || null,
    };
}

function loadSavedState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function saveStateToURL(tickers, pillar, element, chart) {
    const params = new URLSearchParams();
    if (tickers.length > 0) params.set('companies', tickers.join(','));
    if (pillar && pillar !== 'Overall Board Score') params.set('pillar', pillar);
    if (element) params.set('element', element);
    if (chart && chart !== 'box-plot') params.set('chart', chart);
    const qs = params.toString();
    const url = window.location.pathname + (qs ? '?' + qs : '');
    window.history.replaceState(null, '', url);
}

function saveStateToStorage(tickers, pillar, element, chart) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ tickers, pillar, element, chart, ts: Date.now() }));
    } catch { /* storage full or unavailable */ }
}

function Dashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [selectedCompanies, setSelectedCompanies] = useState([]);
    const [justAddedTicker, setJustAddedTicker] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Resolve initial pillar/element/chart from URL > localStorage > defaults
    const initial = useMemo(() => {
        const raw = parseURLState() || loadSavedState() || {};
        // Validate pillar
        const validPillars = [...Object.keys(PILLAR_ELEMENTS), 'Overall Board Score'];
        const pillar = validPillars.includes(raw.pillar) ? raw.pillar : 'Overall Board Score';
        // Validate element belongs to pillar
        const element = (pillar !== 'Overall Board Score' && raw.element &&
            PILLAR_ELEMENTS[pillar]?.elements?.[raw.element]) ? raw.element : null;
        // Validate chart tab
        const validCharts = CHART_TABS.map(t => t.key);
        const chart = validCharts.includes(raw.chart) ? raw.chart : 'box-plot';
        return { tickers: raw.tickers, pillar, element, chart };
    }, []);
    const [selectedPillar, setSelectedPillar] = useState(initial.pillar);
    const [selectedElement, setSelectedElement] = useState(initial.element);
    const [selectedChart, setSelectedChart] = useState(initial.chart);
    const [helpOpen, setHelpOpen] = useState(false);
    const [guideOpen, setGuideOpen] = useState(false);
    const [hoveredElement, setHoveredElement] = useState(null);

    // Track whether chart animations should fire (only on dataset/pillar changes, not company changes)
    // Computed during render (not in useEffect) so the value is current when passed as a prop
    const prevPillar = useRef(selectedPillar);
    const prevElement = useRef(selectedElement);
    // Animate on pillar change or element selection — but NOT when deselecting an element
    // (deselecting = going from a value to null while pillar stays the same)
    const isElementDeselect = prevPillar.current === selectedPillar && prevElement.current != null && selectedElement == null;
    const shouldAnimate = !isElementDeselect && (prevPillar.current !== selectedPillar || prevElement.current !== selectedElement);
    prevPillar.current = selectedPillar;
    prevElement.current = selectedElement;

    // Close modals on Escape
    useEffect(() => {
        if (!helpOpen && !guideOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') { setHelpOpen(false); setGuideOpen(false); } };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [helpOpen, guideOpen]);

    // Smooth height animation for selector group — prevents jitter on description change
    // Only animate height increases (growing); snap instantly on decreases
    useEffect(() => {
        const el = flowRef.current;
        if (!el) return;
        const prev = el._prevHeight;
        const curr = el.scrollHeight;
        if (prev != null && prev !== curr) {
            if (curr > prev) {
                // Growing — animate smoothly
                el.style.height = prev + 'px';
                el.style.transition = 'none';
                requestAnimationFrame(() => {
                    el.style.transition = 'height 0.25s ease';
                    el.style.height = curr + 'px';
                    const onEnd = () => {
                        el.style.height = '';
                        el.style.transition = '';
                        el.removeEventListener('transitionend', onEnd);
                    };
                    el.addEventListener('transitionend', onEnd);
                });
            } else {
                // Shrinking — snap instantly
                el.style.height = '';
                el.style.transition = '';
            }
        }
        el._prevHeight = curr;
    });

    const gridRef = useRef(null);
    const flowRef = useRef(null);

    // Track whether initial company restore has happened (to avoid overwriting with defaults)
    const restoredRef = useRef(false);

    // Load data from JSON file with retry logic
    const loadData = () => {
        setLoading(true);
        setLoadError(null);
        fetch('boards_dashboard_data.json')
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                return res.json();
            })
            .then(json => {
                setData(json);
                setLoading(false);

                // Restore companies: URL params > localStorage > defaults
                const saved = parseURLState() || loadSavedState();
                const tickersToRestore = saved?.tickers || [];
                const resolved = tickersToRestore
                    .slice(0, MAX_COMPANIES)
                    .map(t => json.companies.find(c => c.ticker === t))
                    .filter(Boolean);
                setSelectedCompanies(resolved);
                restoredRef.current = true;
            })
            .catch(err => {
                console.error('Could not load data:', err);
                setLoadError(err.message || 'Failed to load data');
                setLoading(false);
            });
    };

    useEffect(() => { loadData(); }, []);

    // Landscape (scatter) doesn't support Overall — auto-switch to AI Readiness
    useEffect(() => {
        if (selectedChart === 'scatter' && selectedPillar === 'Overall Board Score') {
            setSelectedPillar('Knowledge & Experience');
            setSelectedElement(null);
        }
    }, [selectedChart]);

    // Autosave: persist state on every meaningful change
    useEffect(() => {
        if (!restoredRef.current) return; // don't save until initial restore
        const tickers = selectedCompanies.map(c => c.ticker);
        saveStateToURL(tickers, selectedPillar, selectedElement, selectedChart);
        saveStateToStorage(tickers, selectedPillar, selectedElement, selectedChart);
    }, [selectedCompanies, selectedPillar, selectedElement, selectedChart]);
    
    // Add company to comparison (capped at MAX_COMPANIES)
    const addCompany = (company) => {
        setSelectedCompanies(prev => {
            if (prev.length >= MAX_COMPANIES) return prev;
            if (prev.some(c => c.ticker === company.ticker)) return prev;
            return [...prev, company];
        });
        setJustAddedTicker(company.ticker);
        setTimeout(() => setJustAddedTicker(null), 1500);
    };

    // Helper: get raw score for sorting (null-safe, missing → -Infinity for sort)
    const getSortScore = (comp) => {
        let val;
        if (selectedPillar === 'Overall Board Score') val = comp.overall_score;
        else if (selectedElement) val = comp.pillar_scores?.[selectedPillar]?.indicators?.[selectedElement];
        else val = comp.pillar_scores?.[selectedPillar]?.t_score;
        return (val != null && !isNaN(val)) ? val : -Infinity;
    };

    // Load top N companies for the active pillar
    const loadTopN = (n) => {
        if (!data) return;
        const count = Math.min(n, MAX_COMPANIES);

        const top = [...data.companies]
            .sort((a, b) => getSortScore(b) - getSortScore(a))
            .slice(0, count);
        setSelectedCompanies(top);
    };

    // Load bottom N companies for the active pillar
    const loadBottomN = (n) => {
        if (!data) return;
        const count = Math.min(n, MAX_COMPANIES);

        const bottom = [...data.companies]
            .filter(c => getSortScore(c) > -Infinity) // exclude missing
            .sort((a, b) => getSortScore(a) - getSortScore(b))
            .slice(0, count);
        setSelectedCompanies(bottom);
    };

    // Load companies by GICS sector
    const loadBySector = (sector) => {
        if (!data || !sector) return;
        const matches = data.companies
            .filter(c => c.sector === sector)
            .slice(0, MAX_COMPANIES);
        setSelectedCompanies(matches);
    };

    // Load N random companies
    const loadRandom = (n) => {
        if (!data) return;
        const shuffled = [...data.companies].sort(() => Math.random() - 0.5);
        setSelectedCompanies(shuffled.slice(0, Math.min(n, MAX_COMPANIES)));
    };

    // Sector list for quick-pick dropdown
    const sectors = useMemo(() => {
        if (!data || !data.companies) return [];
        const counts = {};
        data.companies.forEach(c => { const s = c.sector || 'Unknown'; counts[s] = (counts[s] || 0) + 1; });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
    }, [data]);

    // Remove company from comparison
    const removeCompany = (ticker) => {
        setSelectedCompanies(prev => prev.filter(company => company.ticker !== ticker));
    };
    
    // Clear all companies
    const clearAll = () => {
        setSelectedCompanies([]);
    };
    
    // Prepare chart data
    const chartData = useMemo(() => {
        if (!data) return null;
        
        const pillars = PILLAR_ORDER;
        const pillarNames = pillars.map(p => PILLAR_ELEMENTS[p].name);

        // Angle offset: rotated 30° from previous
        const angleOffset = 0;

        // Calculate baseline (average) data from all companies
        const baseline = pillars.map((pillar, i) => {
            const scores = data.companies
                .map(c => c.pillar_scores[pillar]?.t_score)
                .filter(score => score !== undefined);
            const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 50;

            return {
                pillar: pillarNames[i],
                value: avgScore,
                angle: (i * 2 * Math.PI) / pillars.length + angleOffset
            };
        });

        // Selected companies data
        const companies = selectedCompanies.map(company => ({
            ticker: company.ticker,
            name: company.name,
            data: pillars.map((pillar, i) => ({
                pillar: pillarNames[i],
                value: company.pillar_scores[pillar]?.t_score ?? null,
                angle: (i * 2 * Math.PI) / pillars.length + angleOffset
            }))
        }));

        return {
            baseline,
            companies,
            pillars: pillarNames,
            maxValue: 80, // t-scores typically range 20-80
            minValue: 20
        };
    }, [data, selectedCompanies]);
    
    // Shared masthead for loading/error states
    const renderMasthead = () => (
        <div className="masthead">
            <div className="masthead-brand">
                <a href="https://leadershipinstitute.wsj.com" target="_blank" rel="noopener noreferrer">
                    <img src="../resources/wsjli.svg" alt="WSJ Leadership Institute" className="masthead-logo" />
                </a>
            </div>
            <nav className="masthead-nav">
                <a href="../intro/index.html" className="nav-link">Welcome</a>
                <a href="../methodology/index.html" className="nav-link">Methodology</a>
                <a href="./index.html" className="nav-link active">Compare</a>
                <a href="../datatable/index.html" className="nav-link">Data Table</a>
                <a href="../providers/index.html" className="nav-link">Providers</a>
            </nav>
            <a href="https://www.dowjones.com" target="_blank" rel="noopener noreferrer"><img src="../resources/dowjones_logo_green.svg" alt="Dow Jones" className="masthead-dj-logo" /></a>
        </div>
    );

    // Loading skeleton
    if (loading) {
        return (
            <div className="dashboard">
                {renderMasthead()}
                <div className="header">
                    <h1>Best Boards 2026</h1>
                    <p className="subtitle">Loading dashboard data…</p>
                </div>
                <div className="skeleton-container">
                    <div className="skeleton-controls">
                        {[1,2,3,4,5,6].map(i => (
                            <div key={i} className="skeleton-pill" />
                        ))}
                    </div>
                    <div className="skeleton-grid">
                        <div className="skeleton-panel skeleton-left">
                            {[1,2,3,4,5,6].map(i => (
                                <div key={i} className="skeleton-row" />
                            ))}
                        </div>
                        <div className="skeleton-panel skeleton-right">
                            <div className="skeleton-chart" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Error state with retry
    if (loadError || !data) {
        return (
            <div className="dashboard">
                {renderMasthead()}
                <div className="header">
                    <h1>Unable to Load Data</h1>
                    <p className="subtitle">
                        {loadError || 'The data file could not be found.'}
                    </p>
                    <button
                        className="retry-btn"
                        onClick={loadData}
                    >
                        Retry
                    </button>
                    <p className="subtitle" style={{marginTop: '8px', fontSize: '12px', color: '#999'}}>
                        Ensure boards_dashboard_data.json is in the same directory.
                    </p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="dashboard">
            {renderMasthead()}

            <div className="header">
                <div className="header-titles">
                    <h1>Best Boards 2026</h1>
                    <p className="subtitle">
                        See how individual boards stack up to all the others
                    </p>
                </div>
                <div className="header-partner">
                    <span className="partner-label">Sponsored by</span>
                    <img src="../resources/hs-box-logo.png" alt="Heidrick & Struggles" />
                </div>
            </div>

            <div className="app-frame">
            <div className="controls">
                <div className="category-selector-container">
                    <div className="selector-group">
                        {(() => {
                            const showElements = selectedPillar !== 'Overall Board Score' && PILLAR_ELEMENTS[selectedPillar];
                            const displayPillar = showElements
                                ? selectedPillar
                                : Object.keys(PILLAR_ELEMENTS).reduce((a, b) =>
                                    Object.keys(PILLAR_ELEMENTS[a].elements).length >= Object.keys(PILLAR_ELEMENTS[b].elements).length ? a : b);
                            const activeIndicator = hoveredElement || selectedElement;
                            const info = whatsMeasuredFor(displayPillar, activeIndicator);
                            return (
                                <div className="selector-group-flow" ref={flowRef}>
                                    <div className="selector-group-buttons">
                                        <div className="pillar-float">
                                            <div className="selector-group-header">
                                                <div className="section-tag">Dataset Selection</div>
                                            </div>
                                            <div className="selector-group-label">Pillar</div>
                                            <div className="pillar-selector">
                                                {Object.keys(PILLAR_ELEMENTS)
                                                    .sort((a, b) => PILLAR_ORDER.indexOf(a) - PILLAR_ORDER.indexOf(b))
                                                    .map(pillar => (
                                                        <button
                                                            key={pillar}
                                                            className={`pillar-btn ${selectedPillar === pillar ? 'active' : ''}`}
                                                            onClick={() => {
                                                                setSelectedPillar(pillar);
                                                                setSelectedElement(null);
                                                            }}
                                                        >
                                                            {PILLAR_ELEMENTS[pillar].name}
                                                        </button>
                                                    ))}
                                                {selectedChart !== 'scatter' && (
                                                    <button
                                                        className={`overall-btn ${selectedPillar === 'Overall Board Score' ? 'active' : ''}`}
                                                        onClick={() => {
                                                            setSelectedPillar('Overall Board Score');
                                                            setSelectedElement(null);
                                                        }}
                                                    >
                                                        Overall Board Score
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="indicator-float" style={showElements ? {} : {visibility: 'hidden'}}>
                                            <div className="selector-group-label">Indicator</div>
                                            <div className="element-selector">
                                                {(INDICATOR_ORDER[displayPillar] || Object.keys(PILLAR_ELEMENTS[displayPillar].elements)).map(element => (
                                                    <button
                                                        key={element}
                                                        className={`element-btn ${selectedElement === element ? 'active' : ''}`}
                                                        onClick={() => setSelectedElement(
                                                            selectedElement === element ? null : element
                                                        )}
                                                        onMouseEnter={() => setHoveredElement(element)}
                                                        onMouseLeave={() => setHoveredElement(null)}
                                                    >
                                                        {PILLAR_ELEMENTS[displayPillar].elements[element].name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="whats-measured-inline" style={showElements && info ? {} : {visibility: 'hidden'}}>
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
                <div className="comparison-grid" ref={gridRef}>
                    <div className="left-panel">
                        <div className="s2-header-row">
                            <div className="section-tag">Company Selection</div>
                        </div>
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
                        />

                    </div>

                    <div className="right-panel">
                        <div className="chart-toolbar" style={{position:'relative'}}>
                            <div className="chart-toolbar-label">
                                <div className="section-tag">Chart Results</div>
                            </div>
                            <div className="chart-tabs">
                                {CHART_TABS.map(tab => (
                                    <button
                                        key={tab.key}
                                        className={`chart-tab ${selectedChart === tab.key ? 'active' : ''}`}
                                        onClick={() => setSelectedChart(tab.key)}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                            {(selectedChart === 'report-cards' || selectedChart === 'box-plot' || selectedChart === 'beeswarm' || selectedChart === 'scatter') && (
                            <button
                                className="help-fab"
                                onClick={() => setHelpOpen(true)}
                                title="How to read this chart"
                                style={{position:'absolute', right:'2px', top:'50%', transform:'translateY(calc(-50% - 18px))', fontFamily:'Georgia, serif', fontStyle:'italic', fontSize:'15px'}}
                            >i</button>
                            )}
                        </div>
                        <div className="chart-panel">
                            <div className="chart-panel-content" style={{position:'relative'}}>
                                {selectedChart === 'report-cards' && (
                                    <ReportCards
                                        data={data}
                                        selectedCompanies={selectedCompanies}
                                        chartData={chartData}
                                        selectedPillar={selectedPillar}
                                        selectedElement={selectedElement}
                                        shouldAnimate={shouldAnimate}
                                        justAddedTicker={justAddedTicker}
                                    />
                                )}
                                {selectedChart === 'box-plot' && (
                                    <BoxPlot
                                        data={data}
                                        selectedCompanies={selectedCompanies}
                                        selectedPillar={selectedPillar}
                                        selectedElement={selectedElement}
                                        shouldAnimate={shouldAnimate}
                                    />
                                )}
                                {selectedChart === 'beeswarm' && (
                                    <BeeswarmChart
                                        data={data}
                                        selectedCompanies={selectedCompanies}
                                        selectedPillar={selectedPillar}
                                        selectedElement={selectedElement}
                                        shouldAnimate={shouldAnimate}
                                    />
                                )}
                                {selectedChart === 'heatmap' && (
                                    <Heatmap
                                        data={data}
                                        selectedCompanies={selectedCompanies}
                                        selectedPillar={selectedPillar}
                                        selectedElement={selectedElement}
                                        shouldAnimate={shouldAnimate}
                                    />
                                )}
                                {selectedChart === 'bar-chart' && (
                                    <GroupedBarChart
                                        data={data}
                                        selectedCompanies={selectedCompanies}
                                        selectedPillar={selectedPillar}
                                        selectedElement={selectedElement}
                                        shouldAnimate={shouldAnimate}
                                    />
                                )}
                                {selectedChart === 'gics' && (
                                    <GICSBarChart
                                        data={data}
                                        selectedCompanies={selectedCompanies}
                                        selectedPillar={selectedPillar}
                                        selectedElement={selectedElement}
                                        shouldAnimate={shouldAnimate}
                                    />
                                )}
                                {selectedChart === 'scatter' && (
                                    <ScatterPlot
                                        data={data}
                                        selectedCompanies={selectedCompanies}
                                        selectedPillar={selectedPillar}
                                        selectedElement={selectedElement}
                                        shouldAnimate={shouldAnimate}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            </div>{/* end app-frame */}

            {/* Help modal overlay */}
            {helpOpen && (
                <div className="help-backdrop" onClick={() => setHelpOpen(false)}>
                    <div className="help-modal" onClick={e => e.stopPropagation()}>
                        <button className="help-modal-close" onClick={() => setHelpOpen(false)}>&times;</button>
                        <div className="help-modal-body">
                            <HowToRead selectedChart={selectedChart} />
                            {selectedChart === 'report-cards' && (
                            <>
                            <div className="help-modal-divider" />
                            <div className="info-panel" style={{marginTop: 0}}>
                                <h4>About t-scores</h4>
                                <svg width="100%" viewBox="0 0 300 145" style={{display:'block', margin:'4px 0', maxHeight:'160px'}}>
                                    {[3,7,14,24,38,50,55,50,38,24,14,7,3].map((h, i) => {
                                        const barW = 20, gap = 1.5, startX = 17;
                                        const x = startX + i * (barW + gap);
                                        return (
                                            <rect key={i} x={x} y={95-h} width={barW} height={h}
                                                fill="#4A7C8C" opacity={0.2} rx="1"/>
                                        );
                                    })}
                                    <path d="M 17,95 C 50,95 110,40 157,40 C 204,40 264,95 297,95"
                                        fill="none" stroke="#CC3333" strokeWidth="1.5" opacity="0.85"/>
                                    <line x1="17" y1="95" x2="297" y2="95" stroke="#999" strokeWidth="0.75"/>
                                    <line x1="157" y1="37" x2="157" y2="100" stroke="#0A2239" strokeWidth="1.5" strokeDasharray="3,2"/>
                                    <text x="157" y="111" textAnchor="middle" fontSize="11" fill="#0A2239" fontWeight="700"
                                        fontFamily="acumin-pro, IBM Plex Sans, sans-serif">Mean = 50</text>
                                    <line x1="93" y1="63" x2="93" y2="100" stroke="#999" strokeWidth="1" strokeDasharray="2,2"/>
                                    <text x="93" y="111" textAnchor="middle" fontSize="10" fill="#666"
                                        fontFamily="acumin-pro, IBM Plex Sans, sans-serif">40</text>
                                    <line x1="221" y1="63" x2="221" y2="100" stroke="#999" strokeWidth="1" strokeDasharray="2,2"/>
                                    <text x="221" y="111" textAnchor="middle" fontSize="10" fill="#666"
                                        fontFamily="acumin-pro, IBM Plex Sans, sans-serif">60</text>
                                    <line x1="97" y1="121" x2="153" y2="121" stroke="#B8925A" strokeWidth="1.5"/>
                                    <line x1="161" y1="121" x2="217" y2="121" stroke="#B8925A" strokeWidth="1.5"/>
                                    <polygon points="97,118 97,124 93,121" fill="#B8925A"/>
                                    <polygon points="153,118 153,124 157,121" fill="#B8925A"/>
                                    <polygon points="161,118 161,124 157,121" fill="#B8925A"/>
                                    <polygon points="217,118 217,124 221,121" fill="#B8925A"/>
                                    <text x="125" y="134" textAnchor="middle" fontSize="12" fill="#B8925A" fontWeight="600"
                                        fontFamily="acumin-pro, IBM Plex Sans, sans-serif">1 SD = 10</text>
                                    <text x="189" y="134" textAnchor="middle" fontSize="12" fill="#B8925A" fontWeight="600"
                                        fontFamily="acumin-pro, IBM Plex Sans, sans-serif">1 SD = 10</text>
                                    <text x="17"  y="111" textAnchor="start" fontSize="10" fill="#aaa">20</text>
                                    <text x="297" y="111" textAnchor="end"   fontSize="10" fill="#aaa">80</text>
                                </svg>
                                <p>
                                    Scores above 50 = above-average. Below 50 = below-average.
                                </p>
                            </div>
                            </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {guideOpen && (
                <div className="help-backdrop" onClick={() => setGuideOpen(false)}>
                    <div className="guide-modal" onClick={e => e.stopPropagation()}>
                        <button className="help-modal-close" onClick={() => setGuideOpen(false)}>&times;</button>
                        <h2>How to Use This Page</h2>
                        <p className="guide-intro">This dashboard compares S&amp;P 500 boards across five Best Boards pillars. Follow the three steps below.</p>

                        <div className="guide-layout">
                            <div className="guide-layout-frame">
                                <div className="guide-layout-top guide-highlight-1">
                                    <span className="page-map-badge">1</span>
                                </div>
                                <div className="guide-layout-bottom">
                                    <div className="guide-layout-left guide-highlight-2">
                                        <span className="page-map-badge">2</span>
                                    </div>
                                    <div className="guide-layout-right guide-highlight-3">
                                        <span className="page-map-badge">3</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="guide-steps">
                            <div className="guide-step">
                                <span className="guide-step-num">1</span>
                                <div>
                                    <strong>Dataset Selection</strong>
                                    <p>Choose a pillar to focus on (e.g. Knowledge &amp; Experience, Governance &amp; Risk). Optionally drill into a specific indicator within that pillar. Select "Overall Board Score" to see the composite score.</p>
                                </div>
                            </div>
                            <div className="guide-step">
                                <span className="guide-step-num">2</span>
                                <div>
                                    <strong>Company Selection</strong>
                                    <p>Browse the leaderboard and click any company to add it. Use the search bar to find companies by name or ticker, or use the "Top 10" / "Bottom 10" presets. Selected companies appear on the right.</p>
                                </div>
                            </div>
                            <div className="guide-step">
                                <span className="guide-step-num">3</span>
                                <div>
                                    <strong>Chart Results</strong>
                                    <p>View your selected companies across five visualizations: Report Card (radar charts), Bar Chart (lollipop comparison), Box Plot (box plot vs S&amp;P 500), Sector View (GICS averages), and Landscape (scatter plot). Switch views using the tabs.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

// Render the dashboard
ReactDOM.render(<Dashboard />, document.getElementById('root'));
