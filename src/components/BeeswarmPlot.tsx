import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { Earthquake } from '@/lib/enrichment';

interface BeeswarmPlotProps {
  data: Earthquake[];
  width?: number;
  height?: number;
}

export default function BeeswarmPlot({ data, width = 300, height = 120 }: BeeswarmPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 30, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Scale for depth (X axis)
    const depths = data.map(d => d.depth);
    const minDepth = Math.min(0, ...depths);
    const maxDepth = Math.max(...depths);

    const xScale = d3.scaleLinear()
      .domain([minDepth, maxDepth + 10])
      .range([0, innerWidth]);

    // Scale for magnitude (Radius)
    const rScale = d3.scaleLinear()
      .domain([0, 10])
      .range([2, 12]);

    // Color scale based on magnitude
    const colorScale = (mag: number) => {
      if (mag >= 5) return 'hsl(var(--pastel-red-text))';
      if (mag >= 3) return 'hsl(var(--pastel-yellow-text))';
      return 'hsl(var(--secondary))';
    };

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // X Axis
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(5).tickFormat(d => `${d}km`))
      .call(g => g.select(".domain").attr("stroke", "hsl(var(--border))"))
      .call(g => g.selectAll(".tick line").attr("stroke", "hsl(var(--border))"))
      .call(g => g.selectAll(".tick text").attr("fill", "hsl(var(--muted-foreground))").style("font-family", "monospace").style("font-size", "10px"));

    // Force simulation
    const simulation = d3.forceSimulation(data.map(d => ({ ...d } as any)))
      .force("x", d3.forceX((d: any) => xScale(d.depth)).strength(1))
      .force("y", d3.forceY(innerHeight / 2).strength(0.1))
      .force("collide", d3.forceCollide((d: any) => rScale(d.magnitude) + 1))
      .stop();

    // Run simulation synchronously
    for (let i = 0; i < 120; ++i) simulation.tick();

    const nodes = simulation.nodes();

    // Tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "absolute hidden bg-background border border-border p-2 rounded shadow-sm text-xs pointer-events-none z-50")
      .style("opacity", 0);

    // Draw circles
    g.selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("cx", (d: any) => d.x)
      .attr("cy", (d: any) => d.y)
      .attr("r", 0)
      .attr("fill", (d: any) => colorScale(d.magnitude))
      .attr("stroke", "hsl(var(--background))")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("mouseover", function(event, d: any) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("stroke", "hsl(var(--foreground))")
          .attr("stroke-width", 2);

        tooltip.transition().duration(200).style("opacity", 1).style("display", "block");
        tooltip.html(`
          <div class="flex flex-col gap-1">
            <span class="font-mono text-foreground">M${d.magnitude.toFixed(1)}</span>
            <span class="text-muted-foreground">Prof: ${d.depth} km</span>
            <span class="text-muted-foreground truncate max-w-[150px]">${d.place}</span>
          </div>
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("stroke", "hsl(var(--background))")
          .attr("stroke-width", 1);

        tooltip.transition().duration(500).style("opacity", 0).on("end", function() {
          d3.select(this).style("display", "none");
        });
      })
      .transition()
      .duration(800)
      .delay((_, i) => i * 10)
      .attr("r", (d: any) => rScale(d.magnitude));

    return () => {
      tooltip.remove();
    };
  }, [data, width, height]);

  return (
    <div className="w-full overflow-hidden" ref={(el) => {
      // Setup ResizeObserver to update width dynamically if needed
      // but for now, we'll rely on the parent container passing width or CSS scaling
    }}>
      <svg ref={svgRef} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" />
    </div>
  );
}
