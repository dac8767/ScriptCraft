/**
 * CharacterConnectionsGraph (v1.86) — Characters window > Connections tab.
 *
 * Adapted from Derek's Airtable interface extension (D3 force graph with
 * Louvain-style community detection). The Airtable parts are replaced with
 * the script itself: NODES are the script's characters, and a LINK joins two
 * characters each time they share a scene (weight = how many scenes they
 * share — his "encounters" table, derived instead of stored). Same physics:
 * force simulation, drag to pin, wheel to zoom, community colors. Clicking
 * a node opens that character's profile, standing in for expandRecord().
 */
import { useEffect, useMemo, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import * as d3 from 'd3';

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  community?: number;
}
interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  value: number;
}

/** Derek's community detection, verbatim in structure (typed). */
function detectCommunities(nodes: GraphNode[], links: Array<{ source: string; target: string; value: number }>): GraphNode[] {
  const nodeMap = new Map<string, number>();
  nodes.forEach((node, i) => { nodeMap.set(node.id, i); });

  const adjacency: Array<Record<string, number>> = Array(nodes.length).fill(null).map(() => ({}));
  let totalWeight = 0;

  links.forEach((link) => {
    const sourceIdx = nodeMap.get(link.source);
    const targetIdx = nodeMap.get(link.target);
    if (sourceIdx !== undefined && targetIdx !== undefined) {
      adjacency[sourceIdx][targetIdx] = (adjacency[sourceIdx][targetIdx] || 0) + link.value;
      adjacency[targetIdx][sourceIdx] = (adjacency[targetIdx][sourceIdx] || 0) + link.value;
      totalWeight += link.value * 2;
    }
  });
  if (totalWeight === 0) {
    nodes.forEach((n, i) => { n.community = i; });
    return nodes;
  }

  const communities = nodes.map((_, i) => i);
  const degree = adjacency.map((adj) => Object.values(adj).reduce((sum, w) => sum + w, 0));

  function modularityGain(node: number, targetCommunity: number): number {
    let edgesToComm = 0;
    Object.entries(adjacency[node]).forEach(([neighbor, weight]) => {
      if (communities[parseInt(neighbor)] === targetCommunity) edgesToComm += weight;
    });
    const currentComm = communities[node];
    let edgesToCurrentComm = 0;
    Object.entries(adjacency[node]).forEach(([neighbor, weight]) => {
      if (communities[parseInt(neighbor)] === currentComm && parseInt(neighbor) !== node) {
        edgesToCurrentComm += weight;
      }
    });
    const ki = degree[node];
    const sigmaIn = edgesToComm;
    const sigmaTot = nodes.reduce((sum, _, i) => sum + (communities[i] === targetCommunity ? degree[i] : 0), 0);
    return (sigmaIn - edgesToCurrentComm) / totalWeight
      - (sigmaTot * ki - (sigmaTot - ki) * ki) / (totalWeight * totalWeight);
  }

  let improved = true;
  let iterations = 0;
  while (improved && iterations < 10) {
    improved = false;
    iterations++;
    for (let node = 0; node < nodes.length; node++) {
      const currentCommunity = communities[node];
      const neighborCommunities = new Set<number>();
      Object.keys(adjacency[node]).forEach((neighbor) => {
        neighborCommunities.add(communities[parseInt(neighbor)]);
      });
      let bestCommunity = currentCommunity;
      let bestGain = 0;
      neighborCommunities.forEach((comm) => {
        if (comm !== currentCommunity) {
          const gain = modularityGain(node, comm);
          if (gain > bestGain) { bestGain = gain; bestCommunity = comm; }
        }
      });
      if (bestCommunity !== currentCommunity) {
        communities[node] = bestCommunity;
        improved = true;
      }
    }
  }

  const communityMap = new Map<number, number>();
  let nextCommunity = 0;
  communities.forEach((comm, i) => {
    if (!communityMap.has(comm)) communityMap.set(comm, nextCommunity++);
    nodes[i].community = communityMap.get(comm);
  });
  return nodes;
}

/** Normalize a character cue: trim, drop (CONT'D)/(V.O.)/(O.S.) etc. */
function normalizeCue(text: string): string {
  return text.replace(/\(.*?\)/g, '').trim().toUpperCase();
}

/** Scenes → character co-appearances (his "encounter" links, derived).
 *  Exported for the test. */
export function buildConnections(scenes: string[][]): {
  nodes: Array<{ id: string; name: string }>;
  links: Array<{ source: string; target: string; value: number }>;
} {
  const linkMap = new Map<string, { source: string; target: string; value: number }>();
  for (const scene of scenes) {
    const cast = [...new Set(scene)].sort();
    for (let i = 0; i < cast.length; i++) {
      for (let j = i + 1; j < cast.length; j++) {
        const key = `${cast[i]}-${cast[j]}`;
        const existing = linkMap.get(key);
        if (existing) existing.value += 1;
        else linkMap.set(key, { source: cast[i], target: cast[j], value: 1 });
      }
    }
  }
  // Like his version: only characters with at least one connection appear.
  const connected = new Set<string>();
  linkMap.forEach((l) => { connected.add(l.source); connected.add(l.target); });
  return {
    nodes: [...connected].sort().map((name) => ({ id: name, name })),
    links: [...linkMap.values()],
  };
}

function collectScenes(editor: Editor | null): string[][] {
  if (!editor || editor.isDestroyed) return [];
  const scenes: string[][] = [];
  let current: string[] | null = null;
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'sceneHeading') {
      current = [];
      scenes.push(current);
      return false;
    }
    if (node.type.name === 'character') {
      const name = normalizeCue(node.textContent);
      if (name && current) current.push(name);
      return false;
    }
    return true;
  });
  return scenes.filter((s) => s.length > 0);
}

export default function CharacterConnectionsGraph({ editor, onSelectCharacter }: {
  editor: Editor | null;
  onSelectCharacter?: (name: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  const graphData = useMemo(() => {
    const { nodes, links } = buildConnections(collectScenes(editor));
    const simNodes: GraphNode[] = nodes.map((n) => ({ ...n }));
    detectCommunities(simNodes, links);
    return { nodes: simNodes, links: links.map((l) => ({ ...l })) as GraphLink[] };
    // Recomputed each time the tab mounts — the tab unmounts when hidden,
    // so reopening it reflects the current script without live churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    if (graphData.nodes.length === 0) return;

    const width = svgRef.current.clientWidth || 600;
    const height = svgRef.current.clientHeight || 420;
    const g = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => { g.attr('transform', event.transform); });
    svg.call(zoom);

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    const simulation = d3.forceSimulation(graphData.nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(graphData.links).id((d) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    const link = g.append('g')
      .selectAll<SVGLineElement, GraphLink>('line')
      .data(graphData.links)
      .join('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d) => Math.sqrt(d.value));

    const node = g.append('g')
      .selectAll<SVGCircleElement, GraphNode>('circle')
      .data(graphData.nodes)
      .join('circle')
      .attr('r', 8)
      .attr('fill', (d) => colorScale(String(d.community)))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', (_event, d) => { onSelectCharacter?.(d.name); })
      .call(d3.drag<SVGCircleElement, GraphNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        }));

    const label = g.append('g')
      .selectAll<SVGTextElement, GraphNode>('text')
      .data(graphData.nodes)
      .join('text')
      .text((d) => d.name)
      .attr('font-size', 10)
      .attr('dx', 12)
      .attr('dy', 4)
      .attr('fill', 'currentColor')
      .style('pointer-events', 'none');

    node.append('title').text((d) => d.name);

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as GraphNode).x!)
        .attr('y1', (d) => (d.source as GraphNode).y!)
        .attr('x2', (d) => (d.target as GraphNode).x!)
        .attr('y2', (d) => (d.target as GraphNode).y!);
      node.attr('cx', (d) => d.x!).attr('cy', (d) => d.y!);
      label.attr('x', (d) => d.x!).attr('y', (d) => d.y!);
    });

    return () => { simulation.stop(); };
  }, [graphData, onSelectCharacter]);

  return (
    <div className="fs-connections-graph">
      {graphData.nodes.length === 0 ? (
        <div className="fs-connections-empty">
          Connections appear once two characters share a scene — write some
          dialogue under a scene heading and come back.
        </div>
      ) : (
        <svg ref={svgRef} className="fs-connections-svg" />
      )}
    </div>
  );
}
