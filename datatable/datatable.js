/**
 * S&P 500 Data Table — WSJ Leadership Institute
 * Full-featured sortable, filterable, paginated data table
 */

// useState, useEffect, useMemo, useRef already declared in constants.js
const { useCallback } = React;

// ─── Constants ───
// PILLAR_ELEMENTS, PILLAR_ORDER, INDICATOR_ORDER, WHATS_MEASURED loaded from ../compare/constants.js

const DT_COMPANY_COLORS = [
    '#4A7C8C', '#8B3A3A', '#5A6B4A', '#C87D4A', '#697380',
    '#B8925A', '#0A2239', '#A65A5A', '#5A8C7C', '#8C6A4A',
    '#7C5A8C', '#8C8C5A'
];

const ROWS_PER_PAGE = 25;

// ─── Heatmap color helper ───
// Returns a subtle background tint based on score distance from 50
function heatmapColor(score) {
    if (score == null || isNaN(score)) return 'transparent';
    const diff = score - 50;
    if (Math.abs(diff) < 3) return 'transparent';
    if (diff > 0) {
        // Above 50: teal tint, opacity scales with distance
        const opacity = Math.min((diff - 3) / 27, 1) * 0.18;
        return `rgba(74, 124, 140, ${opacity.toFixed(3)})`;
    } else {
        // Below 50: warm/red tint
        const opacity = Math.min((Math.abs(diff) - 3) / 27, 1) * 0.18;
        return `rgba(139, 58, 58, ${opacity.toFixed(3)})`;
    }
}

// Inline bar width: scale score from 20-80 range to 0-100%
function barWidth(score) {
    if (score == null || isNaN(score)) return 0;
    return Math.max(0, Math.min(100, ((score - 20) / 60) * 100));
}

// Bar color: muted teal/warm based on score
function barColor(score) {
    if (score == null || isNaN(score)) return 'rgba(105,115,128,0.15)';
    const diff = score - 50;
    if (diff >= 0) {
        const opacity = 0.12 + Math.min(diff / 30, 1) * 0.18;
        return `rgba(74, 124, 140, ${opacity.toFixed(3)})`;
    } else {
        const opacity = 0.12 + Math.min(Math.abs(diff) / 30, 1) * 0.18;
        return `rgba(139, 58, 58, ${opacity.toFixed(3)})`;
    }
}

// ─── Score Cell Component ───
function ScoreCell({ score, isHighlight }) {
    const val = score != null && !isNaN(score) ? score : null;
    const display = val != null ? val.toFixed(1) : '–';

    return (
        <td className={`dt-score-cell${isHighlight ? ' dt-highlight-col' : ''}`}>
            <span className="dt-score-value" style={val == null ? { color: '#999' } : undefined}>{display}</span>
        </td>
    );
}

// ─── Pagination Helper ───
function getPageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [];
    pages.push(1);
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
}

// ─── Main DataTable Component ───
function DataTable() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);

    // View state
    const [selectedPillar, setSelectedPillar] = useState('Overall Board Score');
    const [selectedElement, setSelectedElement] = useState(null);
    const [hoveredElement, setHoveredElement] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [industryGroupFilter, setIndustryGroupFilter] = useState('');

    // Sort state
    const [sortColumn, setSortColumn] = useState('rank');
    const [sortDirection, setSortDirection] = useState('asc');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);

    // JS-driven sticky table header (CSS sticky on <th> is unreliable)
    const controlsRef = useRef(null);
    const theadRef = useRef(null);
    const flowRef = useRef(null);
    const [stickyHeader, setStickyHeader] = useState(false);
    const [headerTop, setHeaderTop] = useState(0);
    const [colWidths, setColWidths] = useState([]);

    useEffect(() => {
        const onScroll = () => {
            if (!controlsRef.current || !theadRef.current) return;
            const controlsBottom = controlsRef.current.getBoundingClientRect().bottom;
            const theadRect = theadRef.current.getBoundingClientRect();
            // When the real thead scrolls behind the controls bar, activate the clone
            if (theadRect.top < controlsBottom && !stickyHeader) {
                // Capture column widths from the real header before cloning
                const ths = theadRef.current.querySelectorAll('th');
                setColWidths(Array.from(ths).map(th => th.getBoundingClientRect().width));
                setHeaderTop(controlsBottom);
                setStickyHeader(true);
            } else if (theadRect.top >= controlsBottom && stickyHeader) {
                setStickyHeader(false);
            }
            // Keep updating top position while sticky
            if (stickyHeader) {
                setHeaderTop(controlsRef.current.getBoundingClientRect().bottom);
            }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
        };
    });

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

        // Load data
    const loadData = useCallback(() => {
        setLoading(true);
        setLoadError(null);
        fetch('../compare/boards_dashboard_data.json')
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                return res.json();
            })
            .then(json => {
                setData(json);
                setLoading(false);
            })
            .catch(err => {
                setLoadError(err.message);
                setLoading(false);
            });
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // Reset page when filters change
    useEffect(() => { setCurrentPage(1); }, [searchTerm, industryGroupFilter, selectedPillar, selectedElement, sortColumn, sortDirection]);

    // Recapture sticky header widths when columns change
    useEffect(() => {
        if (!stickyHeader || !theadRef.current) return;
        // Wait one frame for the new columns to render in the real thead
        const id = requestAnimationFrame(() => {
            const ths = theadRef.current?.querySelectorAll('th');
            if (ths) setColWidths(Array.from(ths).map(th => th.getBoundingClientRect().width));
        });
        return () => cancelAnimationFrame(id);
    }, [selectedPillar, selectedElement]);

    // Derive industry groups from data
    const industryGroups = useMemo(() => {
        if (!data) return [];
        return [...new Set(data.companies.map(c => c.industry_group))].filter(Boolean).sort();
    }, [data]);

    // Build column definitions based on current view
    const columns = useMemo(() => {
        const isOverall = selectedPillar === 'Overall Board Score';

        if (isOverall) {
            const cols = [
                { key: 'rank', label: 'Rank', type: 'rank' },
                { key: 'overall_score', label: 'Score', type: 'overall_score_field' },
                { key: 'ticker', label: 'Ticker', type: 'ticker' },
                { key: 'name', label: 'Company', type: 'name' },
                { key: 'industry_group', label: 'Industry Group', type: 'industry_group' }
            ];
            PILLAR_ORDER.forEach(p => {
                cols.push({ key: `pillar_${p}`, label: PILLAR_ELEMENTS[p].name, type: 'pillar_rank_score', pillar: p });
            });
            return cols;
        } else {
            const cols = [
                { key: 'rank', label: 'Rank', type: 'rank' },
                { key: 'pillar_tscore', label: 'Score', type: 'pillar_score_field' },
                { key: 'ticker', label: 'Ticker', type: 'ticker' },
                { key: 'name', label: 'Company', type: 'name' },
                { key: 'industry_group', label: 'Industry Group', type: 'industry_group' }
            ];
            const elements = PILLAR_ELEMENTS[selectedPillar].elements;
            (INDICATOR_ORDER[selectedPillar] || Object.keys(elements)).forEach(elKey => {
                cols.push({
                    key: `indicator_${elKey}`,
                    label: elements[elKey].name,
                    type: 'score',
                    indicator: elKey,
                    isHighlight: selectedElement === elKey
                });
            });
            return cols;
        }
    }, [selectedPillar, selectedElement]);

    // Get value for a company/column pair (for sorting and display)
    const getCellValue = useCallback((company, col) => {
        switch (col.key) {
            case 'rank':
                if (selectedPillar === 'Overall Board Score') return company.overall_rank;
                if (selectedElement) {
                    return company.pillar_scores?.[selectedPillar]?.indicator_ranks?.[selectedElement] ?? 999;
                }
                return company.pillar_scores?.[selectedPillar]?.rank ?? 999;
            case 'ticker': return company.ticker;
            case 'name': return company.name;
            case 'industry_group': return company.industry_group;
            case 'overall_score': return company.overall_score ?? null;
            case 'pillar_tscore':
                return company.pillar_scores?.[selectedPillar]?.t_score ?? null;
            case 'pillar_score_field':
                return company.pillar_scores?.[selectedPillar]?.t_score ?? null;
            default:
                if (col.pillar) {
                    return company.pillar_scores?.[col.pillar]?.t_score ?? null;
                }
                if (col.indicator) {
                    return company.pillar_scores?.[selectedPillar]?.indicators?.[col.indicator] ?? null;
                }
                return null;
        }
    }, [selectedPillar, selectedElement]);

    // Filtered and sorted data
    const processedData = useMemo(() => {
        if (!data) return [];
        let companies = [...data.companies];

        // Text search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            companies = companies.filter(c =>
                c.ticker.toLowerCase().includes(term) ||
                c.name.toLowerCase().includes(term)
            );
        }

        // Industry group filter
        if (industryGroupFilter) {
            companies = companies.filter(c => c.industry_group === industryGroupFilter);
        }

        // Sort
        const sortCol = columns.find(c => c.key === sortColumn) || columns[0];
        // Tiebreaker: use pillar rank if sorting by a pillar column, otherwise overall rank
        const tiebreak = (a, b) => {
            if (sortCol.pillar) {
                const ra = a.pillar_scores?.[sortCol.pillar]?.rank ?? 999;
                const rb = b.pillar_scores?.[sortCol.pillar]?.rank ?? 999;
                if (ra !== rb) return ra - rb;
            }
            return a.overall_rank - b.overall_rank;
        };
        companies.sort((a, b) => {
            let va = getCellValue(a, sortCol);
            let vb = getCellValue(b, sortCol);
            // Null/missing always sorts to bottom regardless of direction
            if (va == null && vb == null) return tiebreak(a, b);
            if (va == null) return 1;
            if (vb == null) return -1;
            // Numeric sort for scores and rank
            if (typeof va === 'number' && typeof vb === 'number') {
                const cmp = sortDirection === 'asc' ? va - vb : vb - va;
                if (cmp !== 0) return cmp;
                return tiebreak(a, b);
            }
            // String sort
            va = String(va || '').toLowerCase();
            vb = String(vb || '').toLowerCase();
            if (va < vb) return sortDirection === 'asc' ? -1 : 1;
            if (va > vb) return sortDirection === 'asc' ? 1 : -1;
            return tiebreak(a, b);
        });

        return companies;
    }, [data, searchTerm, industryGroupFilter, sortColumn, sortDirection, columns, getCellValue]);

    // Pagination slice
    const totalPages = Math.ceil(processedData.length / ROWS_PER_PAGE);
    const pageData = processedData.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);
    const showStart = processedData.length === 0 ? 0 : (currentPage - 1) * ROWS_PER_PAGE + 1;
    const showEnd = Math.min(currentPage * ROWS_PER_PAGE, processedData.length);

    // Sort handler
    const handleSort = (colKey) => {
        if (sortColumn === colKey) {
            setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(colKey);
            // Default: rank asc, scores desc, text asc
            const col = columns.find(c => c.key === colKey);
            if (col && (col.type === 'score' || col.type === 'overall_score_field' || col.type === 'pillar_score_field' || col.type === 'pillar_rank_score')) {
                setSortDirection('desc');
            } else {
                setSortDirection('asc');
            }
        }
    };

    // Handle pillar change (also set default sort)
    const handlePillarChange = (pillar) => {
        setSelectedPillar(pillar);
        setSelectedElement(null);
        setSortColumn('rank');
        setSortDirection('asc');
    };

    // Handle element change
    const handleElementChange = (element) => {
        if (selectedElement === element) {
            setSelectedElement(null);
            setSortColumn('pillar_tscore');
        } else {
            setSelectedElement(element);
            setSortColumn(`indicator_${element}`);
        }
        setSortDirection('desc');
    };

    // ── Masthead ──
    const renderMasthead = () => (
        <div className="masthead">
            <div className="masthead-brand">
                <a href="https://leadershipinstitute.wsj.com" target="_blank" rel="noopener noreferrer">
                    <img src="../resources/wsjli.svg" alt="WSJ Leadership Institute" className="masthead-logo" />
                </a>
            </div>
            <nav className="masthead-nav">
                <a href="../methodology/index.html" className="nav-link">Methodology</a>
                <a href="../overview/index.html" className="nav-link">Explore</a>
                <a href="./index.html" className="nav-link active">Data Table</a>
            </nav>
            <a href="https://www.dowjones.com" target="_blank" rel="noopener noreferrer"><img src="../resources/dowjones_logo_green.svg" alt="Dow Jones" className="masthead-dj-logo" /></a>
        </div>
    );

    // ── Loading state ──
    if (loading) {
        return (
            <div className="dashboard">
                {renderMasthead()}
                <div className="dt-loading">
                    <div className="dt-spinner" />
                    <div className="dt-loading-text">Loading S&P 500 data...</div>
                </div>
            </div>
        );
    }

    // ── Error state ──
    if (loadError) {
        return (
            <div className="dashboard">
                {renderMasthead()}
                <div className="dt-error">
                    <p>Failed to load data: {loadError}</p>
                    <button onClick={loadData}>Retry</button>
                </div>
            </div>
        );
    }

    // ── Determine pillar for element selector (keep height stable) ──
    const showElements = selectedPillar !== 'Overall Board Score' && PILLAR_ELEMENTS[selectedPillar];
    const displayPillar = showElements
        ? selectedPillar
        : Object.keys(PILLAR_ELEMENTS).reduce((a, b) =>
            Object.keys(PILLAR_ELEMENTS[a].elements).length >= Object.keys(PILLAR_ELEMENTS[b].elements).length ? a : b);

    return (
        <div className="dashboard">
            {renderMasthead()}

            {/* Header */}
            <div className="header">
                <h1>Best Boards 2026</h1>
                <div className="header-partner">
                    <span className="partner-label">Sponsored by</span>
                    <img src="../resources/hs-box-logo.png" alt="Heidrick & Struggles" style={{ height: '38px', width: 'auto', display: 'block' }} />
                </div>
            </div>

            {/* Pillar / Indicator Selector */}
            <div className="dt-controls" ref={controlsRef}>
                <div className="dt-selector-group">
                    {(() => {
                        const activeIndicator = hoveredElement || selectedElement;
                        const info = whatsMeasuredFor(displayPillar, activeIndicator);
                        return (
                            <div className="dt-selector-group-flow" ref={flowRef}>
                                <div className="dt-selector-group-buttons">
                                    <div className="dt-selector-group-label">Pillar</div>
                                    <div className="dt-pillar-selector">
                                        {PILLAR_ORDER.map(pillar => (
                                            <button
                                                key={pillar}
                                                className={`dt-pillar-btn ${selectedPillar === pillar ? 'active' : ''}`}
                                                onClick={() => handlePillarChange(pillar)}
                                            >
                                                {PILLAR_ELEMENTS[pillar].name}
                                            </button>
                                        ))}
                                        <button
                                            className={`dt-overall-btn ${selectedPillar === 'Overall Board Score' ? 'active' : ''}`}
                                            onClick={() => handlePillarChange('Overall Board Score')}
                                        >
                                            Overall Board Score
                                        </button>
                                    </div>
                                    <div className="dt-element-selector-wrap" style={showElements ? {} : {visibility: 'hidden'}}>
                                        <div className="dt-selector-group-label">Indicator</div>
                                        <div className="dt-element-selector">
                                            {(INDICATOR_ORDER[displayPillar] || Object.keys(PILLAR_ELEMENTS[displayPillar].elements)).map(element => (
                                                <button
                                                    key={element}
                                                    className={`dt-element-btn ${selectedElement === element ? 'active' : ''}`}
                                                    onClick={() => handleElementChange(element)}
                                                    onMouseEnter={() => setHoveredElement(element)}
                                                    onMouseLeave={() => setHoveredElement(null)}
                                                >
                                                    {PILLAR_ELEMENTS[displayPillar].elements[element].name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="dt-whats-measured-inline"
                                    style={showElements && info ? {} : {visibility: 'hidden'}}
                                >
                                        <span className="dt-whats-measured-indicator">{activeIndicator || ' '}</span>
                                        {info ? ' — ' : ''}
                                        {info ? info.measured : ' '}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Filters */}
            <div className="dt-filters">
                <div className="dt-search-box">
                    <svg className="dt-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                        type="text"
                        placeholder="Search by ticker or company..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="dt-sector-filter">
                    <select value={industryGroupFilter} onChange={e => setIndustryGroupFilter(e.target.value)}>
                        <option value="">All Industry Groups</option>
                        {industryGroups.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Fixed clone of table header — appears when real header scrolls behind controls */}
            {stickyHeader && (
                <div style={{
                    position: 'fixed', top: headerTop, left: 0, right: 0, zIndex: 90,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}>
                    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 max(12px, 3vw)', background: '#fff' }}>
                        <table className="dt-table" style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
                            <colgroup>
                                {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                            </colgroup>
                            <thead>
                                <tr>
                                    {columns.map(col => {
                                        const isSorted = sortColumn === col.key;
                                        const arrow = isSorted
                                            ? (sortDirection === 'asc' ? ' \u25B2' : ' \u25BC')
                                            : ' \u25BD';
                                        const isHighlight = col.isHighlight;
                                        return (
                                            <th key={col.key}
                                                className={
                                                    (isSorted ? 'dt-sort-active' : '') +
                                                    (isHighlight ? ' dt-highlight-col' : '')
                                                }
                                                onClick={() => handleSort(col.key)}
                                                title={`Sort by ${col.label}`}
                                            >
                                                {col.type === 'pillar_rank_score' ? (
                                                    <div className="dt-th-twoline">
                                                        <div className="dt-th-name">{col.label}</div>
                                                        <div className="dt-th-sub">Rank / Score{arrow && <span className={`dt-sort-arrow${isSorted ? ' active' : ''}`}>{arrow}</span>}</div>
                                                    </div>
                                                ) : (col.key === 'rank' && selectedPillar === 'Overall Board Score') ? (
                                                    <div className="dt-th-twoline">
                                                        <div className="dt-th-name">Overall</div>
                                                        <div className="dt-th-sub">{col.label}{arrow && <span className={`dt-sort-arrow${isSorted ? ' active' : ''}`}>{arrow}</span>}</div>
                                                    </div>
                                                ) : (col.key === 'overall_score') ? (
                                                    <div className="dt-th-twoline">
                                                        <div className="dt-th-name">Overall</div>
                                                        <div className="dt-th-sub">{col.label}{arrow && <span className={`dt-sort-arrow${isSorted ? ' active' : ''}`}>{arrow}</span>}</div>
                                                    </div>
                                                ) : (
                                                    <React.Fragment>
                                                        {col.label}
                                                        {arrow && <span className={`dt-sort-arrow${isSorted ? ' active' : ''}`}>{arrow}</span>}
                                                    </React.Fragment>
                                                )}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                        </table>
                    </div>
                </div>
            )}

            {/* Main data table */}
            <div className="dt-table-container">
                <table className="dt-table">
                    <thead ref={theadRef}>
                        <tr>
                            {columns.map(col => {
                                const isSorted = sortColumn === col.key;
                                const arrow = isSorted
                                    ? (sortDirection === 'asc' ? ' \u25B2' : ' \u25BC')
                                    : ' \u25BD';
                                const isHighlight = col.isHighlight;
                                return (
                                    <th key={col.key}
                                        className={
                                            (isSorted ? 'dt-sort-active' : '') +
                                            (isHighlight ? ' dt-highlight-col' : '')
                                        }
                                        onClick={() => handleSort(col.key)}
                                        title={`Sort by ${col.label}`}
                                    >
                                        {col.type === 'pillar_rank_score' ? (
                                            <div className="dt-th-twoline">
                                                <div className="dt-th-name">{col.label}</div>
                                                <div className="dt-th-sub">Rank / Score{arrow && <span className={`dt-sort-arrow${isSorted ? ' active' : ''}`}>{arrow}</span>}</div>
                                            </div>
                                        ) : (col.key === 'rank' && selectedPillar === 'Overall Board Score') ? (
                                            <div className="dt-th-twoline">
                                                <div className="dt-th-name">Overall</div>
                                                <div className="dt-th-sub">{col.label}{arrow && <span className={`dt-sort-arrow${isSorted ? ' active' : ''}`}>{arrow}</span>}</div>
                                            </div>
                                        ) : (col.key === 'overall_score') ? (
                                            <div className="dt-th-twoline">
                                                <div className="dt-th-name">Overall</div>
                                                <div className="dt-th-sub">{col.label}{arrow && <span className={`dt-sort-arrow${isSorted ? ' active' : ''}`}>{arrow}</span>}</div>
                                            </div>
                                        ) : (
                                            <React.Fragment>
                                                {col.label}
                                                {arrow && <span className={`dt-sort-arrow${isSorted ? ' active' : ''}`}>{arrow}</span>}
                                            </React.Fragment>
                                        )}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {pageData.map(company => (
                            <tr key={company.ticker}>
                                {columns.map(col => {
                                    if (col.type === 'rank') {
                                        const rank = getCellValue(company, col);
                                        return <td key={col.key} className="dt-col-rank">{rank != null && rank < 999 ? rank : '–'}</td>;
                                    }
                                    if (col.type === 'overall_score_field') {
                                        const val = company.overall_score;
                                        return <td key={col.key} className="dt-col-overall-score">{val != null ? val.toFixed(1) : '–'}</td>;
                                    }
                                    if (col.type === 'pillar_score_field') {
                                        const val = company.pillar_scores?.[selectedPillar]?.t_score;
                                        return <td key={col.key} className="dt-col-overall-score">{val != null ? val.toFixed(1) : '–'}</td>;
                                    }
                                    if (col.type === 'ticker') {
                                        return <td key={col.key} className="dt-col-ticker">{company.ticker}</td>;
                                    }
                                    if (col.type === 'name') {
                                        return <td key={col.key} className="dt-col-name" title={company.name}>{company.name}</td>;
                                    }
                                    if (col.type === 'industry_group') {
                                        return <td key={col.key} className="dt-col-sector" title={company.industry_group}>{company.industry_group}</td>;
                                    }
                                    if (col.type === 'pillar_rank_score') {
                                        const pillarData = company.pillar_scores?.[col.pillar];
                                        const rank = pillarData?.rank;
                                        const score = pillarData?.t_score;
                                        const hasBoth = rank != null && score != null;
                                        return (
                                            <td key={col.key} className="dt-col-pillar-rank-score">
                                                {hasBoth ? (
                                                    <React.Fragment>
                                                        <span className="dt-prs-rank">{rank}</span>
                                                        <span className="dt-prs-sep">/</span>
                                                        <span className="dt-prs-score">{score.toFixed(1)}</span>
                                                    </React.Fragment>
                                                ) : (
                                                    <span className="dt-prs-score">–</span>
                                                )}
                                            </td>
                                        );
                                    }
                                    if (col.type === 'score') {
                                        const val = getCellValue(company, col);
                                        return <ScoreCell key={col.key} score={val} isHighlight={col.isHighlight} />;
                                    }
                                    return <td key={col.key}>–</td>;
                                })}
                            </tr>
                        ))}
                        {pageData.length === 0 && (
                            <tr>
                                <td colSpan={columns.length} style={{
                                    textAlign: 'center', padding: '40px 20px',
                                    color: '#999', fontStyle: 'italic'
                                }}>
                                    No companies match the current filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {processedData.length > 0 && (
                <div className="dt-pagination">
                    <div className="dt-pagination-info">
                        Showing {showStart}–{showEnd} of {processedData.length}
                    </div>
                    <div className="dt-pagination-controls">
                        <button
                            className="dt-page-btn"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => p - 1)}
                        >
                            Prev
                        </button>
                        {getPageNumbers(currentPage, totalPages).map((page, i) => {
                            if (page === '...') {
                                return <span key={`ellipsis-${i}`} className="dt-page-ellipsis">...</span>;
                            }
                            return (
                                <button
                                    key={page}
                                    className={`dt-page-btn ${currentPage === page ? 'active' : ''}`}
                                    onClick={() => setCurrentPage(page)}
                                >
                                    {page}
                                </button>
                            );
                        })}
                        <button
                            className="dt-page-btn"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => p + 1)}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}

// ─── Mount ───
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<DataTable />);
