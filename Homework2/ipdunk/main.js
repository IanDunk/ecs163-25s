/*
    DISCLAIMER:
    There has been help with the use of AI, particularly in the designing of the webpage, making things pretty, difficult d3 concepts, and window resizing.
    All ideas are mine and original.
    Color choice was taken directly from https://bulbapedia.bulbagarden.net/wiki/Main_Page (OFFICIAL POKEMON COLOR SCHEME FOR TYPES)
        -- using first generation color scheme
    Created by Ian Dunk, SID: 922746675, ECS163 HW 2

    Images sourced from: https://www.kaggle.com/datasets/vishalsubbiah/pokemon-images-and-types
*/

/* 
    How to open on computer

    In terminal type:
    python3 -m http.server 8000

    In browser type:
    http://localhost:8000/index.html
*/

// --- Global Constants and Setup ---
let width, height;
let isNarrowView = false;

// Define Margins for each plot
const scatterMargin = {top: 20, right: 30, bottom: 50, left: 60};
const barChartMargin = {top: 20, right: 30, bottom: 70, left: 60};
const sankeyMargin = {top: 20, right: 10, bottom: 20, left: 10};

// Legend settings
const legendXOffset = 40;
const legendItemWidth = 120;
const legendItemHeight = 18;
const legendSwatchSize = 14;
const legendTextOffsetX = 5;

// Color mapping for Pokémon types
const typeColors = {
    Fire: "#EE8130", Water: "#6390F0", Grass: "#7AC74C", Electric: "#F7D02C", Ice: "#96D9D6",
    Fighting: "#C22E28", Poison: "#A33EA1", Ground: "#E2BF65", Flying: "#A98FF3",
    Psychic: "#F95587", Bug: "#A6B91A", Rock: "#B6A136", Ghost: "#735797",
    Dragon: "#6F35FC", Dark: "#705746", Steel: "#B7B7CE", Fairy: "#D685AD", Normal: "#A8A77A"
};

const legendaryColor = "#FFD700";

// Heights will be calculated dynamically based on window size
let scatterPlotContentHeight;
let barChartContentHeight;
let sankeyContentHeight;
let scatterContentWidth;
let barChartContentWidth;
let sankeyContentWidth;

// Minimum sizes to maintain usability
const MIN_WIDTH = 320;
const MIN_PLOT_HEIGHT = 200;
const NARROW_BREAKPOINT = 768;

// State variables
let selectedXAttribute = 'Attack';
let selectedYAttribute = 'Defense';
let selectedGenerations = [1, 2, 3, 4, 5, 6];
let showLegendaryOnly = false;
let selectedTypes = new Set();

// Global data variable
let originalData = null;

// Initialize select elements
const xAxisSelect = d3.select("#x-axis-select");
const yAxisSelect = d3.select("#y-axis-select");
const axisAttributes = [
    { value: 'HP', text: 'HP' }, { value: 'Attack', text: 'Attack' }, { value: 'Defense', text: 'Defense' },
    { value: 'Sp_Atk', text: 'Sp. Attack' }, { value: 'Sp_Def', text: 'Sp. Defense' }, { value: 'Speed', text: 'Speed' },
    { value: 'Height_m', text: 'Height (m)' }, { value: 'Weight_kg', text: 'Weight (kg)' }, { value: 'Catch_Rate', text: 'Catch Rate' },
    { value: 'Pr_Male', text: 'Pr(Male)'}
];

axisAttributes.forEach(attr => {
    xAxisSelect.append("option").attr("value", attr.value).text(attr.text).property("selected", attr.value === selectedXAttribute);
    yAxisSelect.append("option").attr("value", attr.value).text(attr.text).property("selected", attr.value === selectedYAttribute);
});

// Create the main SVG container
const svg = d3.select("svg");

// Tooltip setup
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

// Function to calculate dimensions based on window size
function calculateDimensions() {
    const container = document.querySelector('.viz-container');
    const containerRect = container.getBoundingClientRect();
    width = Math.max(MIN_WIDTH, containerRect.width - 40); // Account for padding
    
    // Check if we're in narrow view
    isNarrowView = window.innerWidth < NARROW_BREAKPOINT;
    
    // Calculate heights based on viewport
    const viewportHeight = window.innerHeight;
    const baseHeight = viewportHeight * 0.7; // Use 70% of viewport height
    
    scatterPlotContentHeight = Math.max(MIN_PLOT_HEIGHT, isNarrowView ? baseHeight * 0.3 : baseHeight * 0.4);
    barChartContentHeight = Math.max(MIN_PLOT_HEIGHT, baseHeight * 0.3);
    sankeyContentHeight = Math.max(MIN_PLOT_HEIGHT, baseHeight * 0.3);
    
    // Calculate widths
    if (isNarrowView) {
        // Stack legend below scatter plot on narrow screens
        scatterContentWidth = width - scatterMargin.left - scatterMargin.right;
    } else {
        // Full width layout on wider screens - legend will overlay on the right
        scatterContentWidth = width - scatterMargin.left - scatterMargin.right;
    }
    
    barChartContentWidth = width - barChartMargin.left - barChartMargin.right;
    sankeyContentWidth = width - sankeyMargin.left - sankeyMargin.right;
    
    // Calculate total height needed
    height = scatterMargin.top + scatterPlotContentHeight + scatterMargin.bottom + 25 +
             barChartMargin.top + barChartContentHeight + barChartMargin.bottom + 25 +
             sankeyMargin.top + sankeyContentHeight + sankeyMargin.bottom;
}

// Store references to main visualization groups
let g1, g2, g3;
let x1, y1, x2_bar, y2_bar;
let xAxisG, yAxisG, xAxisBarG, yAxisBarG;

// Function to resize all visualizations
function resizeVisualizations() {
    if (!originalData) return;
    
    calculateDimensions();
    
    // Update SVG dimensions
    svg.attr("width", width).attr("height", height);
    
    // Update scales
    x1.range([0, scatterContentWidth]);
    y1.range([scatterPlotContentHeight, 0]);
    x2_bar.range([0, barChartContentWidth]);
    y2_bar.range([barChartContentHeight, 0]);
    
    // Redraw all visualizations
    filterAndDrawAll();
}

// Debounce function to limit resize calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Add resize event listener
window.addEventListener('resize', debounce(resizeVisualizations, 250));

// Initial dimension calculation
calculateDimensions();

// Update SVG initial dimensions
svg.attr("width", width).attr("height", height);

// === Data Loading and Processing ===
d3.csv("pokemon_alopez247.csv").then(rawData => {
    originalData = rawData;
    
    originalData.forEach(d => {
        d.HP = +d.HP; d.Attack = +d.Attack; d.Defense = +d.Defense;
        d.Sp_Atk = +d.Sp_Atk; d.Sp_Def = +d.Sp_Def; d.Speed = +d.Speed;
        d.Height_m = +d.Height_m; d.Weight_kg = +d.Weight_kg;
        d.Catch_Rate = +d.Catch_Rate;
        d.Pr_Male = (d.Pr_Male === '' || d.Pr_Male === null || d.Pr_Male === undefined) ? NaN : +d.Pr_Male;
        d.Generation = +d.Generation;
    });

    // Clear any existing content
    svg.selectAll("*").remove();

    // --- Create all main groups ONCE ---
    g1 = svg.append("g").attr("class", "scatter-plot-group");
    g2 = svg.append("g").attr("class", "bar-chart-group");
    g3 = svg.append("g").attr("class", "sankey-group");

    // --- SCATTER PLOT SETUP ---
    x1 = d3.scaleLinear().range([0, scatterContentWidth]);
    y1 = d3.scaleLinear().range([scatterPlotContentHeight, 0]);

    xAxisG = g1.append("g").attr("class", "x-axis");
    yAxisG = g1.append("g").attr("class", "y-axis");

    const xAxisLabel = g1.append("text").attr("class", "x-axis-label")
        .attr("text-anchor", "middle").style("font-size", "14px");
    const yAxisLabel = g1.append("text").attr("class", "y-axis-label")
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "middle").style("font-size", "14px");

    // --- BAR CHART SETUP ---
    const allTypes = Array.from(new Set(originalData.map(d => d.Type_1).filter(t => t))).sort(d3.ascending);
    x2_bar = d3.scaleBand().domain(allTypes).range([0, barChartContentWidth]).padding(0.2);
    y2_bar = d3.scaleLinear().range([barChartContentHeight, 0]);

    xAxisBarG = g2.append("g").attr("class", "x-axis-bar");
    yAxisBarG = g2.append("g").attr("class", "y-axis-bar");

    g2.append("text").attr("class", "bar-chart-x-label")
        .attr("text-anchor", "middle").style("font-size", "14px").text("Pokémon Type");
    const barChartYAxisLabel = g2.append("text").attr("class", "bar-chart-y-label")
        .attr("transform", "rotate(-90)").attr("text-anchor", "middle").style("font-size", "14px")
        .text("Number of Pokémon");

    // --- LEGEND SETUP IN HTML ---
    const typeLegendContainer = d3.select("#type-legend");
    
    // Add type legend items
    const typeColors_array = Object.entries(typeColors);
    
    typeColors_array.forEach(([type, color]) => {
        const legendItem = typeLegendContainer.append("div")
            .attr("class", "type-legend-item")
            .on("click", function() {
                toggleTypeFilter(type);
            });
        
        legendItem.append("div")
            .attr("class", "type-legend-box")
            .style("background-color", color);
        
        legendItem.append("span")
            .attr("class", "type-legend-text")
            .text(type);
    });
    
    // Add separator
    typeLegendContainer.append("div")
        .attr("class", "legend-separator");
    
    // Add legendary filter
    const legendaryItem = typeLegendContainer.append("div")
        .attr("class", "legendary-item")
        .on("click", function() {
            toggleLegendaryFilter();
        });
    
    legendaryItem.append("div")
        .attr("class", "type-legend-box")
        .style("background-color", legendaryColor);
    
    legendaryItem.append("span")
        .attr("class", "type-legend-text")
        .text("Legendary Only");
    
    // Toggle functions for type and legendary filters
    function toggleTypeFilter(type) {
        if (selectedTypes.has(type)) {
            selectedTypes.delete(type);
            d3.select(event.currentTarget).select(".type-legend-box").classed("selected", false);
        } else {
            selectedTypes.add(type);
            d3.select(event.currentTarget).select(".type-legend-box").classed("selected", true);
        }
        
        if (selectedTypes.size === 0) {
            typeLegendContainer.selectAll(".type-legend-item .type-legend-box").classed("selected", false);
        }
        
        filterAndDrawAll();
    }
    
    function toggleLegendaryFilter() {
        showLegendaryOnly = !showLegendaryOnly;
        d3.select(event.currentTarget).select(".type-legend-box").classed("selected", showLegendaryOnly);
        filterAndDrawAll();
    }

    // --- Event listeners ---
    d3.selectAll(".generation-checkbox").on("change", function() {
        const generationValue = +this.value;
        const isChecked = this.checked;
        if (isChecked && !selectedGenerations.includes(generationValue)) {
            selectedGenerations.push(generationValue);
        } else if (!isChecked) {
            selectedGenerations = selectedGenerations.filter(g => g !== generationValue);
        }
        filterAndDrawAll();
    });
    
    xAxisSelect.on("change", function() {
        selectedXAttribute = d3.select(this).property("value");
        filterAndDrawAll();
    });
    
    yAxisSelect.on("change", function() {
        selectedYAttribute = d3.select(this).property("value");
        filterAndDrawAll();
    });

    // Initial draw
    filterAndDrawAll();

}).catch(error => {
    console.error("Error loading or processing CSV data:", error);
    svg.append("text").attr("x", width / 2).attr("y", 50).attr("text-anchor", "middle")
       .text(`Error loading data: ${error.message}. Check console.`);
});

// Update functions
function updateScatterScalesAndAxes() {
    const validX = originalData.filter(d => !isNaN(d[selectedXAttribute]));
    const validY = originalData.filter(d => !isNaN(d[selectedYAttribute]));
    x1.domain([0, d3.max(validX, d => d[selectedXAttribute]) || 10]);
    y1.domain([0, d3.max(validY, d => d[selectedYAttribute]) || 10]);
    xAxisG.transition().duration(500).call(d3.axisBottom(x1));
    yAxisG.transition().duration(500).call(d3.axisLeft(y1));
    
    const xAxisLabel = g1.select(".x-axis-label");
    const yAxisLabel = g1.select(".y-axis-label");
    xAxisLabel.text(axisAttributes.find(a => a.value === selectedXAttribute)?.text || selectedXAttribute);
    yAxisLabel.text(axisAttributes.find(a => a.value === selectedYAttribute)?.text || selectedYAttribute);
}

function updateScatterPlot(data) {
    const displayData = data.filter(d =>
        typeof d[selectedXAttribute] === 'number' && !isNaN(d[selectedXAttribute]) &&
        typeof d[selectedYAttribute] === 'number' && !isNaN(d[selectedYAttribute]) &&
        (selectedTypes.size === 0 || selectedTypes.has(d.Type_1))
    );
    
    const circles = g1.selectAll("circle").data(displayData, d => d.Number);

    circles.exit().transition().duration(500).attr("r", 0).remove();
    
    circles.enter().append("circle")
        .attr("r", 0)
        .attr("cx", d => x1(d[selectedXAttribute]))
        .attr("cy", d => y1(d[selectedYAttribute]))
        .merge(circles)
        .on("mouseover", function(d) {
            const pokemonName = d.Name;
            const imageName = String(pokemonName || '').toLowerCase();
            const imagePath = `images/${imageName}.png`;
            const xAttrLabel = axisAttributes.find(attr => attr.value === selectedXAttribute)?.text || selectedXAttribute;
            const yAttrLabel = axisAttributes.find(attr => attr.value === selectedYAttribute)?.text || selectedYAttribute;
            const xValue = d[selectedXAttribute];
            const yValue = d[selectedYAttribute];
            tooltip.style("display", "block").style("opacity", 0.9)
                .html(`<div style="text-align: center;">
                           <img src="${imagePath}" alt="${pokemonName}" style="width: 70px; height: 70px; display: block; margin: 0 auto 5px auto;" onerror="this.style.display='none';">
                           <strong>${pokemonName}</strong>
                           <div style="text-align: left; margin-top: 5px; font-size: 0.9em;">
                               ${xAttrLabel}: ${xValue}<br>
                               ${yAttrLabel}: ${yValue}
                           </div>
                       </div>`);
            d3.select(this).attr("stroke", "black").attr("stroke-width", 2).raise();
        })
        .on("mousemove", function() {
            tooltip.style("left", (d3.event.pageX + 10) + "px")
                   .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
            tooltip.style("display", "none").style("opacity", 0);
            d3.select(this).attr("stroke", null);
        })
        .transition().duration(500)
        .attr("cx", d => x1(d[selectedXAttribute]))
        .attr("cy", d => y1(d[selectedYAttribute]))
        .attr("r", 5)
        .attr("fill", d => typeColors[d.Type_1] || "gray");
}

function drawOrUpdateBarGraph(data) {
    const filteredData = selectedTypes.size === 0 ? 
        data : 
        data.filter(d => selectedTypes.has(d.Type_1));
        
    const totalInSelection = filteredData.length;
    const barChartYAxisLabel = g2.select(".bar-chart-y-label");
    barChartYAxisLabel.text(`Number of Pokémon (Total: ${totalInSelection})`);
    
    const typeCounts = filteredData.reduce((acc, d) => {
        if (d.Type_1) acc[d.Type_1] = (acc[d.Type_1] || 0) + 1;
        return acc;
    }, {});
    
    const typeDataForBars = x2_bar.domain().map(type => ({ 
        type: type, 
        count: typeCounts[type] || 0,
        percentage: totalInSelection > 0 ? ((typeCounts[type] || 0) / totalInSelection * 100).toFixed(1) : 0
    }));
    
    // Set y-axis scale to range from 0 to the highest type count, with fallback of 10 if no data
    y2_bar.domain([0, d3.max(typeDataForBars, d => d.count) || 10]);
    // Animate the y-axis update with new scale over 500ms
    yAxisBarG.transition().duration(500).call(d3.axisLeft(y2_bar));
    
    // Update x-axis with dynamic text styling
    xAxisBarG.call(d3.axisBottom(x2_bar));
    
    // Calculate optimal rotation and font size based on available width
    const barWidth = x2_bar.bandwidth();
    const minBarWidth = 30;
    let rotationAngle = -45;
    let fontSize = "12px";
    let textAnchor = "end";
    
    xAxisBarG.selectAll("text")
        .attr("transform", `rotate(${rotationAngle})`)
        .attr("x", rotationAngle === -90 ? -5 : -10)
        .attr("y", rotationAngle === -90 ? 5 : 0)
        .style("text-anchor", textAnchor)
        .style("font-size", fontSize);
    
    const bars = g2.selectAll(".bar").data(typeDataForBars, d => d.type);
    bars.exit().transition().duration(500).attr("y", y2_bar(0)).attr("height", 0).remove();
    
    bars.enter().append("rect").attr("class", "bar")
        .attr("x", d => x2_bar(d.type)).attr("y", y2_bar(0))
        .attr("width", x2_bar.bandwidth()).attr("height", 0)
        .attr("fill", d => typeColors[d.type] || "gray")
        .merge(bars)
        .on("mouseover", function(d) {
            tooltip.style("display", "block")
                .style("opacity", 0.9)
                .html(`<div style="text-align: center;">
                        <strong>${d.type}</strong><br>
                        Count: ${d.count}<br>
                        Percentage: ${d.percentage}%
                    </div>`);
            d3.select(this).attr("stroke", "black").attr("stroke-width", 2);
        })
        .on("mousemove", function() {
            tooltip.style("left", (d3.event.pageX + 10) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            tooltip.style("display", "none").style("opacity", 0);
            d3.select(this).attr("stroke", null);
        })
        .transition().duration(500)
        .attr("x", d => x2_bar(d.type)).attr("y", d => y2_bar(d.count))
        .attr("width", x2_bar.bandwidth()).attr("height", d => barChartContentHeight - y2_bar(d.count))
        .attr("opacity", d => selectedTypes.size === 0 || selectedTypes.has(d.type) ? 1 : 0.3);
        
    // Only show labels if there's enough space
    const showLabels = barWidth > 20;
    const labels = g2.selectAll(".bar-label").data(showLabels ? typeDataForBars : [], d => d.type);
    labels.exit().transition().duration(500).style("opacity", 0).remove();
    
    if (showLabels) {
        labels.enter().append("text").attr("class", "bar-label")
            .attr("text-anchor", "middle").attr("font-size", "10px").attr("fill", "#333")
            .attr("x", d => x2_bar(d.type) + x2_bar.bandwidth() / 2).attr("y", d => y2_bar(d.count) - 5)
            .style("opacity", 0)
            .merge(labels)
            .transition().duration(500)
            .attr("x", d => x2_bar(d.type) + x2_bar.bandwidth() / 2)
            .attr("y", d => y2_bar(d.count) - 5)
            .text(d => (d.count > 0 ? d.count : ""))
            .style("opacity", d => (d.count > 0 ? 1 : 0));
    }
}

function buildSankeyData(data) {
    const sankeyNodesDataMap = new Map();
    const sankeyLinksDataMap = new Map();
    
    data.forEach(d => {
        const sourceName = d.Type_1;
        const targetName = d.Generation && d.Generation > 0 ? "Gen " + d.Generation : null;
        
        if (sourceName && !sankeyNodesDataMap.has(sourceName)) {
            sankeyNodesDataMap.set(sourceName, { name: sourceName });
        }
        if (targetName && !sankeyNodesDataMap.has(targetName)) {
            sankeyNodesDataMap.set(targetName, { name: targetName });
        }
        if (sourceName && targetName) {
            const linkKey = `${sourceName}->${targetName}`;
            if (!sankeyLinksDataMap.has(linkKey)) {
                sankeyLinksDataMap.set(linkKey, { source: sourceName, target: targetName, value: 0 });
            }
            sankeyLinksDataMap.get(linkKey).value += 1;
        }
    });
    
    const finalSankeyNodes = Array.from(sankeyNodesDataMap.values());
    const nodeNameToIndex = new Map();
    finalSankeyNodes.forEach((node, i) => { nodeNameToIndex.set(node.name, i); });
    
    const finalSankeyLinks = Array.from(sankeyLinksDataMap.values())
        .map(link => ({
            source: nodeNameToIndex.get(link.source),
            target: nodeNameToIndex.get(link.target),
            value: link.value }))
        .filter(link => link.source !== undefined && link.target !== undefined && link.value > 0);

    return { nodes: finalSankeyNodes, links: finalSankeyLinks };
}

function updateSankeyDiagram(data) {
    // Remove all child elements from the Sankey group to prevent overlapping on redraw
    g3.selectAll("*").remove();
    
    const filteredData = selectedTypes.size === 0 ? 
        data : 
        data.filter(d => selectedTypes.has(d.Type_1));
    
    const sankeyInputData = buildSankeyData(filteredData);

    if (!sankeyInputData.nodes.length || !sankeyInputData.links.length) {
        g3.append("text")
            .attr("x", sankeyContentWidth / 2)
            .attr("y", sankeyContentHeight / 2)
            .attr("text-anchor", "middle")
            .text("No data for Sankey Diagram.");
        return;
    }

    // Scale node width and padding based on available width
    const nodeWidth = Math.max(10, Math.min(20, sankeyContentWidth / 50));
    const nodePadding = Math.max(5, Math.min(15, sankeyContentWidth / 100));
    
    const sankeyLayout = d3.sankey()
        .nodeWidth(nodeWidth)
        .nodePadding(nodePadding)
        .extent([[1, 1], [sankeyContentWidth - 1, sankeyContentHeight - 1]]);

    const { nodes: sankeyComputedNodes, links: sankeyComputedLinks } = sankeyLayout(sankeyInputData);

    const totalFlowValue = d3.sum(sankeyComputedLinks, d => d.value);

    // Create the Sankey diagram links (flows between Pokemon types and generations)
    g3.append("g").attr("class", "sankey-links").selectAll("path")
        .data(sankeyComputedLinks).enter().append("path")
        // Use D3's Sankey link generator to create curved paths
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", d => typeColors[d.source.name.replace("Gen ", "")] || "#aaa")
        .attr("stroke-opacity", 0.5).attr("stroke-width", d => Math.max(1, d.width))
        .attr("fill", "none")
        .sort((a, b) => b.width - a.width)
        .on("mouseover", function(d) {
            const percentage = ((d.value / totalFlowValue) * 100).toFixed(1);
            tooltip.style("display", "block")
                .style("opacity", 0.9)
                .html(`<div style="text-align: center;">
                        <strong>${d.source.name} → ${d.target.name}</strong><br>
                        Count: ${d.value}<br>
                        Percentage: ${percentage}% of total flow
                    </div>`);
            d3.select(this).attr("stroke-opacity", 0.8).attr("stroke-width", d => Math.max(2, d.width + 1));
        })
        .on("mousemove", function() {
            tooltip.style("left", (d3.event.pageX + 10) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            tooltip.style("display", "none").style("opacity", 0);
            d3.select(this).attr("stroke-opacity", 0.5).attr("stroke-width", d => Math.max(1, d.width));
        });

    const sankeyNodeGroup = g3.append("g").attr("class", "sankey-nodes")
        .selectAll("g").data(sankeyComputedNodes).enter().append("g");
    
    sankeyNodeGroup.append("rect")
        .attr("x", d => d.x0).attr("y", d => d.y0)
        .attr("height", d => Math.max(0.5, d.y1 - d.y0))
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", d => typeColors[d.name.replace("Gen ", "")] || (d.name.startsWith("Gen ") ? "#ccc" : "#69b3a2"))
        .attr("stroke", "#333").attr("stroke-width", 0.5)
        .on("mouseover", function(d) {
            const percentage = ((d.value / totalFlowValue) * 100).toFixed(1);
            tooltip.style("display", "block")
                .style("opacity", 0.9)
                .html(`<div style="text-align: center;">
                        <strong>${d.name}</strong><br>
                        Count: ${d.value}<br>
                        Percentage: ${percentage}% of total flow
                    </div>`);
            d3.select(this).attr("stroke", "black").attr("stroke-width", 1);
        })
        .on("mousemove", function() {
            tooltip.style("left", (d3.event.pageX + 10) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            tooltip.style("display", "none").style("opacity", 0);
            d3.select(this).attr("stroke", "#333").attr("stroke-width", 0.5);
        });
    
    // Dynamic font size based on available width
    const fontSize = Math.max(8, Math.min(12, sankeyContentWidth / 80));
    
    sankeyNodeGroup.append("text")
        .attr("x", d => d.x0 < sankeyContentWidth / 2 ? d.x1 + 6 : d.x0 - 6)
        .attr("y", d => (d.y1 + d.y0) / 2).attr("dy", "0.35em")
        .attr("text-anchor", d => d.x0 < sankeyContentWidth / 2 ? "start" : "end")
        .style("font-size", `${fontSize}px`)
        .style("fill", "#000")
        .text(d => {
            // Truncate text if necessary for very narrow displays
            const maxLength = Math.floor(sankeyContentWidth / 50);
            return d.name.length > maxLength && sankeyContentWidth < 400 ? 
                d.name.substring(0, maxLength) + "..." : d.name;
        });
}

// Central filtering and drawing orchestration
function filterAndDrawAll() {
    if (!originalData) return;
    
    // Recalculate dimensions
    calculateDimensions();
    
    // Update SVG size
    svg.attr("width", width).attr("height", height);
    
    // Update plot ranges based on new dimensions
    x1.range([0, scatterContentWidth]);
    y1.range([scatterPlotContentHeight, 0]);
    
    // Update bar chart with dynamic padding
    const barPadding = Math.max(0.1, Math.min(0.3, barChartContentWidth / 1000));
    x2_bar.range([0, barChartContentWidth]).padding(barPadding);
    y2_bar.range([barChartContentHeight, 0]);
    
    // Update positions
    g1.attr("transform", `translate(${scatterMargin.left}, ${scatterMargin.top})`);
    
    // Update axis positions
    xAxisG.attr("transform", `translate(0, ${scatterPlotContentHeight})`);
    const xAxisLabel = g1.select(".x-axis-label");
    const yAxisLabel = g1.select(".y-axis-label");
    xAxisLabel.attr("x", scatterContentWidth / 2).attr("y", scatterPlotContentHeight + scatterMargin.bottom - 10);
    yAxisLabel.attr("x", -scatterPlotContentHeight / 2).attr("y", -scatterMargin.left + 15);
    
    // Reposition bar chart
    const currentPlotYOffset = scatterMargin.top + scatterPlotContentHeight + scatterMargin.bottom + 25;
    g2.attr("transform", `translate(${barChartMargin.left}, ${currentPlotYOffset})`);
    
    // Update bar chart axis positions
    xAxisBarG.attr("transform", `translate(0, ${barChartContentHeight})`);
    g2.select(".bar-chart-x-label")
        .attr("x", barChartContentWidth / 2)
        .attr("y", barChartContentHeight + barChartMargin.bottom - 15);
    g2.select(".bar-chart-y-label")
        .attr("x", -barChartContentHeight / 2)
        .attr("y", -barChartMargin.left + 15);
    
    // Reposition Sankey
    const sankeyYOffset = currentPlotYOffset + barChartMargin.top + barChartContentHeight + barChartMargin.bottom + 25;
    g3.attr("transform", `translate(${sankeyMargin.left}, ${sankeyYOffset})`);
    
    // Filter data
    let filteredDataForPlots = originalData.filter(d => 
        selectedGenerations.includes(d.Generation) && 
        (!showLegendaryOnly || d.isLegendary === "True")
    );
    
    // Update all visualizations
    updateScatterScalesAndAxes();
    updateScatterPlot(filteredDataForPlots);
    drawOrUpdateBarGraph(filteredDataForPlots);
    updateSankeyDiagram(filteredDataForPlots);
}