/**
 * HowToRead Component
 * Dynamic "How to Read" + strengths panel that updates with the selected chart type
 */
function HowToRead({ selectedChart }) {
    const content = {
        'box-plot': {
            title: 'How to Read: Box Plot',
            layout: 'two-col',
            diagramLeft: (
                <div>
                    <svg width="100%" viewBox="0 0 120 140" style={{display:'block', margin:'0 auto', maxHeight:'180px'}}>
                        {/* Max whisker */}
                        <line x1="38" y1="8" x2="38" y2="26" stroke="#999" strokeWidth="1.5"/>
                        <line x1="29" y1="8" x2="47" y2="8" stroke="#999" strokeWidth="1.5"/>
                        {/* Box Q1–Q3 */}
                        <rect x="18" y="26" width="40" height="60" fill="#E8E3D6" stroke="#0A2239" strokeWidth="1.5"/>
                        {/* Median */}
                        <line x1="18" y1="56" x2="58" y2="56" stroke="#0A2239" strokeWidth="2.5"/>
                        {/* Min whisker */}
                        <line x1="38" y1="86" x2="38" y2="110" stroke="#999" strokeWidth="1.5"/>
                        <line x1="29" y1="110" x2="47" y2="110" stroke="#999" strokeWidth="1.5"/>
                        {/* Selected company dot */}
                        <circle cx="48" cy="42" r="3.5" fill="#4A7C8C" stroke="#fff" strokeWidth="1.5"/>
                        <text x="23" y="37" fontSize="8" fontWeight="600" fill="#4A7C8C">AAPL</text>
                        {/* Leader lines + labels */}
                        <line x1="47" y1="8"  x2="60" y2="8"  stroke="#ddd" strokeWidth="0.75"/>
                        <text x="62" y="11" fontSize="8" fill="#666">Upper fence</text>
                        <line x1="58" y1="56" x2="64" y2="56" stroke="#ddd" strokeWidth="0.75"/>
                        <text x="66" y="59" fontSize="8" fill="#0A2239" fontWeight="600">Median</text>
                        <line x1="47" y1="110" x2="60" y2="110" stroke="#ddd" strokeWidth="0.75"/>
                        <text x="62" y="113" fontSize="8" fill="#666">Lower fence</text>
                        {/* Legend */}
                        <circle cx="12" cy="130" r="3" fill="#4A7C8C" stroke="#fff" strokeWidth="1"/>
                        <text x="18" y="133" fontSize="8" fill="#4A7C8C" fontWeight="600">your selection</text>
                    </svg>
                </div>
            ),
            diagramRight: (
                <div style={{display:'flex', flexDirection:'column', justifyContent:'center', height:'100%'}}>
                    <div style={{fontSize:'12px', color:'#444', lineHeight:'1.6', fontFamily:'acumin-pro, IBM Plex Sans, sans-serif'}}>
                        <p style={{margin:'0 0 8px'}}>The box spans the middle 50% of S&P 500 scores. Points beyond the fences are outliers.</p>
                        <p style={{margin:'0 0 8px'}}>The line inside the box is the median.</p>
                        <p style={{margin:'0'}}>Colored dots are your selected companies.</p>
                    </div>
                </div>
            ),
            strengths: null
        },
        'bar-chart': {
            title: 'How to Read: Bar Chart',
            diagram: (
                <svg width="100%" viewBox="0 0 280 130" style={{display:'block', maxHeight:'130px'}}>
                    {/* Midline at 50 */}
                    <line x1="140" y1="8" x2="140" y2="118" stroke="#8B8178" strokeWidth="1"/>
                    <text x="140" y="6" textAnchor="middle" fontSize="7" fill="#8B8178" fontWeight="700" fontFamily="acumin-pro, IBM Plex Sans, sans-serif">50</text>
                    {/* Bars: company colors above 50, navy benchmark */}
                    {[
                        {y:14,  score:220, color:'#4A7C8C', label:'AAPL'},
                        {y:36,  score:195, color:'#8B3A3A', label:'MSFT'},
                        {y:58,  score:160, color:'#0A2239', label:'S\u2009&\u2009P 500 Avg', isBenchmark:true},
                        {y:80,  score:105, color:'#C87D4A', label:'AMZN'},
                        {y:102, score:80,  color:'#5A6B4A', label:'TSLA'},
                    ].map(({y, score, color, label, isBenchmark}, i) => {
                        const barX = score > 140 ? 140 : score;
                        const barW = Math.abs(score - 140);
                        return (
                            <g key={i}>
                                <rect x={barX} y={y} width={barW} height={16} fill={color} opacity={isBenchmark ? 0.85 : 0.75} rx="2"/>
                                <text x={score > 140 ? score+6 : score-6} y={y+11} textAnchor={score > 140 ? 'start' : 'end'} fontSize="8" fontWeight={isBenchmark ? '800' : '700'} fill={color} fontFamily="acumin-pro, IBM Plex Sans, sans-serif">{label}</text>
                            </g>
                        );
                    })}
                </svg>
            ),
            strengths: 'Cleanest view for ranking selected companies on one metric. Each bar uses the company\'s assigned color. Navy benchmark bar shows S&P 500 average. Best for: "How do my picks compare?"'
        },
        'report-cards': {
            title: 'How to Read: Report Card',
            layout: 'two-col',
            diagramLeft: (
                <div>
                    <div style={{fontSize:'12px', fontWeight:600, color:'#0A2239', marginBottom:'6px', textAlign:'center', fontFamily:'acumin-pro, IBM Plex Sans, sans-serif'}}>Radar Chart</div>
                    <svg width="90%" viewBox="0 0 160 100" style={{display:'block'}}>
                        {[
                            {cx:45, cy:42, color:'#999',   pts:null,              label:'S&P 500', labelColor:'#999'},
                            {cx:115,cy:42, color:'#4A7C8C',pts:'115,20 133,36 126,60 104,60 97,36', label:'AAPL', labelColor:'#4A7C8C'},
                        ].map(({cx,cy,color,pts,label,labelColor},i) => (
                            <g key={i}>
                                {[12,21,30].map(r => <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="#eee" strokeWidth="0.75"/>)}
                                {[0,1,2,3,4].map(j => {
                                    const angle = (j*72-90)*Math.PI/180;
                                    return <line key={j} x1={cx} y1={cy} x2={cx+Math.cos(angle)*30} y2={cy+Math.sin(angle)*30} stroke="#eee" strokeWidth="0.75"/>;
                                })}
                                <polygon points={[0,1,2,3,4].map(j=>{const a=(j*72-90)*Math.PI/180;return `${cx+Math.cos(a)*16},${cy+Math.sin(a)*16}`;}).join(' ')}
                                    fill="#999" fillOpacity="0.12" stroke="#999" strokeWidth="0.75"/>
                                {pts && <polygon points={pts} fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5"/>}
                                <text x={cx} y={cy+38} textAnchor="middle" fontSize="9" fill={labelColor} fontWeight="600">{label}</text>
                            </g>
                        ))}
                    </svg>
                    <div style={{fontSize:'12px', color:'#666', lineHeight:'1.6', fontFamily:'acumin-pro, IBM Plex Sans, sans-serif', marginTop:'6px'}}>
                        Shape shows five-pillar profile. High symmetry indicates consistent performance.
                    </div>
                </div>
            ),
            diagramRight: (
                <div>
                    <div style={{fontSize:'12px', fontWeight:600, color:'#0A2239', marginBottom:'6px', textAlign:'center', fontFamily:'acumin-pro, IBM Plex Sans, sans-serif'}}>Score Histogram</div>
                    <svg width="90%" viewBox="0 0 160 100" style={{display:'block'}}>
                        {[4, 10, 20, 34, 44, 37, 22, 10, 3].map((h, i) => {
                            const barW = 14, gap = 2, startX = 10;
                            const x = startX + i * (barW + gap);
                            const highlighted = i === 5;
                            return (
                                <rect key={i} x={x} y={80-h} width={barW} height={h}
                                    fill="#4A7C8C" opacity={highlighted ? 0.85 : 0.18} rx="1"/>
                            );
                        })}
                        <line x1="108" y1="81" x2="108" y2="86" stroke="#4A7C8C" strokeWidth="2"/>
                        <text x="108" y="95" textAnchor="middle" fontSize="8" fill="#4A7C8C" fontWeight="600">score</text>
                        <text x="10" y="95" fontSize="8" fill="#aaa">low</text>
                        <text x="151" y="95" textAnchor="end" fontSize="8" fill="#aaa">high</text>
                    </svg>
                    <div style={{fontSize:'12px', color:'#666', lineHeight:'1.6', fontFamily:'acumin-pro, IBM Plex Sans, sans-serif', marginTop:'6px'}}>
                        Highlighted bar = company's score. Gray bars = S&P 500 distribution.
                    </div>
                </div>
            ),
            strengths: null
        },
        'gics': {
            title: 'How to Read: Sector View',
            layout: 'two-col',
            diagramLeft: (
                <div>
                    <svg width="100%" viewBox="0 0 170 120" style={{display:'block', maxHeight:'140px'}}>
                        {/* Midline */}
                        <line x1="85" y1="8" x2="85" y2="112" stroke="#8B8178" strokeWidth="1"/>
                        <text x="85" y="6" textAnchor="middle" fontSize="7" fill="#0A2239" fontWeight="700" fontFamily="acumin-pro, IBM Plex Sans, sans-serif">50</text>
                        {/* Bars above 50 */}
                        <rect x="85" y="14" width="55" height="12" rx="1" fill="#4A7C8C"/>
                        <text x="78" y="23" textAnchor="end" fontSize="7" fill="#555" fontFamily="acumin-pro, IBM Plex Sans, sans-serif">Energy</text>
                        <rect x="85" y="30" width="30" height="12" rx="1" fill="#4A7C8C"/>
                        <text x="78" y="39" textAnchor="end" fontSize="7" fill="#555" fontFamily="acumin-pro, IBM Plex Sans, sans-serif">Materials</text>
                        {/* S&P 500 benchmark bar */}
                        <rect x="84" y="46" width="2" height="12" rx="1" fill="#0A2239"/>
                        <text x="78" y="55" textAnchor="end" fontSize="7" fill="#0A2239" fontWeight="700" fontFamily="acumin-pro, IBM Plex Sans, sans-serif">S&amp;P 500</text>
                        {/* Bars below 50 */}
                        <rect x="60" y="62" width="25" height="12" rx="1" fill="#697380"/>
                        <text x="78" y="71" textAnchor="end" fontSize="7" fill="#555" fontFamily="acumin-pro, IBM Plex Sans, sans-serif">Healthcare</text>
                        <rect x="50" y="78" width="35" height="12" rx="1" fill="#697380"/>
                        <text x="78" y="87" textAnchor="end" fontSize="7" fill="#555" fontFamily="acumin-pro, IBM Plex Sans, sans-serif">Tech</text>
                        <rect x="40" y="94" width="45" height="12" rx="1" fill="#697380"/>
                        <text x="78" y="103" textAnchor="end" fontSize="7" fill="#555" fontFamily="acumin-pro, IBM Plex Sans, sans-serif">Financials</text>
                    </svg>
                </div>
            ),
            diagramRight: (
                <div style={{display:'flex', flexDirection:'column', justifyContent:'center', height:'100%'}}>
                    <div style={{fontSize:'11px', color:'#444', lineHeight:'1.5', fontFamily:'acumin-pro, IBM Plex Sans, sans-serif'}}>
                        <p style={{margin:'0 0 6px'}}><strong style={{color:'#0A2239'}}>Each bar</strong> = average t-score for all companies in a GICS (Global Industry Classification Standard) sector.</p>
                        <p style={{margin:'0 0 6px'}}><strong style={{color:'#4A7C8C'}}>Teal bars</strong> extend right from 50 (above S&amp;P 500 average).</p>
                        <p style={{margin:'0 0 6px'}}><strong style={{color:'#697380'}}>Slate bars</strong> extend left from 50 (below average).</p>
                        <p style={{margin:'0'}}><strong style={{color:'#0A2239'}}>Black bar</strong> = S&amp;P 500 overall average. Selected companies are shown as markers on their sector's bar.</p>
                    </div>
                </div>
            ),
            strengths: null
        },
        'scatter': {
            title: 'How to Read: Landscape Scatterplot',
            layout: 'two-col',
            diagramLeft: (
                <div>
                    <svg width="100%" viewBox="0 0 140 130" style={{display:'block', margin:'0 auto', maxHeight:'160px'}}>
                        {/* Quadrant lines */}
                        <line x1="70" y1="10" x2="70" y2="120" stroke="#0A2239" strokeWidth="0.75" strokeDasharray="3,2" opacity="0.25"/>
                        <line x1="10" y1="65" x2="130" y2="65" stroke="#0A2239" strokeWidth="0.75" strokeDasharray="3,2" opacity="0.25"/>
                        {/* Dots */}
                        <circle cx="95" cy="30" r="6" fill="#0072B2" opacity="0.4"/>
                        <circle cx="105" cy="40" r="4" fill="#009E73" opacity="0.4"/>
                        <circle cx="85" cy="45" r="5" fill="#E69F00" opacity="0.4"/>
                        <circle cx="50" cy="80" r="7" fill="#D55E00" opacity="0.4"/>
                        <circle cx="40" cy="90" r="3" fill="#56B4E9" opacity="0.4"/>
                        <circle cx="60" cy="55" r="4" fill="#B0AAA0" opacity="0.4"/>
                        <circle cx="75" cy="60" r="5" fill="#0A2239" opacity="0.4"/>
                        {/* Selected dot */}
                        <circle cx="100" cy="35" r="5" fill="#0072B2" stroke="#fff" strokeWidth="1.5" opacity="0.9"/>
                        <text x="100" y="25" textAnchor="middle" fontSize="7" fontWeight="600" fill="#0072B2">AAPL</text>
                        {/* Axis labels */}
                        <text x="70" y="128" textAnchor="middle" fontSize="7" fill="#888">Overall →</text>
                        <text x="6" y="65" textAnchor="middle" fontSize="7" fill="#888" transform="rotate(-90, 6, 65)">Pillar →</text>
                    </svg>
                </div>
            ),
            diagramRight: (
                <div style={{display:'flex', flexDirection:'column', justifyContent:'center', height:'100%'}}>
                    <div style={{fontSize:'12px', color:'#444', lineHeight:'1.6', fontFamily:'acumin-pro, IBM Plex Sans, sans-serif'}}>
                        <p style={{margin:'0 0 8px'}}>Each dot is one S&amp;P 500 company. X-axis = Overall score, Y-axis = selected pillar or indicator.</p>
                        <p style={{margin:'0 0 8px'}}>Dot size reflects market cap as of Dec 31, 2025. Color = GICS sector.</p>
                        <p style={{margin:'0 0 8px'}}>Top-right quadrant = strong on both. Bottom-left quadrant = weak on both.</p>
                        <p style={{margin:'0'}}>Use the "Selected companies vs." dropdown to highlight one sector. Selected companies always stay visible.</p>
                    </div>
                </div>
            ),
            strengths: null
        },
    };

    // Beeswarm — score distribution, colored by GICS sector.
    content['beeswarm'] = {
        title: 'How to Read: Beeswarm',
        layout: 'two-col',
        diagramLeft: (
            <div>
                <svg width="100%" viewBox="0 0 150 120" style={{display:'block', margin:'0 auto', maxHeight:'170px'}}>
                    {/* Median (vertical) + baseline */}
                    <line x1="75" y1="12" x2="75" y2="96" stroke="#0A2239" strokeWidth="1" strokeDasharray="4,3" opacity="0.5"/>
                    <line x1="16" y1="96" x2="134" y2="96" stroke="#B8B2A6" strokeWidth="0.75"/>
                    {/* Dots stacking up into a bell, colored by sector */}
                    <circle cx="35" cy="90" r="3" fill="#882255" opacity="0.7"/>
                    <circle cx="45" cy="90" r="3" fill="#0072B2" opacity="0.7"/><circle cx="45" cy="83" r="3" fill="#E69F00" opacity="0.7"/>
                    <circle cx="55" cy="90" r="3" fill="#009E73" opacity="0.7"/><circle cx="55" cy="83" r="3" fill="#56B4E9" opacity="0.7"/><circle cx="55" cy="76" r="3" fill="#0072B2" opacity="0.7"/>
                    <circle cx="65" cy="90" r="3" fill="#D55E00" opacity="0.7"/><circle cx="65" cy="83" r="3" fill="#0A2239" opacity="0.7"/><circle cx="65" cy="76" r="3" fill="#009E73" opacity="0.7"/><circle cx="65" cy="69" r="3" fill="#117733" opacity="0.7"/>
                    <circle cx="75" cy="90" r="3" fill="#0072B2" opacity="0.7"/><circle cx="75" cy="83" r="3" fill="#E69F00" opacity="0.7"/><circle cx="75" cy="76" r="3" fill="#009E73" opacity="0.7"/><circle cx="75" cy="69" r="3" fill="#56B4E9" opacity="0.7"/><circle cx="75" cy="62" r="3" fill="#D55E00" opacity="0.7"/>
                    <circle cx="85" cy="90" r="3" fill="#009E73" opacity="0.7"/><circle cx="85" cy="83" r="3" fill="#0072B2" opacity="0.7"/><circle cx="85" cy="76" r="3" fill="#E69F00" opacity="0.7"/><circle cx="85" cy="69" r="3" fill="#117733" opacity="0.7"/>
                    <circle cx="95" cy="90" r="3" fill="#56B4E9" opacity="0.7"/><circle cx="95" cy="83" r="3" fill="#009E73" opacity="0.7"/><circle cx="95" cy="76" r="3" fill="#0072B2" opacity="0.7"/>
                    <circle cx="105" cy="90" r="3" fill="#0A2239" opacity="0.7"/><circle cx="105" cy="83" r="3" fill="#009E73" opacity="0.7"/>
                    <circle cx="115" cy="90" r="3" fill="#E69F00" opacity="0.7"/>
                    {/* Selected dot ringed + label above */}
                    <circle cx="95" cy="76" r="4.5" fill="#0072B2" stroke="#4A7C8C" strokeWidth="1.8"/>
                    <line x1="95" y1="18" x2="95" y2="71" stroke="#4A7C8C" strokeWidth="0.75" opacity="0.6"/>
                    <text x="95" y="15" textAnchor="middle" fontSize="7" fontWeight="700" fill="#4A7C8C">ISRG</text>
                    {/* X axis labels (score) */}
                    <text x="35" y="108" textAnchor="middle" fontSize="7" fill="#666">30</text>
                    <text x="75" y="108" textAnchor="middle" fontSize="7" fill="#666">50</text>
                    <text x="115" y="108" textAnchor="middle" fontSize="7" fill="#666">70</text>
                </svg>
            </div>
        ),
        diagramRight: (
            <div style={{display:'flex', flexDirection:'column', justifyContent:'center', height:'100%'}}>
                <div style={{fontSize:'12px', color:'#444', lineHeight:'1.6', fontFamily:'acumin-pro, IBM Plex Sans, sans-serif'}}>
                    <p style={{margin:'0 0 8px'}}>Each circle is one S&P 500 board, placed left-to-right by its score. Circles spread out from a center line, so the swarm is widest where the most boards cluster — a bell-shaped (violin) distribution.</p>
                    <p style={{margin:'0 0 8px'}}>Color shows the company's GICS sector — see the legend above the chart. Dot size reflects board size (number of directors).</p>
                    <p style={{margin:'0'}}>Selected boards are ringed and labeled above the swarm so you can see where they land.</p>
                </div>
            </div>
        ),
        strengths: null
    };

    const c = content[selectedChart] || content['box-plot'];

    if (c.layout === 'two-col') {
        return (
            <div className="info-panel how-to-read-panel">
                <h4>{c.title}</h4>
                <div className="how-to-read-two-col">
                    <div className="how-to-read-col">{c.diagramLeft}</div>
                    <div className="how-to-read-col-divider"></div>
                    <div className="how-to-read-col">{c.diagramRight}</div>
                </div>
            </div>
        );
    }

    if (c.layout === 'side-by-side') {
        return (
            <div className="info-panel how-to-read-panel">
                <div className="how-to-read-side-by-side">
                    <div className="how-to-read-text">
                        <h4>{c.title}</h4>
                        <p className="how-to-read-strengths">{c.strengths}</p>
                    </div>
                    <div className="how-to-read-diagram-large">
                        {c.diagram}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="info-panel how-to-read-panel">
            <h4>{c.title}</h4>
            {c.diagram}
            <p className="how-to-read-strengths">{c.strengths}</p>
        </div>
    );
}

const CHART_TABS = [
    { key: 'report-cards',    label: 'Report Card' },
    { key: 'bar-chart',       label: 'Bar Chart' },
    { key: 'box-plot',        label: 'Box Plot' },
    { key: 'beeswarm',        label: 'Beeswarm' },
    { key: 'gics',            label: 'Sector View' },
    { key: 'scatter',         label: 'Landscape' },
];
