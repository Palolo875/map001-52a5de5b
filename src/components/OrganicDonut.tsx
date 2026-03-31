import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';

export interface DonutData {
  name: string;
  value: number;
  color: string;
}

interface OrganicDonutProps {
  data: DonutData[];
  totalLabel?: string;
  size?: number;
  thickness?: number;
}

export default function OrganicDonut({
  data,
  totalLabel = "espèces",
  size = 200,
  thickness = 24
}: OrganicDonutProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  
  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    const width = size;
    const height = size;
    const margin = 10;
    const radius = Math.min(width, height) / 2 - margin;
    const innerRadius = radius - thickness;

    // Set up the SVG container
    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    // Create the pie layout
    const pie = d3.pie<DonutData>()
      .value(d => d.value)
      .sort(null)
      .padAngle(0.04); // Space between slices

    // Create the arc generator
    const arc = d3.arc<d3.PieArcDatum<DonutData>>()
      .innerRadius(innerRadius)
      .outerRadius(radius)
      .cornerRadius(thickness / 2); // Rounded corners for organic look

    // Generate pie data
    const pieData = pie(data);

    // Add slices
    const path = g.selectAll("path")
      .data(pieData)
      .join("path")
      .attr("fill", d => d.data.color)
      .attr("stroke", "none")
      .attr("d", arc)
      .style("opacity", 0)
      .style("transform", "scale(0.95)");

    // Animate slices
    path.transition()
      .duration(800)
      .ease(d3.easeCubicOut)
      .style("opacity", 1)
      .style("transform", "scale(1)")
      .attrTween("d", function(d) {
        const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return function(t) {
          return arc(i(t)) || "";
        };
      });

  }, [data, size, thickness]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg ref={svgRef} className="absolute inset-0" />
      <div className="absolute flex flex-col items-center justify-center pointer-events-none text-center">
        <span className="font-serif text-4xl leading-none text-foreground tracking-tight">
          {total}
        </span>
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-1">
          {totalLabel}
        </span>
      </div>
    </div>
  );
}
