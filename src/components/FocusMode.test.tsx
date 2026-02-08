/**
 * FocusMode Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FocusMode from './FocusMode';
import { GraphData } from '../types';

const mockData: GraphData = {
  nodes: [
    { id: '1', group: 1, label: 'Node 1', type: 'entry' },
    { id: '2', group: 1, label: 'Node 2', type: 'logic' },
    { id: '3', group: 1, label: 'Node 3', type: 'storage' },
    { id: '4', group: 1, label: 'Node 4', type: 'exit' }
  ],
  links: [
    { source: '1', target: '2', value: 1 },
    { source: '2', target: '3', value: 1 },
    { source: '3', target: '4', value: 1 }
  ]
};

describe('FocusMode', () => {
  it('renders all data when no node is focused', () => {
    const renderSpy = jest.fn();
    render(
      <FocusMode
        data={mockData}
        selectedNodeId={null}
        onClearFocus={() => {}}
      >
        {(data) => {
          renderSpy(data);
          return <div>{data.nodes.length} nodes</div>;
        }}
      </FocusMode>
    );

    expect(renderSpy).toHaveBeenCalledWith(mockData);
    expect(screen.getByText('4 nodes')).toBeInTheDocument();
  });

  it('filters to focused node and its dependencies', () => {
    const renderSpy = jest.fn();
    render(
      <FocusMode
        data={mockData}
        selectedNodeId="2"
        onClearFocus={() => {}}
      >
        {(data) => {
          renderSpy(data);
          return <div>{data.nodes.length} nodes</div>;
        }}
      </FocusMode>
    );

    const filteredData = renderSpy.mock.calls[0][0] as GraphData;
    expect(filteredData.nodes).toHaveLength(3); // Node 2, plus 1 and 3 (connected)
    expect(filteredData.nodes.map(n => n.id).sort()).toEqual(['1', '2', '3']);
  });

  it('filters links to only those between visible nodes', () => {
    const renderSpy = jest.fn();
    render(
      <FocusMode
        data={mockData}
        selectedNodeId="2"
        onClearFocus={() => {}}
      >
        {(data) => {
          renderSpy(data);
          return null;
        }}
      </FocusMode>
    );

    const filteredData = renderSpy.mock.calls[0][0] as GraphData;
    expect(filteredData.links).toHaveLength(2); // 1->2 and 2->3 only
  });

  it('displays focus mode banner when focused', () => {
    render(
      <FocusMode
        data={mockData}
        selectedNodeId="2"
        onClearFocus={() => {}}
      >
        {(data) => <div>{data.nodes.length} nodes</div>}
      </FocusMode>
    );

    expect(screen.getByText(/Focus:/)).toBeInTheDocument();
    expect(screen.getByText('Node 2')).toBeInTheDocument();
  });

  it('calls onClearFocus when clear button is clicked', () => {
    const clearSpy = jest.fn();
    render(
      <FocusMode
        data={mockData}
        selectedNodeId="2"
        onClearFocus={clearSpy}
      >
        {(data) => <div>{data.nodes.length} nodes</div>}
      </FocusMode>
    );

    const clearButton = screen.getByText(/Clear/);
    fireEvent.click(clearButton);

    expect(clearSpy).toHaveBeenCalled();
  });

  it('shows count of hidden nodes', () => {
    render(
      <FocusMode
        data={mockData}
        selectedNodeId="2"
        onClearFocus={() => {}}
      >
        {(data) => <div>{data.nodes.length} nodes</div>}
      </FocusMode>
    );

    expect(screen.getByText(/1 nodes hidden/)).toBeInTheDocument();
  });

  it('handles nodes with no connections gracefully', () => {
    const isolatedData: GraphData = {
      nodes: [
        { id: '1', group: 1, label: 'Node 1', type: 'entry' },
        { id: '2', group: 1, label: 'Isolated', type: 'logic' }
      ],
      links: []
    };

    const renderSpy = jest.fn();
    render(
      <FocusMode
        data={isolatedData}
        selectedNodeId="1"
        onClearFocus={() => {}}
      >
        {(data) => {
          renderSpy(data);
          return null;
        }}
      </FocusMode>
    );

    const filteredData = renderSpy.mock.calls[0][0] as GraphData;
    expect(filteredData.nodes).toHaveLength(1); // Only node 1
    expect(filteredData.links).toHaveLength(0);
  });
});
