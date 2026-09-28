// ============================================================
// WSJ Best Boards 2026 — Methodology Page
// Content from: WSJL Best Boards Methodology 9.21.26.docx
// ============================================================

// ── Data sources table (from the methodology doc) ──
const DATA_SOURCES = [
    {
        area: 'Knowledge and Experience',
        indicator: 'Board members’ backgrounds',
        provider: 'Bendable Labs and Diligent',
        measured: 'Using a large language model, a company’s latest proxy statement was examined to determine directors’ experience and expertise in six categories: AI/technology, executive leadership, financial, innovation, international and regulatory/legal.',
        details: 'The six categories are weighted equally. Scores are adjusted based on a board’s size so that larger boards don’t have an undue advantage. Executive leadership includes CEOs and CFOs of entities that qualify based on their size and prominence.',
    },
    {
        area: 'Group Dynamics',
        indicator: 'Deference',
        provider: 'Free Float Analytics',
        measured: 'This assesses the likelihood that dissent against management would be difficult given the social and economic dynamics of the board.',
        details: 'This accounts for 40% of the Group Dynamics score.',
    },
    {
        area: 'Group Dynamics',
        indicator: 'Similarity',
        provider: 'Free Float Analytics',
        measured: 'Using demographic markers (race, gender, age), experience markers (roles, knowledge, schooling) and connections (overlapping networks), this examines where a board may have a blind spot because of similarities that could negate fresh perspectives.',
        details: 'This accounts for 30% of the Group Dynamics score.',
    },
    {
        area: 'Group Dynamics',
        indicator: 'Industry expertise',
        provider: 'Bendable Labs',
        measured: 'Using a large language model, a company’s latest proxy statement was examined to determine how much relevant industry experience or expertise each board member has.',
        details: 'When 30% to 50% of the board has relevant industry expertise—a big enough portion to challenge management but not so large as to promote groupthink—it earns the most points. This accounts for 30% of the Group Dynamics score.',
    },
    {
        area: 'Governance and Risk Management',
        indicator: 'Governance score',
        provider: 'Diligent',
        measured: 'Twenty different data points were used to assess the composition of the board and its committees, with an eye on a company’s decision-making ability, transparency and accountability, as well as its level of governance risk.',
        details: 'This accounts for 30% of the Governance and Risk Management score.',
    },
    {
        area: 'Governance and Risk Management',
        indicator: 'Shareholder support',
        provider: 'Diligent',
        measured: 'The vote tallies for each board member during their most recent election were averaged, and a graduated penalty was applied for totals under 90%.',
        details: 'This accounts for 10% of the Governance and Risk Management score.',
    },
    {
        area: 'Governance and Risk Management',
        indicator: 'Activist vulnerability',
        provider: 'Diligent Market Intelligence',
        measured: 'A multiple logistic regression analysis of activist investor investment was used to assess the likelihood that a company becomes a target.',
        details: 'This accounts for 15% of the Governance and Risk Management score.',
    },
    {
        area: 'Governance and Risk Management',
        indicator: 'Controversy rating',
        provider: 'Sustainalytics',
        measured: 'This assesses a company’s involvement in incidents with negative environmental, social and governance implications, with a focus on the impact to stakeholders and the financial risk to the company.',
        details: 'This accounts for 20% of the Governance and Risk Management score.',
    },
    {
        area: 'Governance and Risk Management',
        indicator: 'Audit and litigation risk',
        provider: 'Ideagen',
        measured: 'This assesses whether a company has any notable open litigation in various areas (environmental, labor, regulatory, shareholder actions, etc.) and any red flags related to its audits (financial restatements, change in accounting estimates, inordinately high audit fees, etc.).',
        details: 'This accounts for 25% of the Governance and Risk Management score.',
    },
    {
        area: 'Financial Performance',
        indicator: 'Total shareholder return',
        provider: 'FactSet',
        measured: 'Stock performance on both a three-year and 10-year timeframe was analyzed to determine how a company has performed against the average of its industry group, as defined by the Global Industry Classification Standard.',
        details: 'Stock return data is through June 30, 2026.',
    },
    {
        area: 'Best Companies for the Future',
        indicator: 'Best Companies for the Future',
        provider: 'Bendable Labs, using data from Aquisio.ai; Brand Finance; Burning Glass Institute; CB Insights; Clarivate; Diligent; Dragonfly; FactSet; Flex Index; Glassdoor; Indeed; Management Lab; MIT FutureTech; Morningstar; MSCI; Opportunity@Work; Prof. Dimitris Papanikolaou of Northwestern University and Prof. Amit Seru of Stanford University; Revelio Labs; ROI Rocket; Supply Chain Resource Cooperative at North Carolina State University',
        measured: 'Evaluates how large corporations stack up in six areas: AI readiness, innovation, talent readiness, financial fitness, resilience and agility. A firm’s overall Best Companies for the Future score is included in Best Boards in recognition of the fact that directors are stewards of a corporation’s future.',
        details: 'The full methodology for Best Companies for the Future for 2026 can be found at bendablelabs.com/wsj-futurebest-ranking.',
    },
];

// ── Area badge colors ──
const AREA_COLORS = {
    'Knowledge and Experience':       '#0072B2',
    'Group Dynamics':                 '#D55E00',
    'Governance and Risk Management': '#009E73',
    'Financial Performance':          '#E69F00',
    'Best Companies for the Future':  '#56B4E9',
};

// ── Data Sources Table ──
const THEAD_HEIGHT = 38; // px — column header row height for sticky offset

function DataSourcesTable() {
    let lastArea = '';

    const thStyle = {
        textAlign: 'left', padding: '10px 12px', color: '#0A2239',
        fontWeight: 600, fontSize: '12px',
        position: 'sticky', top: 0, zIndex: 20,
        background: '#FFFFFF',
        boxShadow: 'inset 0 -2px 0 #0A2239',
    };

    return (
        <div style={{ marginTop: '32px' }}>
            <table style={{
                width: '100%', borderCollapse: 'separate', borderSpacing: 0,
                fontFamily: 'acumin-pro, IBM Plex Sans, sans-serif', fontSize: '13px',
            }}>
                <thead>
                    <tr>
                        <th style={{ ...thStyle, whiteSpace: 'nowrap' }}>Indicator</th>
                        <th style={{ ...thStyle, whiteSpace: 'nowrap' }}>Data Provider</th>
                        <th style={thStyle}>What's Measured</th>
                        <th style={thStyle}>Computational Details</th>
                    </tr>
                </thead>
                <tbody>
                    {DATA_SOURCES.map((row, i) => {
                        const showAreaHeader = row.area !== lastArea;
                        lastArea = row.area;
                        const color = AREA_COLORS[row.area] || '#666';

                        return (
                            <React.Fragment key={i}>
                                {showAreaHeader && (
                                    <tr>
                                        <td colSpan={4} style={{
                                            padding: '16px 12px 6px',
                                            fontFamily: 'Crimson Text, serif',
                                            fontSize: '18px', fontWeight: 700,
                                            color: color,
                                            boxShadow: `inset 0 -2px 0 ${color}`,
                                            position: 'sticky', top: THEAD_HEIGHT, zIndex: 10,
                                            background: '#FFFFFF',
                                        }}>
                                            {row.area}
                                        </td>
                                    </tr>
                                )}
                                <tr style={{ verticalAlign: 'top' }}>
                                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0A2239', minWidth: '130px', borderBottom: '1px solid #E0DDD3' }}>
                                        {row.indicator}
                                    </td>
                                    <td style={{ padding: '10px 12px', color: '#444', minWidth: '110px', borderBottom: '1px solid #E0DDD3' }}>
                                        {row.provider}
                                    </td>
                                    <td style={{ padding: '10px 12px', color: '#444', lineHeight: '1.5', minWidth: '220px', borderBottom: '1px solid #E0DDD3' }}>
                                        {row.measured}
                                    </td>
                                    <td style={{ padding: '10px 12px', color: '#666', lineHeight: '1.5', fontSize: '12px', minWidth: '200px', borderBottom: '1px solid #E0DDD3' }}>
                                        {row.details}
                                    </td>
                                </tr>
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ── Main Page ──
function MethodologyPage() {
    return (
        <div className="dashboard">
            <div className="masthead">
                <div className="masthead-brand">
                    <a href="https://leadershipinstitute.wsj.com" target="_blank" rel="noopener noreferrer">
                        <img src="../resources/wsjli.svg" alt="WSJ Leadership Institute" className="masthead-logo" />
                    </a>
                </div>
                <nav className="masthead-nav">
                    <a href="./index.html" className="nav-link active">Methodology</a>
                    <a href="../overview/index.html" className="nav-link">Explore</a>
                    <a href="../datatable/index.html" className="nav-link">Data Table</a>
                </nav>
                <a href="https://www.dowjones.com" target="_blank" rel="noopener noreferrer"><img src="../resources/dowjones_logo_green.svg" alt="Dow Jones" className="masthead-dj-logo" /></a>
            </div>

            <div className="header">
                <h1>WSJ Best Boards 2026</h1>
            </div>

            <div className="content-body content-wide">

                <h2>Methodology</h2>

                <p>
                    The Best Boards ranking, created
                    by <a href="https://bendablelabs.com" target="_blank" rel="noopener noreferrer">Bendable Labs</a> for
                    the <a href="https://leadershipinstitute.wsj.com" target="_blank" rel="noopener noreferrer">WSJ
                    Leadership Institute</a>, evaluates how boards at large corporations compare with each other in five
                    areas: the knowledge and experience of their directors, group dynamics, governance and risk management,
                    the company's financial performance, and the firm's place in the Leadership Institute's Best Companies
                    for the Future ranking for 2026.
                </p>

                <p>
                    To be ranked in Best Boards, a company had to be part of the S&P 500 stock index as of June 30, 2026.
                </p>

                <p>
                    Within the five areas are 11 different indicators. Ten of them draw on a handful of data providers:
                    Diligent, Free Float Analytics, Sustainalytics, Ideagen, FactSet and Bendable Labs. The 11th, Best
                    Companies for the Future, draws on its own broader set of sources. To determine directors' relevant
                    knowledge and experience, Bendable Labs used a large language model that analyzed their bios as provided
                    in company proxy statements. Details on all of the indicators can be found in the table below.
                </p>

                <p>
                    Scores were standardized with a typical range of 0 to 100, a mean of 50 and a standard deviation of 10.
                    A company that scores a 60 is in the top 15% or so of the universe of companies covered, a 70 in the
                    top 2% or so; a 40 is in the bottom 15% or so, a 30 in the bottom 2% or so.
                </p>

                <p>
                    None of the areas was given more weight than any other. For a board scored in all five, each accounts
                    for 20% of the overall score. For the small number of firms that didn't have a Best Companies for the
                    Future score because they joined the S&P 500 after the cutoff date for that ranking, the four remaining
                    areas were equally weighted at 25%.
                </p>

                <p>
                    Each company was scored only on the indicators for which it had data. No results depend on imputed values.
                </p>

                <p>
                    In financial performance, each company was scored based on how it stacked up against the average of its
                    peers within its industry group, as defined by the Global Industry Classification Standard. With this
                    approach, the top-performing company in utilities or insurance scored just as high as the top-performing
                    company in software or semiconductors. The intent was to ensure that a board didn't get outsize credit
                    simply for being in a hot industry.
                </p>

                <p>
                    As a final step, a board's overall score was calculated using a statistical measure called geometric
                    mean. The purpose was to reward those companies that are consistently strong across all areas and
                    penalize those that have high variability in their scores.
                </p>

                <h2>Data Sources</h2>

                <DataSourcesTable />

            </div>
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(<MethodologyPage />);
