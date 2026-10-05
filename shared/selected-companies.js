/**
 * Selected Companies + Leaderboard — Two-column layout
 * Left col: Leaderboard / Company Finder (browse & add)
 * Right col: Selected Companies (review & remove)
 */

// Format a score for display: '--' for null/undefined/NaN, otherwise value.toFixed(1)
const formatScoreS2 = (val) => (val != null && !isNaN(val)) ? val.toFixed(1) : '--';

// ─── Truncated-name tooltip (600ms delay, appended to body) ───
const NAME_TOOLTIP_DELAY = 600;
let _nameTooltipEl = null;
let _nameTooltipTimer = null;

function getNameTooltipEl() {
    if (!_nameTooltipEl) {
        _nameTooltipEl = document.createElement('div');
        _nameTooltipEl.className = 'company-name-tooltip';
        document.body.appendChild(_nameTooltipEl);
    }
    return _nameTooltipEl;
}

function showNameTooltip(e) {
    const el = e.currentTarget;
    // Only show if text is actually truncated (scrollHeight for -webkit-line-clamp)
    if (el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth) return;
    const text = el.getAttribute('data-fullname');
    if (!text) return;
    clearTimeout(_nameTooltipTimer);
    _nameTooltipTimer = setTimeout(() => {
        const tip = getNameTooltipEl();
        tip.textContent = text;
        const rect = el.getBoundingClientRect();
        tip.style.left = rect.left + 'px';
        tip.style.top = (rect.bottom + 4) + 'px';
        tip.style.opacity = '1';
    }, NAME_TOOLTIP_DELAY);
}

function hideNameTooltip() {
    clearTimeout(_nameTooltipTimer);
    const tip = getNameTooltipEl();
    tip.style.opacity = '0';
}

function SelectedCompaniesTable({ selectedCompanies, removeCompany, clearAll, selectedPillar, selectedElement, data, searchTerm, setSearchTerm, addCompany, loadTopN, loadBottomN, loadBySector, maxCompanies, justAddedTicker, activeTicker, onSelectActive }) {

    const [sortAsc, setSortAsc] = useState(false);

    const getScore = useMemo(() => {
        // Return a raw score (null for missing data) bound to the current selectedElement
        const el = selectedElement;
        return (company, pillar) => {
            if (pillar === 'Overall Board Score') {
                const v = company.overall_score;
                return (v != null && !isNaN(v)) ? v : null;
            }
            if (el) {
                const val = company.pillar_scores[pillar]?.indicators?.[el];
                return (val != null && !isNaN(val)) ? val : null;
            }
            const v = company.pillar_scores[pillar]?.t_score;
            return (v != null && !isNaN(v)) ? v : null;
        };
    }, [selectedElement]);

    const allCompaniesSorted = useMemo(() => {
        if (!data || !data.companies) return [];
        const dir = sortAsc ? 1 : -1;
        return [...data.companies].sort((a, b) => {
            const sa = getScore(a, selectedPillar) ?? -Infinity;
            const sb = getScore(b, selectedPillar) ?? -Infinity;
            return dir * (sa - sb);
        });
    }, [data, selectedPillar, getScore, sortAsc]);

    // Ranks from pre-baked JSON data (handles ties correctly)
    const companyRanks = useMemo(() => {
        if (!data || !data.companies) return {};
        const ranks = {};
        data.companies.forEach(c => {
            if (selectedPillar === 'Overall Board Score') {
                ranks[c.ticker] = c.overall_rank ?? '–';
            } else if (selectedElement) {
                ranks[c.ticker] = c.pillar_scores?.[selectedPillar]?.indicator_ranks?.[selectedElement] ?? '–';
            } else {
                ranks[c.ticker] = c.pillar_scores?.[selectedPillar]?.rank ?? '–';
            }
        });
        return ranks;
    }, [data, selectedPillar, selectedElement]);

    const sortedSelected = useMemo(() => {
        return [...selectedCompanies].sort((a, b) => getScore(b, selectedPillar) - getScore(a, selectedPillar));
    }, [selectedCompanies, selectedPillar, getScore]);

    const maxScore = useMemo(() => {
        if (selectedCompanies.length === 0) return 100;
        return Math.max(...selectedCompanies.map(c => getScore(c, selectedPillar) ?? 0));
    }, [selectedCompanies, selectedPillar, getScore]);

    const leaderboardMaxScore = useMemo(() => {
        if (allCompaniesSorted.length === 0) return 100;
        return getScore(allCompaniesSorted[0], selectedPillar) ?? 100;
    }, [allCompaniesSorted, selectedPillar, getScore]);

    const filteredCompanies = useMemo(() => {
        if (!searchTerm.trim()) return allCompaniesSorted;
        const term = searchTerm.toLowerCase();
        return allCompaniesSorted.filter(c =>
            c.ticker.toLowerCase().includes(term) || c.name.toLowerCase().includes(term)
        );
    }, [allCompaniesSorted, searchTerm]);

    const selectedTickers = useMemo(() => new Set(selectedCompanies.map(c => c.ticker)), [selectedCompanies]);

    const sectors = useMemo(() => {
        if (!data || !data.companies) return [];
        const counts = {};
        data.companies.forEach(c => { const s = c.sector || 'Unknown'; counts[s] = (counts[s] || 0) + 1; });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
    }, [data]);

    const atCap = false; // no limit

    const handleFinderRowClick = (company) => {
        if (selectedTickers.has(company.ticker)) {
            removeCompany(company.ticker);
        } else if (!atCap) {
            addCompany(company);
        }
        setSearchTerm('');
    };

    const datasetLabel = selectedElement
        ? (PILLAR_ELEMENTS[selectedPillar]?.elements[selectedElement]?.name || selectedElement)
        : (selectedPillar === 'Overall Board Score' ? 'Overall' : (PILLAR_ELEMENTS[selectedPillar]?.name || selectedPillar));

    return (
        <div className="s2-two-col">
            {/* ── LEFT COLUMN: Leaderboard / Finder ── */}
            <div className="s2-col s2-leaderboard">
                <div className="s2-col-header">
                    <h3>
                        {datasetLabel} Leaderboard
                        <button
                            className="sort-toggle"
                            onClick={() => setSortAsc(v => !v)}
                            title={sortAsc ? 'Sorted low → high (click to reverse)' : 'Sorted high → low (click to reverse)'}
                        >{sortAsc ? '▲' : '▼'}</button>
                    </h3>
                    <input
                        type="text"
                        className="company-finder-search"
                        placeholder="Search ticker or name"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="s2-scroll">
                    <table className="s2-table leaderboard-drawer-table">
                        <thead>
                            <tr>
                                <th className="rank-col">#</th>
                                <th className="company-col">Company</th>
                                <th className="score-col">Score</th>
                                <th className="action-col"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCompanies.map((company, rowIdx) => {
                                const score = getScore(company, selectedPillar);
                                const rank = companyRanks[company.ticker] || '–';
                                const isSelected = selectedTickers.has(company.ticker);
                                const originalIndex = selectedCompanies.findIndex(c => c.ticker === company.ticker);
                                const companyColor = isSelected ? COMPANY_COLORS[originalIndex % COMPANY_COLORS.length] : null;
                                const rowStyle = {
                                    ...(!isSelected && atCap ? { opacity: 0.45, cursor: 'default' } : {}),
                                    ...(rowIdx < 30 ? { animation: `rowFadeIn 0.4s ease-out ${rowIdx * 18}ms both` } : {}),
                                };
                                return (
                                    <tr
                                        key={company.ticker}
                                        className={`company-finder-row ${isSelected ? 'selected' : ''} ${!isSelected && atCap ? 'disabled' : ''}`}
                                        onClick={() => handleFinderRowClick(company)}
                                        style={rowStyle}
                                    >
                                        <td className="rank-col">
                                            {rank}
                                        </td>
                                        <td className="company-col">
                                            <div className="company-ticker">{company.ticker}</div>
                                            <div className="company-name" data-fullname={company.name} onMouseEnter={showNameTooltip} onMouseLeave={hideNameTooltip}>{company.name}</div>
                                        </td>
                                        <td className="score-col">
                                            {formatScoreS2(score)}
                                            {score != null && <div className="score-bar" style={{
                                                width: `${(score / leaderboardMaxScore) * 100}%`,
                                                backgroundColor: isSelected ? companyColor : '#697380'
                                            }}></div>}
                                        </td>
                                        <td className="action-col">
                                            {isSelected && (
                                                <button className="remove-btn" onClick={(e) => { e.stopPropagation(); removeCompany(company.ticker); }} title="Remove">×</button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── RIGHT COLUMN: Selected Companies ── */}
            <div className="s2-col s2-selected">
                <div className="s2-col-header">
                    <h3>
                        Selected Companies ({selectedCompanies.length})
                        {selectedCompanies.length > 0 && (
                            <button className="clear-link" onClick={clearAll}>Clear</button>
                        )}
                    </h3>
                </div>
                <div className="s2-scroll">
                    {selectedCompanies.length === 0 ? (
                        <div className="empty-state">
                            <p>Click companies in the leaderboard to add them.</p>
                        </div>
                    ) : (
                        <table className="s2-table leaderboard-table">
                            <thead>
                                <tr>
                                    <th className="rank-col">#</th>
                                    <th className="color-col"></th>
                                    <th className="company-col">Company</th>
                                    <th className="score-col">Score</th>
                                    <th className="action-col"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedSelected.map((company, rowIdx) => {
                                    const score = getScore(company, selectedPillar);
                                    const actualRank = companyRanks[company.ticker] || '–';
                                    const originalIndex = selectedCompanies.findIndex(c => c.ticker === company.ticker);
                                    const companyColor = COMPANY_COLORS[originalIndex % COMPANY_COLORS.length];
                                    const isActive = onSelectActive && company.ticker === activeTicker;
                                    return (
                                        <tr
                                            key={company.ticker}
                                            className={`${company.ticker === justAddedTicker ? 'selection-pulse' : ''}${isActive ? ' active-row' : ''}`}
                                            onClick={onSelectActive ? () => onSelectActive(company.ticker) : undefined}
                                            style={{
                                                animation: `rowFadeIn 0.45s ease-out ${rowIdx * 35}ms both`,
                                                ...(onSelectActive ? { cursor: 'pointer' } : {}),
                                                ...(isActive ? { background: 'rgba(10,34,57,0.08)', boxShadow: 'inset 3px 0 0 ' + companyColor } : {}),
                                            }}
                                        >
                                            <td className="rank-col">{actualRank}</td>
                                            <td className="color-col">
                                                <div className="company-color-dot" style={{ backgroundColor: companyColor, outline: isActive ? '2px solid #0A2239' : 'none', outlineOffset: '1px' }}></div>
                                            </td>
                                            <td className="company-col">
                                                <div className="company-ticker">{company.ticker}</div>
                                                <div className="company-name" data-fullname={company.name} onMouseEnter={showNameTooltip} onMouseLeave={hideNameTooltip}>{company.name}</div>
                                            </td>
                                            <td className="score-col">
                                                {formatScoreS2(score)}
                                                {score != null && <div className="score-bar" style={{
                                                    width: `${(score / maxScore) * 100}%`,
                                                    backgroundColor: companyColor
                                                }}></div>}
                                            </td>
                                            <td className="action-col">
                                                <button className="remove-btn" onClick={(e) => { e.stopPropagation(); removeCompany(company.ticker); }} title="Remove">×</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
