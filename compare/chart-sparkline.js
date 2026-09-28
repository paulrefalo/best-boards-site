/**
 * Sparkline Component
 * Small inline chart showing all 6 pillar scores
 */
function Sparkline({ company, color }) {
    const width = 75;
    const height = 24;
    const padding = 2;

    // Six pillars in a consistent order
    const pillars = Object.keys(PILLAR_ELEMENTS).sort();

    // Get scores for all pillars
    const scores = pillars.map(pillar => {
        const v = company.pillar_scores?.[pillar]?.t_score;
        return (v != null && !isNaN(v)) ? v : null;
    });

    // Scales
    const xScale = d3.scaleLinear()
        .domain([0, pillars.length - 1])
        .range([padding, width - padding]);

    const yScale = d3.scaleLinear()
        .domain([20, 80]) // t-score typical range
        .range([height - padding, padding]);

    // Create line path — skip null points
    const line = d3.line()
        .defined(d => d != null)
        .x((d, i) => xScale(i))
        .y(d => yScale(d ?? 50));

    const pathData = line(scores);

    return (
        <svg width={width} height={height} style={{ display: 'block' }}>
            {/* Background reference line at 50 (average) */}
            <line
                x1={padding}
                x2={width - padding}
                y1={yScale(50)}
                y2={yScale(50)}
                stroke="#ddd"
                strokeWidth="1"
                strokeDasharray="2,2"
            />

            {/* Sparkline */}
            <path
                d={pathData}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                opacity="0.8"
            />

            {/* Data points */}
            {scores.map((score, i) => (
                <circle
                    key={i}
                    cx={xScale(i)}
                    cy={yScale(score)}
                    r="1.5"
                    fill={color}
                    opacity="0.9"
                />
            ))}
        </svg>
    );
}
